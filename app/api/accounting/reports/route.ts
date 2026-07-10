import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { invoiceBalance } from '@/lib/accounting/types';

/**
 * GET ?companyId=&report=trial_balance|pnl|balance_sheet|ar_aging|ap_aging|cashflow
 * Optional: from=&to= (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const report = request.nextUrl.searchParams.get('report') || 'trial_balance';
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'view');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    if (report === 'ar_aging' || report === 'ap_aging') {
      const direction = report === 'ar_aging' ? 'receivable' : 'payable';
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('profile_id', companyId)
        .eq('direction', direction)
        .not('status', 'in', '("paid","void","cancelled")');

      if (error) {
        return NextResponse.json({ success: true, report, rows: [], warning: error.message });
      }

      const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
      const rows = (invoices || [])
        .map((inv) => {
          const bal = invoiceBalance(inv);
          if (bal <= 0) return null;
          const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.issue_date || Date.now());
          const days = Math.floor((Date.now() - due.getTime()) / (86400 * 1000));
          let bucket = 'current';
          if (days > 90) {
            bucket = 'd90_plus';
            buckets.d90_plus += bal;
          } else if (days > 60) {
            bucket = 'd61_90';
            buckets.d61_90 += bal;
          } else if (days > 30) {
            bucket = 'd31_60';
            buckets.d31_60 += bal;
          } else if (days > 0) {
            bucket = 'd1_30';
            buckets.d1_30 += bal;
          } else {
            buckets.current += bal;
          }
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            counterparty_name: inv.counterparty_name,
            due_date: inv.due_date,
            balance_due: bal,
            days_overdue: Math.max(0, days),
            bucket,
          };
        })
        .filter(Boolean);

      return NextResponse.json({
        success: true,
        report,
        buckets,
        rows,
        total: Object.values(buckets).reduce((s, v) => s + v, 0),
      });
    }

    if (report === 'cashflow') {
      let payQ = supabase
        .from('payments')
        .select('*')
        .eq('profile_id', companyId)
        .order('paid_at', { ascending: false })
        .limit(500);
      if (from) payQ = payQ.gte('paid_at', `${from}T00:00:00`);
      if (to) payQ = payQ.lte('paid_at', `${to}T23:59:59`);
      const { data: payments, error } = await payQ;
      if (error) {
        return NextResponse.json({ success: true, report, rows: [], warning: error.message });
      }
      let inflow = 0;
      let outflow = 0;
      for (const p of payments || []) {
        const amt = Number(p.amount || 0);
        if (p.direction === 'inbound') inflow += amt;
        else outflow += amt;
      }
      return NextResponse.json({
        success: true,
        report,
        summary: {
          inflow: round2(inflow),
          outflow: round2(outflow),
          net: round2(inflow - outflow),
          count: (payments || []).length,
        },
        rows: payments || [],
      });
    }

    // GL-based reports: trial balance, P&L, balance sheet
    const { data: accounts, error: accErr } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('profile_id', companyId)
      .eq('is_active', true)
      .order('code');

    if (accErr) {
      return NextResponse.json({
        success: true,
        report,
        rows: [],
        warning: accErr.message,
      });
    }

    let jeQ = supabase
      .from('journal_entries')
      .select('id, entry_date, status')
      .eq('profile_id', companyId)
      .eq('status', 'posted');
    if (from) jeQ = jeQ.gte('entry_date', from);
    if (to) jeQ = jeQ.lte('entry_date', to);
    const { data: entries } = await jeQ;
    const entryIds = (entries || []).map((e) => e.id);

    let lines: Array<{ account_id: number; debit: number; credit: number }> = [];
    if (entryIds.length) {
      // chunk if large
      const { data: lineRows } = await supabase
        .from('journal_lines')
        .select('account_id, debit, credit')
        .in('journal_entry_id', entryIds);
      lines = (lineRows || []).map((l) => ({
        account_id: Number(l.account_id),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      }));
    }

    const totals: Record<number, { debit: number; credit: number }> = {};
    for (const l of lines) {
      if (!totals[l.account_id]) totals[l.account_id] = { debit: 0, credit: 0 };
      totals[l.account_id].debit += l.debit;
      totals[l.account_id].credit += l.credit;
    }

    if (report === 'trial_balance') {
      const rows = (accounts || [])
        .filter((a) => !a.is_header)
        .map((a) => {
          const t = totals[a.id] || { debit: 0, credit: 0 };
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            account_type: a.account_type,
            debit: round2(t.debit),
            credit: round2(t.credit),
            net: round2(t.debit - t.credit),
          };
        })
        .filter((r) => r.debit !== 0 || r.credit !== 0);

      const sumDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
      const sumCredit = round2(rows.reduce((s, r) => s + r.credit, 0));

      return NextResponse.json({
        success: true,
        report,
        rows,
        totals: { debit: sumDebit, credit: sumCredit, balanced: Math.abs(sumDebit - sumCredit) < 0.02 },
        period: { from, to },
      });
    }

    if (report === 'pnl') {
      const plTypes = new Set(['revenue', 'expense', 'cogs']);
      const rows = (accounts || [])
        .filter((a) => plTypes.has(String(a.account_type)) && !a.is_header)
        .map((a) => {
          const t = totals[a.id] || { debit: 0, credit: 0 };
          // revenue credit-positive; expense/cogs debit-positive
          const amount =
            a.account_type === 'revenue'
              ? round2(t.credit - t.debit)
              : round2(t.debit - t.credit);
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            account_type: a.account_type,
            amount,
          };
        })
        .filter((r) => r.amount !== 0);

      const revenue = round2(
        rows.filter((r) => r.account_type === 'revenue').reduce((s, r) => s + r.amount, 0)
      );
      const cogs = round2(
        rows.filter((r) => r.account_type === 'cogs').reduce((s, r) => s + r.amount, 0)
      );
      const expenses = round2(
        rows.filter((r) => r.account_type === 'expense').reduce((s, r) => s + r.amount, 0)
      );
      const grossProfit = round2(revenue - cogs);
      const netIncome = round2(grossProfit - expenses);

      return NextResponse.json({
        success: true,
        report,
        rows,
        summary: { revenue, cogs, grossProfit, expenses, netIncome },
        period: { from, to },
      });
    }

    if (report === 'balance_sheet') {
      const bsTypes = new Set(['asset', 'liability', 'equity']);
      const rows = (accounts || [])
        .filter((a) => bsTypes.has(String(a.account_type)) && !a.is_header)
        .map((a) => {
          const t = totals[a.id] || { debit: 0, credit: 0 };
          const amount =
            a.account_type === 'asset'
              ? round2(t.debit - t.credit)
              : round2(t.credit - t.debit);
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            account_type: a.account_type,
            amount,
          };
        })
        .filter((r) => r.amount !== 0);

      // Roll net income into equity for BS equation
      const plTypes = new Set(['revenue', 'expense', 'cogs']);
      let netIncome = 0;
      for (const a of accounts || []) {
        if (!plTypes.has(String(a.account_type)) || a.is_header) continue;
        const t = totals[a.id] || { debit: 0, credit: 0 };
        if (a.account_type === 'revenue') netIncome += t.credit - t.debit;
        else netIncome -= t.debit - t.credit;
      }
      netIncome = round2(netIncome);

      const assets = round2(
        rows.filter((r) => r.account_type === 'asset').reduce((s, r) => s + r.amount, 0)
      );
      const liabilities = round2(
        rows.filter((r) => r.account_type === 'liability').reduce((s, r) => s + r.amount, 0)
      );
      const equity = round2(
        rows.filter((r) => r.account_type === 'equity').reduce((s, r) => s + r.amount, 0) +
          netIncome
      );

      return NextResponse.json({
        success: true,
        report,
        rows,
        summary: {
          assets,
          liabilities,
          equity,
          netIncome,
          balanced: Math.abs(assets - (liabilities + equity)) < 0.05,
        },
        period: { from, to },
      });
    }

    return NextResponse.json({ error: `Unknown report: ${report}` }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
