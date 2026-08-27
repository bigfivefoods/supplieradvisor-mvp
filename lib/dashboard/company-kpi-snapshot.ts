/**
 * Shared company KPI rows: POs, customers, products, stock, invoices, plus
 * the other tables dashboard / ops / intel / manufacturing all re-read.
 * Process-local 30s + single-flight so the home page's five summary calls
 * share one fetch.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { ttlGetOrLoad } from '@/lib/system/memory-ttl';
import { KPI_TTL_MS } from '@/lib/dashboard/kpi-cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KpiRow = Record<string, any>;

/** Snapshot rows never carry a PostgREST error; keep the field typed for callers. */
export function snapOk<T>(data: T[], count?: number) {
  return {
    data,
    count,
    error: null as { message: string } | null,
  };
}

export type CompanyKpiSnapshot = {
  products: KpiRow[];
  productsCount: number;
  customers: KpiRow[];
  stock: KpiRow[];
  warehouses: KpiRow[];
  buyerPos: KpiRow[];
  sellerPos: KpiRow[];
  invoices: KpiRow[];
  srmSuppliers: KpiRow[];
  connections: KpiRow[];
  leads: KpiRow[];
  quotes: KpiRow[];
  mfgOrders: KpiRow[];
  mfgBoms: KpiRow[];
  mfgWorkCenters: KpiRow[];
  shipments: KpiRow[];
};

function rows(data: unknown): KpiRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter((r) => r && typeof r === 'object') as KpiRow[];
}

async function loadCompanyKpiSnapshotUncached(
  companyId: number
): Promise<CompanyKpiSnapshot> {
  const supabase = getSupabaseServer();
  const [
    productsRes,
    customersRes,
    stockRes,
    warehousesRes,
    buyerPosRes,
    sellerPosRes,
    invoicesRes,
    srmRes,
    connectionsRes,
    leadsRes,
    quotesRes,
    mfgOrdersRes,
    mfgBomsRes,
    mfgWcRes,
    shipsRes,
  ] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, name, sku, product_type, is_active, status, base_currency, prices, sell_price, cost_price, onchain_status',
        { count: 'exact' }
      )
      .eq('profile_id', companyId)
      .limit(500),
    supabase
      .from('customers')
      .select('id, status, invite_status, trading_name, created_at')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('stock_levels')
      .select('id, qty_on_hand, qty_reserved, reorder_level, product_id')
      .eq('profile_id', companyId)
      .limit(500),
    supabase
      .from('warehouses')
      .select('id, name, status')
      .eq('profile_id', companyId)
      .limit(100),
    supabase
      .from('purchase_orders')
      .select(
        'id, status, total_amount, total, currency, created_at, po_number, onchain_po_id, supplier_id, supplier_profile_id, buyer_profile_id'
      )
      .eq('buyer_profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('purchase_orders')
      .select(
        'id, status, total_amount, total, currency, created_at, po_number, onchain_po_id, supplier_id, supplier_profile_id, buyer_profile_id'
      )
      .or(
        `supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`
      )
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('invoices')
      .select(
        'id, direction, status, total_amount, amount_paid, currency, created_at, due_date'
      )
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('srm_suppliers')
      .select(
        'id, trading_name, status, invite_status, trust_score, otifef_pct, verified, linked_profile_id, rating_avg, rating_count, created_at'
      )
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(300),
    supabase
      .from('business_connections')
      .select(
        'id, status, requested_at, accepted_at, requester_profile_id, requestee_profile_id, requester_id, requestee_id, connection_type, metadata, updated_at'
      )
      .or(
        `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
      )
      .limit(200),
    supabase
      .from('leads')
      .select('id, status, name, created_at')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('customer_quotes')
      .select('id, status, total_amount, currency, created_at')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('manufacturing_production_orders')
      .select(
        'id, status, qty_planned, qty_completed, qty_scrapped, priority, order_number'
      )
      .eq('profile_id', companyId)
      .limit(500),
    supabase
      .from('manufacturing_boms')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(500),
    supabase
      .from('manufacturing_work_centers')
      .select('id, status')
      .eq('profile_id', companyId)
      .limit(200),
    supabase
      .from('shipments')
      .select(
        'id, direction, status, mode, eta, shipment_number, progress_pct'
      )
      .eq('profile_id', companyId)
      .limit(200),
  ]);

  const products = rows(productsRes.data);
  return {
    products,
    productsCount: productsRes.count ?? products.length,
    customers: rows(customersRes.data),
    stock: rows(stockRes.data),
    warehouses: rows(warehousesRes.data),
    buyerPos: rows(buyerPosRes.data),
    sellerPos: rows(sellerPosRes.data),
    invoices: rows(invoicesRes.data),
    srmSuppliers: rows(srmRes.data),
    connections: rows(connectionsRes.data),
    leads: rows(leadsRes.data),
    quotes: rows(quotesRes.data),
    mfgOrders: rows(mfgOrdersRes.data),
    mfgBoms: rows(mfgBomsRes.data),
    mfgWorkCenters: rows(mfgWcRes.data),
    shipments: rows(shipsRes.data),
  };
}

export function loadCompanyKpiSnapshot(
  companyId: number
): Promise<CompanyKpiSnapshot> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return Promise.resolve(emptySnapshot());
  }
  return ttlGetOrLoad(
    `kpi:snap:${companyId}`,
    KPI_TTL_MS,
    () => loadCompanyKpiSnapshotUncached(companyId)
  );
}

function emptySnapshot(): CompanyKpiSnapshot {
  return {
    products: [],
    productsCount: 0,
    customers: [],
    stock: [],
    warehouses: [],
    buyerPos: [],
    sellerPos: [],
    invoices: [],
    srmSuppliers: [],
    connections: [],
    leads: [],
    quotes: [],
    mfgOrders: [],
    mfgBoms: [],
    mfgWorkCenters: [],
    shipments: [],
  };
}
