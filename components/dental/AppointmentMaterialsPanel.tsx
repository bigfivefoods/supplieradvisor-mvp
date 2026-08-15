'use client';

/**
 * World-class dental materials / consumables allocation panel.
 * Loads practice inventory catalogue, category chips, stock soft-warnings,
 * service defaults, quantity + lot, billable toggle, and running total.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProductRecord } from '@/lib/inventory/types';
import {
  type DentalMaterialUsage,
  usageFromProduct,
  stockWarning,
  stockWarningLabel,
  stockWarningClass,
  billableTotal,
  filterCatalogue,
  categoriesFromProducts,
  resolveServiceDefaultMaterials,
  productSellPrice,
} from '@/lib/dental/dental-appointment-inventory';
import { getSelectedCompanyId } from '@/lib/containers/company';

type Props = {
  value: DentalMaterialUsage[];
  onChange: (next: DentalMaterialUsage[]) => void;
  serviceName?: string | null;
  serviceCode?: string | null;
  autoDefaults?: boolean;
  className?: string;
  compact?: boolean;
};

export function AppointmentMaterialsPanel({
  value,
  onChange,
  serviceName,
  serviceCode,
  autoDefaults = true,
  className = '',
  compact = false,
}: Props) {
  const companyId = getSelectedCompanyId();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!companyId) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      const res = await fetch(`/api/inventory/products?${params}`);
      const data = await res.json();
      const list = (data.products || []) as ProductRecord[];
      setProducts(
        list.filter(
          (p) =>
            !p.status ||
            String(p.status).toLowerCase() === 'active'
        )
      );
    } catch {
      toast.error('Could not load inventory catalogue');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!autoDefaults || defaultsLoaded || value.length > 0 || !products.length) {
      return;
    }
    if (!serviceName && !serviceCode) return;
    const defaults = resolveServiceDefaultMaterials(
      products,
      serviceName,
      serviceCode
    );
    if (defaults.length) {
      onChange(defaults);
      setDefaultsLoaded(true);
      toast.message('Suggested materials loaded', {
        description: `${defaults.length} item${defaults.length === 1 ? '' : 's'} for this service — adjust quantities as needed`,
      });
    } else {
      setDefaultsLoaded(true);
    }
  }, [
    autoDefaults,
    defaultsLoaded,
    value.length,
    products,
    serviceName,
    serviceCode,
    onChange,
  ]);

  useEffect(() => {
    setDefaultsLoaded(false);
  }, [serviceName, serviceCode]);

  const categories = useMemo(
    () => ['All', ...categoriesFromProducts(products)],
    [products]
  );

  const filtered = useMemo(
    () =>
      filterCatalogue(products, {
        q,
        category: category === 'All' ? null : category,
      }),
    [products, q, category]
  );

  const total = useMemo(() => billableTotal(value), [value]);

  const addProduct = (p: ProductRecord) => {
    const existing = value.find((l) => String(l.product_id) === String(p.id));
    if (existing) {
      onChange(
        value.map((l) =>
          String(l.product_id) === String(p.id)
            ? {
                ...l,
                quantity: (Number(l.quantity) || 0) + 1,
                stock_warning: stockWarning(p, (Number(l.quantity) || 0) + 1),
              }
            : l
        )
      );
      return;
    }
    const line = usageFromProduct(p, 1);
    if (line.stock_warning === 'out') {
      toast.warning(`${p.name} appears out of stock — still recording usage`);
    } else if (line.stock_warning === 'low') {
      toast.message('Low stock', {
        description: `${p.name}: ${Number(p.qty_on_hand ?? 0)} on hand (reorder ${p.reorder_level ?? 0})`,
      });
    }
    onChange([...value, line]);
  };

  const updateLine = (idx: number, patch: Partial<DentalMaterialUsage>) => {
    onChange(
      value.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        const prod = products.find(
          (p) => String(p.id) === String(next.product_id)
        );
        if (prod && patch.quantity != null) {
          next.stock_warning = stockWarning(prod, Number(patch.quantity) || 1);
        }
        return next;
      })
    );
  };

  const removeLine = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const loadDefaults = () => {
    const defaults = resolveServiceDefaultMaterials(
      products,
      serviceName,
      serviceCode
    );
    if (!defaults.length) {
      toast.message('No matching defaults', {
        description: 'Add products under Inventory · Products and categorise them (Restorative, Endodontic, …)',
      });
      return;
    }
    const existingIds = new Set(value.map((l) => String(l.product_id)));
    const toAdd = defaults.filter((d) => !existingIds.has(String(d.product_id)));
    if (!toAdd.length) {
      toast.message('Defaults already on the list');
      return;
    }
    onChange([...value, ...toAdd]);
    toast.success(`Added ${toAdd.length} suggested material${toAdd.length === 1 ? '' : 's'}`);
  };

  return (
    <div
      className={`rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/40 via-white to-white dark:from-sky-950/20 dark:via-slate-950 dark:to-slate-950 ${className}`}
    >
      <div className={`flex items-start justify-between gap-3 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 rounded-xl bg-sky-100 p-2 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Materials & consumables used
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Allocate from your inventory catalogue. Quantities, lots and billable
              lines feed the visit record and optional invoice.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {(serviceName || serviceCode) && products.length > 0 ? (
            <button
              type="button"
              onClick={loadDefaults}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
              title="Load suggested materials for this service"
            >
              <Sparkles className="h-3 w-3" />
              Defaults
            </button>
          ) : null}
          <a
            href="/dashboard/inventory/products"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Catalogue
          </a>
        </div>
      </div>

      <div className={`border-t border-sky-100/80 space-y-2 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-colors ${
                category === c
                  ? 'border-sky-400 bg-sky-100 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, SKU, category…"
            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
      </div>

      <div className={`border-t border-sky-100/80 ${compact ? 'max-h-36' : 'max-h-44'} overflow-y-auto`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
            Loading inventory…
          </div>
        ) : !companyId ? (
          <p className="text-xs text-slate-500 px-4 py-6 text-center">
            Select a company to load the inventory catalogue.
          </p>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-500">
              {products.length === 0
                ? 'No products in inventory yet.'
                : 'No matches for this filter.'}
            </p>
            <a
              href="/dashboard/inventory/products"
              className="mt-2 inline-block text-[11px] font-bold text-sky-700 underline"
            >
              Add products under Inventory → Products
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.slice(0, 40).map((p) => {
              const level = stockWarning(p, 1);
              const price = productSellPrice(p);
              const already = value.some(
                (l) => String(l.product_id) === String(p.id)
              );
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-sky-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {p.name}
                      </span>
                      {level !== 'ok' ? (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] font-bold ${stockWarningClass(level)}`}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {stockWarningLabel(level)}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {(p.category || 'General') +
                        (p.sku ? ` · ${p.sku}` : '') +
                        ` · ${Number(p.qty_on_hand ?? 0)} ${p.uom || 'unit'} on hand` +
                        (price > 0
                          ? ` · R${price.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
                          : '')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold border ${
                      already
                        ? 'border-sky-300 bg-sky-50 text-sky-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                    }`}
                  >
                    <Plus className="h-3 w-3" />
                    {already ? '+1' : 'Add'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {value.length > 0 ? (
        <div className={`border-t border-sky-100/80 ${compact ? 'p-3' : 'p-4'} space-y-2`}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Recorded for this visit ({value.length})
          </p>
          <ul className="space-y-2">
            {value.map((line, idx) => {
              const prod = products.find(
                (p) => String(p.id) === String(line.product_id)
              );
              const level =
                line.stock_warning ||
                (prod ? stockWarning(prod, line.quantity) : 'ok');
              const trackLot = Boolean(prod?.track_lot);
              return (
                <li
                  key={`${line.product_id}-${idx}`}
                  className="rounded-xl border border-slate-150 bg-white p-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {line.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {line.category}
                        {level !== 'ok' ? (
                          <span
                            className={`ml-1.5 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-bold ${stockWarningClass(level)}`}
                          >
                            {stockWarningLabel(level)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="text-[10px] font-medium text-slate-500">
                      Qty
                      <input
                        type="number"
                        min={0.01}
                        step={0.5}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(idx, {
                            quantity: Math.max(0.01, Number(e.target.value) || 1),
                          })
                        }
                        className="mt-0.5 block w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      />
                    </label>
                    {(trackLot || line.lot_number) && (
                      <label className="text-[10px] font-medium text-slate-500">
                        Lot / batch
                        <input
                          type="text"
                          value={line.lot_number || ''}
                          onChange={(e) =>
                            updateLine(idx, { lot_number: e.target.value || null })
                          }
                          placeholder="Optional"
                          className="mt-0.5 block w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono"
                        />
                      </label>
                    )}
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none pb-1">
                      <input
                        type="checkbox"
                        checked={line.billable}
                        onChange={(e) =>
                          updateLine(idx, { billable: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      Billable
                      {line.billable && line.unit_price > 0 ? (
                        <span className="text-slate-400">
                          · R
                          {(
                            (Number(line.quantity) || 0) *
                            (Number(line.unit_price) || 0)
                          ).toLocaleString('en-ZA', {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      ) : null}
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          {total > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-100 px-3 py-2">
              <span className="text-[11px] font-semibold text-sky-900">
                Billable materials total
              </span>
              <span className="text-sm font-black text-sky-900">
                R{total.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-sky-100/80 px-4 py-3 text-[11px] text-slate-500">
          No materials recorded yet. Search and add from your catalogue above —
          or load service defaults when a treatment is selected.
        </p>
      )}
    </div>
  );
}
