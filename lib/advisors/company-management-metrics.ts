/**
 * Cross-cutting company metrics for Advisor management packs.
 * Network, trade, catalogue, inventory, team — soft-fail on missing tables.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ManagementChart,
  ManagementKpi,
  ManagementTable,
  ManagementReportDoc,
} from '@/lib/advisors/management-report';

export type CompanyMetricsBundle = {
  kpis: ManagementKpi[];
  tables: ManagementTable[];
  charts: ManagementChart[];
  highlights: string[];
  risks: string[];
  actions: string[];
  raw: {
    partners: number;
    connectionsAccepted: number;
    connectionsPending: number;
    densityScore: number | null;
    suppliers: number;
    customers: number;
    products: number;
    warehouses: number;
    invoicesTotal: number;
    invoicesPeriod: number;
    invoicesPaid: number;
    posTotal: number;
    posPeriod: number;
    team: number;
    modulesOn: number;
    firstTradeDone: boolean;
    openToTrade: boolean | null;
  };
};

function kpi(label: string, value: string | number, hint?: string): ManagementKpi {
  return { label, value, hint };
}

async function countSoft(
  supabase: SupabaseClient,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any
): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select('id', { count: 'exact', head: true });
    q = apply(q);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Load company-level metrics for the selected workspace.
 * Always safe: missing tables / columns → zeros.
 */
export async function loadCompanyManagementMetrics(
  supabase: SupabaseClient,
  companyId: number,
  period: { from: string; to: string },
  profileMeta?: Record<string, unknown>
): Promise<CompanyMetricsBundle> {
  // Network density (uses its own server client — already soft)
  let density: {
    partnerCount: number;
    densityScore: number;
    connectionsAccepted: number;
    connectionsPending: number;
    suppliersBook: number;
    customersBook: number;
    firstTradeDone: boolean;
    openToTrade: boolean | null;
    recommendations: string[];
    qualityScore: number;
    invitesSent: number;
    acceptRate: number | null;
  } | null = null;
  try {
    const { loadNetworkDensityMetrics } = await import(
      '@/lib/business/network-metrics'
    );
    density = await loadNetworkDensityMetrics(companyId);
  } catch {
    density = null;
  }

  const [
    products,
    warehouses,
    invoicesTotal,
    invoicesPaid,
    invoicesPeriod,
    posTotal,
    posPeriod,
    teamA,
    teamB,
  ] = await Promise.all([
    countSoft(supabase, 'products', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).eq('profile_id', companyId)
    ),
    countSoft(supabase, 'warehouses', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).eq('profile_id', companyId)
    ),
    countSoft(supabase, 'customer_invoices', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).eq('profile_id', companyId)
    ),
    countSoft(supabase, 'customer_invoices', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).eq('profile_id', companyId).in('status', ['paid', 'partial'])
    ),
    // period invoices — soft on date column names
    (async () => {
      try {
        const { count, error } = await supabase
          .from('customer_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', companyId)
          .gte('invoice_date', period.from)
          .lte('invoice_date', period.to);
        if (!error) return count ?? 0;
      } catch {
        /* try created_at */
      }
      try {
        const { count } = await supabase
          .from('customer_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', companyId)
          .gte('created_at', `${period.from}T00:00:00`)
          .lte('created_at', `${period.to}T23:59:59`);
        return count ?? 0;
      } catch {
        return 0;
      }
    })(),
    countSoft(supabase, 'purchase_orders', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).eq('buyer_profile_id', companyId)
    ),
    (async () => {
      try {
        const { count, error } = await supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .eq('buyer_profile_id', companyId)
          .gte('order_date', period.from)
          .lte('order_date', period.to);
        if (!error) return count ?? 0;
      } catch {
        /* soft */
      }
      try {
        const { count } = await supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .eq('buyer_profile_id', companyId)
          .gte('created_at', `${period.from}T00:00:00`)
          .lte('created_at', `${period.to}T23:59:59`);
        return count ?? 0;
      } catch {
        return 0;
      }
    })(),
    countSoft(supabase, 'company_members', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).eq('company_id', companyId)
    ),
    countSoft(supabase, 'profile_memberships', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).eq('profile_id', companyId)
    ),
  ]);

  const team = Math.max(teamA, teamB);

  // Enabled modules from metadata
  let modulesOn = 0;
  const meta = profileMeta || {};
  const em = meta.enabled_modules;
  if (em && typeof em === 'object') {
    modulesOn = Object.values(em as Record<string, unknown>).filter(
      (v) => v === true
    ).length;
  }
  const mods = meta.modules;
  if (!modulesOn && Array.isArray(mods)) modulesOn = mods.length;

  const partners = density?.partnerCount ?? 0;
  const connAcc = density?.connectionsAccepted ?? 0;
  const connPend = density?.connectionsPending ?? 0;
  const densityScore = density?.densityScore ?? null;
  const suppliers = density?.suppliersBook ?? 0;
  const customers = density?.customersBook ?? 0;
  const firstTradeDone = density?.firstTradeDone ?? invoicesTotal + posTotal > 0;
  const openToTrade = density?.openToTrade ?? null;
  const paidPct =
    invoicesTotal > 0
      ? Math.round((invoicesPaid / invoicesTotal) * 1000) / 10
      : null;

  const kpis: ManagementKpi[] = [
    kpi(
      'Network density',
      densityScore != null ? `${densityScore}` : '—',
      '0–100 score'
    ),
    kpi('Partners', partners, `goal via invites`),
    kpi('Connections', connAcc, connPend ? `${connPend} pending` : 'accepted'),
    kpi('Customers book', customers),
    kpi('Suppliers book', suppliers),
    kpi('Products', products),
    kpi('Warehouses', warehouses),
    kpi('Invoices (period)', invoicesPeriod, `${invoicesTotal} all-time`),
    kpi(
      'Paid invoices',
      invoicesPaid,
      paidPct != null ? `${paidPct}% of total` : undefined
    ),
    kpi('POs (period)', posPeriod, `${posTotal} all-time`),
    kpi('Team seats', team || '—'),
    kpi('Modules on', modulesOn || '—'),
  ];

  const tables: ManagementTable[] = [
    {
      title: 'Company commercial snapshot',
      headers: ['Metric', 'Value', 'Notes'],
      rows: [
        ['Network density', densityScore ?? '—', '0–100'],
        ['Trading partners', partners, 'invite goal path'],
        ['Connections accepted', connAcc, connPend ? `${connPend} pending` : ''],
        ['Customers on book', customers, ''],
        ['Suppliers on book', suppliers, ''],
        ['Catalogue products', products, ''],
        ['Warehouses', warehouses, ''],
        ['Invoices (period)', invoicesPeriod, `${invoicesTotal} lifetime`],
        [
          'Invoices paid / partial',
          invoicesPaid,
          paidPct != null ? `${paidPct}%` : '',
        ],
        ['Purchase orders (period)', posPeriod, `${posTotal} lifetime`],
        ['Open to trade', openToTrade == null ? '—' : openToTrade ? 'Yes' : 'No', ''],
        ['First trade done', firstTradeDone ? 'Yes' : 'No', ''],
        ['Team seats', team || '—', ''],
        ['Modules enabled', modulesOn || '—', ''],
        [
          'Invite quality',
          density?.qualityScore != null ? density.qualityScore : '—',
          density?.acceptRate != null ? `${density.acceptRate}% accept` : '',
        ],
      ],
    },
    {
      title: 'Company trade pipeline',
      headers: ['Stage', 'Count'],
      rows: [
        ['Invites sent', density?.invitesSent ?? 0],
        ['Connections accepted', connAcc],
        ['Invoices created', invoicesTotal],
        ['Invoices paid/partial', invoicesPaid],
        ['POs raised', posTotal],
        ['Partners', partners],
      ],
    },
  ];

  const charts: ManagementChart[] = [
    {
      id: 'company_commercial',
      title: 'Company commercial pulse',
      type: 'bar',
      series: [
        { label: 'Customers', value: customers, color: '#0077b6' },
        { label: 'Suppliers', value: suppliers, color: '#00b4d8' },
        { label: 'Products', value: products, color: '#059669' },
        { label: 'Invoices', value: invoicesTotal, color: '#d97706' },
        { label: 'POs', value: posTotal, color: '#7c3aed' },
        { label: 'Partners', value: partners, color: '#0d9488' },
      ],
    },
    {
      id: 'company_network',
      title: 'Network & density',
      type: 'donut',
      unit: 'score',
      series: [
        {
          label: 'Density',
          value: densityScore ?? 0,
          color: '#0077b6',
        },
        {
          label: 'Headroom',
          value: Math.max(0, 100 - (densityScore ?? 0)),
          color: '#e2e8f0',
        },
      ],
    },
  ];

  const highlights: string[] = [
    densityScore != null
      ? `Company network density ${densityScore}/100`
      : 'Network density not scored yet',
    `${customers} customers · ${suppliers} suppliers · ${products} products on catalogue`,
    invoicesPeriod > 0 || posPeriod > 0
      ? `Period trade: ${invoicesPeriod} invoice(s) · ${posPeriod} PO(s)`
      : firstTradeDone
        ? 'Trade history exists outside this period'
        : 'No trade activity in this period',
  ];

  const risks: string[] = [
    !firstTradeDone
      ? 'No first trade yet — run First trade path'
      : 'First trade complete',
    connPend > 0
      ? `${connPend} pending connection(s) need review`
      : 'No pending connections',
    openToTrade === false
      ? 'Open to trade is off — directory discovery limited'
      : 'Trade discovery settings OK',
    products === 0
      ? 'No products on catalogue — buyers cannot order SKUs'
      : 'Catalogue has products',
  ];

  const actions: string[] = [
    ...(density?.recommendations?.slice(0, 2) || []),
    products === 0 ? 'Add catalogue products for trade' : 'Keep catalogue current',
    !firstTradeDone
      ? 'Complete first invoice or PO'
      : 'Push period close on open invoices',
    team === 0 ? 'Invite team seats for collaboration' : 'Review team access roles',
  ].slice(0, 5);

  return {
    kpis,
    tables,
    charts,
    highlights,
    risks,
    actions,
    raw: {
      partners,
      connectionsAccepted: connAcc,
      connectionsPending: connPend,
      densityScore,
      suppliers,
      customers,
      products,
      warehouses,
      invoicesTotal,
      invoicesPeriod,
      invoicesPaid,
      posTotal,
      posPeriod,
      team,
      modulesOn,
      firstTradeDone,
      openToTrade,
    },
  };
}

/**
 * Merge company metrics into an Advisor management doc.
 * - Adds Company slice
 * - Extends KPIs (advisor first, then company) up to 12
 * - Adds company charts/tables/highlights
 */
export function mergeCompanyMetricsIntoReport(
  doc: ManagementReportDoc,
  company: CompanyMetricsBundle,
  activeSlice: string
): ManagementReportDoc {
  const slices = [
    ...doc.availableSlices.filter((s) => s.id !== 'company'),
    { id: 'company', label: 'Company' },
  ];

  const advisorKpis = doc.kpis || [];
  // Prefer distinct labels — company KPIs fill remaining slots
  const seen = new Set(
    advisorKpis.map((k) => k.label.toLowerCase())
  );
  const companyKpis = company.kpis.filter(
    (k) => !seen.has(k.label.toLowerCase())
  );
  const mergedKpis = [...advisorKpis, ...companyKpis].slice(0, 12);

  const charts = [
    ...(doc.charts || []),
    ...company.charts.filter(
      (c) => !(doc.charts || []).some((d) => d.id === c.id)
    ),
  ].slice(0, 4);

  let tables = doc.tables;
  let sliceLabel = doc.sliceLabel;
  if (activeSlice === 'company') {
    tables = company.tables;
    sliceLabel = 'Company';
  } else if (activeSlice === 'overview' || !activeSlice) {
    // Overview: advisor tables + compact company commercial
    tables = [
      ...doc.tables.slice(0, 2),
      {
        title: 'Company commercial (summary)',
        headers: ['Metric', 'Value'],
        rows: company.tables[0].rows.slice(0, 8).map((r) => [r[0], r[1]]),
      },
    ].slice(0, 3);
  }

  return {
    ...doc,
    availableSlices: slices,
    slice: activeSlice || doc.slice,
    sliceLabel,
    kpis: mergedKpis,
    tables,
    charts,
    highlights: [...(doc.highlights || []), ...company.highlights].slice(0, 6),
    risks: [...(doc.risks || []), ...company.risks].slice(0, 6),
    actions: [...(doc.actions || []), ...company.actions].slice(0, 6),
    filterSummary: [doc.filterSummary, 'Company metrics included']
      .filter(Boolean)
      .join(' · '),
  };
}
