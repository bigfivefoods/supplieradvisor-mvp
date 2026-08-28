/**
 * Brief 11 — dashboard first paint is rollup RPCs + one company row.
 * Do not scan fat inventory / pipeline / feedback tables here. Counts come from
 * sa_dashboard_home_rollup, sa_accounting_kpi_rollup, sa_customers_hub_summary.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { computeProfileCompleteness } from '@/lib/business/completeness';
import { normalizeProfileRow } from '@/lib/business/types';
import { OPPORTUNITY_STAGES } from '@/lib/customers/types';

export type DashboardActivity = {
  id: string;
  title: string;
  subtitle: string;
  at: string | null;
  type:
    | 'team'
    | 'network'
    | 'risk'
    | 'invite'
    | 'supplier'
    | 'system'
    | 'container'
    | 'inventory'
    | 'contractor';
};

export type DashboardAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  href: string;
};

function n(raw: Record<string, unknown> | null, key: string, fallback = 0): number {
  if (!raw) return fallback;
  const v = Number(raw[key]);
  return Number.isFinite(v) ? v : fallback;
}

function asObj(data: unknown): Record<string, unknown> | null {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

function pipelineStagesFromRollup(raw: Record<string, unknown> | null) {
  const rows = Array.isArray(raw?.pipeline_stages)
    ? (raw!.pipeline_stages as Array<Record<string, unknown>>)
    : [];
  const byStage = new Map<string, { count: number; value: number; weighted: number }>();
  for (const r of rows) {
    const stage = String(r.stage || '');
    if (!stage) continue;
    byStage.set(stage, {
      count: Number(r.count || 0),
      value: Number(r.value || 0),
      weighted: Number(r.weighted || 0),
    });
  }
  return OPPORTUNITY_STAGES.map((stage) => {
    const hit = byStage.get(stage.value) || { count: 0, value: 0, weighted: 0 };
    return {
      stage: stage.value,
      label: stage.label,
      probability: stage.probability,
      count: hit.count,
      value: Math.round(hit.value),
      weighted: Math.round(hit.weighted),
    };
  });
}

export async function assembleDashboardSummary(companyId: number) {
  const supabase = getSupabaseServer();

  const [companyRes, homeRollupRes, acctRollupRes, crmRollupRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, industry, industries, business_type, country, city, verification_status, verified_at, supplier_status, status, relationship_type, trust_score, logo_url, short_description, description, contact_name, email, phone, contact_phone, address, street, wallet_address, primary_currency, website, registration_number, vat_number, account_number, bank_name, is_verified, certifications, iso_certifications'
      )
      .eq('id', companyId)
      .maybeSingle(),
    supabase.rpc('sa_dashboard_home_rollup', { p_profile_id: companyId }),
    supabase.rpc('sa_accounting_kpi_rollup', { p_profile_id: companyId }),
    supabase.rpc('sa_customers_hub_summary', {
      p_profile_id: companyId,
      p_tree_ids: [companyId],
    }),
  ]);

  if (companyRes.error) throw new Error(companyRes.error.message);
  if (!companyRes.data) throw new Error('Company not found');
  const company = companyRes.data as Record<string, unknown>;

  const home = homeRollupRes.error ? null : asObj(homeRollupRes.data);
  const acct = acctRollupRes.error ? null : asObj(acctRollupRes.data);
  const crmHub = crmRollupRes.error ? null : asObj(crmRollupRes.data);

  const teamActive = n(home, 'team_active');
  const teamInvited = n(home, 'team_invited');
  const teamTotal = n(home, 'team_total', teamActive + teamInvited);
  const pendingInvites = n(home, 'pending_invites');
  const containersTotal = n(home, 'containers_total');
  const containersActive = n(home, 'containers_active');
  const containerLowStock = n(home, 'container_inv_low');
  const containerUnits = n(home, 'container_units');
  const warehouseLowStock = n(home, 'stock_low');
  const warehouseStockUnits = n(home, 'warehouse_units');
  const warehouses = n(home, 'warehouses');
  const connectionsAccepted = n(home, 'connections_accepted');
  const networkPendingIn = n(home, 'connections_pending_in');
  const networkPendingOut = n(home, 'connections_pending_out');
  const connectionsPending = networkPendingIn + networkPendingOut;
  const contractorsTotal = n(home, 'contractors_total');
  const contractorsActive = n(home, 'contractors_active');
  const contractorsVerified = n(home, 'contractors_verified');
  const contractorsPortal = n(home, 'contractors_portal');
  const productsCount = n(home, 'products');
  const documentsCount = n(home, 'documents');
  const projectsCount = n(home, 'projects');
  const openRisks = n(home, 'open_risks');
  const highRisks = n(home, 'high_risks');
  const containerRiads = n(home, 'container_riads');
  const salesToday = n(home, 'sales_today');

  const customersTotal = n(crmHub, 'customers');
  const customersActive = n(crmHub, 'customers_active');
  const leadsOpen = n(crmHub, 'leads_open');
  const leadsTotal = n(crmHub, 'leads');
  const opportunitiesOpen = n(home, 'opportunities_open', n(crmHub, 'opportunities_open'));
  const opportunitiesTotal = n(home, 'opportunities_total', n(crmHub, 'opportunities'));
  const pipelineValue = Math.round(n(home, 'pipeline_value', n(crmHub, 'pipeline_value')));
  const pipelineWeighted = Math.round(
    n(home, 'pipeline_weighted', n(crmHub, 'weighted_pipeline'))
  );
  const wonCount = n(home, 'won_count');
  const wonValue = Math.round(n(home, 'won_value', n(crmHub, 'won_value')));
  const invoicedCount = n(home, 'invoiced_count');
  const invoicedValue = Math.round(n(home, 'invoiced_value'));
  const lostCount = n(home, 'lost_count');
  const crmInvitePending = n(crmHub, 'invite_pending', n(crmHub, 'invitations_pending'));
  const crmInviteAccepted = n(crmHub, 'invite_accepted');
  const crmRiadOpen = n(home, 'crm_riad_open');

  const srmBookTotal = n(home, 'srm_book_total');
  const srmConnected = n(home, 'srm_connected');
  const srmPreferred = n(home, 'srm_preferred');
  const srmInvitePending = n(home, 'srm_invite_pending');
  const srmVerified = n(home, 'srm_verified');
  const srmAvgTrust = n(home, 'srm_avg_trust');
  const srmAvgOtifef = n(home, 'srm_avg_otifef');
  const srmOpenPos = n(home, 'srm_open_pos');
  const srmOnchainPos = n(home, 'srm_onchain_pos');
  const srmRiadOpen = n(home, 'srm_riad_open');

  const pricingAgreements = n(home, 'pricing_agreements');
  const pricingActive = n(home, 'pricing_active');
  const pricingSelling = n(home, 'pricing_selling');
  const pricingBuying = n(home, 'pricing_buying');
  const quotesOpen = n(home, 'quotes_open');
  const quotesValue = n(home, 'quotes_value');
  const quotesAcceptedValue = n(home, 'quotes_accepted_value');
  const quotesTotalValue = n(home, 'quotes_total_value');
  const invoicesOpen = n(home, 'invoices_open');
  const invoicesDraft = n(home, 'invoices_draft');
  const invoicesOverdue = n(home, 'invoices_overdue');
  const invoicesOpenValue = n(home, 'invoices_open_value');
  const invoicesPaidValue = n(home, 'invoices_paid_value');
  const invoicesTotalValue = n(home, 'invoices_total_value');
  const invoicesCollectedValue = n(home, 'invoices_collected_value');
  const feedbackCount = n(home, 'feedback_count');
  const feedbackAvgStars = n(home, 'feedback_avg_stars') || null;
  const feedbackAvgOtifef = n(home, 'feedback_avg_otifef') || null;
  const peerAvgStars = n(home, 'peer_avg_stars') || null;
  const peerRatedCount = n(home, 'peer_rated_count');
  const listingsActive = n(home, 'marketplace_listings');
  const arOpen = n(acct, 'ar_open');
  const arOpenValue = n(acct, 'ar_open_amount');
  const apOpen = n(acct, 'ap_open');
  const apOpenValue = n(acct, 'ap_open_amount');

  const pipelineStages = pipelineStagesFromRollup(home);

  const normalizedCompany = normalizeProfileRow(company);
  const profileCompleteness = computeProfileCompleteness(
    normalizedCompany as Record<string, unknown>
  ).pct;

  const alerts: DashboardAlert[] = [];
  if (String(company.verification_status || '') !== 'verified') {
    alerts.push({
      id: 'verify',
      severity: 'warning',
      title: 'Company not fully verified',
      detail: 'Complete verification to unlock trust badges and preferred network status.',
      href: '/dashboard/my-business/profile',
    });
  }
  if (networkPendingIn > 0) {
    alerts.unshift({
      id: 'network-incoming',
      severity: 'warning',
      title: `${networkPendingIn} incoming connection request${networkPendingIn === 1 ? '' : 's'}`,
      detail: 'Accept or decline partners so trade, pricing, and POs can unlock.',
      href: '/dashboard/connections',
    });
  }
  if (containersTotal === 0) {
    alerts.push({
      id: 'containers-empty',
      severity: 'info',
      title: 'No retail containers yet',
      detail: 'Add your first container outlet, pin GPS, and appoint a contractor.',
      href: '/dashboard/containers/manage',
    });
  }
  if (containerLowStock > 0) {
    alerts.push({
      id: 'container-low-stock',
      severity: 'warning',
      title: `${containerLowStock} container stock line${containerLowStock === 1 ? '' : 's'} low`,
      detail: 'Review outlet inventory and place replenishment orders.',
      href: '/dashboard/containers/manage',
    });
  }
  if (warehouseLowStock > 0) {
    alerts.push({
      id: 'wh-low-stock',
      severity: 'warning',
      title: `${warehouseLowStock} warehouse SKU${warehouseLowStock === 1 ? '' : 's'} at reorder`,
      detail: 'Open Inventory to replenish or transfer stock.',
      href: '/dashboard/inventory',
    });
  }
  if (openRisks > 0) {
    alerts.push({
      id: 'risks',
      severity: highRisks > 0 ? 'critical' : 'warning',
      title: `${openRisks} open RIAD item${openRisks === 1 ? '' : 's'}`,
      detail:
        highRisks > 0
          ? `${highRisks} high/critical — review Container RIAD log.`
          : 'Monitor risks, issues, actions, and decisions across the business.',
      href: '/dashboard/containers/riad-log',
    });
  }
  if (teamInvited > 0) {
    alerts.push({
      id: 'team-pending',
      severity: 'info',
      title: `${teamInvited} team invitation${teamInvited === 1 ? '' : 's'} pending`,
      detail: 'Follow up so teammates can accept and start collaborating.',
      href: '/dashboard/my-business/team',
    });
  }
  if (productsCount === 0) {
    alerts.push({
      id: 'products',
      severity: 'info',
      title: 'Build your inventory catalogue',
      detail: 'Add products with SKUs and QR codes for world-class stock control.',
      href: '/dashboard/inventory/products',
    });
  }
  if (crmInvitePending > 0) {
    alerts.push({
      id: 'crm-invites',
      severity: 'info',
      title: `${crmInvitePending} customer invite${crmInvitePending === 1 ? '' : 's'} pending`,
      detail: 'Buyers still need to claim their platform invitations.',
      href: '/dashboard/customers/invites',
    });
  }
  if (srmInvitePending > 0) {
    alerts.push({
      id: 'srm-invites',
      severity: 'info',
      title: `${srmInvitePending} supplier invite${srmInvitePending === 1 ? '' : 's'} pending`,
      detail: 'Follow up so partners can claim and connect.',
      href: '/dashboard/suppliers/invites',
    });
  }
  if (srmOpenPos > 0) {
    alerts.push({
      id: 'srm-pos',
      severity: 'info',
      title: `${srmOpenPos} open purchase order${srmOpenPos === 1 ? '' : 's'}`,
      detail: 'Track delivery and OTIFEF on the SRM PO pipeline.',
      href: '/dashboard/suppliers/po',
    });
  }
  if (profileCompleteness < 70) {
    alerts.push({
      id: 'profile-complete',
      severity: 'warning',
      title: `Company profile ${profileCompleteness}% complete`,
      detail: 'Strengthen trust signals — fill contacts, location, and wallet.',
      href: '/dashboard/my-business/profile',
    });
  }
  if (crmRiadOpen + srmRiadOpen > 0) {
    alerts.push({
      id: 'rel-riad',
      severity: crmRiadOpen + srmRiadOpen > 5 ? 'warning' : 'info',
      title: `${crmRiadOpen + srmRiadOpen} open relationship RIAD items`,
      detail: `${crmRiadOpen} customer · ${srmRiadOpen} supplier`,
      href: '/dashboard/customers/riad-log',
    });
  }
  if (pricingActive === 0 && connectionsAccepted > 0) {
    alerts.push({
      id: 'pricing-empty',
      severity: 'info',
      title: 'No active pricing agreements',
      detail: 'Set wholesale list prices with connected companies for global trade.',
      href: '/dashboard/connections/pricing',
    });
  }
  if (arOpen > 0) {
    alerts.push({
      id: 'ar-open',
      severity: 'info',
      title: `${arOpen} open AR invoice${arOpen === 1 ? '' : 's'}`,
      detail: `Outstanding ~ ${arOpenValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} across currencies.`,
      href: '/dashboard/accounting/accounts-receivable',
    });
  }

  const supplierHealth = Math.min(
    100,
    Math.round(
      (srmConnected / Math.max(srmBookTotal || 1, 1)) * 70 +
        (String(company.verification_status) === 'verified' ? 20 : 0) +
        (connectionsAccepted > 0 ? 10 : 0)
    )
  );
  const fulfillmentSignal = Math.min(
    100,
    30 +
      Math.min(productsCount, 20) * 2 +
      Math.min(containersActive, 10) * 3 +
      Math.min(connectionsAccepted, 10) * 2 +
      (warehouseStockUnits > 0 || containerUnits > 0 ? 15 : 0)
  );
  const riskScoreLabel =
    highRisks >= 3 ? 'High' : openRisks >= 2 ? 'Medium' : openRisks === 1 ? 'Low' : 'Stable';
  const riskBar = highRisks >= 3 ? 85 : openRisks >= 2 ? 55 : openRisks === 1 ? 30 : 15;

  const activity: DashboardActivity[] = [];
  const currencySet = new Set<string>([
    String(company.primary_currency || 'ZAR').toUpperCase() || 'ZAR',
  ]);

  return {
    success: true,
    company: {
      id: company.id,
      trading_name: company.trading_name,
      legal_name: company.legal_name,
      industry:
        company.industry ||
        (Array.isArray(company.industries) ? company.industries[0] : null),
      business_type: company.business_type,
      country: company.country,
      city: company.city,
      verification_status: company.verification_status,
      verified_at: company.verified_at,
      supplier_status: company.supplier_status,
      status: company.status,
      relationship_type: company.relationship_type,
      trust_score: company.trust_score,
      logo_url: company.logo_url,
      short_description: company.short_description,
      contact_name: company.contact_name,
      email: company.email,
      wallet_address: company.wallet_address,
      primary_currency: company.primary_currency || 'ZAR',
    },
    kpis: {
      teamActive,
      teamInvited,
      teamTotal,
      networkAccepted: connectionsAccepted,
      networkPending: connectionsPending,
      networkPendingIn,
      networkPendingOut,
      networkTotal: connectionsAccepted + connectionsPending,
      suppliersTotal: srmBookTotal,
      suppliersActive: srmConnected,
      suppliersInvited: srmInvitePending,
      openRisks,
      highRisks,
      products: productsCount,
      documents: documentsCount,
      projects: projectsCount,
      pendingInvites,
      containersTotal,
      containersActive,
      contractorsTotal,
      contractorsActive,
      contractorsVerified,
      contractorsPortal,
      containerLowStock,
      containerUnits,
      salesToday,
      containerRiads,
      warehouses,
      warehouseStockUnits,
      warehouseLowStock,
      stockLines: 0,
      customersTotal,
      customersActive,
      leadsOpen,
      leadsTotal,
      opportunitiesOpen,
      pipelineValue,
      pipelineWeighted,
      pipelineIncludesGroup: false,
      pipelineGroupCompanies: 0,
      wonCount,
      wonValue,
      invoicedCount,
      invoicedValue,
      lostCount,
      crmInvitePending,
      crmInviteAccepted,
      crmRiadOpen,
      srmBookTotal,
      srmConnected,
      srmPreferred,
      srmInvitePending,
      srmVerified,
      srmAvgTrust,
      srmAvgOtifef,
      srmOpenPos,
      srmOnchainPos,
      srmRiadOpen,
      pricingAgreements,
      pricingActive,
      pricingSelling,
      pricingBuying,
      quotesOpen,
      quotesValue,
      quotesAcceptedValue,
      quotesTotalValue,
      invoicesOpen,
      invoicesDraft,
      invoicesOverdue,
      invoicesOpenValue,
      invoicesPaidValue,
      invoicesTotalValue,
      invoicesCollectedValue,
      multiCurrencyProducts: 0,
      catalogueCurrencies: Array.from(currencySet).sort(),
      arOpen,
      arOpenValue,
      apOpen,
      apOpenValue,
      marketplaceListings: listingsActive,
      profileCompleteness,
    },
    health: {
      supplierHealth,
      fulfillmentSignal,
      riskScoreLabel,
      riskBar,
      profileCompleteness,
    },
    network: {
      accepted: connectionsAccepted,
      pending: connectionsPending,
      pendingIn: networkPendingIn,
      pendingOut: networkPendingOut,
      pricingActive,
      pricingTotal: pricingAgreements,
      marketplaceListings: listingsActive,
      href: '/dashboard/connections',
    },
    trade: {
      quotesOpen,
      quotesValue,
      quotesAcceptedValue,
      quotesTotalValue,
      invoicesOpen,
      invoicesDraft,
      invoicesOverdue,
      invoicesOpenValue,
      invoicesPaidValue,
      invoicesTotalValue,
      invoicesCollectedValue,
      openPos: srmOpenPos,
      onchainPos: srmOnchainPos,
      arOpen,
      arOpenValue,
      apOpen,
      apOpenValue,
    },
    inventory: {
      products: productsCount,
      multiCurrencyProducts: 0,
      currencies: Array.from(currencySet).sort(),
      warehouseLowStock,
      warehouses,
      href: '/dashboard/inventory/products',
    },
    crm: {
      customers: customersTotal,
      customersActive,
      leadsOpen,
      leadsTotal,
      opportunitiesOpen,
      pipelineValue,
      pipelineWeighted,
      pipelineIncludesGroup: false,
      pipelineGroupCompanies: 0,
      wonCount,
      wonValue,
      invoicedCount,
      invoicedValue,
      lostCount,
      opportunitiesTotal,
      pipelineStages,
      invitePending: crmInvitePending,
      inviteAccepted: crmInviteAccepted,
      riadOpen: crmRiadOpen,
      quotesOpen,
      quotesValue,
      quotesAcceptedValue,
      quotesTotalValue,
      invoicesOpen,
      invoicesDraft,
      invoicesOverdue,
      invoicesOpenValue,
      invoicesPaidValue,
      invoicesTotalValue,
      invoicesCollectedValue,
      feedbackCount,
      feedbackAvgStars: feedbackCount ? feedbackAvgStars : null,
      feedbackAvgOtifef: feedbackCount ? feedbackAvgOtifef : null,
      peerAvgStars: peerRatedCount ? peerAvgStars : null,
      peerRatedCount,
      href: '/dashboard/customers',
      leadsHref: '/dashboard/customers/leads',
      reportHref: '/dashboard/customers/report',
      ratingsHref: '/dashboard/customers/ratings',
    },
    srm: {
      book: srmBookTotal,
      connected: srmConnected,
      preferred: srmPreferred,
      invitePending: srmInvitePending,
      verified: srmVerified,
      avgTrust: srmAvgTrust,
      avgOtifef: srmAvgOtifef,
      openPos: srmOpenPos,
      onchainPos: srmOnchainPos,
      riadOpen: srmRiadOpen,
      href: '/dashboard/suppliers',
    },
    business: {
      profileCompleteness,
      teamActive,
      teamInvited,
      verified: String(company.verification_status) === 'verified',
      href: '/dashboard/my-business',
    },
    modules: {
      containers: {
        total: containersTotal,
        active: containersActive,
        href: '/dashboard/containers',
      },
      contractors: {
        total: contractorsTotal,
        verified: contractorsVerified,
        portal: contractorsPortal,
        href: '/dashboard/containers/contractors',
      },
      inventory: {
        products: productsCount,
        warehouses,
        lowStock: warehouseLowStock + containerLowStock,
        units: warehouseStockUnits + containerUnits,
        href: '/dashboard/inventory',
      },
      riad: {
        open: openRisks,
        critical: highRisks,
        containerScoped: containerRiads,
        href: '/dashboard/containers/riad-log',
      },
      crm: { href: '/dashboard/customers' },
      srm: { href: '/dashboard/suppliers' },
      business: { href: '/dashboard/my-business' },
    },
    activity: activity.slice(0, 14),
    alerts: alerts.slice(0, 10),
    teamPreview: [] as Array<Record<string, unknown>>,
    containersPreview: [] as Array<Record<string, unknown>>,
    contractorsPreview: [] as Array<Record<string, unknown>>,
    projectsPreview: [] as Array<Record<string, unknown>>,
    generatedAt: new Date().toISOString(),
  };
}
