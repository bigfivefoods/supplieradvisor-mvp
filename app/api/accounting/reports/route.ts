import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { invoiceBalance } from '@/lib/accounting/types';
import {
  buildForecastSeries,
  emptyBucket,
  finalizeBuckets,
  forwardMonthKeys,
  horizonsFromMax,
  monthKey,
  parseHorizons,
  trailingMonthKeys,
  type MonthBucket,
} from '@/lib/accounting/forecast';
import { stageProbability } from '@/lib/customers/types';

/**
 * GET ?companyId=&report=trial_balance|pnl|balance_sheet|ar_aging|ap_aging|cashflow|management_accounts|trends|forecast
 * Optional: from=&to= (YYYY-MM-DD), months=12 (history), horizons=1,3,6,9,12 | horizonMonths=12,
 * includePipeline=1
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

    if (report === 'management_accounts') {
      // P&L from posted journals + bank allocation pulse
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
          warning: accErr.message,
          summary: null,
          income: [],
          expenses: [],
          bank: null,
        });
      }

      let jeQ = supabase
        .from('journal_entries')
        .select('id, entry_date, status, source')
        .eq('profile_id', companyId)
        .eq('status', 'posted');
      if (from) jeQ = jeQ.gte('entry_date', from);
      if (to) jeQ = jeQ.lte('entry_date', to);
      const { data: entries } = await jeQ;
      const entryIds = (entries || []).map((e) => e.id);

      let lines: Array<{ account_id: number; debit: number; credit: number }> = [];
      if (entryIds.length) {
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

      const income: Array<Record<string, unknown>> = [];
      const expenses: Array<Record<string, unknown>> = [];
      const cogsRows: Array<Record<string, unknown>> = [];

      for (const a of accounts || []) {
        if (a.is_header) continue;
        const t = totals[a.id] || { debit: 0, credit: 0 };
        const type = String(a.account_type || '');
        if (type === 'revenue') {
          const amount = round2(t.credit - t.debit);
          if (amount !== 0) {
            income.push({
              id: a.id,
              code: a.code,
              name: a.name,
              account_type: type,
              amount,
            });
          }
        } else if (type === 'cogs') {
          const amount = round2(t.debit - t.credit);
          if (amount !== 0) {
            cogsRows.push({
              id: a.id,
              code: a.code,
              name: a.name,
              account_type: type,
              amount,
            });
          }
        } else if (type === 'expense') {
          const amount = round2(t.debit - t.credit);
          if (amount !== 0) {
            expenses.push({
              id: a.id,
              code: a.code,
              name: a.name,
              account_type: type,
              amount,
            });
          }
        }
      }

      const revenue = round2(income.reduce((s, r) => s + Number(r.amount), 0));
      const cogs = round2(cogsRows.reduce((s, r) => s + Number(r.amount), 0));
      const expenseTotal = round2(expenses.reduce((s, r) => s + Number(r.amount), 0));
      const grossProfit = round2(revenue - cogs);
      const operatingProfit = round2(grossProfit - expenseTotal);

      // Bank allocation progress
      let bankQ = supabase
        .from('bank_transactions')
        .select('id, amount, allocation_status, txn_date, description, gl_account_id')
        .eq('profile_id', companyId);
      if (from) bankQ = bankQ.gte('txn_date', from);
      if (to) bankQ = bankQ.lte('txn_date', to);
      const { data: bankTxns } = await bankQ;

      let unallocated = 0;
      let unallocatedIn = 0;
      let unallocatedOut = 0;
      let allocatedCount = 0;
      let bankIn = 0;
      let bankOut = 0;
      for (const t of bankTxns || []) {
        const amt = Number(t.amount || 0);
        if (amt > 0) bankIn += amt;
        else bankOut += Math.abs(amt);
        const st = String(t.allocation_status || 'unallocated');
        if (st === 'unallocated') {
          unallocated++;
          if (amt > 0) unallocatedIn += amt;
          else unallocatedOut += Math.abs(amt);
        } else if (st === 'allocated' || st === 'matched_invoice') {
          allocatedCount++;
        }
      }

      // Recent allocated bank lines for detail
      const recentAllocated = (bankTxns || [])
        .filter((t) => ['allocated', 'matched_invoice'].includes(String(t.allocation_status)))
        .slice(0, 50);

      return NextResponse.json({
        success: true,
        report,
        period: { from, to },
        summary: {
          revenue,
          cogs,
          grossProfit,
          expenses: expenseTotal,
          operatingProfit,
          netIncome: operatingProfit,
          journalCount: entryIds.length,
          bankLines: (bankTxns || []).length,
          bankIn: round2(bankIn),
          bankOut: round2(bankOut),
          unallocated,
          unallocatedIn: round2(unallocatedIn),
          unallocatedOut: round2(unallocatedOut),
          allocatedCount,
        },
        income,
        cogs: cogsRows,
        expenses,
        bank: {
          unallocated,
          unallocatedIn: round2(unallocatedIn),
          unallocatedOut: round2(unallocatedOut),
          allocatedCount,
          recentAllocated,
        },
      });
    }

    // ── Monthly trends + multi-horizon forecast ──────────────────────────
    if (report === 'trends' || report === 'forecast') {
      const monthsParam = Number(request.nextUrl.searchParams.get('months') || 12);
      const historyMonths = Math.min(36, Math.max(3, Number.isFinite(monthsParam) ? monthsParam : 12));
      const includePipeline =
        request.nextUrl.searchParams.get('includePipeline') !== '0' &&
        request.nextUrl.searchParams.get('includePipeline') !== 'false';
      const horizonMonthsParam = Number(request.nextUrl.searchParams.get('horizonMonths') || 0);
      const horizonsRaw = request.nextUrl.searchParams.get('horizons');
      const horizons = horizonsRaw
        ? parseHorizons(horizonsRaw)
        : horizonMonthsParam > 0
          ? horizonsFromMax(horizonMonthsParam)
          : [1, 3, 6, 9, 12];
      const maxHorizon = Math.max(...horizons, 1);

      // Optional explicit history end (to=) — default ends at current month
      const keys = trailingMonthKeys(historyMonths, to ? new Date(to + 'T12:00:00') : new Date());
      const rangeFrom = from || `${keys[0]}-01`;
      const lastKey = keys[keys.length - 1];
      const [ly, lm] = lastKey.split('-').map(Number);
      const lastDay = new Date(ly, lm, 0).getDate();
      const rangeTo = to || `${lastKey}-${String(lastDay).padStart(2, '0')}`;

      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, account_type, is_header')
        .eq('profile_id', companyId)
        .eq('is_active', true);

      const accountType = new Map<number, string>();
      for (const a of accounts || []) {
        if (a.is_header) continue;
        accountType.set(Number(a.id), String(a.account_type || ''));
      }

      const { data: entries } = await supabase
        .from('journal_entries')
        .select('id, entry_date')
        .eq('profile_id', companyId)
        .eq('status', 'posted')
        .gte('entry_date', rangeFrom)
        .lte('entry_date', rangeTo);

      const entryMonth = new Map<number, string>();
      for (const e of entries || []) {
        const d = String(e.entry_date || '').slice(0, 10);
        if (!d) continue;
        entryMonth.set(Number(e.id), d.slice(0, 7));
      }
      const entryIds = Array.from(entryMonth.keys());

      type LineRow = { journal_entry_id: number; account_id: number; debit: number; credit: number };
      let lines: LineRow[] = [];
      // Chunk .in() for large journals
      const chunk = 200;
      for (let i = 0; i < entryIds.length; i += chunk) {
        const slice = entryIds.slice(i, i + chunk);
        if (!slice.length) break;
        const { data: lineRows } = await supabase
          .from('journal_lines')
          .select('journal_entry_id, account_id, debit, credit')
          .in('journal_entry_id', slice);
        for (const l of lineRows || []) {
          lines.push({
            journal_entry_id: Number(l.journal_entry_id),
            account_id: Number(l.account_id),
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          });
        }
      }

      const bucketMap = new Map<string, MonthBucket>();
      for (const k of keys) bucketMap.set(k, emptyBucket(k));

      const journalsPerMonth = new Map<string, Set<number>>();
      for (const e of entries || []) {
        const mk = entryMonth.get(Number(e.id));
        if (!mk || !bucketMap.has(mk)) continue;
        if (!journalsPerMonth.has(mk)) journalsPerMonth.set(mk, new Set());
        journalsPerMonth.get(mk)!.add(Number(e.id));
      }
      for (const [mk, set] of journalsPerMonth) {
        const b = bucketMap.get(mk);
        if (b) b.journalCount = set.size;
      }

      for (const l of lines) {
        const mk = entryMonth.get(l.journal_entry_id);
        if (!mk) continue;
        const b = bucketMap.get(mk);
        if (!b) continue;
        const type = accountType.get(l.account_id);
        if (type === 'revenue') b.revenue += l.credit - l.debit;
        else if (type === 'cogs') b.cogs += l.debit - l.credit;
        else if (type === 'expense') b.expenses += l.debit - l.credit;
      }

      // Bank cash movement by month
      const { data: bankTxns } = await supabase
        .from('bank_transactions')
        .select('txn_date, amount')
        .eq('profile_id', companyId)
        .gte('txn_date', rangeFrom)
        .lte('txn_date', rangeTo);

      for (const t of bankTxns || []) {
        const mk = String(t.txn_date || '').slice(0, 7);
        const b = bucketMap.get(mk);
        if (!b) continue;
        const amt = Number(t.amount || 0);
        if (amt > 0) b.bankIn += amt;
        else b.bankOut += Math.abs(amt);
      }

      // Payments as cashflow fallback / supplement if bank empty
      const { data: payments } = await supabase
        .from('payments')
        .select('paid_at, amount, direction')
        .eq('profile_id', companyId)
        .gte('paid_at', `${rangeFrom}T00:00:00`)
        .lte('paid_at', `${rangeTo}T23:59:59`)
        .limit(2000);

      // Only fold payments into cash if bank has no rows that month
      const monthsWithBank = new Set(
        (bankTxns || []).map((t) => String(t.txn_date || '').slice(0, 7)).filter(Boolean)
      );
      for (const p of payments || []) {
        const mk = String(p.paid_at || '').slice(0, 7);
        if (!mk || monthsWithBank.has(mk)) continue;
        const b = bucketMap.get(mk);
        if (!b) continue;
        const amt = Number(p.amount || 0);
        if (p.direction === 'inbound') b.bankIn += amt;
        else b.bankOut += amt;
      }

      // ── CRM pipeline (sales team opportunities) ────────────────────────
      const fwdKeys = forwardMonthKeys(maxHorizon);
      const pipelineForward = Array(maxHorizon).fill(0) as number[];
      const pipelineWeightedForward = Array(maxHorizon).fill(0) as number[];
      let pipelineOpen = 0;
      let pipelineWeightedOpen = 0;
      let pipelineWonHist = 0;
      let pipelineOpenDeals = 0;
      let pipelineWonDeals = 0;
      const pipelineRows: Array<Record<string, unknown>> = [];
      let pipelineWarning: string | undefined;

      if (includePipeline) {
        const { data: opps, error: oppErr } = await supabase
          .from('opportunities')
          .select(
            'id, name, stage, status, amount, opportunity_size, probability, expected_close_date, estimated_date, actual_close_date, company_name, currency, created_at'
          )
          .eq('profile_id', companyId)
          .limit(1000);

        if (oppErr) {
          pipelineWarning = oppErr.message;
        } else {
          const fwdIndex = new Map(fwdKeys.map((k, i) => [k, i]));
          for (const o of opps || []) {
            const amount = Number(o.amount ?? o.opportunity_size ?? 0);
            const stage = String(o.stage || o.status || 'prospecting')
              .toLowerCase()
              .replace(/\s+/g, '_');
            const isWon = stage === 'closed_won' || stage === 'won';
            const isLost = stage === 'closed_lost' || stage === 'lost';
            const isOpen = !isWon && !isLost;
            const prob =
              o.probability != null && Number(o.probability) > 0
                ? Number(o.probability)
                : stageProbability(stage);
            const closeDate =
              (isWon
                ? o.actual_close_date || o.expected_close_date || o.estimated_date
                : o.expected_close_date || o.estimated_date || o.created_at) || null;
            const mk = closeDate ? String(closeDate).slice(0, 7) : null;

            if (isWon && mk && bucketMap.has(mk)) {
              const b = bucketMap.get(mk)!;
              b.pipeline += amount;
              b.pipelineWeighted += amount; // won = 100%
              pipelineWonHist += amount;
              pipelineWonDeals += 1;
            }

            if (isOpen) {
              pipelineOpen += amount;
              pipelineWeightedOpen += (amount * prob) / 100;
              pipelineOpenDeals += 1;
              if (mk && fwdIndex.has(mk)) {
                const i = fwdIndex.get(mk)!;
                pipelineForward[i] += amount;
                pipelineWeightedForward[i] += (amount * prob) / 100;
              } else if (mk && bucketMap.has(mk)) {
                // Expected close still in history window (this month)
                const b = bucketMap.get(mk)!;
                b.pipeline += amount;
                b.pipelineWeighted += (amount * prob) / 100;
              } else if (!mk || mk < keys[0]) {
                // Undated / overdue → park in current month (last history key)
                const b = bucketMap.get(lastKey);
                if (b) {
                  b.pipeline += amount;
                  b.pipelineWeighted += (amount * prob) / 100;
                }
              }
              pipelineRows.push({
                id: o.id,
                name: o.name,
                company_name: o.company_name,
                stage,
                amount,
                probability: prob,
                weighted: round2((amount * prob) / 100),
                expected_close_date: o.expected_close_date || o.estimated_date,
                currency: o.currency || 'ZAR',
              });
            }
          }
        }
      }

      const history = finalizeBuckets(bucketMap, keys);
      const totals = {
        revenue: round2(history.reduce((s, h) => s + h.revenue, 0)),
        cogs: round2(history.reduce((s, h) => s + h.cogs, 0)),
        expenses: round2(history.reduce((s, h) => s + h.expenses, 0)),
        netIncome: round2(history.reduce((s, h) => s + h.netIncome, 0)),
        bankIn: round2(history.reduce((s, h) => s + h.bankIn, 0)),
        bankOut: round2(history.reduce((s, h) => s + h.bankOut, 0)),
        cashNet: round2(history.reduce((s, h) => s + h.cashNet, 0)),
        pipeline: round2(history.reduce((s, h) => s + h.pipeline, 0)),
        pipelineWeighted: round2(history.reduce((s, h) => s + h.pipelineWeighted, 0)),
        pipelineOpen: round2(pipelineOpen),
        pipelineWeightedOpen: round2(pipelineWeightedOpen),
        pipelineWonHist: round2(pipelineWonHist),
        pipelineOpenDeals,
        pipelineWonDeals,
      };

      const pipelineBlock = {
        enabled: includePipeline,
        openValue: round2(pipelineOpen),
        weightedValue: round2(pipelineWeightedOpen),
        openDeals: pipelineOpenDeals,
        wonInHistory: round2(pipelineWonHist),
        wonDeals: pipelineWonDeals,
        forwardByMonth: fwdKeys.map((k, i) => ({
          key: k,
          label: k,
          amount: round2(pipelineForward[i] || 0),
          weighted: round2(pipelineWeightedForward[i] || 0),
        })),
        topDeals: pipelineRows
          .sort((a, b) => Number(b.weighted) - Number(a.weighted))
          .slice(0, 25),
        warning: pipelineWarning,
      };

      if (report === 'trends') {
        return NextResponse.json({
          success: true,
          report: 'trends',
          period: { from: rangeFrom, to: rangeTo, months: historyMonths },
          history,
          totals,
          pipeline: pipelineBlock,
          labels: history.map((h) => h.label),
          series: {
            revenue: history.map((h) => h.revenue),
            cogs: history.map((h) => h.cogs),
            expenses: history.map((h) => h.expenses),
            netIncome: history.map((h) => h.netIncome),
            bankIn: history.map((h) => h.bankIn),
            bankOut: history.map((h) => h.bankOut),
            cashNet: history.map((h) => h.cashNet),
            pipeline: history.map((h) => h.pipeline),
            pipelineWeighted: history.map((h) => h.pipelineWeighted),
          },
        });
      }

      // forecast
      const { series, horizons: horizonRows, method } = buildForecastSeries(history, horizons, {
        includePipeline,
        pipelineForward: pipelineForward.map((n) => round2(n)),
        pipelineWeightedForward: pipelineWeightedForward.map((n) => round2(n)),
      });
      const last = history[history.length - 1] || emptyBucket(monthKey(new Date()));

      return NextResponse.json({
        success: true,
        report: 'forecast',
        period: { from: rangeFrom, to: rangeTo, months: historyMonths },
        history,
        totals,
        pipeline: pipelineBlock,
        lastMonth: last,
        series,
        horizons: horizonRows,
        selectedHorizons: horizons,
        maxHorizon,
        method,
        asOf: new Date().toISOString(),
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
