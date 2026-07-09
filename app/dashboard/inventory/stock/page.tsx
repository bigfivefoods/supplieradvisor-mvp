'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  PackagePlus,
  AlertTriangle,
  RefreshCw,
  Search,
  Warehouse,
  Package,
  MapPin,
  Truck,
  ChevronDown,
  ChevronRight,
  Radio,
  ArrowLeftRight,
  Box,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  ownerTypeClass,
  ownerTypeLabel,
  type ProductRecord,
  type WarehouseRecord,
} from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

type StockLevel = {
  id: number;
  product_id: number;
  warehouse_id?: number | null;
  qty_on_hand: number;
  qty_reserved?: number;
  qty_available?: number;
  reorder_level?: number;
  is_low?: boolean;
  lot_number?: string | null;
  bin_location?: string | null;
  location_name?: string;
  location_key?: string;
  updated_at?: string;
  product?: {
    id: number;
    name?: string;
    sku?: string | null;
    uom?: string | null;
    product_type?: string | null;
    category?: string | null;
  } | null;
  warehouse?: {
    id: number;
    name?: string;
    code?: string | null;
    owner_type?: string | null;
    partner_name?: string | null;
    city?: string | null;
  } | null;
};

type ByLocation = {
  warehouse_id: number | null;
  location_key: string;
  name: string;
  code?: string | null;
  owner_type?: string | null;
  partner_name?: string | null;
  city?: string | null;
  lines: number;
  units: number;
  reserved: number;
  available: number;
  low_stock: number;
  skus: number;
  in_transit_inbound: number;
};

type ByProduct = {
  product_id: number;
  name: string;
  sku?: string | null;
  uom?: string | null;
  product_type?: string | null;
  category?: string | null;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  locations: number;
  low_locations: number;
  reorder_level: number;
  is_low: boolean;
  in_transit: number;
  by_location: Array<{
    warehouse_id: number | null;
    location_name: string;
    qty_on_hand: number;
    lot_number?: string | null;
  }>;
};

type Summary = {
  asOf: string;
  stockLines: number;
  totalUnits: number;
  totalReserved: number;
  totalAvailable: number;
  lowStockLines: number;
  skusWithStock: number;
  locations: number;
  locationsWithStock: number;
  inTransitUnits: number;
  inTransitLines: number;
  containerUnits: number;
  containerLines: number;
  networkUnits: number;
  typeBreakdown: { raw_material: number; finished_good: number; other: number };
  ownerBreakdown: { own: number; supplier: number; customer: number; unassigned: number };
};

type ContainerLine = {
  id: string;
  product_name: string;
  sku?: string | null;
  qty_on_hand: number;
  location_name: string;
  is_low?: boolean;
  uom?: string;
};

type ViewMode = 'lines' | 'products' | 'locations';

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function relTime(iso?: string) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5000) return 'just now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return new Date(iso).toLocaleString();
}

export default function StockLevelsPage() {
  return (
    <CompanyRequired>
      <StockInner />
    </CompanyRequired>
  );
}

function StockInner() {
  const companyId = getSelectedCompanyId()!;
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [byLocation, setByLocation] = useState<ByLocation[]>([]);
  const [byProduct, setByProduct] = useState<ByProduct[]>([]);
  const [containerLines, setContainerLines] = useState<ContainerLine[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  // View / filters
  const [view, setView] = useState<ViewMode>('products');
  const [q, setQ] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [lowOnly, setLowOnly] = useState(false);
  const [showContainers, setShowContainers] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [showMove, setShowMove] = useState(false);

  // Quick move
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('1');
  const [action, setAction] = useState('receive');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        if (locationFilter !== 'all') params.set('warehouseId', locationFilter);
        if (typeFilter !== 'all') params.set('productType', typeFilter);

        const [sRes, pRes] = await Promise.all([
          fetch(`/api/inventory/stock?${params}`).then((r) => r.json()),
          fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
        ]);

        setLevels(sRes.levels || []);
        setByLocation(sRes.byLocation || []);
        setByProduct(sRes.byProduct || []);
        setContainerLines(sRes.containerLines || []);
        setSummary(sRes.summary || null);
        setWarehouses(sRes.warehouses || []);
        setAsOf(sRes.asOf || sRes.summary?.asOf || new Date().toISOString());
        setProducts(pRes.products || sRes.products || []);
        if (sRes.warning) toast.message(sRes.warning);
      } catch {
        toast.error('Failed to load live stock');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, locationFilter, typeFilter]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Live poll every 30s
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void load({ silent: true }), 30000);
    return () => clearInterval(id);
  }, [live, load]);

  const needle = q.trim().toLowerCase();

  const filteredLevels = useMemo(() => {
    let rows = levels;
    if (lowOnly) rows = rows.filter((l) => l.is_low);
    if (needle) {
      rows = rows.filter((l) => {
        const hay = [
          l.product?.name,
          l.product?.sku,
          l.product?.category,
          l.location_name,
          l.warehouse?.name,
          l.warehouse?.partner_name,
          l.lot_number,
          l.bin_location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    return rows;
  }, [levels, lowOnly, needle]);

  const filteredProducts = useMemo(() => {
    let rows = byProduct;
    if (lowOnly) rows = rows.filter((p) => p.is_low);
    if (needle) {
      rows = rows.filter((p) => {
        const hay = [p.name, p.sku, p.category, p.product_type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    return rows;
  }, [byProduct, lowOnly, needle]);

  const filteredLocations = useMemo(() => {
    let rows = byLocation;
    if (locationFilter !== 'all' && locationFilter !== 'none') {
      rows = rows.filter((l) => l.location_key === locationFilter);
    }
    if (locationFilter === 'none') {
      rows = rows.filter((l) => l.location_key === 'unassigned');
    }
    if (lowOnly) rows = rows.filter((l) => l.low_stock > 0);
    if (needle) {
      rows = rows.filter((l) => {
        const hay = [l.name, l.code, l.partner_name, l.city, l.owner_type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    return rows;
  }, [byLocation, locationFilter, lowOnly, needle]);

  const filteredContainers = useMemo(() => {
    let rows = containerLines;
    if (needle) {
      rows = rows.filter((c) => {
        const hay = [c.product_name, c.sku, c.location_name].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(needle);
      });
    }
    if (lowOnly) rows = rows.filter((c) => c.is_low);
    return rows;
  }, [containerLines, needle, lowOnly]);

  const move = async () => {
    if (!productId) {
      toast.error('Select a product');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          productId: Number(productId),
          warehouseId: warehouseId ? Number(warehouseId) : undefined,
          quantity: Number(qty),
          movement_type: action,
          absolute: action === 'count',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Stock updated · ${fmt(data.qty_on_hand)} on hand`);
      setQty('1');
      void load({ silent: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const whOptionLabel = (w: WarehouseRecord) => {
    const owner =
      w.owner_type && w.owner_type !== 'own' ? ` · ${w.owner_type}` : '';
    const partner = w.partner_name ? ` · ${w.partner_name}` : '';
    return `${w.name}${owner}${partner}`;
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Live stock"
        description="Step 3 — network inventory across warehouses, supplier/customer sites, and containers. Totals, by product, by location."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/inventory/scan"
              className="btn-secondary !py-2.5 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              Receive
            </Link>
            <Link
              href="/dashboard/inventory/stock-transfers"
              className="btn-secondary !py-2.5 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4" /> Transfer
            </Link>
            <button
              type="button"
              onClick={() => setShowMove((v) => !v)}
              className="btn-primary !py-2.5 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              <PackagePlus className="w-4 h-4" /> Adjust stock
            </button>
          </div>
        }
      />

      {/* Live bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 text-xs">
        <div className="inline-flex items-center gap-2 text-neutral-600">
          <span
            className={`inline-flex items-center gap-1.5 font-semibold ${live ? 'text-emerald-700' : 'text-neutral-500'}`}
          >
            <Radio className={`w-3.5 h-3.5 ${live && !refreshing ? 'animate-pulse' : ''}`} />
            {live ? 'Live' : 'Paused'}
          </span>
          <span className="text-neutral-400">·</span>
          <span>Updated {asOf ? relTime(asOf) : '—'}</span>
          {refreshing && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00b4d8]" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
              live
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-neutral-200 text-neutral-600'
            }`}
          >
            {live ? 'Auto-refresh on' : 'Auto-refresh off'}
          </button>
          <button
            type="button"
            onClick={() => void load({ silent: true })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 font-semibold hover:bg-neutral-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        <Kpi
          label="Network units"
          value={fmt(summary?.networkUnits ?? 0)}
          sub="WH + containers + transit"
          tone="sky"
        />
        <Kpi
          label="On hand (WH)"
          value={fmt(summary?.totalUnits ?? 0)}
          sub={`${summary?.skusWithStock ?? 0} SKUs · ${summary?.stockLines ?? 0} lines`}
        />
        <Kpi
          label="Locations"
          value={String(summary?.locationsWithStock ?? 0)}
          sub={`of ${summary?.locations ?? 0} configured`}
        />
        <Kpi
          label="Low stock"
          value={String(summary?.lowStockLines ?? 0)}
          sub="lines at/below reorder"
          tone={(summary?.lowStockLines || 0) > 0 ? 'amber' : 'neutral'}
        />
        <Kpi
          label="In transit"
          value={fmt(summary?.inTransitUnits ?? 0)}
          sub={`${summary?.inTransitLines ?? 0} open lines`}
          tone={(summary?.inTransitUnits || 0) > 0 ? 'violet' : 'neutral'}
        />
        <Kpi
          label="Containers"
          value={fmt(summary?.containerUnits ?? 0)}
          sub={`${summary?.containerLines ?? 0} outlet lines`}
        />
      </div>

      {/* Owner + type breakdown */}
      {summary && (
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <div className="rounded-3xl border bg-white p-4">
            <div className="text-xs font-semibold text-neutral-500 mb-2">Units by owner</div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['own', 'Mine', summary.ownerBreakdown.own],
                  ['supplier', 'Supplier', summary.ownerBreakdown.supplier],
                  ['customer', 'Customer', summary.ownerBreakdown.customer],
                  ['unassigned', 'Unassigned', summary.ownerBreakdown.unassigned],
                ] as const
              ).map(([k, label, n]) => (
                <span
                  key={k}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    k === 'own'
                      ? ownerTypeClass('own')
                      : k === 'supplier'
                        ? ownerTypeClass('supplier')
                        : k === 'customer'
                          ? ownerTypeClass('customer')
                          : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {label}: {fmt(n)}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border bg-white p-4">
            <div className="text-xs font-semibold text-neutral-500 mb-2">Units by product type</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-800">
                Raw materials: {fmt(summary.typeBreakdown.raw_material)}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                Finished goods: {fmt(summary.typeBreakdown.finished_good)}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700">
                Other: {fmt(summary.typeBreakdown.other)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick adjust */}
      {showMove && (
        <div className="bg-white border rounded-3xl p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            className="input !p-3 !text-sm lg:col-span-2"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select product *</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.sku ? `(${p.sku})` : ''}
              </option>
            ))}
          </select>
          <select
            className="input !p-3 !text-sm"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">Unassigned / default</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {whOptionLabel(w)}
              </option>
            ))}
          </select>
          <select
            className="input !p-3 !text-sm"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="receive">Receive</option>
            <option value="issue">Issue</option>
            <option value="adjustment">Adjust (+/−)</option>
            <option value="count">Set count</option>
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              className="input !p-3 !text-sm flex-1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void move()}
              className="btn-primary !px-4"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Filters + view tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="flex rounded-2xl border bg-white p-1 gap-1">
          {(
            [
              ['products', 'By product', Package],
              ['locations', 'By location', MapPin],
              ['lines', 'All lines', Warehouse],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                view === k
                  ? 'bg-[#00b4d8] text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input w-full !pl-9 !py-2.5 !text-sm"
              placeholder="Search product, SKU, location…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="input !py-2.5 !px-3 !text-sm min-w-[160px]"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="all">All locations</option>
            <option value="none">Unassigned only</option>
            {warehouses.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            className="input !py-2.5 !px-3 !text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="raw_material">Raw materials</option>
            <option value="finished_good">Finished goods</option>
            <option value="consumable">Consumables</option>
            <option value="kit">Kits</option>
          </select>
          <button
            type="button"
            onClick={() => setLowOnly((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-semibold ${
              lowOnly
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-neutral-200 text-neutral-600'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Low only
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {/* BY PRODUCT */}
          {view === 'products' && (
            <div className="bg-white border rounded-3xl overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between">
                <div className="font-semibold text-sm">
                  Product totals across locations
                  <span className="text-neutral-400 font-normal ml-2">
                    ({filteredProducts.length})
                  </span>
                </div>
              </div>
              {filteredProducts.length === 0 ? (
                <EmptyStock />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 border-b text-left text-xs text-neutral-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Product</th>
                        <th className="px-3 py-3 font-semibold">Type</th>
                        <th className="px-3 py-3 font-semibold text-right">Total on hand</th>
                        <th className="px-3 py-3 font-semibold text-right">Locations</th>
                        <th className="px-3 py-3 font-semibold text-right">In transit</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredProducts.map((p) => {
                        const open = expandedProduct === p.product_id;
                        return (
                          <ProductRows
                            key={p.product_id}
                            p={p}
                            open={open}
                            onToggle={() => setExpandedProduct(open ? null : p.product_id)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* BY LOCATION */}
          {view === 'locations' && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLocations.length === 0 ? (
                <div className="sm:col-span-2 xl:col-span-3">
                  <EmptyStock />
                </div>
              ) : (
                filteredLocations.map((loc) => (
                  <button
                    key={loc.location_key}
                    type="button"
                    onClick={() => {
                      setLocationFilter(loc.location_key === 'unassigned' ? 'none' : loc.location_key);
                      setView('lines');
                    }}
                    className="text-left bg-white border rounded-3xl p-5 hover:border-[#00b4d8] hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{loc.name}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {[loc.code, loc.city, loc.partner_name].filter(Boolean).join(' · ') ||
                            '—'}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${ownerTypeClass(loc.owner_type)}`}
                      >
                        {loc.location_key === 'unassigned'
                          ? 'Unassigned'
                          : ownerTypeLabel(loc.owner_type)}
                      </span>
                    </div>
                    <div className="text-3xl font-black tracking-tighter text-slate-900 mb-1">
                      {fmt(loc.units)}
                    </div>
                    <div className="text-xs text-neutral-500 mb-3">units on hand</div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100">
                        {loc.skus} SKUs
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100">
                        {loc.lines} lines
                      </span>
                      {loc.low_stock > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                          {loc.low_stock} low
                        </span>
                      )}
                      {loc.in_transit_inbound > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-semibold inline-flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {fmt(loc.in_transit_inbound)} inbound
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* ALL LINES */}
          {view === 'lines' && (
            <div className="bg-white border rounded-3xl overflow-hidden">
              <div className="px-5 py-3 border-b font-semibold text-sm flex items-center justify-between">
                <span>
                  Stock lines
                  <span className="text-neutral-400 font-normal ml-2">
                    ({filteredLevels.length})
                  </span>
                </span>
                {locationFilter !== 'all' && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#00b4d8]"
                    onClick={() => setLocationFilter('all')}
                  >
                    Clear location filter
                  </button>
                )}
              </div>
              {filteredLevels.length === 0 ? (
                <EmptyStock />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 border-b text-left text-xs text-neutral-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Product</th>
                        <th className="px-3 py-3 font-semibold">Location</th>
                        <th className="px-3 py-3 font-semibold">Owner</th>
                        <th className="px-3 py-3 font-semibold text-right">On hand</th>
                        <th className="px-3 py-3 font-semibold text-right">Avail</th>
                        <th className="px-3 py-3 font-semibold">Lot / bin</th>
                        <th className="px-3 py-3 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredLevels.map((l) => (
                        <tr
                          key={l.id}
                          className={l.is_low ? 'bg-amber-50/40' : 'hover:bg-neutral-50'}
                        >
                          <td className="px-5 py-3">
                            <div className="font-semibold">
                              {l.product?.name || `Product #${l.product_id}`}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono">
                              {l.product?.sku || '—'}
                              {l.product?.product_type
                                ? ` · ${l.product.product_type.replace(/_/g, ' ')}`
                                : ''}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium">
                              {l.location_name || l.warehouse?.name || 'Unassigned'}
                            </div>
                            {l.warehouse?.city && (
                              <div className="text-[11px] text-neutral-400">{l.warehouse.city}</div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${ownerTypeClass(l.warehouse?.owner_type)}`}
                            >
                              {l.warehouse
                                ? ownerTypeLabel(l.warehouse.owner_type)
                                : 'Unassigned'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-bold">{fmt(l.qty_on_hand)}</span>
                            {l.is_low && (
                              <div className="text-[10px] text-amber-700 font-semibold inline-flex items-center gap-0.5 justify-end w-full">
                                <AlertTriangle className="w-3 h-3" /> Low
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-neutral-600">
                            {fmt(l.qty_available ?? l.qty_on_hand)}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-neutral-500">
                            {[l.lot_number, l.bin_location].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="px-3 py-3 text-xs text-neutral-400 whitespace-nowrap">
                            {l.updated_at ? relTime(l.updated_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Container outlets */}
          {showContainers && filteredContainers.length > 0 && (
            <div className="mt-6 bg-white border rounded-3xl overflow-hidden">
              <div className="px-5 py-3 border-b font-semibold text-sm flex items-center gap-2">
                <Box className="w-4 h-4 text-[#00b4d8]" />
                Container outlets
                <span className="text-neutral-400 font-normal">
                  ({filteredContainers.length} lines · {fmt(summary?.containerUnits || 0)} units)
                </span>
                <button
                  type="button"
                  className="ml-auto text-xs text-neutral-400 hover:text-neutral-600"
                  onClick={() => setShowContainers(false)}
                >
                  Hide
                </button>
              </div>
              <ul className="divide-y max-h-72 overflow-y-auto">
                {filteredContainers.map((c) => (
                  <li
                    key={c.id}
                    className={`px-5 py-3 flex justify-between gap-3 text-sm ${c.is_low ? 'bg-amber-50/40' : ''}`}
                  >
                    <div>
                      <div className="font-semibold">{c.product_name}</div>
                      <div className="text-xs text-neutral-500">
                        {c.location_name}
                        {c.sku ? ` · ${c.sku}` : ''}
                      </div>
                    </div>
                    <div className="font-bold">
                      {fmt(c.qty_on_hand)}{' '}
                      <span className="text-xs font-normal text-neutral-400">{c.uom}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!showContainers && containerLines.length > 0 && (
            <button
              type="button"
              className="mt-4 text-xs font-semibold text-[#00b4d8]"
              onClick={() => setShowContainers(true)}
            >
              Show container outlets ({containerLines.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'neutral' | 'amber' | 'sky' | 'violet';
}) {
  const tones = {
    neutral: 'bg-white border-neutral-200',
    amber: 'bg-amber-50 border-amber-100',
    sky: 'bg-sky-50 border-sky-100',
    violet: 'bg-violet-50 border-violet-100',
  };
  return (
    <div className={`rounded-3xl border p-4 ${tones[tone]}`}>
      <div className="text-[11px] text-neutral-500 mb-0.5">{label}</div>
      <div className="text-2xl font-black tracking-tighter text-slate-900">{value}</div>
      <div className="text-[10px] text-neutral-500 mt-0.5 leading-snug">{sub}</div>
    </div>
  );
}

function ProductRows({
  p,
  open,
  onToggle,
}: {
  p: ByProduct;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`hover:bg-neutral-50 cursor-pointer ${p.is_low ? 'bg-amber-50/40' : ''}`}
        onClick={onToggle}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            )}
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-neutral-500 font-mono">
                {p.sku || '—'}
                {p.category ? ` · ${p.category}` : ''}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-xs capitalize text-neutral-600">
          {(p.product_type || '—').replace(/_/g, ' ')}
        </td>
        <td className="px-3 py-3 text-right">
          <span className="font-bold text-base">{fmt(p.total_on_hand)}</span>
          <span className="text-xs text-neutral-400 ml-1">{p.uom || ''}</span>
        </td>
        <td className="px-3 py-3 text-right text-neutral-600">{p.locations}</td>
        <td className="px-3 py-3 text-right">
          {p.in_transit > 0 ? (
            <span className="text-violet-700 font-semibold">{fmt(p.in_transit)}</span>
          ) : (
            <span className="text-neutral-300">—</span>
          )}
        </td>
        <td className="px-3 py-3">
          {p.is_low ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
              <AlertTriangle className="w-3 h-3" /> Low
            </span>
          ) : (
            <span className="text-xs text-emerald-700 font-medium">OK</span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50/80">
          <td colSpan={6} className="px-5 py-3">
            <div className="text-xs font-semibold text-neutral-500 mb-2">
              Breakdown by location
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {p.by_location.map((loc, i) => (
                <div
                  key={`${loc.warehouse_id}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{loc.location_name}</div>
                    {loc.lot_number && (
                      <div className="text-[10px] font-mono text-neutral-400">
                        lot {loc.lot_number}
                      </div>
                    )}
                  </div>
                  <div className="font-bold tabular-nums">{fmt(loc.qty_on_hand)}</div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EmptyStock() {
  return (
    <div className="p-12 text-center text-neutral-500 text-sm">
      <Package className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
      <p className="mb-2">No stock matches this view.</p>
      <p className="text-xs text-neutral-400 mb-4">
        Receive stock, complete a transfer, or clear filters.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/dashboard/inventory/warehouses" className="btn-secondary !py-2 !px-4 text-sm">
          Locations
        </Link>
        <Link href="/dashboard/inventory/products" className="btn-primary !py-2 !px-4 text-sm">
          Products
        </Link>
      </div>
    </div>
  );
}
