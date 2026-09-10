'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ExternalLink,
  Loader2,
  Search,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  InventoryHeader,
} from '@/components/inventory/InventoryShell';
import { RelationshipPage } from '@/components/relationship/RelationshipChrome';
import { ProductPhoto } from '@/components/inventory/ProductPhoto';
import type {
  StorefrontCatalogPick,
  StorefrontPickerItem,
} from '@/lib/storefront/catalog-pick';

export default function InventoryStorefrontPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<StorefrontPickerItem[]>([]);
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [storePath, setStorePath] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/inventory/storefront?companyId=${companyId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const catalog = (data.catalog || {}) as StorefrontCatalogPick;
      const rows: StorefrontPickerItem[] = data.products || [];
      setProducts(rows);
      setStorePath(data.store_path || null);
      const nextMode = catalog.mode === 'selected' ? 'selected' : 'all';
      setMode(nextMode);
      setChecked(keysFromCatalog(rows, catalog));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return products;
    return products.filter((p) => {
      const hay = [p.name, p.sku, p.category, String(p.id)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(n);
    });
  }, [products, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, StorefrontPickerItem[]>();
    for (const p of filtered) {
      const cat = p.category?.trim() || 'General';
      const list = map.get(cat) || [];
      list.push(p);
      map.set(cat, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const selectedCount = useMemo(() => {
    return products.filter((p) => checked.has(p.key)).length;
  }, [products, checked]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectVisible(on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of filtered) {
        if (on) next.add(p.key);
        else next.delete(p.key);
      }
      return next;
    });
  }

  async function save() {
    if (!companyId) return;
    setSaving(true);
    try {
      const product_ids: number[] = [];
      const seed_keys: string[] = [];
      const gym_item_ids: string[] = [];
      for (const p of products) {
        if (!checked.has(p.key)) continue;
        if (p.kind === 'product' && typeof p.id === 'number') {
          product_ids.push(p.id);
        }
        if (p.kind === 'gym') {
          gym_item_ids.push(String(p.id));
        }
        if (p.seed_key) seed_keys.push(p.seed_key);
        if (p.sku) seed_keys.push(p.sku);
      }
      const res = await fetch('/api/inventory/storefront', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          mode,
          product_ids,
          seed_keys,
          gym_item_ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(
        mode === 'selected'
          ? `Storefront updated — ${selectedCount} item${selectedCount === 1 ? '' : 's'} public`
          : 'Storefront will show all sellable products'
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const emptySelected = mode === 'selected' && selectedCount === 0;

  return (
    <RelationshipPage>
      <InventoryHeader
        title="Storefront"
        titleAccent="catalogue"
        description="Choose which inventory items appear on your public store and website embed. Unticked SKUs stay in the catalogue — they just are not for sale on the store."
        action={
          <div className="flex flex-wrap gap-2">
            {storePath ? (
              <Link
                href={storePath}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View store
              </Link>
            ) : null}
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save()}
              className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save storefront
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={mode === 'all'}
              title="All sellable products"
              desc="The public store lists every active, sellable SKU in this catalogue."
              onClick={() => setMode('all')}
            />
            <ModeCard
              active={mode === 'selected'}
              title="Only selected items"
              desc="Tick the products, packs, or gym shop items that should appear. Leave the rest in inventory only."
              onClick={() => setMode('selected')}
            />
          </div>

          {emptySelected ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No items ticked. Saving this will publish an empty store until you
              select products.
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, SKU, or category"
                className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                disabled={mode !== 'selected'}
                onClick={() => selectVisible(true)}
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                Tick visible
              </button>
              <button
                type="button"
                disabled={mode !== 'selected'}
                onClick={() => selectVisible(false)}
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                Clear visible
              </button>
              <span className="self-center text-neutral-500 text-xs">
                {mode === 'selected'
                  ? `${selectedCount} of ${products.length} on the store`
                  : `${products.length} in catalogue`}
              </span>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-200 bg-white p-12 text-center">
              <Store className="mx-auto h-8 w-8 text-[#00b4d8]" />
              <p className="mt-3 font-bold text-slate-800">No catalogue items yet</p>
              <p className="text-sm text-neutral-500 mt-1">
                Add products in Catalog, then come back to choose what the public
                store shows.
              </p>
              <Link
                href="/dashboard/inventory/products"
                className="btn-primary inline-flex mt-5 !py-2 !px-4 text-sm"
              >
                Open catalog
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(([category, rows]) => (
                <section key={category}>
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 mb-3">
                    {category}
                  </h2>
                  <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                    {rows.map((p) => {
                      const on = checked.has(p.key);
                      const disabled = mode !== 'selected';
                      return (
                        <li key={p.key}>
                          <label
                            className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${
                              disabled
                                ? 'cursor-default'
                                : 'cursor-pointer hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                              checked={
                                mode === 'all'
                                  ? p.status === 'active' && p.is_sellable
                                  : on
                              }
                              disabled={disabled}
                              onChange={() => toggle(p.key)}
                            />
                            {p.image_url ? (
                              <ProductPhoto
                                src={p.image_url}
                                alt=""
                                className="h-12 w-12 rounded-lg border border-neutral-100 shrink-0"
                              />
                            ) : (
                              <span className="h-12 w-12 rounded-lg border border-neutral-100 bg-neutral-50 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-slate-800 truncate">
                                {p.name}
                              </span>
                              <span className="block text-xs text-neutral-500 truncate">
                                {[p.sku, p.kind === 'gym' ? 'Gym shop' : null]
                                  .filter(Boolean)
                                  .join(' · ') || 'SKU'}
                                {p.status !== 'active' ? ' · inactive' : ''}
                                {p.is_sellable === false ? ' · not sellable' : ''}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </RelationshipPage>
  );
}

function ModeCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border px-4 py-4 transition ${
        active
          ? 'border-[#00b4d8] bg-[#00b4d8]/5 shadow-sm'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${
            active ? 'border-[#00b4d8] bg-[#00b4d8]' : 'border-neutral-300'
          }`}
        />
        <span>
          <span className="block font-bold text-slate-800">{title}</span>
          <span className="block text-sm text-neutral-500 mt-1">{desc}</span>
        </span>
      </div>
    </button>
  );
}

function keysFromCatalog(
  rows: StorefrontPickerItem[],
  catalog: StorefrontCatalogPick
): Set<string> {
  if (catalog.mode !== 'selected') {
    return new Set(
      rows.filter((p) => p.status === 'active' && p.is_sellable).map((p) => p.key)
    );
  }
  const ids = new Set((catalog.product_ids || []).map(Number));
  const seeds = new Set(
    (catalog.seed_keys || []).map((s) => String(s).toLowerCase())
  );
  const gym = new Set(
    (catalog.gym_item_ids || []).map((s) => String(s).toLowerCase())
  );
  const next = new Set<string>();
  for (const p of rows) {
    if (p.kind === 'product' && typeof p.id === 'number' && ids.has(p.id)) {
      next.add(p.key);
      continue;
    }
    const keys = [String(p.id), p.sku, p.seed_key]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    if (keys.some((k) => seeds.has(k) || gym.has(k))) next.add(p.key);
  }
  return next;
}
