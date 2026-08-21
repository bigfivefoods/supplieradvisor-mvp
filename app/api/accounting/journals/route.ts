import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import {
  linesAreBalanced,
  nextDocumentNumber,
  parseCompanyId,
  round2,
} from '@/lib/accounting/server';
import {
  requireCompanyAccess,
  requireCompanyPermission,
  legacyPrivyFrom,
  requireVerifiedUser,
} from '@/lib/auth/api-auth';
import { auditLog } from '@/lib/audit/log';
import { isPeriodLocked } from '@/lib/accounting/period-lock';
import { validatePostableLines } from '@/lib/accounting/post-journal';
import { invalidateLearnedPatterns } from '@/lib/banking/learning';
import {
  journalIsReversed,
  resolveLivePostedJournal,
} from '@/lib/accounting/journal-status';
import { invalidateAccountingReads } from '@/lib/accounting/read-cache';

/** GET ?companyId=&status= */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const status = request.nextUrl.searchParams.get('status');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    const idParam = Number(request.nextUrl.searchParams.get('id') || 0);
    const idsParam = String(request.nextUrl.searchParams.get('ids') || '')
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 50);
    const byId = Number.isFinite(idParam) && idParam > 0;
    const byIds = idsParam.length > 0;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const detail = byId || byIds;
    let query = supabase
      .from('journal_entries')
      .select(
        'id, entry_number, entry_date, memo, status, source, source_id, created_by, currency, metadata'
      )
      .eq('profile_id', companyId)
      .order('entry_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(detail ? 50 : 200);

    if (status && status !== 'all') query = query.eq('status', status);
    if (byId) {
      query = query.eq('id', idParam);
    } else if (byIds) {
      query = query.in('id', idsParam);
    } else {
      if (from) query = query.gte('entry_date', from);
      if (to) query = query.lte('entry_date', to);
    }

    const { data: entries, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        entries: [],
        warning: error.message,
        hint: 'Run accounting migrations',
      });
    }

    const ids = (entries || []).map((e) => e.id);
    let lines: Array<Record<string, unknown>> = [];
    if (ids.length) {
      const lined = await supabase
        .from('journal_lines')
        .select('*')
        .in('journal_entry_id', ids);
      lines = (lined.data || []) as Array<Record<string, unknown>>;
    }

    const byEntry: Record<number, typeof lines> = {};
    for (const l of lines) {
      const eid = Number(l.journal_entry_id);
      if (!byEntry[eid]) byEntry[eid] = [];
      byEntry[eid].push(l);
    }

    const enriched = (entries || []).map((e) => {
      const elines = byEntry[e.id] || [];
      const total_debit = round2(elines.reduce((s, l) => s + Number(l.debit || 0), 0));
      const total_credit = round2(elines.reduce((s, l) => s + Number(l.credit || 0), 0));
      return { ...e, lines: elines, total_debit, total_credit };
    });

    return NextResponse.json({ success: true, entries: enriched });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — create journal entry with lines
 * body: { companyId, entry_date, memo, status, lines: [{ account_id, debit, credit, memo }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyPermission(
      request,
      companyId,
      'accounting',
      'write',
      { legacyPrivyUserId: legacyPrivyFrom(request, body) }
    );
    if (!_gate.ok) return _gate.response;
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'At least two journal lines required' },
        { status: 400 }
      );
    }

    const status = body.status === 'draft' ? 'draft' : 'posted';
    const balanced = linesAreBalanced(lines);
    if (status === 'posted' && !balanced.ok) {
      return NextResponse.json(
        {
          error: `Journal must balance. Debits ${balanced.debit} ≠ credits ${balanced.credit}`,
        },
        { status: 400 }
      );
    }
    if (status === 'posted') {
      const mixed = (lines as Array<{ debit?: number; credit?: number }>).find(
        (l) => Number(l.debit || 0) > 0 && Number(l.credit || 0) > 0
      );
      if (mixed) {
        return NextResponse.json(
          { error: 'A journal line cannot carry both a debit and a credit' },
          { status: 400 }
        );
      }
      const checked = await validatePostableLines(
        companyId,
        lines.map(
          (l: { account_id: number; debit?: number; credit?: number }) => ({
            account_id: Number(l.account_id),
            debit: round2(Number(l.debit || 0)),
            credit: round2(Number(l.credit || 0)),
          })
        )
      );
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: 400 });
      }
    }

    const entryDate = body.entry_date || new Date().toISOString().slice(0, 10);
    if (status === 'posted') {
      const lock = await isPeriodLocked(companyId, entryDate);
      if (lock.locked) {
        return NextResponse.json(
          {
            error: `Period ${lock.period_key} is locked. Unlock the period or post as draft.`,
            code: 'PERIOD_LOCKED',
            period_key: lock.period_key,
          },
          { status: 409 }
        );
      }
    }

    const entryNumber =
      body.entry_number || (await nextDocumentNumber(companyId, 'journal'));
    const supabase = getSupabaseServer();

    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        profile_id: companyId,
        entry_number: entryNumber,
        entry_date: entryDate,
        memo: body.memo || null,
        status,
        source: body.source || 'manual',
        source_id: body.source_id || null,
        currency: body.currency || 'ZAR',
        entity_id: body.entity_id || null,
        created_by: _gate.userId || privyUserId || body.created_by || null,
        posted_at: status === 'posted' ? new Date().toISOString() : null,
        metadata: body.metadata || {},
      })
      .select('*')
      .single();

    if (error || !entry) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create journal entry' },
        { status: 400 }
      );
    }

    type JournalLineRow = {
      journal_entry_id: number | string;
      profile_id: number;
      account_id: number;
      debit: number;
      credit: number;
      memo: string | null;
      counterparty: string | null;
      tax_code: string | null;
      business_unit_id: number | null;
      work_center_id: number | null;
      work_station_id: number | null;
      asset_id: number | null;
      purchase_order_id: number | null;
    };

    const lineRows: JournalLineRow[] = lines.map(
      (l: {
        account_id: number;
        debit?: number;
        credit?: number;
        memo?: string;
        counterparty?: string;
        tax_code?: string;
        business_unit_id?: number | null;
        work_center_id?: number | null;
        work_station_id?: number | null;
        asset_id?: number | null;
        purchase_order_id?: number | null;
      }): JournalLineRow => ({
        journal_entry_id: entry.id,
        profile_id: companyId,
        account_id: Number(l.account_id),
        debit: round2(Number(l.debit || 0)),
        credit: round2(Number(l.credit || 0)),
        memo: l.memo || null,
        counterparty: l.counterparty || null,
        tax_code: l.tax_code || null,
        business_unit_id:
          l.business_unit_id != null && Number(l.business_unit_id) > 0
            ? Number(l.business_unit_id)
            : null,
        work_center_id:
          l.work_center_id != null && Number(l.work_center_id) > 0
            ? Number(l.work_center_id)
            : null,
        work_station_id:
          l.work_station_id != null && Number(l.work_station_id) > 0
            ? Number(l.work_station_id)
            : null,
        asset_id:
          l.asset_id != null && Number(l.asset_id) > 0 ? Number(l.asset_id) : null,
        purchase_order_id:
          l.purchase_order_id != null && Number(l.purchase_order_id) > 0
            ? Number(l.purchase_order_id)
            : null,
      })
    );

    let { data: insertedLines, error: lineErr } = await supabase
      .from('journal_lines')
      .insert(lineRows)
      .select('*');

    // Soft retry without cost dimensions if migration not applied
    if (lineErr && /column|schema cache|does not exist/i.test(lineErr.message)) {
      const bare = lineRows.map((row: JournalLineRow) => ({
        journal_entry_id: row.journal_entry_id,
        profile_id: row.profile_id,
        account_id: row.account_id,
        debit: row.debit,
        credit: row.credit,
        memo: row.memo,
        counterparty: row.counterparty,
        tax_code: row.tax_code,
      }));
      const retry = await supabase.from('journal_lines').insert(bare).select('*');
      insertedLines = retry.data;
      lineErr = retry.error;
    }

    if (lineErr) {
      await supabase.from('journal_entries').delete().eq('id', entry.id);
      return NextResponse.json({ error: lineErr.message }, { status: 400 });
    }

    if (status === 'posted') {
      invalidateLearnedPatterns(companyId);
      invalidateAccountingReads(companyId);
    }

    void auditLog({
      companyId,
      actorUserId: _gate.userId,
      action: 'journal.post',
      entityType: 'journal_entry',
      entityId: entry.id,
      summary: `Journal ${entryNumber} ${status}`,
      metadata: {
        status,
        entry_date: entryDate,
        debit: balanced.debit,
        credit: balanced.credit,
        role: _gate.role,
      },
    });

    return NextResponse.json({
      success: true,
      entry: {
        ...entry,
        lines: insertedLines,
        total_debit: balanced.debit,
        total_credit: balanced.credit,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — journal amendments
 * action:
 *  - void | post
 *  - reverse — post reversing entry (swap D/C), mark original void
 *  - update_draft — replace memo/date/lines on a draft only
 *  - correct — reverse original + post new lines as a correcting pair
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyPermission(
      request,
      companyId,
      'accounting',
      'write',
      { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request, body) }
    );
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const action = body.action as string;

    const { data: existing, error: exErr } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (exErr || !existing) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (action === 'void') {
      if (String(existing.status) === 'void') {
        return NextResponse.json({ error: 'Already void' }, { status: 400 });
      }
      if (String(existing.status) === 'posted') {
        return NextResponse.json(
          {
            error:
              'Posted journals cannot be deleted. Reverse them so the audit trail stays intact.',
            code: 'USE_REVERSE',
          },
          { status: 409 }
        );
      }
      const { data, error } = await supabase
        .from('journal_entries')
        .update({ status: 'void', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, entry: data });
    }

    if (action === 'post') {
      if (String(existing.status) !== 'draft') {
        return NextResponse.json({ error: 'Only drafts can be posted' }, { status: 400 });
      }
      const lock = await isPeriodLocked(
        companyId,
        String(existing.entry_date || new Date().toISOString().slice(0, 10))
      );
      if (lock.locked) {
        return NextResponse.json(
          {
            error: `Period ${lock.period_key} is locked`,
            code: 'PERIOD_LOCKED',
            period_key: lock.period_key,
          },
          { status: 409 }
        );
      }
      const { data: lines } = await supabase
        .from('journal_lines')
        .select('debit, credit')
        .eq('journal_entry_id', id);
      const balanced = linesAreBalanced(lines || []);
      if (!balanced.ok) {
        return NextResponse.json(
          { error: `Cannot post unbalanced entry (${balanced.debit} ≠ ${balanced.credit})` },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('journal_entries')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      invalidateLearnedPatterns(companyId);
      invalidateAccountingReads(companyId);
      return NextResponse.json({ success: true, entry: data });
    }

    /** Reverse a posted journal (proper amendment — does not rewrite history) */
    if (action === 'reverse') {
      if (String(existing.status) !== 'posted') {
        return NextResponse.json(
          { error: 'Only posted journals can be reversed (edit drafts instead)' },
          { status: 400 }
        );
      }
      const existingMeta =
        existing.metadata && typeof existing.metadata === 'object'
          ? (existing.metadata as Record<string, unknown>)
          : {};
      if (existingMeta.reversed_by_journal_id) {
        return NextResponse.json(
          {
            error: `Already reversed by journal ${existingMeta.reversed_by_journal_id}`,
            code: 'ALREADY_REVERSED',
          },
          { status: 409 }
        );
      }
      const reverseDate =
        body.entry_date || existing.entry_date || new Date().toISOString().slice(0, 10);
      const revLock = await isPeriodLocked(companyId, String(reverseDate));
      if (revLock.locked) {
        return NextResponse.json(
          {
            error: `Period ${revLock.period_key} is locked. Unlock the period to reverse.`,
            code: 'PERIOD_LOCKED',
            period_key: revLock.period_key,
          },
          { status: 409 }
        );
      }
      const { data: lines } = await supabase
        .from('journal_lines')
        .select('account_id, debit, credit, memo, counterparty, tax_code')
        .eq('journal_entry_id', id);

      if (!lines?.length) {
        return NextResponse.json({ error: 'No lines to reverse' }, { status: 400 });
      }

      const reverseLines = lines.map((l) => ({
        account_id: Number(l.account_id),
        debit: round2(Number(l.credit || 0)),
        credit: round2(Number(l.debit || 0)),
        memo: l.memo ? `Reversal: ${l.memo}` : 'Reversal',
        counterparty: l.counterparty || null,
        tax_code: l.tax_code || null,
      }));

      const balanced = linesAreBalanced(reverseLines);
      if (!balanced.ok) {
        return NextResponse.json(
          { error: `Reverse lines do not balance (${balanced.debit} ≠ ${balanced.credit})` },
          { status: 400 }
        );
      }

      const entryNumber = await nextDocumentNumber(companyId, 'journal');

      const { data: revEntry, error: revErr } = await supabase
        .from('journal_entries')
        .insert({
          profile_id: companyId,
          entry_number: entryNumber,
          entry_date: reverseDate,
          memo:
            body.memo ||
            `Reversal of ${existing.entry_number || `JE-${id}`}${existing.memo ? `: ${existing.memo}` : ''}`,
          status: 'posted',
          source: 'reversal',
          source_id: String(id),
          currency: existing.currency || 'ZAR',
          entity_id: existing.entity_id || null,
          created_by: privyUserId || null,
          posted_at: new Date().toISOString(),
          metadata: {
            reverses_journal_id: id,
            reverses_entry_number: existing.entry_number,
          },
        })
        .select('*')
        .single();

      if (revErr || !revEntry) {
        return NextResponse.json(
          { error: revErr?.message || 'Failed to create reversal' },
          { status: 400 }
        );
      }

      const { data: insertedLines, error: lineErr } = await supabase
        .from('journal_lines')
        .insert(
          reverseLines.map((l) => ({
            journal_entry_id: revEntry.id,
            profile_id: companyId,
            ...l,
          }))
        )
        .select('*');

      if (lineErr) {
        await supabase.from('journal_entries').delete().eq('id', revEntry.id);
        return NextResponse.json({ error: lineErr.message }, { status: 400 });
      }

      // Keep original posted — voiding it AND posting a reverse would invert the books.
      await supabase
        .from('journal_entries')
        .update({
          updated_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata && typeof existing.metadata === 'object'
              ? (existing.metadata as object)
              : {}),
            reversed_by_journal_id: revEntry.id,
            reversed_at: new Date().toISOString(),
          },
        })
        .eq('id', id)
        .eq('profile_id', companyId);

      invalidateAccountingReads(companyId);
      return NextResponse.json({
        success: true,
        reversed: true,
        originalId: id,
        entry: {
          ...revEntry,
          lines: insertedLines,
          total_debit: balanced.debit,
          total_credit: balanced.credit,
        },
      });
    }

    /**
     * Update a draft: replace lines + memo/date.
     * body: { action: 'update_draft', memo?, entry_date?, lines: [...] }
     */
    if (action === 'update_draft' || action === 'edit') {
      if (String(existing.status) !== 'draft') {
        return NextResponse.json(
          {
            error:
              'Only draft journals can be edited in place. For posted entries use Reverse, then post a new journal.',
          },
          { status: 400 }
        );
      }

      const lines = Array.isArray(body.lines) ? body.lines : null;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.memo !== undefined) patch.memo = body.memo;
      if (body.entry_date !== undefined) patch.entry_date = body.entry_date;

      if (lines) {
        if (lines.length < 2) {
          return NextResponse.json({ error: 'At least two lines required' }, { status: 400 });
        }
        const balanced = linesAreBalanced(lines);
        // Drafts may be unbalanced until post — still allow save
        await supabase.from('journal_lines').delete().eq('journal_entry_id', id);
        const { error: lineErr } = await supabase.from('journal_lines').insert(
          lines.map(
            (l: {
              account_id: number;
              debit?: number;
              credit?: number;
              memo?: string;
              counterparty?: string;
              tax_code?: string;
            }) => ({
              journal_entry_id: id,
              profile_id: companyId,
              account_id: Number(l.account_id),
              debit: round2(Number(l.debit || 0)),
              credit: round2(Number(l.credit || 0)),
              memo: l.memo || null,
              counterparty: l.counterparty || null,
              tax_code: l.tax_code || null,
            })
          )
        );
        if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 400 });
        void balanced;
      }

      const { data, error } = await supabase
        .from('journal_entries')
        .update(patch)
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const { data: elines } = await supabase
        .from('journal_lines')
        .select('*')
        .eq('journal_entry_id', id);

      return NextResponse.json({
        success: true,
        entry: { ...data, lines: elines || [] },
      });
    }

    /**
     * Correct a posted journal: reverse original, then post new lines.
     * body: { action: 'correct', lines, memo?, entry_date? }
     * If the original was already reversed, follow the live correction (or
     * post the missing correction when a reverse exists with no replacement).
     */
    if (action === 'correct' || action === 'reclassify' || action === 'edit_posted') {
      if (String(existing.status) !== 'posted') {
        return NextResponse.json(
          { error: 'Correct / reclassify is for posted journals. Edit drafts with update_draft.' },
          { status: 400 }
        );
      }

      let target = existing as typeof existing & { id: number };
      let targetId = id;
      let correctionOnly = false;
      if (journalIsReversed(existing)) {
        const resolved = await resolveLivePostedJournal(companyId, {
          id,
          status: existing.status,
          source: existing.source,
          metadata: existing.metadata,
        });
        if (resolved.live && Number(resolved.live.id) !== Number(id)) {
          target = resolved.live as typeof target;
          targetId = Number(target.id);
        } else {
          correctionOnly = true;
        }
      }

      const newLines = Array.isArray(body.lines) ? body.lines : [];
      if (newLines.length < 2) {
        return NextResponse.json({ error: 'New lines required for correction' }, { status: 400 });
      }
      const balancedNew = linesAreBalanced(newLines);
      if (!balancedNew.ok) {
        return NextResponse.json(
          {
            error: `Correction must balance (${balancedNew.debit} ≠ ${balancedNew.credit})`,
          },
          { status: 400 }
        );
      }
      const checked = await validatePostableLines(
        companyId,
        newLines.map(
          (l: { account_id: number; debit?: number; credit?: number }) => ({
            account_id: Number(l.account_id),
            debit: round2(Number(l.debit || 0)),
            credit: round2(Number(l.credit || 0)),
          })
        )
      );
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: 400 });
      }

      const revDate =
        body.entry_date ||
        target.entry_date ||
        existing.entry_date ||
        new Date().toISOString().slice(0, 10);
      const corrLock = await isPeriodLocked(companyId, String(revDate));
      if (corrLock.locked) {
        return NextResponse.json(
          {
            error: `Period ${corrLock.period_key} is locked. Unlock the period to reclassify.`,
            code: 'PERIOD_LOCKED',
            period_key: corrLock.period_key,
          },
          { status: 409 }
        );
      }

      const dropJournal = async (journalId: number) => {
        await supabase.from('journal_lines').delete().eq('journal_entry_id', journalId);
        await supabase.from('journal_entries').delete().eq('id', journalId);
      };

      let revEntry: typeof existing | null = null;
      if (!correctionOnly) {
        const { data: oldLines } = await supabase
          .from('journal_lines')
          .select('account_id, debit, credit, memo, counterparty, tax_code')
          .eq('journal_entry_id', targetId);

        if (!oldLines?.length) {
          return NextResponse.json({ error: 'No lines to reverse' }, { status: 400 });
        }

        const reverseLines = oldLines.map((l) => ({
          account_id: Number(l.account_id),
          debit: round2(Number(l.credit || 0)),
          credit: round2(Number(l.debit || 0)),
          memo: l.memo ? `Reversal: ${l.memo}` : 'Reversal',
          counterparty: l.counterparty || null,
          tax_code: l.tax_code || null,
        }));
        const revNumber = await nextDocumentNumber(companyId, 'journal');
        const insertedRev = await supabase
          .from('journal_entries')
          .insert({
            profile_id: companyId,
            entry_number: revNumber,
            entry_date: revDate,
            memo: `Reversal before correction of ${target.entry_number || `JE-${targetId}`}`,
            status: 'posted',
            source: 'reversal',
            source_id: String(targetId),
            currency: target.currency || existing.currency || 'ZAR',
            created_by: privyUserId || null,
            posted_at: new Date().toISOString(),
            metadata: { reverses_journal_id: targetId, part_of_correction: true },
          })
          .select('*')
          .single();

        if (insertedRev.error || !insertedRev.data) {
          return NextResponse.json(
            { error: insertedRev.error?.message || 'Failed to reverse original' },
            { status: 400 }
          );
        }
        revEntry = insertedRev.data;

        const { error: revLineErr } = await supabase.from('journal_lines').insert(
          reverseLines.map((l) => ({
            journal_entry_id: revEntry!.id,
            profile_id: companyId,
            ...l,
          }))
        );
        if (revLineErr) {
          await dropJournal(Number(revEntry.id));
          return NextResponse.json({ error: revLineErr.message }, { status: 400 });
        }
      } else {
        const existingRevId = Number(
          (existing.metadata && typeof existing.metadata === 'object'
            ? (existing.metadata as Record<string, unknown>).reversed_by_journal_id
            : 0) || 0
        );
        if (Number.isFinite(existingRevId) && existingRevId > 0) {
          const { data: existingRev } = await supabase
            .from('journal_entries')
            .select('*')
            .eq('id', existingRevId)
            .eq('profile_id', companyId)
            .maybeSingle();
          revEntry = existingRev || null;
        }
      }

      const corrNumber = await nextDocumentNumber(companyId, 'journal');
      const originLabel = existing.entry_number || `JE-${id}`;
      const { data: corrEntry, error: corrErr } = await supabase
        .from('journal_entries')
        .insert({
          profile_id: companyId,
          entry_number: corrNumber,
          entry_date: revDate,
          memo: body.memo || `Correction of ${originLabel}`,
          status: 'posted',
          source: 'correction',
          source_id: String(targetId),
          currency: target.currency || existing.currency || 'ZAR',
          created_by: privyUserId || null,
          posted_at: new Date().toISOString(),
          metadata: {
            corrects_journal_id: targetId,
            reverse_journal_id: revEntry?.id || null,
            originally_journal_id: id,
          },
        })
        .select('*')
        .single();

      if (corrErr || !corrEntry) {
        if (revEntry && !correctionOnly) await dropJournal(Number(revEntry.id));
        return NextResponse.json(
          { error: corrErr?.message || 'Failed to post correction' },
          { status: 400 }
        );
      }

      const { data: insertedLines, error: lineErr } = await supabase
        .from('journal_lines')
        .insert(
          newLines.map(
            (l: {
              account_id: number;
              debit?: number;
              credit?: number;
              memo?: string;
              counterparty?: string;
              tax_code?: string;
            }) => ({
              journal_entry_id: corrEntry.id,
              profile_id: companyId,
              account_id: Number(l.account_id),
              debit: round2(Number(l.debit || 0)),
              credit: round2(Number(l.credit || 0)),
              memo: l.memo || null,
              counterparty: l.counterparty || null,
              tax_code: l.tax_code || null,
            })
          )
        )
        .select('*');

      if (lineErr) {
        await dropJournal(Number(corrEntry.id));
        if (revEntry && !correctionOnly) await dropJournal(Number(revEntry.id));
        return NextResponse.json({ error: lineErr.message }, { status: 400 });
      }

      if (!correctionOnly && revEntry) {
        const stampMeta = {
          ...(target.metadata && typeof target.metadata === 'object'
            ? (target.metadata as Record<string, unknown>)
            : {}),
          reversed_by_journal_id: revEntry.id,
          reversed_at: new Date().toISOString(),
        };
        let stamped = false;
        for (let i = 0; i < 3 && !stamped; i += 1) {
          const { error: stampErr } = await supabase
            .from('journal_entries')
            .update({
              updated_at: new Date().toISOString(),
              metadata: stampMeta,
            })
            .eq('id', targetId)
            .eq('profile_id', companyId);
          if (!stampErr) stamped = true;
        }
        if (!stamped) {
          await dropJournal(Number(corrEntry.id));
          await dropJournal(Number(revEntry.id));
          return NextResponse.json(
            {
              error:
                'Could not mark the original as reversed. Nothing was posted — try again.',
            },
            { status: 500 }
          );
        }
      }

      invalidateLearnedPatterns(companyId);
      invalidateAccountingReads(companyId);
      return NextResponse.json({
        success: true,
        corrected: true,
        reverseEntry: revEntry,
        superseded: originLabel,
        followed_journal_id: targetId !== id ? targetId : undefined,
        entry: {
          ...corrEntry,
          lines: insertedLines,
          total_debit: balancedNew.debit,
          total_credit: balancedNew.credit,
        },
      });
    }

    // Simple header patch (draft or posted memo only)
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.memo !== undefined) patch.memo = body.memo;
    if (body.entry_date !== undefined && String(existing.status) === 'draft') {
      patch.entry_date = body.entry_date;
    }
    if (Object.keys(patch).length <= 1) {
      return NextResponse.json(
        {
          error:
            'Nothing to update. Use action void | post | reverse | update_draft | correct | reclassify',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, entry: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
