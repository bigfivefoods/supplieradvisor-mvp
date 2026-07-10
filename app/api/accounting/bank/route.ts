import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';

/** GET ?companyId=&include=transactions */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const include = request.nextUrl.searchParams.get('include');
    const accountId = request.nextUrl.searchParams.get('accountId');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'view');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { data: accounts, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('profile_id', companyId)
      .order('name');

    if (error) {
      return NextResponse.json({
        success: true,
        accounts: [],
        transactions: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260710_accounting_module.sql',
      });
    }

    const { data: unrec } = await supabase
      .from('bank_transactions')
      .select('bank_account_id')
      .eq('profile_id', companyId)
      .eq('status', 'unreconciled');

    const unrecCount: Record<number, number> = {};
    for (const t of unrec || []) {
      const id = Number(t.bank_account_id);
      unrecCount[id] = (unrecCount[id] || 0) + 1;
    }

    const enriched = (accounts || []).map((a) => ({
      ...a,
      unreconciled_count: unrecCount[a.id] || 0,
    }));

    let transactions: unknown[] = [];
    if (include === 'transactions' || accountId) {
      let tq = supabase
        .from('bank_transactions')
        .select('*')
        .eq('profile_id', companyId)
        .order('txn_date', { ascending: false })
        .limit(200);
      if (accountId) tq = tq.eq('bank_account_id', Number(accountId));
      const { data: txns } = await tq;
      transactions = txns || [];
    }

    return NextResponse.json({ success: true, accounts: enriched, transactions });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — create bank account OR bank transaction OR reconcile
 * body.action: 'account' | 'transaction' | 'reconcile' | 'unreconcile'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const action = (body.action || 'account') as string;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    if (action === 'account') {
      if (!body.name) {
        return NextResponse.json({ error: 'name required' }, { status: 400 });
      }
      const opening = round2(Number(body.opening_balance || 0));
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          profile_id: companyId,
          name: body.name,
          bank_name: body.bank_name || null,
          account_number: body.account_number || null,
          account_type: body.account_type || 'current',
          currency: body.currency || 'ZAR',
          opening_balance: opening,
          current_balance: body.current_balance != null ? Number(body.current_balance) : opening,
          is_default: !!body.is_default,
          status: 'active',
          provider: body.provider || 'manual',
          wallet_address: body.wallet_address || null,
          gl_account_id: body.gl_account_id || null,
          entity_id: body.entity_id || null,
          metadata: body.metadata || {},
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, account: data });
    }

    if (action === 'transaction') {
      if (!body.bank_account_id) {
        return NextResponse.json({ error: 'bank_account_id required' }, { status: 400 });
      }
      const amount = round2(Number(body.amount || 0));
      const { data, error } = await supabase
        .from('bank_transactions')
        .insert({
          profile_id: companyId,
          bank_account_id: Number(body.bank_account_id),
          txn_date: body.txn_date || new Date().toISOString().slice(0, 10),
          description: body.description || null,
          reference: body.reference || null,
          amount,
          currency: body.currency || 'ZAR',
          status: 'unreconciled',
          metadata: body.metadata || {},
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // Adjust bank balance
      const { data: bank } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', Number(body.bank_account_id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (bank) {
        await supabase
          .from('bank_accounts')
          .update({
            current_balance: round2(Number(bank.current_balance || 0) + amount),
            updated_at: new Date().toISOString(),
          })
          .eq('id', Number(body.bank_account_id));
      }

      return NextResponse.json({ success: true, transaction: data });
    }

    if (action === 'reconcile' || action === 'unreconcile') {
      const id = Number(body.id || body.transaction_id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'transaction id required' }, { status: 400 });
      }
      const status = action === 'reconcile' ? 'reconciled' : 'unreconciled';
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (action === 'reconcile') {
        if (body.matched_payment_id) patch.matched_payment_id = body.matched_payment_id;
        if (body.matched_journal_id) patch.matched_journal_id = body.matched_journal_id;
      } else {
        patch.matched_payment_id = null;
        patch.matched_journal_id = null;
      }
      const { data, error } = await supabase
        .from('bank_transactions')
        .update(patch)
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, transaction: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** PATCH bank account */
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
      'name',
      'bank_name',
      'account_number',
      'account_type',
      'currency',
      'current_balance',
      'is_default',
      'status',
      'provider',
      'wallet_address',
      'gl_account_id',
      'entity_id',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('bank_accounts')
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
