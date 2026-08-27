/**
 * HireAdvisor® customer PWA — Search · Hire · You · Track · Nearby
 * with You lifted in the centre of the phone dock.
 * Chrome is the HireAdvisor product — never the listing company (e.g. a gym).
 */

export const HIRE_PWA_APP_NAME = 'HireAdvisor';
export const HIRE_PWA_APP_MARK = 'HireAdvisor®';

export const HIRE_CUSTOMER_PWA_DOCK = [
  'search',
  'hire',
  'you',
  'track',
  'nearby',
] as const;

export type HireCustomerPwaDockId = (typeof HIRE_CUSTOMER_PWA_DOCK)[number];

export type HireCustomerTab =
  | HireCustomerPwaDockId
  | 'calendar'
  | 'requirements';

export type HirePwaCatalogueItem = {
  id: string;
  title?: string | null;
  srm_supplier_id?: number | null;
  supplier_name?: string | null;
  location?: string | null;
  photo_url?: string | null;
  category_short?: string | null;
  category_name?: string | null;
  rate_zar?: number | null;
};

export type HirePwaSupplier = {
  key: string;
  srm_supplier_id: number | null;
  name: string;
  location: string | null;
  item_count: number;
  categories: string[];
  min_rate_zar: number | null;
  photo_url: string | null;
};

export function hireSupplierKey(item: {
  srm_supplier_id?: number | null;
  supplier_name?: string | null;
}): string {
  const sid = Number(item.srm_supplier_id);
  if (Number.isFinite(sid) && sid > 0) return `srm:${sid}`;
  const name = String(item.supplier_name || '')
    .trim()
    .toLowerCase();
  if (name) return `name:${name}`;
  return 'desk';
}

export function groupHireSuppliers(
  items: HirePwaCatalogueItem[],
  deskName = 'Hire desk'
): HirePwaSupplier[] {
  const map = new Map<string, HirePwaSupplier>();
  for (const item of items) {
    const key = hireSupplierKey(item);
    const sid = Number(item.srm_supplier_id);
    const named = String(item.supplier_name || '').trim();
    const name = named || deskName;
    const location = String(item.location || '').trim() || null;
    const category = String(
      item.category_short || item.category_name || ''
    ).trim();
    const rate = Number(item.rate_zar);
    const photo = String(item.photo_url || '').trim() || null;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        srm_supplier_id:
          Number.isFinite(sid) && sid > 0 ? sid : null,
        name,
        location,
        item_count: 1,
        categories: category ? [category] : [],
        min_rate_zar: Number.isFinite(rate) && rate > 0 ? rate : null,
        photo_url: photo,
      });
      continue;
    }
    existing.item_count += 1;
    if (!existing.location && location) existing.location = location;
    if (!existing.photo_url && photo) existing.photo_url = photo;
    if (!existing.name || existing.name === deskName) existing.name = name;
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
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterHireSuppliers(
  suppliers: HirePwaSupplier[],
  query?: string | null,
  area?: string | null
): HirePwaSupplier[] {
  const q = String(query || '').trim().toLowerCase();
  const loc = String(area || '').trim().toLowerCase();
  return suppliers.filter((s) => {
    if (loc && !String(s.location || '').toLowerCase().includes(loc)) {
      return false;
    }
    if (!q) return true;
    const hay = `${s.name} ${s.location || ''} ${s.categories.join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}

export function normalizeHireCustomerTab(
  raw: string | null | undefined
): HireCustomerTab {
  const t = String(raw || '').trim().toLowerCase();
  if (
    t === 'shop' ||
    t === 'browse' ||
    t === 'hire' ||
    t === 'catalogue'
  ) {
    return 'hire';
  }
  if (t === 'coming' || t === 'hires' || t === 'track') return 'track';
  if (t === 'history') return 'track';
  if (t === 'account' || t === 'you' || t === 'profile') return 'you';
  if (t === 'search' || t === 'suppliers') return 'search';
  if (t === 'nearby' || t === 'places') return 'nearby';
  if (t === 'calendar' || t === 'diary') return 'calendar';
  if (t === 'requirements' || t === 'docs' || t === 'kyc') {
    return 'requirements';
  }
  return 'search';
}

export function hireTrackViewFromTab(
  raw: string | null | undefined
): 'coming' | 'history' {
  return String(raw || '').trim().toLowerCase() === 'history'
    ? 'history'
    : 'coming';
}

export function isHireYouTab(tab: string | null | undefined): boolean {
  const t = normalizeHireCustomerTab(tab);
  return t === 'you' || t === 'requirements' || t === 'calendar';
}

/** Common SA hire areas — used for the Search map when a supplier has a place name. */
const ZA_HIRE_AREA_COORDS: Record<string, [number, number]> = {
  sandton: [-26.1076, 28.0567],
  randburg: [-26.0937, 27.9804],
  midrand: [-25.9752, 28.1267],
  centurion: [-25.8603, 28.1894],
  pretoria: [-25.7479, 28.2293],
  johannesburg: [-26.2041, 28.0473],
  'cape town': [-33.9249, 18.4241],
  durban: [-29.8587, 31.0218],
  soweto: [-26.2678, 27.8585],
  roodepoort: [-26.1625, 27.8725],
  kempton: [-26.1, 28.23],
  'kempton park': [-26.1, 28.23],
  benoni: [-26.1885, 28.3208],
  springs: [-26.25, 28.4],
  alberton: [-26.2678, 28.1211],
  fourways: [-26.0177, 28.0106],
  rosebank: [-26.1447, 28.0416],
  bryanston: [-26.0534, 28.0246],
  hatfield: [-25.748, 28.238],
  stellenbosch: [-33.9321, 18.8602],
  paarl: [-33.7274, 18.9756],
  somerset: [-34.074, 18.848],
  'somerset west': [-34.074, 18.848],
  bloemfontein: [-29.0852, 26.1596],
  polokwane: [-23.9045, 29.4689],
  nelspruit: [-25.4753, 30.9694],
  mbombela: [-25.4753, 30.9694],
  port: [-33.9608, 25.6022],
  'port elizabeth': [-33.9608, 25.6022],
  gqeberha: [-33.9608, 25.6022],
  east: [-33.0153, 27.9116],
  'east london': [-33.0153, 27.9116],
  kimberley: [-28.7282, 24.7499],
  rustenburg: [-25.6676, 27.2421],
};

export function coordsForHireArea(
  name: string | null | undefined,
  depot?: { lat?: number | null; lng?: number | null; label?: string | null }
): [number, number] | null {
  const lat = Number(depot?.lat);
  const lng = Number(depot?.lng);
  const depotOk = Number.isFinite(lat) && Number.isFinite(lng);
  const raw = String(name || '').trim().toLowerCase();
  const depotLabel = String(depot?.label || '').trim().toLowerCase();
  if (depotOk && raw && depotLabel && (raw.includes(depotLabel) || depotLabel.includes(raw))) {
    return [lat, lng];
  }
  if (!raw) return depotOk ? [lat, lng] : null;
  if (ZA_HIRE_AREA_COORDS[raw]) return ZA_HIRE_AREA_COORDS[raw];
  for (const [key, pos] of Object.entries(ZA_HIRE_AREA_COORDS)) {
    if (raw.includes(key) || key.includes(raw)) return pos;
  }
  return depotOk ? [lat, lng] : null;
}
