import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST /api/intelligence/summary
 * World-class BI snapshot from live Supabase company data.
 * Body: { companyId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const now = Date.now();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profileRes,
      connectionsRes,
      srmRes,
      customersRes,
      posRes,
      quotesRes,
      custInvRes,
      acctInvRes,
      productsRes,
      stockRes,
      pricingRes,
      leadsRes,
      oppsRes,
      containerSalesRes,
      srmRatingsLike,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, trading_name, industry, country, city, verification_status, trust_score, primary_currency, wallet_address, leadership_progress'
        )
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('business_connections')
        .select(
          'id, status, requester_profile_id, requestee_profile_id, connection_type, metadata, updated_at'
        )
        .or(`requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`),
      supabase
        .from('srm_suppliers')
        .select(
          'id, trading_name, status, invite_status, trust_score, otifef_pct, verified, linked_profile_id, rating_avg, rating_count'
        )
        .eq('profile_id', companyId)
        .limit(300),
      supabase
        .from('customers')
        .select('id, status, invite_status, trading_name, created_at')
        .eq('profile_id', companyId)
        .limit(300),
      supabase
        .from('purchase_orders')
        .select(
          'id, status, total_amount, currency, created_at, onchain_po_id, supplier_profile_id, buyer_profile_id'
        )
        .eq('buyer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('customer_quotes')
        .select('id, status, total_amount, currency, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(150),
      supabase
        .from('customer_invoices')
        .select('id, status, total_amount, amount_paid, currency, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(150),
      supabase
        .from('invoices')
        .select('id, direction, status, total_amount, amount_paid, currency, created_at')
        .eq('profile_id', companyId)
        .limit(200),
      supabase
        .from('products')
        .select('id, name, base_currency, prices, sell_price, cost_price, status')
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('stock_levels')
        .select('id, qty_on_hand, reorder_level, product_id')
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('pricing_agreements')
        .select('id, status, seller_profile_id, buyer_profile_id, currency, updated_at')
        .or(`seller_profile_id.eq.${companyId},buyer_profile_id.eq.${companyId}`)
        .limit(100),
      supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('profile_id', companyId)
        .limit(200),
      supabase
        .from('opportunities')
        .select('id, stage, status, amount, updated_at')
        .eq('profile_id', companyId)
        .limit(200),
      supabase
        .from('container_sales')
        .select('id, gross_amount, sale_date, created_at')
        .eq('profile_id', companyId)
        .order('sale_date', { ascending: false })
        .limit(120),
      supabase
        .from('po_reviews')
        .select('id, overall_rating, reviewee_profile_id, reviewer_profile_id, created_at')
        .or(`reviewer_profile_id.eq.${companyId},reviewee_profile_id.eq.${companyId}`)
        .limit(100),
    ]);

    const company = profileRes.data;
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Network
    const conns = (connectionsRes.data || []).filter((c) => {
      const a = Number(c.requester_profile_id);
      const b = Number(c.requestee_profile_id);
      return a > 0 && b > 0;
    });
    const netAccepted = conns.filter((c) => c.status === 'accepted').length;
    const netPendingIn = conns.filter(
      (c) => c.status === 'pending' && Number(c.requestee_profile_id) === companyId
    ).length;
    const netPendingOut = conns.filter(
      (c) => c.status === 'pending' && Number(c.requester_profile_id) === companyId
    ).length;

    // SRM
    const srm = srmRes.data || [];
    const srmConnected = srm.filter(
      (s) => s.invite_status === 'accepted' || s.linked_profile_id
    ).length;
    const srmAvgTrust =
      srm.length > 0
        ? srm.reduce((a, s) => a + Number(s.trust_score || 0), 0) / srm.length
        : 0;
    const srmAvgOtifef =
      srm.length > 0
        ? srm.reduce((a, s) => a + Number(s.otifef_pct || 0), 0) / srm.length
        : 0;
    const srmVerified = srm.filter((s) => s.verified).length;

    // CRM
    const customers = customersRes.data || [];
    const customersActive = customers.filter(
      (c) => !c.status || ['active', 'customer'].includes(String(c.status).toLowerCase())
    ).length;
    const leads = leadsRes.data || [];
    const openLeads = leads.filter((l) =>
      ['new', 'contacted', 'working', 'qualified'].includes(String(l.status || '').toLowerCase())
    ).length;
    const opps = oppsRes.data || [];
    const openOpps = opps.filter(
      (o) =>
        !['closed_won', 'closed_lost'].includes(String(o.stage || '').toLowerCase()) &&
        String(o.status || 'open').toLowerCase() !== 'closed_lost'
    );
    const pipelineValue = openOpps.reduce((s, o) => s + Number(o.amount || 0), 0);

    // POs
    const pos = posRes.data || [];
    const openPoStatuses = new Set(['draft', 'sent', 'accepted', 'funded']);
    const openPos = pos.filter((p) => openPoStatuses.has(String(p.status || '').toLowerCase()));
    const poValue30 = pos
      .filter((p) => p.created_at && p.created_at >= d30)
      .reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const poValuePrev30 = pos
      .filter((p) => p.created_at && p.created_at >= d60 && p.created_at < d30)
      .reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const onchainPos = pos.filter((p) => p.onchain_po_id != null && p.onchain_po_id !== '').length;

    // Quotes / CRM invoices
    const quotes = quotesRes.data || [];
    const quotesOpen = quotes.filter((q) =>
      ['draft', 'sent', 'accepted'].includes(String(q.status || '').toLowerCase())
    ).length;
    const quotesValue = quotes
      .filter((q) => ['draft', 'sent', 'accepted'].includes(String(q.status || '').toLowerCase()))
      .reduce((s, q) => s + Number(q.total_amount || 0), 0);
    const quotesAccepted = quotes.filter(
      (q) => String(q.status || '').toLowerCase() === 'accepted' || String(q.status).toLowerCase() === 'converted'
    ).length;
    const quoteWinRate =
      quotes.length > 0 ? Math.round((quotesAccepted / quotes.length) * 100) : 0;

    // Accounting AR/AP
    const acct = acctInvRes.data || [];
    const ar = acct.filter((i) => i.direction === 'receivable');
    const ap = acct.filter((i) => i.direction === 'payable');
    const openFin = (s?: string | null) =>
      !['paid', 'void', 'cancelled'].includes(String(s || '').toLowerCase());
    const arOpen = ar.filter((i) => openFin(i.status));
    const apOpen = ap.filter((i) => openFin(i.status));
    const arBalance = arOpen.reduce(
      (s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
      0
    );
    const apBalance = apOpen.reduce(
      (s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
      0
    );

    // Products / inventory
    const products = productsRes.data || [];
    let multiCcy = 0;
    const ccy = new Set<string>();
    let catalogueValue = 0;
    for (const p of products) {
      const prices = Array.isArray(p.prices) ? p.prices : [];
      if (prices.length > 1) multiCcy += 1;
      if (p.base_currency) ccy.add(String(p.base_currency).toUpperCase());
      for (const r of prices) {
        if (r && typeof r === 'object' && (r as { currency?: string }).currency) {
          ccy.add(String((r as { currency: string }).currency).toUpperCase());
        }
      }
      catalogueValue += Number(p.sell_price || 0);
    }
    const stock = stockRes.data || [];
    const lowStock = stock.filter(
      (s) => Number(s.qty_on_hand) <= Number(s.reorder_level || 0)
    ).length;
    const stockUnits = stock.reduce((s, r) => s + Number(r.qty_on_hand || 0), 0);

    // Pricing agreements
    const pricing = pricingRes.data || [];
    const pricingActive = pricing.filter(
      (p) => String(p.status || '').toLowerCase() === 'active'
    ).length;

    // Container sales trend
    const sales = containerSalesRes.data || [];
    const sales30 = sales
      .filter((s) => (s.sale_date || s.created_at || '') >= d30.slice(0, 10))
      .reduce((a, s) => a + Number(s.gross_amount || 0), 0);
    const salesPrev = sales
      .filter((s) => {
        const d = s.sale_date || (s.created_at || '').slice(0, 10);
        return d >= d60.slice(0, 10) && d < d30.slice(0, 10);
      })
      .reduce((a, s) => a + Number(s.gross_amount || 0), 0);

    // Reviews
    const reviews = srmRatingsLike.data || [];
    const given = reviews.filter((r) => Number(r.reviewer_profile_id) === companyId);
    const avgGiven =
      given.length > 0
        ? given.reduce((a, r) => a + Number(r.overall_rating || 0), 0) / given.length
        : 0;

    // Growth rates
    const poGrowth =
      poValuePrev30 > 0
        ? Math.round(((poValue30 - poValuePrev30) / poValuePrev30) * 100)
        : poValue30 > 0
          ? 100
          : 0;
    const salesGrowth =
      salesPrev > 0
        ? Math.round(((sales30 - salesPrev) / salesPrev) * 100)
        : sales30 > 0
          ? 100
          : 0;

    // Composite health scores 0–100
    const networkScore = Math.min(
      100,
      netAccepted * 12 +
        (netPendingIn === 0 ? 15 : Math.max(0, 15 - netPendingIn * 3)) +
        pricingActive * 8 +
        (company.wallet_address ? 10 : 0)
    );
    const supplyScore = Math.min(
      100,
      Math.round(srmAvgOtifef * 0.45 + srmAvgTrust * 0.35) +
        Math.min(srmConnected * 3, 15) +
        Math.min(srmVerified * 2, 10)
    );
    const demandScore = Math.min(
      100,
      Math.min(customersActive * 4, 30) +
        Math.min(openOpps.length * 5, 25) +
        Math.min(quoteWinRate * 0.3, 25) +
        (pipelineValue > 0 ? 20 : 0)
    );
    const financeScore = Math.min(
      100,
      (arBalance === 0 && apBalance === 0 ? 40 : 20) +
        Math.max(0, 40 - Math.min(arOpen.length * 4, 30)) +
        Math.max(0, 20 - Math.min(apOpen.length * 3, 20))
    );
    const opsScore = Math.min(
      100,
      Math.min(products.length * 2, 30) +
        (lowStock === 0 ? 25 : Math.max(0, 25 - lowStock * 3)) +
        multiCcy * 5 +
        Math.min(stockUnits > 0 ? 20 : 0, 20) +
        (ccy.size > 1 ? 15 : 5)
    );
    const overallHealth = Math.round(
      (networkScore + supplyScore + demandScore + financeScore + opsScore) / 5
    );

    // Insights (rule-based intelligence from live data)
    const insights: Array<{
      id: string;
      severity: 'critical' | 'warning' | 'positive' | 'info';
      title: string;
      detail: string;
      href: string;
      metric?: string;
    }> = [];

    if (netPendingIn > 0) {
      insights.push({
        id: 'pending-in',
        severity: 'warning',
        title: `${netPendingIn} connection request${netPendingIn === 1 ? '' : 's'} awaiting you`,
        detail: 'Accept partners to unlock pricing agreements, POs, and multi-currency trade.',
        href: '/dashboard/connections',
        metric: String(netPendingIn),
      });
    }
    if (netAccepted === 0) {
      insights.push({
        id: 'no-network',
        severity: 'info',
        title: 'Build your company network',
        detail: 'Discover and connect with platform companies to activate the trade graph.',
        href: '/dashboard/suppliers/discover',
      });
    }
    if (srmAvgOtifef > 0 && srmAvgOtifef < 80) {
      insights.push({
        id: 'otifef-low',
        severity: 'warning',
        title: `Supplier OTIFEF at ${srmAvgOtifef.toFixed(0)}%`,
        detail: 'Below 80% target — review delivery performance and open POs.',
        href: '/dashboard/suppliers/performance',
        metric: `${srmAvgOtifef.toFixed(0)}%`,
      });
    } else if (srmAvgOtifef >= 90) {
      insights.push({
        id: 'otifef-strong',
        severity: 'positive',
        title: `Excellent OTIFEF · ${srmAvgOtifef.toFixed(0)}%`,
        detail: 'Supply partners are delivering on time, in full, and error-free.',
        href: '/dashboard/suppliers/performance',
        metric: `${srmAvgOtifef.toFixed(0)}%`,
      });
    }
    if (lowStock > 0) {
      insights.push({
        id: 'low-stock',
        severity: lowStock > 5 ? 'critical' : 'warning',
        title: `${lowStock} SKU${lowStock === 1 ? '' : 's'} at reorder level`,
        detail: 'Warehouse stock is below threshold — plan replenishment or POs.',
        href: '/dashboard/inventory/stock',
        metric: String(lowStock),
      });
    }
    if (arBalance > 0 && arOpen.length > 0) {
      insights.push({
        id: 'ar-exposure',
        severity: arOpen.length > 5 ? 'warning' : 'info',
        title: 'Accounts receivable exposure',
        detail: `${arOpen.length} open AR invoice${arOpen.length === 1 ? '' : 's'} · ~${Math.round(arBalance).toLocaleString()} outstanding.`,
        href: '/dashboard/accounting/accounts-receivable',
        metric: Math.round(arBalance).toLocaleString(),
      });
    }
    if (pricingActive === 0 && netAccepted > 0) {
      insights.push({
        id: 'pricing-gap',
        severity: 'info',
        title: 'No active pricing agreements',
        detail: 'Connected companies without list prices — set wholesale terms for global trade.',
        href: '/dashboard/connections/pricing',
      });
    }
    if (multiCcy === 0 && products.length > 0) {
      insights.push({
        id: 'single-ccy',
        severity: 'info',
        title: 'Catalogue is single-currency',
        detail: 'Add USD/EUR (or regional) list prices on products for global quoting.',
        href: '/dashboard/inventory/products',
      });
    } else if (multiCcy > 0) {
      insights.push({
        id: 'multi-ccy',
        severity: 'positive',
        title: `${multiCcy} multi-currency product${multiCcy === 1 ? '' : 's'}`,
        detail: `Catalogue spans ${ccy.size} currencies — ready for global quotes.`,
        href: '/dashboard/inventory/products',
        metric: String(ccy.size),
      });
    }
    if (poGrowth !== 0) {
      insights.push({
        id: 'po-trend',
        severity: poGrowth >= 0 ? 'positive' : 'warning',
        title: `PO spend ${poGrowth >= 0 ? 'up' : 'down'} ${Math.abs(poGrowth)}% vs prior 30d`,
        detail: `Last 30 days procurement value vs previous period.`,
        href: '/dashboard/suppliers/po',
        metric: `${poGrowth > 0 ? '+' : ''}${poGrowth}%`,
      });
    }
    if (openLeads > 5 && openOpps.length === 0) {
      insights.push({
        id: 'leads-stuck',
        severity: 'warning',
        title: `${openLeads} open leads without opportunities`,
        detail: 'Convert qualified leads into pipeline to protect revenue forecast.',
        href: '/dashboard/customers/leads',
      });
    }
    if (quoteWinRate > 0 && quoteWinRate < 25 && quotes.length >= 4) {
      insights.push({
        id: 'quote-win',
        severity: 'warning',
        title: `Quote win rate ${quoteWinRate}%`,
        detail: 'Review pricing competitiveness and follow-up discipline on open quotes.',
        href: '/dashboard/customers/quotes',
        metric: `${quoteWinRate}%`,
      });
    }

    // Forecasts (simple trend projection)
    const forecastPoNext30 =
      poValuePrev30 > 0
        ? Math.round(poValue30 * (1 + (poValue30 - poValuePrev30) / Math.max(poValuePrev30, 1)))
        : Math.round(poValue30 * 1.05);
    const forecastSalesNext30 =
      salesPrev > 0
        ? Math.round(sales30 * (1 + (sales30 - salesPrev) / Math.max(salesPrev, 1)))
        : Math.round(sales30 * 1.05);
    const forecastArRisk = Math.round(arBalance * 0.15); // simplistic 15% collection risk

    // Scorecard dimensions
    const scorecards = [
      {
        id: 'network',
        label: 'Network health',
        score: Math.round(networkScore),
        detail: `${netAccepted} connected · ${pricingActive} pricing`,
        href: '/dashboard/connections',
      },
      {
        id: 'supply',
        label: 'Supply chain',
        score: Math.round(supplyScore),
        detail: `OTIFEF ${srmAvgOtifef.toFixed(0)}% · trust ${srmAvgTrust.toFixed(0)}`,
        href: '/dashboard/suppliers/performance',
      },
      {
        id: 'demand',
        label: 'Demand / CRM',
        score: Math.round(demandScore),
        detail: `${customersActive} customers · pipeline ${Math.round(pipelineValue).toLocaleString()}`,
        href: '/dashboard/customers',
      },
      {
        id: 'finance',
        label: 'Finance control',
        score: Math.round(financeScore),
        detail: `AR ${arOpen.length} · AP ${apOpen.length}`,
        href: '/dashboard/accounting',
      },
      {
        id: 'ops',
        label: 'Operations',
        score: Math.round(opsScore),
        detail: `${products.length} SKUs · ${lowStock} low stock`,
        href: '/dashboard/inventory',
      },
    ];

    // Concentration: top supplier share of POs
    const bySupplier = new Map<number, number>();
    for (const p of pos) {
      const sid = Number(p.supplier_profile_id);
      if (!sid) continue;
      bySupplier.set(sid, (bySupplier.get(sid) || 0) + Number(p.total_amount || 0));
    }
    const poTotalAll = Array.from(bySupplier.values()).reduce((a, b) => a + b, 0) || 1;
    const topSupplierShare = Math.round(
      (Math.max(0, ...Array.from(bySupplier.values()), 0) / poTotalAll) * 100
    );
    if (topSupplierShare >= 60 && bySupplier.size > 1) {
      insights.push({
        id: 'supplier-concentration',
        severity: 'warning',
        title: `Supplier concentration ${topSupplierShare}%`,
        detail: 'One supplier dominates PO spend — diversify to reduce supply risk.',
        href: '/dashboard/suppliers/network',
        metric: `${topSupplierShare}%`,
      });
    }

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      company: {
        id: company.id,
        trading_name: company.trading_name,
        industry: company.industry,
        country: company.country,
        city: company.city,
        verification_status: company.verification_status,
        trust_score: company.trust_score,
        primary_currency: company.primary_currency || 'ZAR',
        wallet_address: company.wallet_address,
        leadership_progress: company.leadership_progress || null,
      },
      health: {
        overall: overallHealth,
        network: Math.round(networkScore),
        supply: Math.round(supplyScore),
        demand: Math.round(demandScore),
        finance: Math.round(financeScore),
        ops: Math.round(opsScore),
      },
      pulse: {
        networkAccepted: netAccepted,
        networkPendingIn: netPendingIn,
        networkPendingOut: netPendingOut,
        pricingActive,
        srmBook: srm.length,
        srmConnected,
        srmAvgOtifef: Math.round(srmAvgOtifef * 10) / 10,
        srmAvgTrust: Math.round(srmAvgTrust * 10) / 10,
        srmVerified,
        customers: customers.length,
        customersActive,
        openLeads,
        pipelineValue,
        openOpps: openOpps.length,
        openPos: openPos.length,
        onchainPos,
        poValue30,
        poGrowth,
        quotesOpen,
        quotesValue,
        quoteWinRate,
        arOpen: arOpen.length,
        arBalance,
        apOpen: apOpen.length,
        apBalance,
        products: products.length,
        multiCurrencyProducts: multiCcy,
        currencies: Array.from(ccy).sort(),
        lowStock,
        stockUnits,
        sales30,
        salesGrowth,
        avgRatingGiven: Math.round(avgGiven * 10) / 10,
        reviewsGiven: given.length,
      },
      forecasts: {
        poNext30: forecastPoNext30,
        salesNext30: forecastSalesNext30,
        arCollectionRisk: forecastArRisk,
        poGrowth,
        salesGrowth,
        horizonDays: 30,
        method: 'trailing-period trend projection',
      },
      scorecards,
      insights: insights.slice(0, 12),
      concentration: {
        topSupplierShare,
        supplierCount: bySupplier.size,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Intelligence error' },
      { status: 500 }
    );
  }
}
