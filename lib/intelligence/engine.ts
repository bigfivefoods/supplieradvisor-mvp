/**
 * Rule-based business intelligence engine.
 * Transparent thresholds — not a black-box model.
 */

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info';

export type Insight = {
  id: string;
  severity: InsightSeverity;
  domain:
    | 'network'
    | 'supply'
    | 'demand'
    | 'finance'
    | 'ops'
    | 'quality'
    | 'esg'
    | 'projects'
    | 'people';
  title: string;
  detail: string;
  href: string;
  metric?: string;
  action?: string;
};

export type PulseInput = {
  networkAccepted: number;
  networkPendingIn: number;
  networkPendingOut: number;
  pricingActive: number;
  walletReady: boolean;
  srmBook: number;
  srmConnected: number;
  srmAvgOtifef: number;
  srmAvgTrust: number;
  srmVerified: number;
  customers: number;
  customersActive: number;
  openLeads: number;
  openOpps: number;
  pipelineValue: number;
  openPos: number;
  onchainPos: number;
  poValue30: number;
  poGrowth: number;
  quotesOpen: number;
  quotesValue: number;
  quoteWinRate: number;
  quotesCount: number;
  arOpen: number;
  arBalance: number;
  apOpen: number;
  apBalance: number;
  products: number;
  multiCurrencyProducts: number;
  currencyCount: number;
  lowStock: number;
  stockUnits: number;
  sales30: number;
  salesGrowth: number;
  topSupplierShare: number;
  supplierPoCount: number;
  // Extended domains (optional / soft)
  qualityFailed?: number;
  qualityOpen?: number;
  qualityPassRate?: number | null;
  haccpPlans?: number;
  sheqOpen?: number;
  esgTotalKg?: number;
  esgTargetsActive?: number;
  esgCertExpiring?: number;
  projectsActive?: number;
  projectsOpenRiads?: number;
  dmaicStuck?: number;
  mfOpenOrders?: number;
  shipmentsOpen?: number;
  // Golden path stuck stages
  stuckReceive?: number;
  stuckSettle?: number;
  escrowAwaitingRelease?: number;
  // Super-Cube® leadership (optional, 1–10 face scores)
  leadershipWeakScore?: number;
  leadershipWeakFace?: string;
  leadershipPhysical?: number;
  leadershipEmotional?: number;
  leadershipChoices?: number;
  leadershipAssessed?: boolean;
};

export type HealthScores = {
  overall: number;
  network: number;
  supply: number;
  demand: number;
  finance: number;
  ops: number;
  quality: number;
  esg: number;
};

export function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

export function computeHealth(p: PulseInput): HealthScores {
  const network = clamp(
    p.networkAccepted * 12 +
      (p.networkPendingIn === 0 ? 15 : Math.max(0, 15 - p.networkPendingIn * 3)) +
      p.pricingActive * 8 +
      (p.walletReady ? 10 : 0)
  );
  const supply = clamp(
    Math.round(p.srmAvgOtifef * 0.45 + p.srmAvgTrust * 0.35) +
      Math.min(p.srmConnected * 3, 15) +
      Math.min(p.srmVerified * 2, 10)
  );
  const demand = clamp(
    Math.min(p.customersActive * 4, 30) +
      Math.min(p.openOpps * 5, 25) +
      Math.min(p.quoteWinRate * 0.3, 25) +
      (p.pipelineValue > 0 ? 20 : 0)
  );
  const finance = clamp(
    (p.arBalance === 0 && p.apBalance === 0 ? 40 : 20) +
      Math.max(0, 40 - Math.min(p.arOpen * 4, 30)) +
      Math.max(0, 20 - Math.min(p.apOpen * 3, 20))
  );
  const ops = clamp(
    Math.min(p.products * 2, 30) +
      (p.lowStock === 0 ? 25 : Math.max(0, 25 - p.lowStock * 3)) +
      p.multiCurrencyProducts * 5 +
      (p.stockUnits > 0 ? 20 : 0) +
      (p.currencyCount > 1 ? 15 : 5)
  );

  // Quality score from pass rate + open issues
  let quality = 55;
  if (p.qualityPassRate != null) {
    quality = clamp(Math.round(Number(p.qualityPassRate) * 0.7 + (p.haccpPlans || 0) * 3));
  } else if ((p.haccpPlans || 0) > 0) {
    quality = 65;
  }
  if ((p.qualityFailed || 0) > 0) quality = clamp(quality - p.qualityFailed! * 8);
  if ((p.sheqOpen || 0) > 3) quality = clamp(quality - 10);

  // ESG score
  let esg = 40;
  if ((p.esgTotalKg || 0) > 0) esg += 20;
  if ((p.esgTargetsActive || 0) > 0) esg += 20;
  if ((p.esgCertExpiring || 0) === 0 && (p.esgTargetsActive || 0) > 0) esg += 10;
  if ((p.esgCertExpiring || 0) > 0) esg = clamp(esg - p.esgCertExpiring! * 8);
  esg = clamp(esg);

  const core = [network, supply, demand, finance, ops];
  const overall = Math.round(core.reduce((a, b) => a + b, 0) / core.length);

  return {
    overall,
    network: Math.round(network),
    supply: Math.round(supply),
    demand: Math.round(demand),
    finance: Math.round(finance),
    ops: Math.round(ops),
    quality: Math.round(quality),
    esg: Math.round(esg),
  };
}

export function buildInsights(p: PulseInput): Insight[] {
  const insights: Insight[] = [];

  // ── Network ────────────────────────────────────────────────────────────
  if (p.networkPendingIn > 0) {
    insights.push({
      id: 'pending-in',
      severity: 'warning',
      domain: 'network',
      title: `${p.networkPendingIn} connection request${p.networkPendingIn === 1 ? '' : 's'} awaiting you`,
      detail: 'Accept partners to unlock pricing agreements, POs, and multi-currency trade.',
      href: '/dashboard/connections',
      metric: String(p.networkPendingIn),
      action: 'Review requests',
    });
  }
  if (p.networkAccepted === 0) {
    insights.push({
      id: 'no-network',
      severity: 'info',
      domain: 'network',
      title: 'Build your company network',
      detail: 'Discover and connect with platform companies to activate the trade graph.',
      href: '/dashboard/connections/discover',
      action: 'Discover partners',
    });
  } else if (p.networkAccepted >= 5) {
    insights.push({
      id: 'network-strong',
      severity: 'positive',
      domain: 'network',
      title: `${p.networkAccepted} active network connections`,
      detail: 'Your trade graph is growing — keep pricing and OTIFEF healthy.',
      href: '/dashboard/connections',
      metric: String(p.networkAccepted),
    });
  }
  if (p.pricingActive === 0 && p.networkAccepted > 0) {
    insights.push({
      id: 'pricing-gap',
      severity: 'info',
      domain: 'network',
      title: 'No active pricing agreements',
      detail: 'Connected companies without list prices — set wholesale terms for global trade.',
      href: '/dashboard/connections/pricing',
      action: 'Set prices',
    });
  }
  if (!p.walletReady) {
    insights.push({
      id: 'wallet-missing',
      severity: 'info',
      domain: 'network',
      title: 'Wallet not ready for on-chain trade',
      detail: 'Link a wallet to mint product passports and settle with proof.',
      href: '/dashboard/my-business/profile',
    });
  }

  // ── Supply ─────────────────────────────────────────────────────────────
  if (p.srmAvgOtifef > 0 && p.srmAvgOtifef < 80) {
    insights.push({
      id: 'otifef-low',
      severity: 'warning',
      domain: 'supply',
      title: `Supplier OTIFEF at ${p.srmAvgOtifef.toFixed(0)}%`,
      detail: 'Below 80% target — review delivery performance and open POs.',
      href: '/dashboard/suppliers/performance',
      metric: `${p.srmAvgOtifef.toFixed(0)}%`,
      action: 'Open scorecards',
    });
  } else if (p.srmAvgOtifef >= 90) {
    insights.push({
      id: 'otifef-strong',
      severity: 'positive',
      domain: 'supply',
      title: `Excellent OTIFEF · ${p.srmAvgOtifef.toFixed(0)}%`,
      detail: 'Supply partners are delivering on time, in full, and error-free.',
      href: '/dashboard/suppliers/performance',
      metric: `${p.srmAvgOtifef.toFixed(0)}%`,
    });
  }
  if (p.srmBook === 0) {
    insights.push({
      id: 'no-suppliers',
      severity: 'info',
      domain: 'supply',
      title: 'Supplier book is empty',
      detail: 'Add or invite suppliers to measure OTIFEF and raise POs.',
      href: '/dashboard/suppliers/add',
      action: 'Add supplier',
    });
  }
  if (p.topSupplierShare >= 60 && p.supplierPoCount > 1) {
    insights.push({
      id: 'supplier-concentration',
      severity: 'warning',
      domain: 'supply',
      title: `Supplier concentration ${p.topSupplierShare}%`,
      detail: 'One supplier dominates PO spend — diversify to reduce supply risk.',
      href: '/dashboard/suppliers/network',
      metric: `${p.topSupplierShare}%`,
    });
  }
  if (p.poGrowth !== 0) {
    insights.push({
      id: 'po-trend',
      severity: p.poGrowth >= 0 ? 'positive' : 'warning',
      domain: 'supply',
      title: `PO spend ${p.poGrowth >= 0 ? 'up' : 'down'} ${Math.abs(p.poGrowth)}% vs prior 30d`,
      detail: 'Last 30 days procurement value vs previous period.',
      href: '/dashboard/suppliers/po',
      metric: `${p.poGrowth > 0 ? '+' : ''}${p.poGrowth}%`,
    });
  }
  if (p.openPos > 10) {
    insights.push({
      id: 'po-backlog',
      severity: 'info',
      domain: 'supply',
      title: `${p.openPos} open purchase orders`,
      detail: 'Large open PO book — chase confirmations and receipts.',
      href: '/dashboard/suppliers/po',
      metric: String(p.openPos),
    });
  }

  // ── Demand / CRM ───────────────────────────────────────────────────────
  if (p.openLeads > 5 && p.openOpps === 0) {
    insights.push({
      id: 'leads-stuck',
      severity: 'warning',
      domain: 'demand',
      title: `${p.openLeads} open leads without opportunities`,
      detail: 'Convert qualified leads into pipeline to protect revenue forecast.',
      href: '/dashboard/customers/leads',
      action: 'Work leads',
    });
  }
  if (p.quoteWinRate > 0 && p.quoteWinRate < 25 && p.quotesCount >= 4) {
    insights.push({
      id: 'quote-win',
      severity: 'warning',
      domain: 'demand',
      title: `Quote win rate ${p.quoteWinRate}%`,
      detail: 'Review pricing competitiveness and follow-up on open quotes.',
      href: '/dashboard/customers/quotes',
      metric: `${p.quoteWinRate}%`,
    });
  } else if (p.quoteWinRate >= 40 && p.quotesCount >= 4) {
    insights.push({
      id: 'quote-win-strong',
      severity: 'positive',
      domain: 'demand',
      title: `Strong quote win rate ${p.quoteWinRate}%`,
      detail: 'Commercial conversion is healthy — protect margins as volume grows.',
      href: '/dashboard/customers/quotes',
      metric: `${p.quoteWinRate}%`,
    });
  }
  if (p.pipelineValue > 0) {
    insights.push({
      id: 'pipeline-value',
      severity: 'info',
      domain: 'demand',
      title: 'Open pipeline value',
      detail: `${p.openOpps} opportunities in flight.`,
      href: '/dashboard/customers',
      metric: Math.round(p.pipelineValue).toLocaleString(),
    });
  }
  if (p.customersActive === 0 && p.customers === 0) {
    insights.push({
      id: 'no-customers',
      severity: 'info',
      domain: 'demand',
      title: 'No customers on the book yet',
      detail: 'Onboard buyers or import leads to start the CRM engine.',
      href: '/dashboard/customers/onboard',
      action: 'Onboard customer',
    });
  }
  if (p.salesGrowth !== 0 && p.sales30 > 0) {
    insights.push({
      id: 'sales-trend',
      severity: p.salesGrowth >= 0 ? 'positive' : 'warning',
      domain: 'demand',
      title: `Retail/container sales ${p.salesGrowth >= 0 ? 'up' : 'down'} ${Math.abs(p.salesGrowth)}%`,
      detail: '30-day sales vs prior period (containers / retail channel).',
      href: '/dashboard/containers',
      metric: `${p.salesGrowth > 0 ? '+' : ''}${p.salesGrowth}%`,
    });
  }

  // ── Finance ────────────────────────────────────────────────────────────
  if (p.arBalance > 0 && p.arOpen > 0) {
    insights.push({
      id: 'ar-exposure',
      severity: p.arOpen > 5 || p.arBalance > 100000 ? 'warning' : 'info',
      domain: 'finance',
      title: 'Accounts receivable exposure',
      detail: `${p.arOpen} open AR invoice${p.arOpen === 1 ? '' : 's'} outstanding.`,
      href: '/dashboard/accounting/accounts-receivable',
      metric: Math.round(p.arBalance).toLocaleString(),
      action: 'Chase collections',
    });
  }
  if (p.apOpen > 8) {
    insights.push({
      id: 'ap-pressure',
      severity: 'info',
      domain: 'finance',
      title: `${p.apOpen} open payables`,
      detail: 'High AP count — schedule payments and protect supplier goodwill.',
      href: '/dashboard/accounting/accounts-payable',
      metric: Math.round(p.apBalance).toLocaleString(),
    });
  }
  if (p.arBalance === 0 && p.apBalance === 0 && p.products > 0) {
    insights.push({
      id: 'books-clean',
      severity: 'positive',
      domain: 'finance',
      title: 'AR and AP books are clear',
      detail: 'No open ledger balances on the sample window — strong control signal.',
      href: '/dashboard/accounting',
    });
  }

  // ── Operations / inventory ─────────────────────────────────────────────
  if (p.lowStock > 0) {
    insights.push({
      id: 'low-stock',
      severity: p.lowStock > 5 ? 'critical' : 'warning',
      domain: 'ops',
      title: `${p.lowStock} SKU${p.lowStock === 1 ? '' : 's'} at reorder level`,
      detail: 'Warehouse stock is below threshold — plan replenishment or POs.',
      href: '/dashboard/inventory/stock',
      metric: String(p.lowStock),
      action: 'Review stock',
    });
  }
  if (p.multiCurrencyProducts === 0 && p.products > 0) {
    insights.push({
      id: 'single-ccy',
      severity: 'info',
      domain: 'ops',
      title: 'Catalogue is single-currency',
      detail: 'Add USD/EUR (or regional) list prices for global quoting.',
      href: '/dashboard/inventory/products',
    });
  } else if (p.multiCurrencyProducts > 0) {
    insights.push({
      id: 'multi-ccy',
      severity: 'positive',
      domain: 'ops',
      title: `${p.multiCurrencyProducts} multi-currency product${p.multiCurrencyProducts === 1 ? '' : 's'}`,
      detail: `Catalogue spans ${p.currencyCount} currencies — ready for global quotes.`,
      href: '/dashboard/inventory/products',
      metric: String(p.currencyCount),
    });
  }
  if (p.products === 0) {
    insights.push({
      id: 'no-products',
      severity: 'info',
      domain: 'ops',
      title: 'No products in catalogue',
      detail: 'Create SKUs to enable quoting, stock, and manufacturing.',
      href: '/dashboard/inventory/products',
      action: 'Add product',
    });
  }
  if ((p.shipmentsOpen || 0) > 5) {
    insights.push({
      id: 'shipments-open',
      severity: 'info',
      domain: 'ops',
      title: `${p.shipmentsOpen} open shipments`,
      detail: 'Distribution in flight — track delivery and carbon estimates.',
      href: '/dashboard/distribution/tracking',
      metric: String(p.shipmentsOpen),
    });
  }
  if ((p.mfOpenOrders || 0) > 0) {
    insights.push({
      id: 'mfg-open',
      severity: 'info',
      domain: 'ops',
      title: `${p.mfOpenOrders} open production orders`,
      detail: 'Manufacturing WIP — check MRP and materials availability.',
      href: '/dashboard/manufacturing/production-orders',
    });
  }

  // ── Quality / SHEQ ─────────────────────────────────────────────────────
  if ((p.qualityFailed || 0) > 0) {
    insights.push({
      id: 'qa-failed',
      severity: p.qualityFailed! > 2 ? 'critical' : 'warning',
      domain: 'quality',
      title: `${p.qualityFailed} failed quality inspection${p.qualityFailed === 1 ? '' : 's'}`,
      detail: 'Investigate defects and CAPA before release.',
      href: '/dashboard/quality/inspections',
      metric: String(p.qualityFailed),
      action: 'Open inspections',
    });
  }
  if (p.qualityPassRate != null && p.qualityPassRate < 85 && (p.qualityOpen || 0) + (p.qualityFailed || 0) >= 3) {
    insights.push({
      id: 'qa-pass-low',
      severity: 'warning',
      domain: 'quality',
      title: `QA pass rate ${p.qualityPassRate}%`,
      detail: 'Below 85% — tighten process control and supplier quality gates.',
      href: '/dashboard/quality/inspections',
      metric: `${p.qualityPassRate}%`,
    });
  }
  if ((p.haccpPlans || 0) === 0 && p.products > 0) {
    insights.push({
      id: 'no-haccp',
      severity: 'info',
      domain: 'quality',
      title: 'No HACCP plans on file',
      detail: 'Food/process businesses should document critical control points.',
      href: '/dashboard/quality/haccp',
    });
  }
  if ((p.sheqOpen || 0) > 0) {
    insights.push({
      id: 'sheq-open',
      severity: p.sheqOpen! > 3 ? 'warning' : 'info',
      domain: 'quality',
      title: `${p.sheqOpen} open SHEQ items`,
      detail: 'Incidents, NCRs, or hazards still open.',
      href: '/dashboard/sheq',
      metric: String(p.sheqOpen),
    });
  }

  // ── ESG ────────────────────────────────────────────────────────────────
  if ((p.esgCertExpiring || 0) > 0) {
    insights.push({
      id: 'esg-certs-expiring',
      severity: 'warning',
      domain: 'esg',
      title: `${p.esgCertExpiring} sustainability certificate${p.esgCertExpiring === 1 ? '' : 's'} expiring soon`,
      detail: 'Renew within 90 days to protect customer and buyer audits.',
      href: '/dashboard/sustainability/green-certificates',
      metric: String(p.esgCertExpiring),
      action: 'View certificates',
    });
  }
  if ((p.esgTargetsActive || 0) === 0 && (p.esgTotalKg || 0) > 0) {
    insights.push({
      id: 'esg-no-targets',
      severity: 'info',
      domain: 'esg',
      title: 'GHG inventory without reduction targets',
      detail: 'Set a baseline→horizon pathway so measurement becomes reduction.',
      href: '/dashboard/sustainability/regenerative-dashboard',
      action: 'Set target',
    });
  }
  if ((p.esgTotalKg || 0) === 0 && p.products > 0) {
    insights.push({
      id: 'esg-no-inventory',
      severity: 'info',
      domain: 'esg',
      title: 'No GHG inventory lines yet',
      detail: 'Log Scope 1–3 emissions or rely on shipment carbon estimates.',
      href: '/dashboard/sustainability/carbon-tracking',
    });
  } else if ((p.esgTotalKg || 0) > 0 && (p.esgTargetsActive || 0) > 0) {
    insights.push({
      id: 'esg-on-track',
      severity: 'positive',
      domain: 'esg',
      title: 'ESG measurement + targets active',
      detail: 'Inventory and pathways are in place — keep initiatives moving.',
      href: '/dashboard/sustainability',
    });
  }

  // ── Projects / PMO ─────────────────────────────────────────────────────
  if ((p.projectsOpenRiads || 0) > 0) {
    insights.push({
      id: 'pm-riads',
      severity: p.projectsOpenRiads! > 5 ? 'warning' : 'info',
      domain: 'projects',
      title: `${p.projectsOpenRiads} open project RIAD items`,
      detail: 'Risks, issues, actions, or decisions need owners.',
      href: '/dashboard/projects/risk-register',
      metric: String(p.projectsOpenRiads),
    });
  }
  if ((p.dmaicStuck || 0) > 0) {
    insights.push({
      id: 'dmaic-stuck',
      severity: 'info',
      domain: 'projects',
      title: `${p.dmaicStuck} DMAIC project${p.dmaicStuck === 1 ? '' : 's'} still in Define`,
      detail: 'Move stage-gates when checklists are met — or unblock sponsors.',
      href: '/dashboard/projects/dmaic',
    });
  }
  if ((p.projectsActive || 0) === 0 && p.networkAccepted > 2) {
    insights.push({
      id: 'no-projects',
      severity: 'info',
      domain: 'projects',
      title: 'No active PMO projects',
      detail: 'Charter process improvement or SDG work to institutionalise gains.',
      href: '/dashboard/projects',
    });
  }

  // ── Golden path stuck stages ───────────────────────────────────────────
  if ((p.stuckReceive || 0) > 0) {
    insights.push({
      id: 'stuck-receive',
      severity: p.stuckReceive! > 2 ? 'critical' : 'warning',
      domain: 'ops',
      title: `${p.stuckReceive} PO${p.stuckReceive === 1 ? '' : 's'} stuck before receive`,
      detail: 'Goods accepted on paper but not stocked — complete receive to close the path.',
      href: '/dashboard/suppliers/po',
      metric: String(p.stuckReceive),
      action: 'Receive stock',
    });
  }
  if ((p.stuckSettle || 0) > 0) {
    insights.push({
      id: 'stuck-settle',
      severity: p.stuckSettle! > 2 ? 'critical' : 'warning',
      domain: 'finance',
      title: `${p.stuckSettle} trade${p.stuckSettle === 1 ? '' : 's'} stuck at settle`,
      detail: 'Invoiced or delivered work awaiting claim confirm / payment / escrow release.',
      href: '/dashboard/settle',
      metric: String(p.stuckSettle),
      action: 'Open settle',
    });
  }
  if ((p.escrowAwaitingRelease || 0) > 0) {
    insights.push({
      id: 'escrow-release',
      severity: 'warning',
      domain: 'finance',
      title: `${p.escrowAwaitingRelease} escrow${p.escrowAwaitingRelease === 1 ? '' : 's'} awaiting release`,
      detail: 'Buyer should confirm delivery on-chain so funds release to the seller.',
      href: '/dashboard/escrow',
      metric: String(p.escrowAwaitingRelease),
      action: 'Release escrow',
    });
  }

  // ── Super-Cube® leadership × ops ───────────────────────────────────────
  if (p.leadershipAssessed && typeof p.leadershipWeakScore === 'number') {
    if (p.leadershipWeakScore < 6) {
      insights.push({
        id: 'leadership-weak-edge',
        severity: p.leadershipWeakScore < 4 ? 'warning' : 'info',
        domain: 'people',
        title: `Super-Cube® growth edge: ${p.leadershipWeakFace || 'face'} (${p.leadershipWeakScore}/10)`,
        detail:
          'Lowest leadership face needs deliberate practice — open the 30-day growth plan.',
        href: '/dashboard/intelligence/leadership-development',
        metric: String(p.leadershipWeakScore),
        action: 'Open Super-Cube®',
      });
    }
    if (
      typeof p.leadershipPhysical === 'number' &&
      p.leadershipPhysical < 6 &&
      ((p.sheqOpen || 0) > 0 || p.lowStock > 3)
    ) {
      insights.push({
        id: 'leadership-physical-burnout',
        severity: 'warning',
        domain: 'people',
        title: 'Physical leadership face low while ops pressure is high',
        detail:
          'Energy is strategy: protect recovery while low stock / SHEQ items stay open — burnout multiplies errors.',
        href: '/dashboard/intelligence/leadership-development',
        metric: String(p.leadershipPhysical),
        action: 'Practise Physical face',
      });
    }
    if (
      typeof p.leadershipEmotional === 'number' &&
      p.leadershipEmotional < 6 &&
      (p.sheqOpen || 0) > 2
    ) {
      insights.push({
        id: 'leadership-emotional-safety',
        severity: 'warning',
        domain: 'people',
        title: 'Emotional face lagging with open SHEQ load',
        detail:
          'Psychological safety and incident load often travel together — coach empathy + repair under Super-Cube® Emotional.',
        href: '/dashboard/intelligence/leadership-development',
        metric: String(p.leadershipEmotional),
        action: 'Practise Emotional face',
      });
    }
    if (
      typeof p.leadershipChoices === 'number' &&
      p.leadershipChoices < 6 &&
      (p.stuckSettle || 0) + (p.escrowAwaitingRelease || 0) > 0
    ) {
      insights.push({
        id: 'leadership-choices-settle',
        severity: 'info',
        domain: 'people',
        title: 'Choices face weak while money is stuck',
        detail:
          'Integrity under pressure shows in settle decisions — use Super-Cube® Choices practices when releasing funds or disputes.',
        href: '/dashboard/intelligence/leadership-development',
        action: 'Practise Choices',
      });
    }
  } else if (p.networkAccepted > 0 || p.openPos > 0) {
    insights.push({
      id: 'leadership-not-assessed',
      severity: 'info',
      domain: 'people',
      title: 'Super-Cube® assessment not completed',
      detail:
        'Map the six faces (choices, principles, mental, emotional, physical, spiritual) to grow the humans who run the network.',
      href: '/dashboard/intelligence/leadership-development',
      action: 'Start assessment',
    });
  }

  // Severity order for display
  const rank: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    positive: 2,
    info: 3,
  };
  insights.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return insights;
}

export function buildScorecards(
  health: HealthScores,
  p: PulseInput
): Array<{ id: string; label: string; score: number; detail: string; href: string }> {
  return [
    {
      id: 'network',
      label: 'Network health',
      score: health.network,
      detail: `${p.networkAccepted} connected · ${p.pricingActive} pricing`,
      href: '/dashboard/connections',
    },
    {
      id: 'supply',
      label: 'Supply chain',
      score: health.supply,
      detail: `OTIFEF ${p.srmAvgOtifef.toFixed(0)}% · trust ${p.srmAvgTrust.toFixed(0)}`,
      href: '/dashboard/suppliers/performance',
    },
    {
      id: 'demand',
      label: 'Demand / CRM',
      score: health.demand,
      detail: `${p.customersActive} customers · pipeline ${Math.round(p.pipelineValue).toLocaleString()}`,
      href: '/dashboard/customers',
    },
    {
      id: 'finance',
      label: 'Finance control',
      score: health.finance,
      detail: `AR ${p.arOpen} · AP ${p.apOpen}`,
      href: '/dashboard/accounting',
    },
    {
      id: 'ops',
      label: 'Operations',
      score: health.ops,
      detail: `${p.products} SKUs · ${p.lowStock} low stock`,
      href: '/dashboard/inventory',
    },
    {
      id: 'quality',
      label: 'Quality & SHEQ',
      score: health.quality,
      detail:
        p.qualityPassRate != null
          ? `Pass ${p.qualityPassRate}% · ${p.haccpPlans || 0} HACCP`
          : `${p.haccpPlans || 0} HACCP · ${p.sheqOpen || 0} SHEQ open`,
      href: '/dashboard/quality',
    },
    {
      id: 'esg',
      label: 'ESG / impact',
      score: health.esg,
      detail: `${p.esgTargetsActive || 0} targets · ${p.esgCertExpiring || 0} certs expiring`,
      href: '/dashboard/sustainability',
    },
  ];
}

/** What-if simulation: adjust levers and recompute health */
export function simulateHealth(
  base: PulseInput,
  levers: {
    otifefDelta?: number;
    lowStockDelta?: number;
    arOpenDelta?: number;
    networkDelta?: number;
    winRateDelta?: number;
    pipelineMult?: number;
  }
): { pulse: PulseInput; health: HealthScores; insights: Insight[] } {
  const pulse: PulseInput = {
    ...base,
    srmAvgOtifef: clamp(base.srmAvgOtifef + (levers.otifefDelta || 0)),
    lowStock: Math.max(0, base.lowStock + (levers.lowStockDelta || 0)),
    arOpen: Math.max(0, base.arOpen + (levers.arOpenDelta || 0)),
    arBalance:
      base.arOpen > 0
        ? base.arBalance *
          (Math.max(0, base.arOpen + (levers.arOpenDelta || 0)) / Math.max(base.arOpen, 1))
        : base.arBalance,
    networkAccepted: Math.max(0, base.networkAccepted + (levers.networkDelta || 0)),
    quoteWinRate: clamp(base.quoteWinRate + (levers.winRateDelta || 0)),
    pipelineValue: base.pipelineValue * (levers.pipelineMult ?? 1),
  };
  const health = computeHealth(pulse);
  const insights = buildInsights(pulse).slice(0, 8);
  return { pulse, health, insights };
}
