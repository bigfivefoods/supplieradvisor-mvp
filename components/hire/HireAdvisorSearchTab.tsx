'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, Map, MapPin, Search } from 'lucide-react';
import { ProductPhoto } from '@/components/inventory/ProductPhoto';
import { coordsForHireArea } from '@/lib/hire/hire-customer-pwa';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

export type HireSearchListItem = {
  id: string;
  title: string;
  description?: string;
  photo_url?: string | null;
  location?: string;
  supplier_name?: string;
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
  items,
  zar,
  onOpenItem,
  depot,
}: {
  search: string;
  onSearch: (q: string) => void;
  areaFilter: string;
  onArea: (area: string) => void;
  areaOptions: string[];
  items: HireSearchListItem[];
  zar: (n: number | null | undefined) => string;
  onOpenItem: (item: HireSearchListItem) => void;
  depot?: {
    lat?: number | null;
    lng?: number | null;
    label?: string | null;
  };
}) {
  const [mapView, setMapView] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const pins = useMemo(() => {
    const out: Array<{
      id: string;
      position: [number, number];
      label: string;
      subtitle?: string;
    }> = [];
    const seen = new Set<string>();
    for (const item of items) {
      const pos = coordsForHireArea(item.location, depot);
      if (!pos) continue;
      const key = `${pos[0]}:${pos[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: item.id,
        position: pos,
        label: item.title,
        subtitle: item.location || undefined,
      });
    }
    if (!out.length) {
      const pos = coordsForHireArea(depot?.label, depot);
      if (pos) {
        out.push({
          id: 'depot',
          position: pos,
          label: depot?.label || 'Hire desk',
        });
      }
    }
    return out;
  }, [depot, items]);

  const mapCenter = pins[0]?.position ||
    coordsForHireArea(null, depot) || [-26.2041, 28.0473];

  const locationLabel = areaFilter.trim() || 'Location';
  const locationOn = Boolean(areaFilter.trim());

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-medium shadow-sm"
          placeholder="Search items to hire…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
          inputMode="search"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => {
            setMapView((v) => !v);
            setLocationOpen(false);
          }}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${
            mapView
              ? 'bg-cyan-700 text-white'
              : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          <Map className="h-3.5 w-3.5" />
          Map view
        </button>
        <button
          type="button"
          onClick={() => {
            onArea('');
            setLocationOpen(false);
          }}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
            !locationOn
              ? 'bg-cyan-700 text-white'
              : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          Any area
        </button>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setLocationOpen((o) => !o)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${
              locationOn
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {locationLabel}
            <ChevronDown className="h-3 w-3" />
          </button>
          {locationOpen ? (
            <ul className="absolute right-0 z-20 mt-1 max-h-56 min-w-[10rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
              {areaOptions.length === 0 ? (
                <li className="px-3 py-2 text-[11px] text-slate-500">
                  No areas listed yet
                </li>
              ) : (
                areaOptions.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      onClick={() => {
                        onArea(a);
                        setLocationOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-[12px] font-bold ${
                        areaFilter === a
                          ? 'bg-cyan-50 text-cyan-800'
                          : 'text-slate-700'
                      }`}
                    >
                      {a}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>

      {mapView ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <LocationMap
            pins={pins}
            center={mapCenter}
            zoom={pins.length > 1 ? 10 : 12}
            height="220px"
            interactive
            className="w-full"
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No hire items match that search. Try another name or area.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenItem(item)}
                className="flex w-full gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-cyan-300"
              >
                {item.photo_url ? (
                  <ProductPhoto
                    src={item.photo_url}
                    className="h-20 w-20 shrink-0 rounded-2xl"
                  />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-800 text-lg font-black text-white">
                    {item.title.trim().charAt(0).toUpperCase() || 'H'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-cyan-700">
                    {item.category_short || item.category_name || 'Hire'}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-black text-slate-900">
                    {item.title}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">
                      {item.description}
                    </span>
                  ) : null}
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                    {item.location ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {item.location}
                      </span>
                    ) : null}
                    <span className="font-black text-cyan-800">
                      {zar(item.rate_zar)} / {item.rate_unit}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
