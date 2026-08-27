/**
 * Company picker / Switch company order.
 *
 * Craig’s founder set: Connect → Group → Foods → VUKA, then the rest A–Z.
 * Safe for client and API.
 */

export const COMPANY_SWITCHER_PIN_IDS: number[] = [
  5743, // Big Five Connect (platform control plane)
  5748, // Big Five Group (holding)
  102, // Big Five Foods
  110, // VUKA Fitness
];

export type CompanySwitcherSortItem = {
  id?: string | number | null;
  trading_name?: string | null;
  legal_name?: string | null;
  entity_kind?: string | null;
  business_type?: string | null;
  org_type?: string | null;
};

function namesOf(c: CompanySwitcherSortItem): string[] {
  return [c.trading_name, c.legal_name]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
}

function isPlatformLike(c: CompanySwitcherSortItem): boolean {
  if (String(c.entity_kind || '').toLowerCase() === 'platform') return true;
  if (String(c.org_type || '').toLowerCase() === 'platform') return true;
  if (String(c.business_type || '').toLowerCase() === 'platform') return true;
  return false;
}

function isConnectName(name: string): boolean {
  return /big\s*five\s*(group\s+)?connect/i.test(name) || /^supplier\s*advisor$/i.test(name);
}

function isGroupName(name: string): boolean {
  return /^big\s*five\s*group/i.test(name) && !/connect/i.test(name);
}

function isFoodsName(name: string): boolean {
  return /^big\s*five\s*foods(\s*\(pty\).*)?$/i.test(name);
}

function isVukaName(name: string): boolean {
  return /^vuka(\s+fitness)?$/i.test(name) || /^vuka\s*fitness/i.test(name);
}

/** 0 = Connect, 1 = Group, 2 = Foods, 3 = VUKA, 100+ = unpinned */
export function companySwitcherPinRank(c: CompanySwitcherSortItem): number {
  const id = Number(c.id);
  if (Number.isFinite(id) && id > 0) {
    const idx = COMPANY_SWITCHER_PIN_IDS.indexOf(id);
    if (idx >= 0) return idx;
  }
  const names = namesOf(c);
  if (isPlatformLike(c) || names.some(isConnectName)) return 0;
  if (names.some(isGroupName)) return 1;
  if (names.some(isFoodsName)) return 2;
  if (names.some(isVukaName)) return 3;
  return 100;
}

export function sortCompaniesForSwitcher<T extends CompanySwitcherSortItem>(
  companies: T[]
): T[] {
  return [...companies].sort((a, b) => {
    const ra = companySwitcherPinRank(a);
    const rb = companySwitcherPinRank(b);
    if (ra !== rb) return ra - rb;
    const an = String(a.trading_name || a.legal_name || '').toLowerCase();
    const bn = String(b.trading_name || b.legal_name || '').toLowerCase();
    return an.localeCompare(bn);
  });
}
