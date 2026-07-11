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

/** GET ?companyId=&status= */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const status = request.nextUrl.searchParams.get('status');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('profile_id', companyId)
      .order('entry_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(200);

    if (status && status !== 'all') query = query.eq('status', status);

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
      const { data: lineRows } = await supabase
        .from('journal_lines')
        .select('*')
        .in('journal_entry_id', ids);
      lines = lineRows || [];
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

    const lineRows = lines.map(
      (l: {
        account_id: number;
        debit?: number;
        credit?: number;
        memo?: string;
        counterparty?: string;
        tax_code?: string;
      }) => ({
        journal_entry_id: entry.id,
        profile_id: companyId,
        account_id: Number(l.account_id),
        debit: round2(Number(l.debit || 0)),
        credit: round2(Number(l.credit || 0)),
        memo: l.memo || null,
        counterparty: l.counterparty || null,
        tax_code: l.tax_code || null,
      })
    );

    const { data: insertedLines, error: lineErr } = await supabase
      .from('journal_lines')
      .insert(lineRows)
      .select('*');

    if (lineErr) {
      await supabase.from('journal_entries').delete().eq('id', entry.id);
      return NextResponse.json({ error: lineErr.message }, { status: 400 });
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
      const reverseDate =
        body.entry_date || existing.entry_date || new Date().toISOString().slice(0, 10);

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

      // Mark original void so it no longer affects open reports that filter void
      await supabase
        .from('journal_entries')
        .update({
          status: 'void',
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
     */
    if (action === 'correct') {
      if (String(existing.status) !== 'posted') {
        return NextResponse.json(
          { error: 'Correct is for posted journals. Edit drafts with update_draft.' },
          { status: 400 }
        );
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

      const { data: oldLines } = await supabase
        .from('journal_lines')
        .select('account_id, debit, credit, memo, counterparty, tax_code')
        .eq('journal_entry_id', id);

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

      const revDate =
        body.entry_date || existing.entry_date || new Date().toISOString().slice(0, 10);
      const revNumber = await nextDocumentNumber(companyId, 'journal');
      const { data: revEntry, error: revErr } = await supabase
        .from('journal_entries')
        .insert({
          profile_id: companyId,
          entry_number: revNumber,
          entry_date: revDate,
          memo: `Reversal before correction of ${existing.entry_number || `JE-${id}`}`,
          status: 'posted',
          source: 'reversal',
          source_id: String(id),
          currency: existing.currency || 'ZAR',
          created_by: privyUserId || null,
          posted_at: new Date().toISOString(),
          metadata: { reverses_journal_id: id, part_of_correction: true },
        })
        .select('*')
        .single();

      if (revErr || !revEntry) {
        return NextResponse.json(
          { error: revErr?.message || 'Failed to reverse original' },
          { status: 400 }
        );
      }

      const { error: revLineErr } = await supabase.from('journal_lines').insert(
        reverseLines.map((l) => ({
          journal_entry_id: revEntry.id,
          profile_id: companyId,
          ...l,
        }))
      );
      if (revLineErr) {
        await supabase.from('journal_entries').delete().eq('id', revEntry.id);
        return NextResponse.json({ error: revLineErr.message }, { status: 400 });
      }

      await supabase
        .from('journal_entries')
        .update({ status: 'void', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', companyId);

      const corrNumber = await nextDocumentNumber(companyId, 'journal');
      const { data: corrEntry, error: corrErr } = await supabase
        .from('journal_entries')
        .insert({
          profile_id: companyId,
          entry_number: corrNumber,
          entry_date: revDate,
          memo: body.memo || `Correction of ${existing.entry_number || `JE-${id}`}`,
          status: 'posted',
          source: 'correction',
          source_id: String(id),
          currency: existing.currency || 'ZAR',
          created_by: privyUserId || null,
          posted_at: new Date().toISOString(),
          metadata: {
            corrects_journal_id: id,
            reverse_journal_id: revEntry.id,
          },
        })
        .select('*')
        .single();

      if (corrErr || !corrEntry) {
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
        await supabase.from('journal_entries').delete().eq('id', corrEntry.id);
        return NextResponse.json({ error: lineErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        corrected: true,
        reverseEntry: revEntry,
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
            'Nothing to update. Use action void | post | reverse | update_draft | correct',
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
