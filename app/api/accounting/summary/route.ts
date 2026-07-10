import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, monthBounds, getOrCreateSettings } from '@/lib/accounting/server';
import { invoiceBalance, isOverdue } from '@/lib/accounting/types';

/** GET ?companyId=&privyUserId= — Accounting hub KPIs */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'view');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { start, end } = monthBounds();

    const [coa, journals, invoices, payments, banks, bankTxn, entities, assets, settings] =
      await Promise.all([
        supabase
          .from('chart_of_accounts')
          .select('id, is_active')
          .eq('profile_id', companyId),
        supabase
          .from('journal_entries')
          .select('id, status')
          .eq('profile_id', companyId),
        supabase
          .from('invoices')
          .select(
            'id, direction, status, total_amount, amount_paid, due_date, currency'
          )
          .eq('profile_id', companyId),
        supabase
          .from('payments')
          .select('id, amount, paid_at, status')
          .eq('profile_id', companyId)
          .gte('paid_at', `${start}T00:00:00`)
          .lte('paid_at', `${end}T23:59:59`),
        supabase
          .from('bank_accounts')
          .select('id, current_balance, status')
          .eq('profile_id', companyId),
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
          .eq('profile_id', companyId),
        getOrCreateSettings(companyId),
      ]);

    const warnings = [
      coa.error,
      journals.error,
      invoices.error,
      payments.error,
      banks.error,
    ]
      .filter(Boolean)
      .map((e) => (e as { message: string }).message);

    const coaRows = coa.data || [];
    const jeRows = journals.data || [];
    const invRows = invoices.data || [];
    const payRows = payments.data || [];
    const bankRows = banks.data || [];
    const assetRows = assets.data || [];

    const ar = invRows.filter((i) => i.direction === 'receivable');
    const ap = invRows.filter((i) => i.direction === 'payable');

    const openAr = ar.filter(
      (i) => !['paid', 'void', 'cancelled'].includes(String(i.status || '')) && invoiceBalance(i) > 0
    );
    const openAp = ap.filter(
      (i) => !['paid', 'void', 'cancelled'].includes(String(i.status || '')) && invoiceBalance(i) > 0
    );
    const overdueAr = openAr.filter((i) => isOverdue(i));
    const overdueAp = openAp.filter((i) => isOverdue(i));

    const sumBal = (rows: typeof invRows) =>
      rows.reduce((s, i) => s + invoiceBalance(i), 0);

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

    return NextResponse.json({
      success: true,
      summary: {
        coaCount: coaRows.length,
        coaActive: coaRows.filter((c) => c.is_active !== false).length,
        journalsPosted: jeRows.filter((j) => j.status === 'posted').length,
        journalsDraft: jeRows.filter((j) => j.status === 'draft').length,
        arOpen: openAr.length,
        arOpenAmount: sumBal(openAr),
        arOverdue: overdueAr.length,
        arOverdueAmount: sumBal(overdueAr),
        apOpen: openAp.length,
        apOpenAmount: sumBal(openAp),
        apOverdue: overdueAp.length,
        apOverdueAmount: sumBal(overdueAp),
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
          ? 'Run supabase/migrations/20260710_accounting_module.sql'
          : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
