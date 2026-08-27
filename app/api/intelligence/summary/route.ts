import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  buildInsights,
  buildScorecards,
  computeHealth,
  type PulseInput,
} from '@/lib/intelligence/engine';
import { filterHealedInsights } from '@/lib/intelligence/insight-lifecycle';
import { loadGoldenPath } from '@/lib/business/golden-path';
import { daysUntil } from '@/lib/sustainability/types';

/**
 * Live BI snapshot from Supabase company data + rule-based insights engine.
 * GET ?companyId=&privyUserId=  or  POST { companyId, privyUserId }
 */
async function buildSummary(request: NextRequest, companyId: number, legacyPrivy: string | null) {
  const gate = await requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivy,
  });
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseServer();
  const { loadHoldingSubtree } = await import(
    '@/lib/business/holding-pipeline'
  );
  const tree = await loadHoldingSubtree(companyId);
  const now = Date.now();
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profileRes,
    connectionsRes,
    srmRes,
    customersRes,
    posRes,
    quotesRes,
    acctInvRes,
    productsRes,
    stockRes,
    pricingRes,
    leadsRes,
    oppsRes,
    containerSalesRes,
    srmRatingsLike,
    inspRes,
    haccpRes,
    sheqIncRes,
    sheqNcrRes,
    emissionsRes,
    targetsRes,
    certsRes,
    projectsRes,
    riadsRes,
    shipsRes,
    mfgRes,
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
      .in('profile_id', tree.ids)
      .limit(800),
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
    // Soft domains — errors ignored
    supabase
      .from('quality_inspections')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(200),
    supabase
      .from('haccp_plans')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(50),
    supabase
      .from('sheq_incidents')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(100),
    supabase
      .from('sheq_ncrs')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(100),
    supabase
      .from('esg_emissions')
      .select('amount_kgco2e')
      .eq('profile_id', companyId)
      .limit(500),
    supabase
      .from('esg_targets')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(50),
    supabase
      .from('sustainability_certificates')
      .select('id, status, expires_at')
      .eq('profile_id', companyId)
      .limit(100),
    supabase
      .from('pm_projects')
      .select('id, status, methodology, methodology_gate')
      .eq('profile_id', companyId)
      .limit(200),
    supabase
      .from('pm_project_riads')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(200),
    supabase
      .from('shipments')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(200),
    supabase
      .from('manufacturing_production_orders')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(100),
  ]);

  const company = profileRes.data;
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

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

  const customers = customersRes.data || [];
  const customersActive = customers.filter(
    (c) =>
      !c.status || ['active', 'customer'].includes(String(c.status).toLowerCase())
  ).length;
  const leads = leadsRes.data || [];
  const openLeads = leads.filter((l) =>
    ['new', 'contacted', 'working', 'qualified'].includes(
      String(l.status || '').toLowerCase()
    )
  ).length;
  const opps = oppsRes.data || [];
  const openOpps = opps.filter(
    (o) =>
      !['closed_won', 'closed_lost'].includes(String(o.stage || '').toLowerCase()) &&
      String(o.status || 'open').toLowerCase() !== 'closed_lost'
  );
  const pipelineValue = openOpps.reduce((s, o) => s + Number(o.amount || 0), 0);

  const pos = posRes.data || [];
  const openPoStatuses = new Set(['draft', 'sent', 'accepted', 'funded']);
  const openPos = pos.filter((p) =>
    openPoStatuses.has(String(p.status || '').toLowerCase())
  );
  const poValue30 = pos
    .filter((p) => p.created_at && p.created_at >= d30)
    .reduce((s, p) => s + Number(p.total_amount || 0), 0);
  const poValuePrev30 = pos
    .filter((p) => p.created_at && p.created_at >= d60 && p.created_at < d30)
    .reduce((s, p) => s + Number(p.total_amount || 0), 0);
  const onchainPos = pos.filter(
    (p) => p.onchain_po_id != null && p.onchain_po_id !== ''
  ).length;

  const quotes = quotesRes.data || [];
  const quotesOpen = quotes.filter((q) =>
    ['draft', 'sent', 'accepted'].includes(String(q.status || '').toLowerCase())
  ).length;
  const quotesValue = quotes
    .filter((q) =>
      ['draft', 'sent', 'accepted'].includes(String(q.status || '').toLowerCase())
    )
    .reduce((s, q) => s + Number(q.total_amount || 0), 0);
  const quotesAccepted = quotes.filter((q) =>
    ['accepted', 'converted'].includes(String(q.status || '').toLowerCase())
  ).length;
  const quoteWinRate =
    quotes.length > 0 ? Math.round((quotesAccepted / quotes.length) * 100) : 0;

  const acct = acctInvRes.data || [];
  const ar = acct.filter((i) => i.direction === 'receivable');
  const ap = acct.filter((i) => i.direction === 'payable');
  const openFin = (s?: string | null) =>
    !['paid', 'void', 'cancelled'].includes(String(s || '').toLowerCase());
  const arOpen = ar.filter((i) => openFin(i.status));
  const apOpen = ap.filter((i) => openFin(i.status));
  const arBalance = arOpen.reduce(
    (s, i) =>
      s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
    0
  );
  const apBalance = apOpen.reduce(
    (s, i) =>
      s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
    0
  );

  const products = productsRes.data || [];
  let multiCcy = 0;
  const ccy = new Set<string>();
  for (const p of products) {
    const prices = Array.isArray(p.prices) ? p.prices : [];
    if (prices.length > 1) multiCcy += 1;
    if (p.base_currency) ccy.add(String(p.base_currency).toUpperCase());
    for (const r of prices) {
      if (r && typeof r === 'object' && (r as { currency?: string }).currency) {
        ccy.add(String((r as { currency: string }).currency).toUpperCase());
      }
    }
  }
  const stock = stockRes.data || [];
  const lowStock = stock.filter(
    (s) => Number(s.qty_on_hand) <= Number(s.reorder_level || 0)
  ).length;
  const stockUnits = stock.reduce((s, r) => s + Number(r.qty_on_hand || 0), 0);

  const pricing = pricingRes.data || [];
  const pricingActive = pricing.filter(
    (p) => String(p.status || '').toLowerCase() === 'active'
  ).length;

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

  const reviews = srmRatingsLike.data || [];
  const given = reviews.filter((r) => Number(r.reviewer_profile_id) === companyId);
  const avgGiven =
    given.length > 0
      ? given.reduce((a, r) => a + Number(r.overall_rating || 0), 0) / given.length
      : 0;

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

  const bySupplier = new Map<number, number>();
  for (const p of pos) {
    const sid = Number(p.supplier_profile_id);
    if (!sid) continue;
    bySupplier.set(sid, (bySupplier.get(sid) || 0) + Number(p.total_amount || 0));
  }
  const poTotalAll =
    Array.from(bySupplier.values()).reduce((a, b) => a + b, 0) || 1;
  const topSupplierShare = Math.round(
    (Math.max(0, ...Array.from(bySupplier.values()), 0) / poTotalAll) * 100
  );

  // Soft domains
  const inspections = inspRes.data || [];
  const inspPassed = inspections.filter((i) => i.status === 'passed').length;
  const inspFailed = inspections.filter((i) => i.status === 'failed').length;
  const inspOpen = inspections.filter((i) => i.status === 'open').length;
  const qualityPassRate =
    inspections.length > 0
      ? Math.round((inspPassed / inspections.length) * 1000) / 10
      : null;

  const sheqOpen = [...(sheqIncRes.data || []), ...(sheqNcrRes.data || [])].filter(
    (x) => !['closed', 'resolved', 'cancelled'].includes(String(x.status || '').toLowerCase())
  ).length;

  const esgTotalKg = (emissionsRes.data || []).reduce(
    (s, e) => s + (Number(e.amount_kgco2e) || 0),
    0
  );
  const esgTargetsActive = (targetsRes.data || []).filter(
    (t) => t.status === 'active'
  ).length;
  const esgCertExpiring = (certsRes.data || []).filter((c) => {
    const d = daysUntil(c.expires_at);
    return d != null && d >= 0 && d <= 90 && c.status === 'active';
  }).length;

  const projects = projectsRes.data || [];
  const projectsActive = projects.filter((p) =>
    ['active', 'planning'].includes(String(p.status || '').toLowerCase())
  ).length;
  const dmaicStuck = projects.filter(
    (p) =>
      (p.methodology === 'dmaic' || p.methodology === 'hybrid') &&
      (p.methodology_gate === 'define' || !p.methodology_gate) &&
      p.status !== 'completed'
  ).length;
  const projectsOpenRiads = (riadsRes.data || []).filter((r) =>
    ['open', 'active', 'in_progress'].includes(String(r.status || 'open'))
  ).length;

  const shipmentsOpen = (shipsRes.data || []).filter(
    (s) =>
      !['delivered', 'cancelled', 'closed'].includes(
        String(s.status || '').toLowerCase()
      )
  ).length;
  const mfOpenOrders = (mfgRes.data || []).filter(
    (o) =>
      !['completed', 'cancelled', 'closed'].includes(
        String(o.status || '').toLowerCase()
      )
  ).length;

  // Golden path stuck counts (soft — never fail summary)
  let stuckReceive = 0;
  let stuckSettle = 0;
  let escrowAwaitingRelease = 0;
  try {
    const gp = await loadGoldenPath(companyId, 30);
    stuckReceive = gp.summary.stuck_receive;
    stuckSettle = gp.summary.stuck_settle;
    escrowAwaitingRelease = gp.summary.escrow_awaiting_release;
  } catch {
    /* soft */
  }

  // Super-Cube® leadership faces from saved progress
  let leadershipWeakScore: number | undefined;
  let leadershipWeakFace: string | undefined;
  let leadershipPhysical: number | undefined;
  let leadershipEmotional: number | undefined;
  let leadershipChoices: number | undefined;
  let leadershipAssessed = false;
  try {
    const lp = company.leadership_progress as {
      dimensions?: Record<string, number>;
      scores?: Record<string, number[]>;
      step?: string;
    } | null;
    if (lp && (lp.dimensions || lp.scores)) {
      leadershipAssessed = true;
      const dims =
        lp.dimensions ||
        Object.fromEntries(
          Object.entries(lp.scores || {}).map(([k, arr]) => {
            const a = Array.isArray(arr) ? arr : [];
            const avg = a.length
              ? Math.round(a.reduce((x, y) => x + y, 0) / a.length)
              : 5;
            return [k, avg];
          })
        );
      const entries = Object.entries(dims).filter(([, v]) => typeof v === 'number');
      if (entries.length) {
        entries.sort((a, b) => Number(a[1]) - Number(b[1]));
        leadershipWeakFace = entries[0][0];
        leadershipWeakScore = Number(entries[0][1]);
        leadershipPhysical = Number(dims.physical);
        leadershipEmotional = Number(dims.emotional);
        leadershipChoices = Number(dims.choices);
      }
    }
  } catch {
    /* soft */
  }

  const pulse: PulseInput = {
    networkAccepted: netAccepted,
    networkPendingIn: netPendingIn,
    networkPendingOut: netPendingOut,
    pricingActive,
    walletReady: Boolean(company.wallet_address),
    srmBook: srm.length,
    srmConnected,
    srmAvgOtifef: Math.round(srmAvgOtifef * 10) / 10,
    srmAvgTrust: Math.round(srmAvgTrust * 10) / 10,
    srmVerified,
    customers: customers.length,
    customersActive,
    openLeads,
    openOpps: openOpps.length,
    pipelineValue,
    openPos: openPos.length,
    onchainPos,
    poValue30,
    poGrowth,
    quotesOpen,
    quotesValue,
    quoteWinRate,
    quotesCount: quotes.length,
    arOpen: arOpen.length,
    arBalance,
    apOpen: apOpen.length,
    apBalance,
    products: products.length,
    multiCurrencyProducts: multiCcy,
    currencyCount: ccy.size,
    lowStock,
    stockUnits,
    sales30,
    salesGrowth,
    topSupplierShare,
    supplierPoCount: bySupplier.size,
    qualityFailed: inspFailed,
    qualityOpen: inspOpen,
    qualityPassRate,
    haccpPlans: (haccpRes.data || []).length,
    sheqOpen,
    esgTotalKg,
    esgTargetsActive,
    esgCertExpiring,
    projectsActive,
    projectsOpenRiads,
    dmaicStuck,
    mfOpenOrders,
    shipmentsOpen,
    stuckReceive,
    stuckSettle,
    escrowAwaitingRelease,
    leadershipWeakScore,
    leadershipWeakFace,
    leadershipPhysical,
    leadershipEmotional,
    leadershipChoices,
    leadershipAssessed,
  };

  const health = computeHealth(pulse);
  const rawInsights = buildInsights(pulse);
  // Server-side auto-close: drop issues whose metrics have healed
  let insights = filterHealedInsights(rawInsights, pulse);
  try {
    const { loadAdvisorInsights } = await import('@/lib/core-os/server');
    insights = [...insights, ...(await loadAdvisorInsights(companyId))];
  } catch {
    /* Advisor pulse is additive */
  }
  const scorecards = buildScorecards(health, pulse);

  const forecastPoNext30 =
    poValuePrev30 > 0
      ? Math.round(
          poValue30 * (1 + (poValue30 - poValuePrev30) / Math.max(poValuePrev30, 1))
        )
      : Math.round(poValue30 * 1.05);
  const forecastSalesNext30 =
    salesPrev > 0
      ? Math.round(sales30 * (1 + (sales30 - salesPrev) / Math.max(salesPrev, 1)))
      : Math.round(sales30 * 1.05);

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
    health,
    pulse: {
      networkAccepted: pulse.networkAccepted,
      networkPendingIn: pulse.networkPendingIn,
      networkPendingOut: pulse.networkPendingOut,
      pricingActive: pulse.pricingActive,
      srmBook: pulse.srmBook,
      srmConnected: pulse.srmConnected,
      srmAvgOtifef: pulse.srmAvgOtifef,
      srmAvgTrust: pulse.srmAvgTrust,
      srmVerified: pulse.srmVerified,
      customers: pulse.customers,
      customersActive: pulse.customersActive,
      openLeads: pulse.openLeads,
      pipelineValue: pulse.pipelineValue,
      openOpps: pulse.openOpps,
      openPos: pulse.openPos,
      onchainPos: pulse.onchainPos,
      poValue30: pulse.poValue30,
      poGrowth: pulse.poGrowth,
      quotesOpen: pulse.quotesOpen,
      quotesValue: pulse.quotesValue,
      quoteWinRate: pulse.quoteWinRate,
      arOpen: pulse.arOpen,
      arBalance: pulse.arBalance,
      apOpen: pulse.apOpen,
      apBalance: pulse.apBalance,
      products: pulse.products,
      multiCurrencyProducts: pulse.multiCurrencyProducts,
      currencies: Array.from(ccy).sort(),
      lowStock: pulse.lowStock,
      stockUnits: pulse.stockUnits,
      sales30: pulse.sales30,
      salesGrowth: pulse.salesGrowth,
      avgRatingGiven: Math.round(avgGiven * 10) / 10,
      reviewsGiven: given.length,
      qualityPassRate: pulse.qualityPassRate,
      qualityFailed: pulse.qualityFailed,
      haccpPlans: pulse.haccpPlans,
      sheqOpen: pulse.sheqOpen,
      esgTotalKg: pulse.esgTotalKg,
      esgTargetsActive: pulse.esgTargetsActive,
      esgCertExpiring: pulse.esgCertExpiring,
      projectsActive: pulse.projectsActive,
      projectsOpenRiads: pulse.projectsOpenRiads,
      dmaicStuck: pulse.dmaicStuck,
      mfOpenOrders: pulse.mfOpenOrders,
      shipmentsOpen: pulse.shipmentsOpen,
    },
    // Raw pulse for simulation lab
    pulseModel: pulse,
    forecasts: {
      poNext30: forecastPoNext30,
      salesNext30: forecastSalesNext30,
      arCollectionRisk: Math.round(arBalance * 0.15),
      poGrowth,
      salesGrowth,
      horizonDays: 30,
      method: 'trailing-period trend projection',
    },
    scorecards,
    insights: insights.slice(0, 24),
    concentration: {
      topSupplierShare,
      supplierCount: bySupplier.size,
    },
    domains: {
      quality: !inspRes.error,
      esg: !emissionsRes.error,
      projects: !projectsRes.error,
      manufacturing: !mfgRes.error,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    return await buildSummary(
      request,
      companyId,
      legacyPrivyFrom(request)
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Intelligence error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    return await buildSummary(
      request,
      companyId,
      legacyPrivyFrom(request, body)
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Intelligence error' },
      { status: 500 }
    );
  }
}
