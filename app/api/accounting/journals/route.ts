import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import {
  linesAreBalanced,
  nextDocumentNumber,
  parseCompanyId,
  round2,
} from '@/lib/accounting/server';

/** GET ?companyId=&status= */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const status = request.nextUrl.searchParams.get('status');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'view');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

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
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
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

    const entryNumber =
      body.entry_number || (await nextDocumentNumber(companyId, 'journal'));
    const supabase = getSupabaseServer();

    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        profile_id: companyId,
        entry_number: entryNumber,
        entry_date: body.entry_date || new Date().toISOString().slice(0, 10),
        memo: body.memo || null,
        status,
        source: body.source || 'manual',
        source_id: body.source_id || null,
        currency: body.currency || 'ZAR',
        entity_id: body.entity_id || null,
        created_by: privyUserId || body.created_by || null,
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

/** PATCH — void or post draft { companyId, id, action: 'void' | 'post' } */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const action = body.action as string;

    if (action === 'void') {
      const { data, error } = await supabase
        .from('journal_entries')
        .update({ status: 'void' })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, entry: data });
    }

    if (action === 'post') {
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
        .update({ status: 'posted', posted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, entry: data });
    }

    const patch: Record<string, unknown> = {};
    if (body.memo !== undefined) patch.memo = body.memo;
    if (body.entry_date !== undefined) patch.entry_date = body.entry_date;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
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
