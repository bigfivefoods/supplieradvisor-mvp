import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

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

    const allocationStatus = request.nextUrl.searchParams.get('allocation_status');
    const limit = Math.min(1000, Number(request.nextUrl.searchParams.get('limit') || 500) || 500);

    let transactions: unknown[] = [];
    if (include === 'transactions' || accountId || allocationStatus) {
      let tq = supabase
        .from('bank_transactions')
        .select('*')
        .eq('profile_id', companyId)
        .order('txn_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      if (accountId) tq = tq.eq('bank_account_id', Number(accountId));
      if (allocationStatus && allocationStatus !== 'all') {
        tq = tq.eq('allocation_status', allocationStatus);
      }
      const { data: txns } = await tq;
      // Normalize legacy columns (tx_date) for the UI
      transactions = (txns || []).map((t: Record<string, unknown>) => {
        const txn_date =
          t.txn_date ||
          (t.tx_date ? String(t.tx_date).slice(0, 10) : null) ||
          null;
        return {
          ...t,
          txn_date,
          status: t.status || 'unreconciled',
          allocation_status: t.allocation_status || 'unallocated',
          currency: t.currency || 'ZAR',
        };
      });

      try {
        const { proposeForTransactions } = await import('@/lib/banking/learning');
        const proposals = await proposeForTransactions(
          companyId,
          transactions as Array<{
            id: number | string;
            description?: string | null;
            counterparty_name?: string | null;
            amount: number;
            allocation_status?: string | null;
          }>
        );
        if (proposals.size) {
          transactions = (
            transactions as Array<Record<string, unknown>>
          ).map((t) => {
            const p = proposals.get(String(t.id));
            return p ? { ...t, proposal: p } : t;
          });
        }
      } catch {
        /* proposals are optional */
      }
    }

    // Allocation pulse
    const { data: allocRows } = await supabase
      .from('bank_transactions')
      .select('allocation_status, amount')
      .eq('profile_id', companyId);
    const pulse = {
      unallocated: 0,
      allocated: 0,
      matched_invoice: 0,
      excluded: 0,
      unallocatedIn: 0,
      unallocatedOut: 0,
    };
    for (const r of allocRows || []) {
      const s = String(r.allocation_status || 'unallocated');
      if (s === 'allocated') pulse.allocated++;
      else if (s === 'matched_invoice') pulse.matched_invoice++;
      else if (s === 'excluded') pulse.excluded++;
      else {
        pulse.unallocated++;
        const amt = Number(r.amount || 0);
        if (amt > 0) pulse.unallocatedIn += amt;
        else pulse.unallocatedOut += Math.abs(amt);
      }
    }

    return NextResponse.json({
      success: true,
      accounts: enriched,
      transactions,
      pulse,
    });
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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

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

    /**
     * Set or adjust the statement/book balance on a bank account.
     * body: { bank_account_id | id, current_balance, as_of?, note?, record_adjustment? }
     * - Sets current_balance absolutely
     * - Optionally inserts a signed adjustment transaction for the delta
     * - Stores audit trail in metadata.balance_updates
     */
    if (action === 'set_balance' || action === 'update_balance') {
      const bankId = Number(body.bank_account_id ?? body.id);
      if (!Number.isFinite(bankId) || bankId <= 0) {
        return NextResponse.json(
          { error: 'bank_account_id required' },
          { status: 400 }
        );
      }
      if (body.current_balance == null || body.current_balance === '') {
        return NextResponse.json(
          { error: 'current_balance required' },
          { status: 400 }
        );
      }
      const newBal = round2(Number(body.current_balance));
      if (!Number.isFinite(newBal)) {
        return NextResponse.json(
          { error: 'current_balance must be a number' },
          { status: 400 }
        );
      }

      const { data: bank, error: loadErr } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', bankId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 400 });
      }
      if (!bank) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 }
        );
      }

      const prev = round2(Number(bank.current_balance || 0));
      const delta = round2(newBal - prev);
      const asOf =
        body.as_of && String(body.as_of).slice(0, 10)
          ? String(body.as_of).slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const note = body.note ? String(body.note).trim() : null;
      const recordAdjustment = body.record_adjustment !== false && delta !== 0;

      let adjustmentTxn: Record<string, unknown> | null = null;
      if (recordAdjustment && delta !== 0) {
        const txnPayload: Record<string, unknown> = {
          profile_id: companyId,
          bank_account_id: bankId,
          txn_date: asOf,
          description:
            note || `Balance adjustment to ${newBal} (was ${prev})`,
          reference: 'BALANCE_ADJ',
          amount: delta,
          currency: bank.currency || 'ZAR',
          status: 'reconciled',
          allocation_status: 'excluded',
          metadata: {
            kind: 'balance_adjustment',
            previous_balance: prev,
            new_balance: newBal,
            as_of: asOf,
            note,
          },
        };
        let { data: txn, error: txnErr } = await supabase
          .from('bank_transactions')
          .insert(txnPayload)
          .select('*')
          .single();
        if (txnErr && /allocation_status|column|schema cache/i.test(txnErr.message)) {
          delete txnPayload.allocation_status;
          const retry = await supabase
            .from('bank_transactions')
            .insert(txnPayload)
            .select('*')
            .single();
          txn = retry.data;
          txnErr = retry.error;
        }
        if (txnErr) {
          // Soft: still set balance if txn insert fails (legacy schema)
          console.warn('balance adjustment txn:', txnErr.message);
        } else {
          adjustmentTxn = txn as Record<string, unknown>;
        }
      }

      const meta =
        bank.metadata && typeof bank.metadata === 'object'
          ? { ...(bank.metadata as Record<string, unknown>) }
          : {};
      const history = Array.isArray(meta.balance_updates)
        ? [...(meta.balance_updates as unknown[])]
        : [];
      history.unshift({
        at: new Date().toISOString(),
        as_of: asOf,
        previous: prev,
        current: newBal,
        delta,
        note,
        by: _gate.userId,
      });
      meta.balance_updates = history.slice(0, 50);
      meta.balance_as_of = asOf;
      meta.last_balance_set_at = new Date().toISOString();

      const { data: updated, error: upErr } = await supabase
        .from('bank_accounts')
        .update({
          current_balance: newBal,
          metadata: meta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bankId)
        .eq('profile_id', companyId)
        .select('*')
        .single();

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        account: updated,
        previous_balance: prev,
        new_balance: newBal,
        delta,
        adjustment: adjustmentTxn,
      });
    }

    if (action === 'reconcile' || action === 'unreconcile') {
      const rawId = body.id ?? body.transaction_id;
      const id =
        rawId == null || rawId === ''
          ? null
          : typeof rawId === 'number'
            ? rawId
            : /^\d+$/.test(String(rawId))
              ? Number(rawId)
              : String(rawId);
      if (id == null || id === '' || (typeof id === 'number' && !Number.isFinite(id))) {
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
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const allowed = [
      'name',
      'bank_name',
      'account_number',
      'account_type',
      'currency',
      'opening_balance',
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
      if (body[k] !== undefined) {
        if (
          k === 'current_balance' ||
          k === 'opening_balance' ||
          k === 'gl_account_id' ||
          k === 'entity_id'
        ) {
          const n = body[k] === '' || body[k] == null ? null : Number(body[k]);
          patch[k] =
            n != null && Number.isFinite(n)
              ? k === 'gl_account_id' || k === 'entity_id'
                ? n
                : round2(n)
              : null;
        } else if (k === 'is_default') {
          patch[k] = Boolean(body[k]);
        } else {
          patch[k] = body[k];
        }
      }
    }

    // Audit when current_balance is set via PATCH
    const supabase = getSupabaseServer();
    if (body.current_balance !== undefined) {
      const { data: existing } = await supabase
        .from('bank_accounts')
        .select('current_balance, metadata')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (existing) {
        const prev = round2(Number(existing.current_balance || 0));
        const next = round2(Number(body.current_balance));
        const meta =
          existing.metadata && typeof existing.metadata === 'object'
            ? { ...(existing.metadata as Record<string, unknown>) }
            : {};
        const history = Array.isArray(meta.balance_updates)
          ? [...(meta.balance_updates as unknown[])]
          : [];
        history.unshift({
          at: new Date().toISOString(),
          previous: prev,
          current: next,
          delta: round2(next - prev),
          note: body.note ? String(body.note) : 'Updated via account edit',
          by: _gate.userId,
        });
        meta.balance_updates = history.slice(0, 50);
        meta.balance_as_of =
          body.as_of || new Date().toISOString().slice(0, 10);
        patch.metadata = meta;
      }
    }

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
