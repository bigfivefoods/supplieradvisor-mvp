/**
 * HireAdvisor search: multi-area, item type, company, distance.
 */
import {
  coordsForHireArea,
  hireSupplierKey,
  type HirePwaCatalogueItem,
} from '@/lib/hire/hire-customer-pwa';

export type HireSearchItem = HirePwaCatalogueItem & {
  id: string;
  title: string;
  description?: string;
  category_id?: string;
  rate_unit?: string;
};

export type HireSearchCompany = {
  key: string;
  name: string;
  location: string | null;
  item_count: number;
  min_rate_zar: number | null;
  photo_url: string | null;
  categories: string[];
};

export type LatLng = { lat: number; lng: number };

export type HireCompanyPin = {
  key: string;
  name: string;
  position: [number, number];
  location: string | null;
  item_count: number;
  min_rate_zar: number | null;
  categories: string[];
};

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function itemHaystack(item: HireSearchItem): string {
  return [
    item.title,
    item.description,
    item.category_name,
    item.category_short,
    item.supplier_name,
    item.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function areaHit(location: string | null | undefined, area: string): boolean {
  const loc = String(location || '').toLowerCase();
  const a = area.trim().toLowerCase();
  if (!a) return true;
  if (!loc) return false;
  return loc.includes(a) || a.includes(loc);
}

export function filterHireSearchItems(
  items: HireSearchItem[],
  opts: {
    query?: string | null;
    areas?: string[];
    types?: string[];
    companies?: string[];
  }
): HireSearchItem[] {
  const q = String(opts.query || '').trim().toLowerCase();
  const areas = (opts.areas || []).map((a) => a.trim()).filter(Boolean);
  const types = (opts.types || []).map((t) => t.trim()).filter(Boolean);
  const companies = (opts.companies || []).map((c) => c.trim()).filter(Boolean);

  return items.filter((item) => {
    if (areas.length && !areas.some((a) => areaHit(item.location, a))) {
      return false;
    }
    if (types.length) {
      const id = String(item.category_id || '');
      const short = String(item.category_short || '').toLowerCase();
      const name = String(item.category_name || '').toLowerCase();
      const typeHit = types.some((t) => {
        const x = t.toLowerCase();
        return id === t || short === x || name === x || name.includes(x);
      });
      if (!typeHit) return false;
    }
    if (companies.length) {
      const key = hireSupplierKey(item);
      const supplier = String(item.supplier_name || '').toLowerCase();
      const companyHit = companies.some((c) => {
        const x = c.toLowerCase();
        return key === c || supplier === x || supplier.includes(x);
      });
      if (!companyHit) return false;
    }
    if (q && !itemHaystack(item).includes(q)) return false;
    return true;
  });
}

export function sortHireItemsByDistance(
  items: HireSearchItem[],
  origin: LatLng | null,
  depot?: { lat?: number | null; lng?: number | null; label?: string | null }
): HireSearchItem[] {
  if (!origin) return items;
  return [...items].sort((a, b) => {
    const pa = coordsForHireArea(a.location, depot);
    const pb = coordsForHireArea(b.location, depot);
    const da = pa ? haversineKm(origin, { lat: pa[0], lng: pa[1] }) : 1e9;
    const db = pb ? haversineKm(origin, { lat: pb[0], lng: pb[1] }) : 1e9;
    return da - db;
  });
}

export function companyPinsFromItems(
  items: HireSearchItem[],
  depot?: { lat?: number | null; lng?: number | null; label?: string | null }
): HireCompanyPin[] {
  const map = new Map<string, HireCompanyPin>();
  for (const item of items) {
    const key = hireSupplierKey(item);
    const pos = coordsForHireArea(item.location, depot);
    if (!pos) continue;
    const rate = Number(item.rate_zar);
    const category = String(
      item.category_short || item.category_name || ''
    ).trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: String(item.supplier_name || '').trim() || 'Hire desk',
        position: pos,
        location: item.location || null,
        item_count: 1,
        min_rate_zar: Number.isFinite(rate) && rate > 0 ? rate : null,
        categories: category ? [category] : [],
      });
      continue;
    }
    existing.item_count += 1;
    if (category && !existing.categories.includes(category)) {
      existing.categories.push(category);
    }
    if (
      Number.isFinite(rate) &&
      rate > 0 &&
      (existing.min_rate_zar == null || rate < existing.min_rate_zar)
    ) {
      existing.min_rate_zar = rate;
    }
  }

  const used = new Map<string, number>();
  const pins: HireCompanyPin[] = [];
  for (const pin of map.values()) {
    const k = `${pin.position[0].toFixed(5)},${pin.position[1].toFixed(5)}`;
    const n = used.get(k) || 0;
    used.set(k, n + 1);
    const jitter = n * 0.0018;
    pins.push({
      key: pin.key,
      name: pin.name,
      position: [pin.position[0] + jitter, pin.position[1] + jitter],
      location: pin.location,
      item_count: pin.item_count,
      min_rate_zar: pin.min_rate_zar,
      categories: pin.categories,
    });
  }
  return pins.sort((a, b) => a.name.localeCompare(b.name));
}

export function nearestHireAreas(
  origin: LatLng,
  areas: string[],
  depot?: { lat?: number | null; lng?: number | null; label?: string | null },
  limit = 3
): string[] {
  return areas
    .map((name) => {
      const pos = coordsForHireArea(name, depot);
      if (!pos) return null;
      return {
        name,
        km: haversineKm(origin, { lat: pos[0], lng: pos[1] }),
      };
    })
    .filter((x): x is { name: string; km: number } => Boolean(x))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((x) => x.name);
}

export function toggleListValue(list: string[], value: string): string[] {
  const v = value.trim();
  if (!v) return list;
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
