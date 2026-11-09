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
  forwardMonthKeysFrom,
  horizonsFromMax,
  monthKey,
  parseHorizons,
  trailingMonthKeys,
  type MonthBucket,
} from '@/lib/accounting/forecast';
import { stageProbability } from '@/lib/customers/types';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&report=trial_balance|pnl|balance_sheet|ar_aging|ap_aging|cashflow|management_accounts|budget_vs_actual|trends|forecast
 * Optional: from=&to= (YYYY-MM-DD), year= (budget), months=12 (history),
 * direction=forward (with from: N months starting at from, going forward),
 * includePipeline=1. Forecast is the Sales pipeline sliced by from/to.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const report = request.nextUrl.searchParams.get('report') || 'trial_balance';
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const acc = await assertAccountingAccess(_gate.userId, companyId, 'view');
    if (!acc.ok) {
      return NextResponse.json({ error: acc.error }, { status: acc.status });
    }

    const supabase = getSupabaseServer();

    if (report === 'ar_aging' || report === 'ap_aging') {
      const direction = report === 'ar_aging' ? 'receivable' : 'payable';
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(
          'id, invoice_number, counterparty_name, due_date, issue_date, total_amount, amount_paid, status, currency'
        )
        .eq('profile_id', companyId)
        .eq('direction', direction)
        .not('status', 'in', '("paid","void","cancelled")')
        .limit(2000);

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
      const { buildIas7CashFlow } = await import('@/lib/accounting/cash-flow-ias7');
      const rangeFrom = from || `${new Date().getFullYear()}-01-01`;
      const rangeTo = to || new Date().toISOString().slice(0, 10);
      const ias7 = await buildIas7CashFlow({
        profileId: companyId,
        from: rangeFrom,
        to: rangeTo,
      });
      const { buildCashFlowBudget } = await import(
        '@/lib/accounting/cash-flow-budget'
      );
      const budget = await buildCashFlowBudget({
        profileId: companyId,
        from: rangeFrom,
        to: rangeTo,
      });
      return NextResponse.json({
        success: true,
        report,
        method: 'ias7_direct',
        period: { from: rangeFrom, to: rangeTo },
        ias7: { ...ias7, budget },
        summary: {
          inflow: round2(
            [...ias7.operating, ...ias7.investing, ...ias7.financing].reduce(
              (s, l) => s + l.inflow,
              0
            )
          ),
          outflow: round2(
            [...ias7.operating, ...ias7.investing, ...ias7.financing].reduce(
              (s, l) => s + l.outflow,
              0
            )
          ),
          net: ias7.netChange,
          operating: ias7.netOperating,
          investing: ias7.netInvesting,
          financing: ias7.netFinancing,
          openingCash: ias7.openingCash,
          closingCash: ias7.closingCash,
          reconciled: ias7.reconciled,
          count: ias7.journalCount,
          budgetSet: budget.set,
          budgetOperating: budget.netOperating,
        },
        warning: ias7.warning,
      });
    }

    if (report === 'management_accounts') {
      const crmBooksNote: string | undefined = undefined;
      const invoiceRepair:
        | {
            count: number;
            results: string[];
            errors: string[];
          }
        | undefined = undefined;

      // P&L from posted journals + bank allocation pulse
      // Prefer active accounts; fall back if is_active column filter is empty/mis-set
      let accounts: Array<Record<string, unknown>> = [];
      let accWarning: string | undefined;
      {
        const active = await supabase
          .from('chart_of_accounts')
          .select('id, code, name, account_type, subtype, is_header, is_active, parent_id, normal_balance')
          .eq('profile_id', companyId)
          .order('code');
        if (active.error) {
          const all = await supabase
            .from('chart_of_accounts')
            .select('id, code, name, account_type, subtype, is_header, is_active, parent_id, normal_balance')
            .eq('profile_id', companyId)
            .order('code');
          if (all.error) {
            return NextResponse.json({
              success: true,
              report,
              warning: all.error.message,
              summary: null,
              income: [],
              expenses: [],
              journals: [],
              bank: null,
            });
          }
          accounts = (all.data || []) as Array<Record<string, unknown>>;
          accWarning = active.error.message;
        } else {
          accounts = (active.data || []) as Array<Record<string, unknown>>;
          if (accounts.length === 0) {
            const all = await supabase
              .from('chart_of_accounts')
              .select('id, code, name, account_type, subtype, is_header, is_active, parent_id, normal_balance')
              .eq('profile_id', companyId)
              .order('code');
            accounts = (all.data || []) as Array<Record<string, unknown>>;
          }
        }
      }

      // Same paged ledger as the PDF, the AFS and the balance sheet.
      // An unpaged read stops at PostgREST's 1,000-row cap and drops the oldest journals.
      const { loadPostedLedger } = await import('@/lib/accounting/posted-ledger');
      const ledger = await loadPostedLedger({
        profileId: companyId,
        from,
        to,
        includeLines: true,
        journalColumns: 'detail',
        lineColumns: 'detail',
      });
      const entries = ledger.journals.map((journal) => ({
        id: journal.id,
        entry_date: journal.entry_date,
        status: journal.status || 'posted',
        source: journal.source,
        source_id: journal.source_id ?? null,
        memo: journal.memo ?? null,
        entry_number: journal.entry_number ?? null,
        currency: journal.currency ?? null,
        posted_at: journal.posted_at ?? null,
        created_at: journal.created_at ?? null,
        metadata: journal.metadata ?? null,
      }));
      const lines = ledger.lines.map((line) => ({
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
        journal_entry_id: line.journal_entry_id,
        memo: line.memo ?? null,
        counterparty: line.counterparty ?? null,
      }));
      if (ledger.warning && !entries.length && !/truncated/i.test(ledger.warning)) {
        return NextResponse.json({
          success: true,
          report,
          period: { from, to },
          warning: `Journal query failed: ${ledger.warning}`,
          summary: {
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            expenses: 0,
            operatingProfit: 0,
            netIncome: 0,
            journalCount: 0,
            bankLines: 0,
            bankIn: 0,
            bankOut: 0,
            unallocated: 0,
            unallocatedIn: 0,
            unallocatedOut: 0,
            allocatedCount: 0,
          },
          income: [],
          cogs: [],
          expenses: [],
          journals: [],
          bank: null,
        });
      }
      const entryIds = entries.map((entry) => Number(entry.id));

      // Period journals for management accounts drill-down
      const totalsByEntry: Record<number, { debit: number; credit: number }> = {};
      for (const l of lines) {
        const eid = Number(l.journal_entry_id);
        if (!Number.isFinite(eid)) continue;
        if (!totalsByEntry[eid]) totalsByEntry[eid] = { debit: 0, credit: 0 };
        totalsByEntry[eid].debit += l.debit;
        totalsByEntry[eid].credit += l.credit;
      }
      const journals = (entries || []).map((e) => {
        const t = totalsByEntry[Number(e.id)] || { debit: 0, credit: 0 };
        return {
          id: e.id,
          entry_date: e.entry_date,
          document_number: (e.entry_number as string) ?? null,
          reference: null,
          memo: (e.memo as string) ?? null,
          source: (e.source as string) ?? null,
          status: e.status,
          total_debit: round2(t.debit),
          total_credit: round2(t.credit),
        };
      });

      const { PNL_EXCLUDED_SOURCES, debitCreditMap, ledgerCoverageWarning, pnlAccountLines } =
        await import('@/lib/accounting/statement-figures');
      const { totalsFromLedger } = await import('@/lib/accounting/posted-ledger');
      const pnlJournals = entries.filter(
        (entry) => !PNL_EXCLUDED_SOURCES.has(String(entry.source || '').toLowerCase())
      );
      const pnlIds = new Set(pnlJournals.map((entry) => Number(entry.id)));
      const pnlLines = lines.filter((line) => pnlIds.has(Number(line.journal_entry_id)));
      const periodAgg = totalsFromLedger({
        journals: pnlJournals.map((entry) => ({
          id: Number(entry.id),
          entry_date: String(entry.entry_date || ''),
          source: entry.source != null ? String(entry.source) : null,
        })),
        lines: pnlLines,
      });
      const totals: Record<number, { debit: number; credit: number }> = {};
      for (const row of periodAgg.rows) {
        totals[row.account_id] = { debit: row.debit, credit: row.credit };
      }
      const statementAccounts = (accounts || [])
        .filter((account) => !account.is_header)
        .map((account) => ({
          id: Number(account.id),
          code: String(account.code || ''),
          name: String(account.name || ''),
          account_type: String(account.account_type || ''),
          is_header: false,
        }));
      const grouped = pnlAccountLines(statementAccounts, debitCreditMap(periodAgg.rows));
      const { collectAccountPostings } = await import('@/lib/accounting/sales-origin');
      const entryRecords = pnlJournals as Array<Record<string, unknown>>;
      const income = grouped.income.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        account_type: 'revenue',
        amount: row.amount,
        postings: collectAccountPostings({
          accountId: row.id,
          polarity: 'revenue' as const,
          entries: entryRecords,
          lines: pnlLines,
        }),
      }));
      const cogsRows = grouped.cogsLines.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        account_type: 'cogs',
        amount: row.amount,
        postings: collectAccountPostings({
          accountId: row.id,
          polarity: 'expense' as const,
          entries: entryRecords,
          lines: pnlLines,
        }),
      }));
      const expenses = grouped.expenseLines.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        account_type: 'expense',
        amount: row.amount,
        postings: collectAccountPostings({
          accountId: row.id,
          polarity: 'expense' as const,
          entries: entryRecords,
          lines: pnlLines,
        }),
      }));
      const revenue = grouped.revenue;
      const cogs = grouped.cogs;
      const expenseTotal = grouped.expenses;
      const grossProfit = grouped.grossProfit;
      const operatingProfit = grouped.operatingProfit;
      const coverageWarning = ledgerCoverageWarning({
        totals: periodAgg.rows,
        accounts: (accounts || []).map((account) => ({
          id: Number(account.id),
          code: account.code != null ? String(account.code) : null,
          name: account.name != null ? String(account.name) : null,
          account_type:
            account.account_type != null ? String(account.account_type) : null,
          is_header: Boolean(account.is_header),
        })),
      });

      const { buildSalesOrigin } = await import('@/lib/accounting/sales-origin');
      const sales = buildSalesOrigin({
        entries: entryRecords,
        lines: pnlLines,
        accounts: (accounts || []).map((a) => ({
          id: Number(a.id),
          code: String(a.code || ''),
          name: String(a.name || ''),
          account_type: String(a.account_type || ''),
          is_header: Boolean(a.is_header),
        })),
      });

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

      const emptyPeriod =
        entryIds.length === 0
          ? `No posted journals between ${from || '…'} and ${to || '…'}. Try YTD, Full FY, or multi-select months that cover your bank allocations.`
          : undefined;

      // Soft: budget (plan) vs actual for the period's fiscal year(s)
      let budgetVsActual: Record<string, unknown> | null = null;
      try {
        const { buildBudgetVsActual } = await import(
          '@/lib/accounting/budget-vs-actual'
        );
        budgetVsActual = await buildBudgetVsActual({
          companyId,
          from: from || null,
          to: to || null,
          accounts: accounts as Array<Record<string, unknown>>,
          actualByAccount: totals,
        });
      } catch {
        budgetVsActual = null;
      }

      return NextResponse.json({
        success: true,
        report,
        period: { from, to },
        warning:
          [ledger.warning, coverageWarning, accWarning, crmBooksNote, emptyPeriod]
            .filter(Boolean)
            .join(' ') || undefined,
        summary: {
          revenue,
          cogs,
          grossProfit,
          expenses: expenseTotal,
          operatingProfit,
          netIncome: operatingProfit,
          journalCount: periodAgg.entry_count,
          lineCount: lines.length,
          bankLines: (bankTxns || []).length,
          bankIn: round2(bankIn),
          bankOut: round2(bankOut),
          unallocated,
          unallocatedIn: round2(unallocatedIn),
          unallocatedOut: round2(unallocatedOut),
          allocatedCount,
          budgetRevenue: budgetVsActual?.summary
            ? (budgetVsActual.summary as { budgetRevenue?: number }).budgetRevenue
            : undefined,
          budgetExpenses: budgetVsActual?.summary
            ? (budgetVsActual.summary as { budgetExpenses?: number })
                .budgetExpenses
            : undefined,
        },
        income,
        cogs: cogsRows,
        expenses,
        sales,
        journals,
        bank: {
          unallocated,
          unallocatedIn: round2(unallocatedIn),
          unallocatedOut: round2(unallocatedOut),
          allocatedCount,
          recentAllocated,
        },
        budgetVsActual,
        invoiceRepair,
      });
    }

    // ── Budget (plan) vs actual report ─────────────────────────────────────
    if (report === 'budget_vs_actual') {
      const { getOrCreateSettings } = await import('@/lib/accounting/server');
      const {
        normalizeFyStartMonth,
        fiscalYearStartYear,
      } = await import('@/lib/accounting/budget');
      const {
        fiscalYearStart,
        fiscalYearEnd,
        toIsoDate,
      } = await import('@/lib/accounting/fiscal');

      const settings = await getOrCreateSettings(companyId);
      const fyStartMonth = normalizeFyStartMonth(
        settings.fiscal_year_start_month
      );
      const defaultFyYear = fiscalYearStartYear(new Date(), fyStartMonth);
      const year = Number(
        request.nextUrl.searchParams.get('year') || defaultFyYear
      );
      const fyRef = new Date(
        Number.isFinite(year) ? year : defaultFyYear,
        fyStartMonth - 1,
        15
      );

      const { data: accounts, error: accErr } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type, subtype, is_header, is_active, parent_id, normal_balance')
        .eq('profile_id', companyId)
        .order('code');
      if (accErr) {
        return NextResponse.json({
          success: true,
          report,
          rows: [],
          warning: accErr.message,
        });
      }

      // Actuals from posted journals in range (default = full financial year)
      const rangeFrom = from || toIsoDate(fiscalYearStart(fyRef, fyStartMonth));
      const rangeTo = to || toIsoDate(fiscalYearEnd(fyRef, fyStartMonth));
      let jeQ = supabase
        .from('journal_entries')
        .select('id')
        .eq('profile_id', companyId)
        .eq('status', 'posted')
        .gte('entry_date', rangeFrom)
        .lte('entry_date', rangeTo);
      const { data: entries } = await jeQ;
      const entryIds = (entries || []).map((e) => Number(e.id));
      const totals: Record<number, { debit: number; credit: number }> = {};
      if (entryIds.length) {
        const chunkSize = 150;
        for (let i = 0; i < entryIds.length; i += chunkSize) {
          const chunk = entryIds.slice(i, i + chunkSize);
          const { data: lineRows } = await supabase
            .from('journal_lines')
            .select('account_id, debit, credit')
            .in('journal_entry_id', chunk);
          for (const l of lineRows || []) {
            const aid = Number(l.account_id);
            if (!totals[aid]) totals[aid] = { debit: 0, credit: 0 };
            totals[aid].debit += Number(l.debit || 0);
            totals[aid].credit += Number(l.credit || 0);
          }
        }
      }

      const { buildBudgetVsActual } = await import(
        '@/lib/accounting/budget-vs-actual'
      );
      const result = await buildBudgetVsActual({
        companyId,
        from: rangeFrom,
        to: rangeTo,
        year: Number.isFinite(year) ? year : defaultFyYear,
        accounts: (accounts || []) as Array<Record<string, unknown>>,
        actualByAccount: totals,
        fyStartMonth,
      });

      return NextResponse.json({
        success: true,
        report,
        period: {
          from: rangeFrom,
          to: rangeTo,
          year: result.year,
          fyStartMonth: result.fyStartMonth,
          fyLabel: result.fyLabel,
        },
        ...result,
      });
    }

    if (report === 'forecast') {
      const rangeFrom = from || `${new Date().getFullYear()}-01-01`;
      const rangeTo = to || new Date().toISOString().slice(0, 10);
      const { buildPipelineForecast } = await import(
        '@/lib/accounting/pipeline-forecast'
      );
      const pack = await buildPipelineForecast({
        profileId: companyId,
        from: rangeFrom,
        to: rangeTo,
      });
      return NextResponse.json({
        success: true,
        report,
        method: 'sales_pipeline',
        period: { from: pack.from, to: pack.to },
        summary: pack.summary,
        months: pack.months,
        stages: pack.stages,
        rows: pack.rows,
        warning: pack.warning,
      });
    }

    // ── Monthly trends + multi-horizon forecast ──────────────────────────
    if (report === 'trends') {
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

      // History keys:
      // - direction=forward (+ from): N months starting at `from` month, going forward
      // - from+to: month span between them
      // - else: trailing N months ending at `to` or today
      const direction = (
        request.nextUrl.searchParams.get('direction') || ''
      ).toLowerCase();
      let keys: string[];
      if (direction === 'forward' && from) {
        const start = new Date(from + 'T12:00:00');
        keys = forwardMonthKeysFrom(
          historyMonths,
          Number.isNaN(start.getTime()) ? new Date() : start
        );
      } else if (from && to) {
        const start = new Date(from + 'T12:00:00');
        const end = new Date(to + 'T12:00:00');
        keys = [];
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const endM = new Date(end.getFullYear(), end.getMonth(), 1);
        // Cap at 36 months
        for (let i = 0; i < 36 && cursor <= endM; i++) {
          keys.push(monthKey(cursor));
          cursor.setMonth(cursor.getMonth() + 1);
        }
        if (!keys.length) keys = trailingMonthKeys(historyMonths, end);
      } else {
        keys = trailingMonthKeys(
          historyMonths,
          to ? new Date(to + 'T12:00:00') : new Date()
        );
      }
      const rangeFrom = `${keys[0]}-01`;
      const lastKey = keys[keys.length - 1];
      const [ly, lm] = lastKey.split('-').map(Number);
      const lastDay = new Date(ly, lm, 0).getDate();
      const rangeTo = `${lastKey}-${String(lastDay).padStart(2, '0')}`;

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
        const { loadHoldingSubtree } = await import(
          '@/lib/business/holding-pipeline'
        );
        const tree = await loadHoldingSubtree(companyId);
        const { data: opps, error: oppErr } = await supabase
          .from('opportunities')
          .select(
            'id, name, stage, status, amount, opportunity_size, probability, expected_close_date, estimated_date, actual_close_date, company_name, currency, created_at'
          )
          .in('profile_id', tree.ids)
          .limit(2000);

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
      .select('id, code, name, account_type, subtype, is_header, is_active, parent_id, normal_balance')
      .eq('profile_id', companyId)
      .order('code');

    if (accErr) {
      return NextResponse.json({
        success: true,
        report,
        rows: [],
        warning: accErr.message,
      });
    }

    const { loadPostedLedger, totalsFromLedger } = await import(
      '@/lib/accounting/posted-ledger'
    );
    const {
      debitCreditMap,
      ledgerCoverageWarning,
      pnlAccountLines,
      signedStatementAmount,
      statementPosition,
    } = await import('@/lib/accounting/statement-figures');
    // IAS 1: statement of financial position is as-at a date (all history through `to`).
    // P&L / TB stay period-filtered. Both read the shared paged ledger.
    const ledger = await loadPostedLedger({
      profileId: companyId,
      from: report === 'balance_sheet' ? null : from,
      to,
      includeLines: true,
      journalColumns: 'core',
      lineColumns: 'amounts',
    });
    if (ledger.warning && !ledger.journals.length && !/truncated/i.test(ledger.warning)) {
      return NextResponse.json({
        success: true,
        report,
        rows: [],
        warning: ledger.warning,
      });
    }
    const agg = totalsFromLedger({
      journals: ledger.journals,
      lines: ledger.lines,
    });
    const entryIds = ledger.journals.map((journal) => journal.id);
    const totals: Record<number, { debit: number; credit: number }> = {};
    for (const row of agg.rows) {
      totals[row.account_id] = { debit: row.debit, credit: row.credit };
    }
    const figureAccounts = (accounts || []).map((account) => ({
      id: Number(account.id),
      code: account.code != null ? String(account.code) : null,
      name: account.name != null ? String(account.name) : null,
      account_type: account.account_type != null ? String(account.account_type) : null,
      is_header: Boolean(account.is_header),
    }));
    const dcMap = debitCreditMap(agg.rows);
    const reportWarning =
      [ledger.warning, ledgerCoverageWarning({ totals: agg.rows, accounts: figureAccounts })]
        .filter(Boolean)
        .join(' ') || undefined;

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
      const shown = new Set(rows.map((row) => Number(row.id)));
      for (const total of agg.rows) {
        if (shown.has(total.account_id)) continue;
        if (total.debit === 0 && total.credit === 0) continue;
        const account = (accounts || []).find(
          (row) => Number(row.id) === total.account_id
        );
        rows.push({
          id: total.account_id,
          code: account?.code || String(total.account_id),
          name: account?.name || 'Unmapped ledger account',
          account_type: account?.account_type || 'unmapped',
          debit: total.debit,
          credit: total.credit,
          net: round2(total.debit - total.credit),
        });
      }

      const sumDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
      const sumCredit = round2(rows.reduce((s, r) => s + r.credit, 0));

      return NextResponse.json({
        success: true,
        report,
        rows,
        totals: { debit: sumDebit, credit: sumCredit, balanced: Math.abs(sumDebit - sumCredit) < 0.02 },
        period: { from, to },
        warning: reportWarning,
      });
    }

    if (report === 'pnl') {
      const grouped = pnlAccountLines(figureAccounts, dcMap);
      const rows = [
        ...grouped.income.map((row) => ({ ...row, account_type: 'revenue' })),
        ...grouped.cogsLines.map((row) => ({ ...row, account_type: 'cogs' })),
        ...grouped.expenseLines.map((row) => ({ ...row, account_type: 'expense' })),
      ];

      return NextResponse.json({
        success: true,
        report,
        rows,
        summary: {
          revenue: grouped.revenue,
          cogs: grouped.cogs,
          grossProfit: grouped.grossProfit,
          expenses: grouped.expenses,
          netIncome: grouped.netIncome,
        },
        period: { from, to },
        warning: reportWarning,
      });
    }

    if (report === 'balance_sheet') {
      const {
        classifyBsSection,
        BS_SECTION_LABELS,
        buildBalanceSheetExtras,
      } = await import('@/lib/accounting/balance-sheet-allocate');

      const bsTypes = new Set(['asset', 'liability', 'equity']);
      const rows = (accounts || [])
        .filter((a) => bsTypes.has(String(a.account_type)) && !a.is_header)
        .map((a) => {
          const t = totals[a.id] || { debit: 0, credit: 0 };
          const amount = signedStatementAmount(a.account_type, t.debit, t.credit);
          const section = classifyBsSection(
            String(a.account_type),
            a.subtype,
            a.code
          );
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            account_type: a.account_type,
            subtype: a.subtype ?? null,
            section,
            section_label: BS_SECTION_LABELS[section] || section,
            amount,
          };
        })
        .filter((r) => r.amount !== 0)
        .sort((a, b) => String(a.code).localeCompare(String(b.code)));

      const { collapseBsStatementRows } = await import(
        '@/lib/accounting/statement-rollups'
      );
      const ledgerRows = rows;
      const statementRows = collapseBsStatementRows(rows);

      // Same position totals as the AFS statement of financial position.
      const position = statementPosition(figureAccounts, dcMap);
      const netIncome = position.netIncome;
      const assets = position.assets;
      const liabilities = position.liabilities;
      const equityBase = position.equityBase;
      const equity = position.equity;

      // Section totals
      const sections: Record<string, number> = {};
      for (const r of rows) {
        sections[r.section] = round2((sections[r.section] || 0) + r.amount);
      }
      sections.equity = round2((sections.equity || 0) + netIncome);

      // Dimension allocation breakdown from journal lines (when dims present)
      let allocationByBu: Array<{
        business_unit_id: number | null;
        assets: number;
        liabilities: number;
      }> = [];
      try {
        if (entryIds.length) {
          const { data: dimLines } = await supabase
            .from('journal_lines')
            .select(
              'account_id, debit, credit, business_unit_id, work_center_id, asset_id, fixed_asset_id, liability_id'
            )
            .in('journal_entry_id', entryIds);
          const acctType = new Map(
            (accounts || []).map((a) => [Number(a.id), String(a.account_type)])
          );
          const byBu = new Map<
            string,
            { business_unit_id: number | null; assets: number; liabilities: number }
          >();
          for (const l of dimLines || []) {
            const type = acctType.get(Number(l.account_id));
            if (type !== 'asset' && type !== 'liability') continue;
            const key =
              l.business_unit_id != null
                ? String(l.business_unit_id)
                : 'unallocated';
            const cur = byBu.get(key) || {
              business_unit_id:
                l.business_unit_id != null ? Number(l.business_unit_id) : null,
              assets: 0,
              liabilities: 0,
            };
            const d = Number(l.debit || 0);
            const c = Number(l.credit || 0);
            if (type === 'asset') cur.assets += d - c;
            else cur.liabilities += c - d;
            byBu.set(key, cur);
          }
          allocationByBu = [...byBu.values()].map((r) => ({
            business_unit_id: r.business_unit_id,
            assets: round2(r.assets),
            liabilities: round2(r.liabilities),
          }));
        }
      } catch {
        /* soft — dim columns may be missing */
      }

      const extras = await buildBalanceSheetExtras({
        companyId,
        glAssets: assets,
        glLiabilities: liabilities,
        glEquity: equity,
      });

      return NextResponse.json({
        success: true,
        report,
        rows: statementRows,
        ledger_rows: ledgerRows,
        sections,
        sectionLabels: BS_SECTION_LABELS,
        allocationByBu,
        netIncomeLine: {
          code: 'NI',
          name: 'Net income (period)',
          account_type: 'equity',
          section: 'equity',
          amount: netIncome,
        },
        registers: {
          fixedAssets: extras.fixedAssetSchedule,
          fixedAssetRegisterTotal: extras.fixedAssetRegisterTotal,
          fixedAssetCapitalisedCount: extras.fixedAssetCapitalisedCount,
          fixedAssetUncapitalisedCount: extras.fixedAssetUncapitalisedCount,
          liabilities: extras.liabilitySchedule,
          liabilityRegisterTotal: extras.liabilityRegisterTotal,
          bankRegisterTotal: extras.bankRegisterTotal,
        },
        completeness: extras.completeness,
        summary: {
          assets,
          liabilities,
          equity,
          equityBase,
          netIncome,
          currentAssets: sections.current_assets || 0,
          nonCurrentAssets: sections.non_current_assets || 0,
          currentLiabilities: sections.current_liabilities || 0,
          nonCurrentLiabilities: sections.non_current_liabilities || 0,
          balanced: position.balanced,
        },
        period: { from, to },
        warning: reportWarning,
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
