import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { ensureDefaultCoa, parseCompanyId } from '@/lib/accounting/server';

/** GET ?companyId=&seed=1&q= — list CoA; optional seed of defaults when empty */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const seed = request.nextUrl.searchParams.get('seed') === '1';
    const q = request.nextUrl.searchParams.get('q');
    const type = request.nextUrl.searchParams.get('type');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'view');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    let seeded = 0;
    let seedWarning: string | undefined;
    if (seed) {
      const r = await ensureDefaultCoa(companyId);
      seeded = r.seeded;
      seedWarning = r.warning;
    }

    const supabase = getSupabaseServer();
    let query = supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('profile_id', companyId)
      .order('code');

    if (type && type !== 'all') query = query.eq('account_type', type);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        accounts: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_world_class_schema.sql and 20260710_accounting_module.sql',
      });
    }

    let accounts = data || [];
    if (q) {
      const n = q.toLowerCase();
      accounts = accounts.filter(
        (a) =>
          a.code?.toLowerCase().includes(n) ||
          a.name?.toLowerCase().includes(n) ||
          a.account_type?.toLowerCase().includes(n)
      );
    }

    // Compute simple balances from journal lines
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('account_id, debit, credit, journal_entry_id');

    const { data: posted } = await supabase
      .from('journal_entries')
      .select('id, status')
      .eq('profile_id', companyId)
      .eq('status', 'posted');

    const postedIds = new Set((posted || []).map((j) => j.id));
    const bal: Record<number, number> = {};
    for (const l of lines || []) {
      if (!postedIds.has(l.journal_entry_id)) continue;
      const id = Number(l.account_id);
      if (!Number.isFinite(id)) continue;
      bal[id] = (bal[id] || 0) + Number(l.debit || 0) - Number(l.credit || 0);
    }

    const enriched = accounts.map((a) => {
      const raw = bal[a.id] || 0;
      // Present normal balance: liabilities/equity/revenue show credit-positive
      const normal = a.normal_balance || (['liability', 'equity', 'revenue'].includes(a.account_type) ? 'credit' : 'debit');
      const balance = normal === 'credit' ? -raw : raw;
      return { ...a, balance };
    });

    return NextResponse.json({
      success: true,
      accounts: enriched,
      seeded,
      warning: seedWarning,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — create account or seed defaults { companyId, seed: true } or account fields */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    if (body.seed) {
      const r = await ensureDefaultCoa(companyId);
      return NextResponse.json({ success: true, ...r });
    }

    if (!body.code || !body.name || !body.account_type) {
      return NextResponse.json(
        { error: 'code, name, and account_type required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        profile_id: companyId,
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        account_type: body.account_type,
        subtype: body.subtype || null,
        parent_id: body.parent_id || null,
        is_active: body.is_active !== false,
        is_header: !!body.is_header,
        is_system: false,
        currency: body.currency || 'ZAR',
        tax_code: body.tax_code || null,
        normal_balance: body.normal_balance || null,
        description: body.description || null,
        entity_id: body.entity_id || null,
        sort_order: body.sort_order ?? 0,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, account: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** PATCH — update account */
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

    const allowed = [
      'code',
      'name',
      'account_type',
      'subtype',
      'parent_id',
      'is_active',
      'is_header',
      'currency',
      'tax_code',
      'normal_balance',
      'description',
      'entity_id',
      'sort_order',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, account: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** DELETE ?companyId=&id= — deactivate or delete non-system account */
export async function DELETE(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const hard = request.nextUrl.searchParams.get('hard') === '1';

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    if (hard) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('id', id)
        .eq('profile_id', companyId)
        .eq('is_system', false);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
