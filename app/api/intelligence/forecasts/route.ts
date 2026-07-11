import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { forecastSeries, toMonthlySeries } from '@/lib/ml/forecast';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&privyUserId=&horizon=6
 * Real statistical ML forecasts from PO / invoice / container sales history.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    const horizon = Math.min(12, Math.max(1, Number(sp.get('horizon')) || 6));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const since = new Date(Date.now() - 730 * 86400000).toISOString(); // 24 months

    const [buyerPos, sellerInv, custQuotes, containerSales, products] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id, total_amount, total, currency, status, created_at')
        .eq('buyer_profile_id', companyId)
        .gte('created_at', since)
        .limit(2000),
      supabase
        .from('customer_invoices')
        .select('id, total_amount, currency, status, created_at, invoice_date')
        .eq('profile_id', companyId)
        .gte('created_at', since)
        .limit(2000),
      supabase
        .from('customer_quotes')
        .select('id, total_amount, status, created_at')
        .eq('profile_id', companyId)
        .gte('created_at', since)
        .limit(1000),
      supabase
        .from('container_sales')
        .select('id, total_amount, amount, created_at')
        .eq('profile_id', companyId)
        .gte('created_at', since)
        .limit(1000),
      supabase
        .from('stock_movements')
        .select('id, quantity, movement_type, created_at')
        .eq('profile_id', companyId)
        .in('movement_type', ['receive', 'sale', 'issue', 'ship'])
        .gte('created_at', since)
        .limit(3000),
    ]);

    const poRows = (buyerPos.data || [])
      .filter((p) => !['cancelled', 'draft'].includes(String(p.status || '').toLowerCase()))
      .map((p) => ({
        date: p.created_at,
        amount: Number(p.total_amount ?? p.total ?? 0),
      }));

    const invRows = (sellerInv.data || []).map((i) => ({
      date: i.invoice_date || i.created_at,
      amount: Number(i.total_amount || 0),
    }));

    const salesRows = (containerSales.data || []).map((s) => ({
      date: s.created_at,
      amount: Number(s.total_amount ?? s.amount ?? 0),
    }));

    // Combined revenue-like series: invoices + container sales preferred; else POs
    const revenueSource =
      invRows.length >= 3
        ? invRows
        : salesRows.length >= 3
          ? salesRows
          : poRows;

    const revenueMonthly = toMonthlySeries(revenueSource);
    const revenueForecast = forecastSeries(revenueMonthly, horizon);

    const poMonthly = toMonthlySeries(poRows);
    const procurementForecast = forecastSeries(poMonthly, horizon);

    const demandRows = (products.data || [])
      .filter((m) => Number(m.quantity) !== 0)
      .map((m) => ({
        date: m.created_at,
        amount: Math.abs(Number(m.quantity || 0)),
      }));
    const demandMonthly = toMonthlySeries(demandRows);
    const demandForecast = forecastSeries(demandMonthly, horizon);

    const quoteWin =
      (custQuotes.data || []).length > 0
        ? {
            total: custQuotes.data!.length,
            won: custQuotes.data!.filter((q) =>
              ['accepted', 'won', 'converted'].includes(String(q.status || '').toLowerCase())
            ).length,
          }
        : null;

    return NextResponse.json({
      success: true,
      horizon_months: horizon,
      method: 'ensemble_linear_regression_holt',
      series: {
        revenue: {
          label: invRows.length >= 3 ? 'Customer invoices' : salesRows.length >= 3 ? 'Container sales' : 'Purchase orders (proxy)',
          ...revenueForecast,
        },
        procurement: {
          label: 'Buyer PO spend',
          ...procurementForecast,
        },
        demand_units: {
          label: 'Stock movement units',
          ...demandForecast,
        },
      },
      pipeline: quoteWin
        ? {
            quotes: quoteWin.total,
            won: quoteWin.won,
            win_rate:
              quoteWin.total > 0
                ? Math.round((quoteWin.won / quoteWin.total) * 1000) / 10
                : null,
          }
        : null,
      data_quality: {
        po_rows: poRows.length,
        invoice_rows: invRows.length,
        sales_rows: salesRows.length,
        movement_rows: demandRows.length,
        months_revenue: revenueMonthly.length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
