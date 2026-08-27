/**
 * HireAdvisor® customer PWA — Search · Hire · You · Track · Nearby
 * with You lifted in the centre of the phone dock.
 */

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
