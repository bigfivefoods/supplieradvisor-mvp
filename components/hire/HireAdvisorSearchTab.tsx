'use client';

import { Building2, ChevronRight, MapPin, Package, Search } from 'lucide-react';
import { ProductPhoto } from '@/components/inventory/ProductPhoto';
import type { HirePwaSupplier } from '@/lib/hire/hire-customer-pwa';

type KitItem = {
  id: string;
  title: string;
  supplier_name?: string;
  location?: string;
  photo_url?: string | null;
  category_short?: string;
  category_name?: string;
  rate_zar: number;
  rate_unit: string;
};

export function HireAdvisorSearchTab({
  search,
  onSearch,
  areaFilter,
  onArea,
  areaOptions,
  suppliers,
  kit,
  deskName,
  zar,
  onOpenSupplier,
  onOpenItem,
}: {
  search: string;
  onSearch: (q: string) => void;
  areaFilter: string;
  onArea: (area: string) => void;
  areaOptions: string[];
  suppliers: HirePwaSupplier[];
  kit: KitItem[];
  deskName: string;
  zar: (n: number | null | undefined) => string;
  onOpenSupplier: (supplier: HirePwaSupplier) => void;
  onOpenItem: (item: KitItem) => void;
}) {
  const q = search.trim();

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
          HireAdvisor
        </p>
        <h2 className="mt-0.5 text-lg font-black text-slate-900">
          Search suppliers
        </h2>
        <p className="mt-1 text-[12px] text-slate-600">
          Find the owner of the gear, then hire it and track when it is coming.
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-cyan-100 bg-white py-3 pl-10 pr-3 text-sm font-medium shadow-sm"
            placeholder="Supplier, plant, jumping castle, suburb…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            autoComplete="off"
            inputMode="search"
          />
        </div>
      </div>

      {areaOptions.length ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onArea('')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
              !areaFilter
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            Any area
          </button>
          {areaOptions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onArea(areaFilter === a ? '' : a)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                areaFilter === a
                  ? 'bg-cyan-700 text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900">Suppliers</h3>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {suppliers.length} on {deskName}
        </span>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No suppliers match that search. Try another name or area.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {suppliers.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onOpenSupplier(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-cyan-300"
              >
                {s.photo_url ? (
                  <ProductPhoto
                    src={s.photo_url}
                    className="h-14 w-14 shrink-0 rounded-2xl"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-800 text-lg font-black text-white">
                    {s.name.trim().charAt(0).toUpperCase() || 'S'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-900">
                    {s.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {s.location || 'Area TBC'}
                    {' · '}
                    {s.item_count} item{s.item_count === 1 ? '' : 's'}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {s.categories.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-800"
                      >
                        {c}
                      </span>
                    ))}
                    {s.min_rate_zar != null ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        from {zar(s.min_rate_zar)}
                      </span>
                    ) : null}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {q && kit.length > 0 ? (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">
            <Package className="h-4 w-4 text-cyan-700" /> Matching kit
          </h3>
          <ul className="space-y-2">
            {kit.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 text-left shadow-sm"
                >
                  {item.photo_url ? (
                    <ProductPhoto
                      src={item.photo_url}
                      className="h-12 w-12 shrink-0 rounded-xl"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Building2 className="h-4 w-4 text-slate-400" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {[
                        item.supplier_name,
                        item.location,
                        item.category_short || item.category_name,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-black text-cyan-800">
                    {zar(item.rate_zar)}
                    <span className="block text-[10px] font-bold text-slate-400">
                      / {item.rate_unit}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
