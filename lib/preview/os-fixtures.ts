/**
 * In-memory samples for the command center, purchase orders, inventory,
 * ratings, and SHEQ. Nothing here is written to a database.
 */
import { coaPreviewJson } from '@/lib/accounting/coa-preview';
import { crmPreviewJson } from '@/lib/customers/crm-preview';
import { srmPreviewBook, srmPreviewJson } from '@/lib/suppliers/srm-preview';

export const FIXTURE_COMPANY_ID = 91001;
export const FIXTURE_COMPANY_NAME = 'Harbour & Co';

/** Sample first-run company. Counts only — never written anywhere. */
export const FIRST_RUN_FIXTURE_COMPANY_ID = 91002;
export const FIRST_RUN_FIXTURE_COMPANY_NAME = 'Northwind Provisions';

export function osFirstRunSignals() {
  return {
    profileCompleteness: 75,
    suppliers: 1,
    customers: 0,
    purchaseOrders: 0,
    teamActive: 1,
    teamInvited: 0,
    verified: false,
  };
}

const ADVISOR_MODULES_OFF = {
  hiregraph: false,
  retailgraph: false,
  apparelgraph: false,
  constructiongraph: false,
  fitgraph: false,
  physiograph: false,
  dentalgraph: false,
  medicalgraph: false,
  vetgraph: false,
  psychiatrygraph: false,
  fieldgraph: false,
  quarrygraph: false,
  schools: false,
};

function pathOf(url: string): { path: string; params: URLSearchParams } | null {
  try {
    const parsed = new URL(url, 'http://preview.local');
    return { path: parsed.pathname, params: parsed.searchParams };
  } catch {
    return null;
  }
}

export function osDashboardHome() {
  return {
    success: true,
    company: {
      id: FIXTURE_COMPANY_ID,
      trading_name: FIXTURE_COMPANY_NAME,
      legal_name: 'Harbour and Company (Pty) Ltd',
      industry: 'Food distribution',
      country: 'South Africa',
      city: 'Cape Town',
      verification_status: 'verified',
      trust_score: 92,
      primary_currency: 'ZAR',
    },
    kpis: {
      teamActive: 6,
      teamInvited: 1,
      networkAccepted: 14,
      networkPendingIn: 2,
      networkPendingOut: 1,
      openRisks: 1,
      highRisks: 0,
      products: 48,
      warehouseLowStock: 3,
      containerLowStock: 0,
      customersTotal: 4,
      leadsOpen: 3,
      pipelineValue: 1280000,
      opportunitiesOpen: 5,
      srmOpenPos: 2,
      srmOnchainPos: 0,
      purchaseOrders: 2,
      profileCompleteness: 86,
      arOpen: 3,
      arOpenValue: 186400,
      apOpen: 1,
      apOpenValue: 94200,
    },
    crm: {
      customers: 4,
      pipelineValue: 1280000,
      pipelineWeighted: 640000,
      opportunitiesOpen: 5,
      leadsOpen: 3,
      riadOpen: 0,
      wonCount: 2,
      wonValue: 240000,
    },
    srm: {
      book: 3,
      connected: 2,
      openPos: 2,
      onchainPos: 0,
      avgOtifef: 96,
      avgTrust: 91,
      verified: 2,
      riadOpen: 0,
    },
    network: {
      accepted: 14,
      pendingIn: 2,
      pendingOut: 1,
      pricingActive: 4,
    },
    trade: {
      quotesOpen: 2,
      quotesValue: 86400,
      arOpen: 3,
      arOpenValue: 186400,
      apOpen: 1,
      apOpenValue: 94200,
      openPos: 2,
      onchainPos: 0,
      purchaseOrders: 2,
    },
    inventory: {
      products: 48,
      multiCurrencyProducts: 0,
      warehouseLowStock: 3,
      warehouses: 2,
    },
    business: {
      profileCompleteness: 86,
      teamActive: 6,
      teamInvited: 1,
      verified: true,
    },
    alerts: [
      {
        id: 'low-stock',
        severity: 'warning',
        title: '3 lines at or below reorder',
        detail: 'Kelp flakes in the cold room.',
        href: '/dashboard/inventory/stock?low=1',
      },
    ],
    generatedAt: '2026-10-13T08:00:00.000Z',
  };
}

export function osInventorySummary() {
  return {
    products: 48,
    productsActive: 46,
    warehouses: 2,
    stockLines: 62,
    unitsOnHand: 18420,
    containerUnits: 860,
    lowStock: 3,
    onchainReady: 12,
    rawMaterials: 18,
    finishedGoods: 30,
  };
}

export function osStockFixture() {
  const products = [
    {
      id: 1,
      name: 'Kelp flakes',
      sku: 'KELP-10',
      uom: 'kg',
      product_type: 'finished_good',
      category: 'Seaweed',
    },
    {
      id: 2,
      name: 'Glass jars 500ml',
      sku: 'JAR-500',
      uom: 'ea',
      product_type: 'raw_material',
      category: 'Packaging',
    },
  ];
  const byProduct = [
    {
      product_id: 1,
      name: 'Kelp flakes',
      sku: 'KELP-10',
      uom: 'kg',
      product_type: 'finished_good',
      category: 'Seaweed',
      total_on_hand: 42,
      total_reserved: 6,
      total_available: 36,
      locations: 1,
      low_locations: 1,
      reorder_level: 80,
      is_low: true,
      in_transit: 0,
      by_location: [
        { warehouse_id: 1, location_name: 'Cape Town DC', qty_on_hand: 42, lot_number: 'LOT-204' },
      ],
    },
    {
      product_id: 2,
      name: 'Glass jars 500ml',
      sku: 'JAR-500',
      uom: 'ea',
      product_type: 'raw_material',
      category: 'Packaging',
      total_on_hand: 2400,
      total_reserved: 0,
      total_available: 2400,
      locations: 1,
      low_locations: 0,
      reorder_level: 400,
      is_low: false,
      in_transit: 200,
      by_location: [
        { warehouse_id: 1, location_name: 'Cape Town DC', qty_on_hand: 2400, lot_number: null },
      ],
    },
  ];
  return {
    success: true,
    levels: [],
    byLocation: [
      {
        warehouse_id: 1,
        location_key: 'wh-1',
        name: 'Cape Town DC',
        code: 'CPT',
        owner_type: 'own',
        city: 'Cape Town',
        lines: 2,
        units: 2442,
        reserved: 6,
        available: 2436,
        low_stock: 1,
        skus: 2,
        in_transit_inbound: 200,
      },
    ],
    byProduct,
    containerLines: [],
    warehouses: [{ id: 1, name: 'Cape Town DC', code: 'CPT', owner_type: 'own', city: 'Cape Town' }],
    products,
    summary: {
      asOf: '2026-10-13T08:00:00.000Z',
      stockLines: 2,
      totalUnits: 2442,
      totalReserved: 6,
      totalAvailable: 2436,
      lowStockLines: 1,
      skusWithStock: 2,
      locations: 2,
      locationsWithStock: 1,
      inTransitUnits: 200,
      inTransitLines: 1,
      containerUnits: 860,
      containerLines: 4,
      networkUnits: 3502,
      typeBreakdown: { raw_material: 2400, finished_good: 42, other: 0 },
      ownerBreakdown: { own: 2442, supplier: 0, customer: 0, unassigned: 0 },
    },
  };
}

export function osSheqSummary() {
  return {
    success: true,
    counts: {
      incidentsOpen: 1,
      ncrsOpen: 1,
      capasOpen: 1,
      hazardsOpen: 1,
      highRisks: 1,
      qaHolds: 1,
    },
    recentIncidents: [
      {
        id: 41,
        title: 'Slip near the cold-room door',
        status: 'investigating',
        severity: 'medium',
      },
    ],
    recentNcrs: [
      {
        id: 18,
        title: 'Label mismatch on kelp flakes',
        status: 'open',
        lot_number: 'LOT-204',
      },
    ],
    recentCapas: [
      { id: 9, title: 'Replace worn floor mat', status: 'in_progress' },
    ],
  };
}

function osPreviewJson(path: string, params: URLSearchParams): unknown | null {
  if (path.startsWith('/api/dashboard/home')) return osDashboardHome();
  if (path.startsWith('/api/operations/summary')) {
    return {
      summary: {
        workOrdersInFlight: 6,
        shipmentsInMotion: 3,
        exceptions: 2,
        unitsOnHand: 18420,
        qualityOpen: 1,
        supplierPosOpen: 2,
        inboundInMotion: 1,
        outboundInMotion: 2,
        transfersLive: 1,
        warehouses: 2,
      },
    };
  }
  if (path.startsWith('/api/manufacturing/summary')) {
    return { summary: { bomsActive: 8, ordersInProgress: 4, oee: 81, workCentersActive: 3 } };
  }
  if (path.startsWith('/api/accounting/summary')) {
    return {
      summary: {
        arOpen: 3,
        arOpenAmount: 186400,
        arOverdue: 1,
        arOverdueAmount: 22000,
        apOpen: 1,
        apOpenAmount: 94200,
        apOverdue: 0,
        bankAccounts: 2,
        bankBalance: 640000,
        unreconciled: 4,
        currency: 'ZAR',
      },
    };
  }
  if (path.startsWith('/api/inventory/summary')) {
    return { success: true, summary: osInventorySummary() };
  }
  if (path.startsWith('/api/inventory/stock')) return osStockFixture();
  if (path.startsWith('/api/inventory/products')) {
    return { success: true, products: osStockFixture().products };
  }
  if (path.startsWith('/api/sheq/summary')) return osSheqSummary();
  if (path.startsWith('/api/sheq/incidents')) {
    return {
      success: true,
      incidents: [
        {
          id: 41,
          profile_id: FIXTURE_COMPANY_ID,
          public_ref: 'INC-00041',
          incident_type: 'near_miss',
          severity: 'medium',
          status: 'investigating',
          title: 'Slip near the cold-room door',
          description: 'A wet mat shifted during the morning receive.',
          location: 'Cape Town DC',
        },
      ],
    };
  }
  if (path.startsWith('/api/sheq/ncrs')) {
    return {
      success: true,
      ncrs: [
        {
          id: 18,
          title: 'Label mismatch on kelp flakes',
          status: 'open',
          severity: 'high',
          domain: 'quality',
          source: 'inspection',
          lot_number: 'LOT-204',
          description: 'Inner label does not match the lot card.',
        },
      ],
    };
  }
  if (path.startsWith('/api/sheq/capas')) {
    return {
      success: true,
      capas: [
        {
          id: 9,
          title: 'Replace worn floor mat',
          status: 'in_progress',
          priority: 'medium',
          description: 'Fit a non-slip mat at the cold-room door.',
        },
      ],
    };
  }
  if (path.startsWith('/api/sheq/hazards')) {
    return {
      success: true,
      hazards: [
        {
          id: 7,
          title: 'Wet floor at receiving',
          status: 'open',
          category: 'slip',
          likelihood: 3,
          severity: 4,
          risk_score: 12,
          location: 'Cape Town DC',
        },
      ],
    };
  }
  if (path.startsWith('/api/business/ratings')) {
    return {
      success: true,
      aggregates: [
        {
          ratee_profile_id: 8801,
          ratee_role: params.get('role') || 'customer',
          name: 'Atlantic Table',
          rating_avg: 4.6,
          rating_count: 3,
          quality: 5,
          delivery: 4,
          communication: 5,
          value: 4,
          payment: 4.5,
          reliability: 4.7,
        },
      ],
      summary: { givenCount: 3, companiesRated: 1, givenAvg: 4.6 },
    };
  }
  if (path.startsWith('/api/connections')) {
    return {
      edges: [
        {
          status: 'accepted',
          role: 'customer',
          peer: { id: 8801, trading_name: 'Atlantic Table' },
        },
      ],
    };
  }
  if (path.startsWith('/api/business/membership')) {
    return {
      companyId: FIXTURE_COMPANY_ID,
      companyName: FIXTURE_COMPANY_NAME,
      membership: {
        role: 'owner',
        roleLabel: 'Owner',
        rights: 'full',
        memberId: 1,
        canManageTeam: true,
      },
      enabledModules: {
        customers: true,
        suppliers: true,
        inventory: true,
        sheq: true,
        quality: true,
        ...ADVISOR_MODULES_OFF,
      },
      packaging: null,
      sidebarModuleOrder: [],
    };
  }
  if (path.startsWith('/api/business/settings')) {
    return { success: true, settings: {} };
  }
  const chart = coaPreviewJson(path, params);
  if (chart) return chart;
  if (path.startsWith('/api/suppliers/purchase-orders')) {
    const book = srmPreviewBook();
    return {
      success: true,
      purchaseOrders: book.purchaseOrders,
      counts: {
        total: book.purchaseOrders.length,
        open: 1,
        completed: 1,
        onchain: 0,
        draft: 0,
        cancelled: 0,
      },
    };
  }
  return null;
}

/** Answers fixture GETs. Returns null when this URL is not a sample. */
export function previewJson(url: string): unknown | null {
  const parsed = pathOf(url);
  if (!parsed || !parsed.path.startsWith('/api/')) return null;
  const os = osPreviewJson(parsed.path, parsed.params);
  if (os) return os;
  const crm = crmPreviewJson(url);
  if (crm) return crm;
  return srmPreviewJson(url);
}
