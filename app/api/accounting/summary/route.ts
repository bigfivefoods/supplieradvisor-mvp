import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, monthBounds } from '@/lib/accounting/server';
import { invoiceBalance, isOverdue } from '@/lib/accounting/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { jsonKpi } from '@/lib/http/response-cache';
import { withCompanyKpiCache } from '@/lib/dashboard/kpi-cache';
import { getCachedCoa, getCachedSettings } from '@/lib/accounting/read-cache';

/** GET ?companyId=&privyUserId= — Accounting hub KPIs */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const payload = await withCompanyKpiCache(companyId, 'accounting', () =>
      assembleAccountingSummary(companyId)
    );
    return jsonKpi(payload);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function assembleAccountingSummary(companyId: number) {
    const supabase = getSupabaseServer();
    const { start, end } = monthBounds();

    const [coaRows, journalsPosted, journalsDraft, invoiceRollup, payments, banks, bankTxn, entities, assets, settings] =
      await Promise.all([
        getCachedCoa(companyId),
        supabase
          .from('journal_entries')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', companyId)
          .eq('status', 'posted'),
        supabase
          .from('journal_entries')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', companyId)
          .eq('status', 'draft'),
        loadInvoiceKpis(supabase, companyId),
        supabase
          .from('payments')
          .select('id, amount, paid_at, status')
          .eq('profile_id', companyId)
          .gte('paid_at', `${start}T00:00:00`)
          .lte('paid_at', `${end}T23:59:59`)
          .limit(500),
        supabase
          .from('bank_accounts')
          .select('id, current_balance, status')
          .eq('profile_id', companyId)
          .limit(100),
        supabase
          .from('bank_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', companyId)
          .eq('status', 'unreconciled'),
        supabase
          .from('accounting_entities')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', companyId),
        supabase
          .from('fixed_assets')
          .select('id, book_value, purchase_cost, accumulated_depreciation, status')
          .eq('profile_id', companyId)
          .limit(500),
        getCachedSettings(companyId),
      ]);

    const warnings = [
      journalsPosted.error,
      journalsDraft.error,
      invoiceRollup.error,
      payments.error,
      banks.error,
    ]
      .filter(Boolean)
      .map((e) => (e as { message: string }).message);

    const payRows = payments.data || [];
    const bankRows = banks.data || [];
    const assetRows = assets.data || [];

    const invKpis = invoiceRollup.kpis;

    const bankBalance = bankRows
      .filter((b) => b.status !== 'closed')
      .reduce((s, b) => s + Number(b.current_balance || 0), 0);

    const assetsBook = assetRows
      .filter((a) => a.status !== 'disposed')
      .reduce((s, a) => {
        const bv =
          a.book_value != null
            ? Number(a.book_value)
            : Math.max(0, Number(a.purchase_cost || 0) - Number(a.accumulated_depreciation || 0));
        return s + bv;
      }, 0);

    return {
      success: true,
      summary: {
        coaCount: coaRows.length,
        coaActive: coaRows.filter((c) => c.is_active !== false).length,
        journalsPosted: journalsPosted.count || 0,
        journalsDraft: journalsDraft.count || 0,
        arOpen: invKpis.arOpen,
        arOpenAmount: invKpis.arOpenAmount,
        arOverdue: invKpis.arOverdue,
        arOverdueAmount: invKpis.arOverdueAmount,
        apOpen: invKpis.apOpen,
        apOpenAmount: invKpis.apOpenAmount,
        apOverdue: invKpis.apOverdue,
        apOverdueAmount: invKpis.apOverdueAmount,
        paymentsThisMonth: payRows.length,
        paymentsThisMonthAmount: payRows.reduce((s, p) => s + Number(p.amount || 0), 0),
        bankAccounts: bankRows.length,
        bankBalance,
        unreconciled: bankTxn.count || 0,
        entities: entities.count || 0,
        assets: assetRows.filter((a) => a.status !== 'disposed').length,
        assetsBookValue: assetsBook,
        currency: settings.base_currency || 'ZAR',
      },
      warnings: warnings.length ? warnings : undefined,
      hint:
        warnings.some((w) => w.includes('does not exist') || w.includes('schema cache'))
          ? 'Run supabase/migrations/20260710_accounting_module.sql or RUN_THIS_FOR_BRIEF3.sql'
          : undefined,
    };
}

type InvoiceKpis = {
  arOpen: number;
  arOpenAmount: number;
  arOverdue: number;
  arOverdueAmount: number;
  apOpen: number;
  apOpenAmount: number;
  apOverdue: number;
  apOverdueAmount: number;
};

function kpisFromInvoiceRows(
  invRows: Array<{
    direction?: string | null;
    status?: string | null;
    total_amount?: number | null;
    amount_paid?: number | null;
    due_date?: string | null;
  }>
): InvoiceKpis {
  const ar = invRows.filter((i) => i.direction === 'receivable');
  const ap = invRows.filter((i) => i.direction === 'payable');
  const openAr = ar.filter(
    (i) =>
      !['paid', 'void', 'cancelled'].includes(String(i.status || '')) &&
      invoiceBalance(i) > 0
  );
  const openAp = ap.filter(
    (i) =>
      !['paid', 'void', 'cancelled'].includes(String(i.status || '')) &&
      invoiceBalance(i) > 0
  );
  const overdueAr = openAr.filter((i) => isOverdue(i));
  const overdueAp = openAp.filter((i) => isOverdue(i));
  const sumBal = (
    rows: typeof invRows
  ) => rows.reduce((s, i) => s + invoiceBalance(i), 0);
  return {
    arOpen: openAr.length,
    arOpenAmount: sumBal(openAr),
    arOverdue: overdueAr.length,
    arOverdueAmount: sumBal(overdueAr),
    apOpen: openAp.length,
    apOpenAmount: sumBal(openAp),
    apOverdue: overdueAp.length,
    apOverdueAmount: sumBal(overdueAp),
  };
}

async function loadInvoiceKpis(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
): Promise<{ kpis: InvoiceKpis; error: { message: string } | null }> {
  const rpc = await supabase.rpc('sa_accounting_kpi_rollup', {
    p_profile_id: companyId,
  });
  if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
    const o = rpc.data as Record<string, unknown>;
    if (o.ok !== false) {
      const n = (k: string) => Number(o[k] || 0);
      return {
        kpis: {
          arOpen: n('ar_open'),
          arOpenAmount: n('ar_open_amount'),
          arOverdue: n('ar_overdue'),
          arOverdueAmount: n('ar_overdue_amount'),
          apOpen: n('ap_open'),
          apOpenAmount: n('ap_open_amount'),
          apOverdue: n('ap_overdue'),
          apOverdueAmount: n('ap_overdue_amount'),
        },
        error: null,
      };
    }
  }

  const invoices = await supabase
    .from('invoices')
    .select(
      'id, direction, status, total_amount, amount_paid, due_date, currency'
    )
    .eq('profile_id', companyId)
    .limit(2000);
  return {
    kpis: kpisFromInvoiceRows(invoices.data || []),
    error: invoices.error,
  };
}
