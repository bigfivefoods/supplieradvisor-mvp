'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Building2,
  ChevronDown,
  Map,
  MapPin,
  Navigation,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { ProductPhoto } from '@/components/inventory/ProductPhoto';
import { coordsForHireArea } from '@/lib/hire/hire-customer-pwa';
import {
  companyPinsFromItems,
  filterHireSearchItems,
  sortHireItemsByDistance,
  toggleListValue,
  type HireSearchItem,
  type LatLng,
} from '@/lib/hire/hire-search';
import { HireSearchMap } from '@/components/hire/HireSearchMap';

export type HireSearchListItem = HireSearchItem & {
  rate_zar: number;
  rate_unit: string;
};

type CategoryOpt = { id: string; name: string; short: string; item_count: number };
type CompanyOpt = { key: string; name: string; location: string | null; item_count: number };

function FilterMenu({
  label,
  icon,
  active,
  open,
  onOpen,
  children,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${
          active
            ? 'bg-cyan-700 text-white'
            : 'border border-slate-200 bg-white text-slate-600'
        }`}
      >
        {icon}
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 max-h-64 min-w-[14rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold ${
        on ? 'bg-cyan-50 text-cyan-800' : 'text-slate-700'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          on ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-slate-300'
        }`}
      >
        {on ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}

export function HireAdvisorSearchTab({
  search,
  onSearch,
  items,
  zar,
  onOpenItem,
  areaOptions,
  categories = [],
  companies = [],
  depot,
}: {
  search: string;
  onSearch: (q: string) => void;
  items: HireSearchListItem[];
  zar: (n: number | null | undefined) => string;
  onOpenItem: (item: HireSearchListItem) => void;
  areaOptions: string[];
  categories?: CategoryOpt[];
  companies?: CompanyOpt[];
  depot?: {
    lat?: number | null;
    lng?: number | null;
    label?: string | null;
  };
}) {
  const [mapView, setMapView] = useState(false);
  const [menu, setMenu] = useState<'area' | 'type' | 'company' | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [companyKeys, setCompanyKeys] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'on' | 'denied'>('idle');

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoStatus('on');
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    );
  }, []);

  const filtered = useMemo(() => {
    const next = filterHireSearchItems(items, {
      query: search,
      areas,
      types,
      companies: companyKeys,
    });
    return sortHireItemsByDistance(next, userLocation, depot);
  }, [items, search, areas, types, companyKeys, userLocation, depot]);

  const pins = useMemo(
    () => companyPinsFromItems(filtered, depot),
    [filtered, depot]
  );

  const mapCenter: [number, number] = useMemo(() => {
    if (userLocation && areas.length === 0) {
      return [userLocation.lat, userLocation.lng];
    }
    if (areas[0]) {
      const pos = coordsForHireArea(areas[0], depot);
      if (pos) return pos;
    }
    if (pins[0]) return pins[0].position;
    const depotPos = coordsForHireArea(depot?.label, depot);
    return depotPos || [-26.2041, 28.0473];
  }, [userLocation, areas, pins, depot]);

  const typeLabel =
    types.length === 0
      ? 'Item type'
      : types.length === 1
        ? categories.find((c) => c.id === types[0])?.short || types[0]
        : `${types.length} types`;
  const companyLabel =
    companyKeys.length === 0
      ? 'Company'
      : companyKeys.length === 1
        ? companies.find((c) => c.key === companyKeys[0])?.name || 'Company'
        : `${companyKeys.length} companies`;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-medium shadow-sm"
          placeholder="Search items, companies, areas…"
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
            setMenu(null);
          }}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${
            mapView
              ? 'bg-cyan-700 text-white'
              : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          <Map className="h-3.5 w-3.5" />
          Map
        </button>
        <FilterMenu
          label={areas.length ? `${areas.length} area${areas.length === 1 ? '' : 's'}` : 'Areas'}
          icon={<MapPin className="h-3.5 w-3.5" />}
          active={areas.length > 0}
          open={menu === 'area'}
          onOpen={() => setMenu((m) => (m === 'area' ? null : 'area'))}
        >
          <MenuRow
            on={areas.length === 0}
            onClick={() => {
              setAreas([]);
              setMenu(null);
            }}
          >
            Any area
          </MenuRow>
          {areaOptions.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-500">
              No areas listed yet
            </p>
          ) : (
            areaOptions.map((a) => (
              <MenuRow
                key={a}
                on={areas.includes(a)}
                onClick={() => setAreas((cur) => toggleListValue(cur, a))}
              >
                {a}
              </MenuRow>
            ))
          )}
        </FilterMenu>
        <FilterMenu
          label={typeLabel}
          icon={<Tag className="h-3.5 w-3.5" />}
          active={types.length > 0}
          open={menu === 'type'}
          onOpen={() => setMenu((m) => (m === 'type' ? null : 'type'))}
        >
          <MenuRow on={types.length === 0} onClick={() => setTypes([])}>
            All types
          </MenuRow>
          {categories.map((c) => (
            <MenuRow
              key={c.id}
              on={types.includes(c.id)}
              onClick={() => setTypes((cur) => toggleListValue(cur, c.id))}
            >
              {c.short || c.name}
              <span className="ml-auto text-[10px] text-slate-400">
                {c.item_count}
              </span>
            </MenuRow>
          ))}
        </FilterMenu>
        <FilterMenu
          label={companyLabel}
          icon={<Building2 className="h-3.5 w-3.5" />}
          active={companyKeys.length > 0}
          open={menu === 'company'}
          onOpen={() => setMenu((m) => (m === 'company' ? null : 'company'))}
        >
          <MenuRow on={companyKeys.length === 0} onClick={() => setCompanyKeys([])}>
            All companies
          </MenuRow>
          {companies.map((c) => (
            <MenuRow
              key={c.key}
              on={companyKeys.includes(c.key)}
              onClick={() =>
                setCompanyKeys((cur) => toggleListValue(cur, c.key))
              }
            >
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="text-[10px] text-slate-400">{c.item_count}</span>
            </MenuRow>
          ))}
        </FilterMenu>
      </div>

      {areas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAreas((cur) => cur.filter((x) => x !== a))}
              className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-900"
            >
              <MapPin className="h-3 w-3" />
              {a}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}

      {geoStatus === 'on' && userLocation ? (
        <p className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
          <Navigation className="h-3 w-3 text-cyan-700" />
          Sorted nearest to you
          {areas.length === 0 ? ' · showing companies around your location' : ''}
        </p>
      ) : geoStatus === 'denied' ? (
        <p className="text-[11px] text-slate-400">
          Location off — pick areas or use the map.
        </p>
      ) : null}

      {mapView ? (
        <HireSearchMap
          pins={pins}
          center={mapCenter}
          zoom={userLocation && areas.length === 0 ? 12 : 11}
          userLocation={userLocation}
          activeKey={companyKeys.length === 1 ? companyKeys[0] : null}
          onPinClick={(key) => {
            setCompanyKeys((cur) =>
              cur.length === 1 && cur[0] === key ? [] : [key]
            );
            setMenu(null);
          }}
          height="340px"
        />
      ) : null}

      <p className="text-[11px] font-bold text-slate-500">
        {filtered.length} item{filtered.length === 1 ? '' : 's'}
        {pins.length
          ? ` · ${pins.length} compan${pins.length === 1 ? 'y' : 'ies'} on the map`
          : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nothing matches. Clear a filter or try another area, type or company.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenItem(item as HireSearchListItem)}
                className="flex w-full gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-cyan-300"
              >
                {item.photo_url ? (
                  <ProductPhoto
                    src={item.photo_url}
                    className="h-20 w-20 shrink-0 rounded-2xl"
                  />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-800 text-lg font-black text-white">
                    {String(item.title || 'H')
                      .trim()
                      .charAt(0)
                      .toUpperCase() || 'H'}
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
                    {item.supplier_name ? (
                      <span className="font-bold text-slate-700">
                        {item.supplier_name}
                      </span>
                    ) : null}
                    {item.location ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {item.location}
                      </span>
                    ) : null}
                    <span className="font-black text-cyan-800">
                      {zar(item.rate_zar)} / {item.rate_unit || 'day'}
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
