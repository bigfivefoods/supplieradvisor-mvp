/**
 * Client-side card filters for the CRM book and the SRM network.
 * Reads the rows already loaded. Does not write to the database.
 */

export type CardQuery = {
  q: string;
  status: string;
  region: string;
  industry: string;
  /** Supplier OTIFEF band: all | high | mid | low | none */
  band: string;
  /** Supplier compliance: all | certified | missing */
  compliance: string;
};

export type CardSort = string;

const BLANK = 'all';

export function emptyCardQuery(): CardQuery {
  return { q: '', status: BLANK, region: BLANK, industry: BLANK, band: BLANK, compliance: BLANK };
}

export function cardQueryFromParams(params: { get(name: string): string | null }): CardQuery {
  const read = (key: keyof CardQuery) => (params.get(key) || '').trim();
  const facet = (key: keyof CardQuery) => read(key) || BLANK;
  return {
    q: read('q'),
    status: facet('status').toLowerCase(),
    region: facet('region'),
    industry: facet('industry'),
    band: facet('band').toLowerCase(),
    compliance: facet('compliance').toLowerCase(),
  };
}

export function cardQueryKey(query: CardQuery): string {
  return [query.q, query.status, query.region, query.industry, query.band, query.compliance].join('\u001f');
}

export function cardQueryActive(query: CardQuery): boolean {
  return Boolean(
    query.q.trim() ||
      query.status !== BLANK ||
      query.region !== BLANK ||
      query.industry !== BLANK ||
      query.band !== BLANK ||
      query.compliance !== BLANK
  );
}

export function writeListParams(
  current: URLSearchParams,
  query: CardQuery,
  sort: string,
  defaultSort = 'name'
): URLSearchParams {
  const next = new URLSearchParams(current);
  const set = (key: string, value: string, blank: string) => {
    const text = value.trim();
    if (!text || text === blank) next.delete(key);
    else next.set(key, text);
  };
  set('q', query.q, '');
  set('status', query.status, BLANK);
  set('region', query.region, BLANK);
  set('industry', query.industry, BLANK);
  set('band', query.band, BLANK);
  set('compliance', query.compliance, BLANK);
  set('sort', sort, defaultSort);
  return next;
}

export function sortFromParams(
  params: { get(name: string): string | null },
  allowed: readonly string[],
  fallback = 'name'
): string {
  const value = (params.get('sort') || '').trim();
  return allowed.includes(value) ? value : fallback;
}

export function titleLabel(value: string): string {
  const text = value.replace(/_/g, ' ').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const CUSTOMER_STATUS_ORDER = ['active', 'prospect', 'on_hold', 'inactive', 'credit_hold'] as const;
export const SUPPLIER_STATUS_ORDER = ['preferred', 'active', 'prospect', 'blocked', 'archived'] as const;

export const SCORE_BANDS = [
  { value: 'all', label: 'All scores' },
  { value: 'high', label: '90+' },
  { value: 'mid', label: '70–89' },
  { value: 'low', label: 'Under 70' },
  { value: 'none', label: 'Unscored' },
] as const;

export const PRIMARY_SCORE_BANDS = ['all', 'high', 'none'] as const;

export function orderedStatuses(values: Array<string | null | undefined>, order: readonly string[]): string[] {
  const present = new Set(
    values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
  );
  const known = order.filter((value) => present.has(value));
  const extra = [...present].filter((value) => !order.includes(value)).sort();
  return [...known, ...extra];
}

export function splitPrimary<T>(items: T[], limit = 4): { primary: T[]; more: T[] } {
  return { primary: items.slice(0, limit), more: items.slice(limit) };
}

export function facetChoices(values: Array<string | null | undefined>, selected: string): string[] {
  const unique = [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
  unique.sort((a, b) => a.localeCompare(b));
  if (selected && selected !== BLANK && !unique.some((value) => value.toLowerCase() === selected.toLowerCase())) {
    unique.unshift(selected);
  }
  return unique;
}

type Place = {
  province?: string | null;
  region?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
};

export function placeLabel(row: Place): string {
  return String(row.province || row.region || row.city || row.country || '').trim();
}

export function industryLabel(row: Place): string {
  return String(row.industry || '').trim();
}

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function customerMatches(
  row: Place & {
    trading_name?: string | null;
    legal_name?: string | null;
    email?: string | null;
    contact_name?: string | null;
    status?: string | null;
  },
  query: CardQuery
): boolean {
  if (query.status !== BLANK && !same(row.status || 'active', query.status)) return false;
  if (query.region !== BLANK && !same(placeLabel(row), query.region)) return false;
  if (query.industry !== BLANK && !same(industryLabel(row), query.industry)) return false;
  const needle = query.q.trim().toLowerCase();
  if (!needle) return true;
  const blob = [row.trading_name, row.legal_name, row.email, row.contact_name, row.city, row.country, row.industry]
    .filter(Boolean)
    .join(' ');
  return includes(blob, needle);
}

export function scoreBand(pct: number | null | undefined): 'high' | 'mid' | 'low' | 'none' {
  if (pct == null || Number.isNaN(Number(pct))) return 'none';
  const n = Number(pct);
  if (n >= 90) return 'high';
  if (n >= 70) return 'mid';
  return 'low';
}

export function supplierCertified(row: {
  verified?: boolean | null;
  certifications?: string[] | null;
  bee_level?: string | null;
}): boolean {
  return Boolean(row.verified) || Boolean(row.certifications?.length) || Boolean(String(row.bee_level || '').trim());
}

export function supplierMatches(
  row: Place & {
    trading_name?: string | null;
    legal_name?: string | null;
    email?: string | null;
    contact_name?: string | null;
    status?: string | null;
    otifef_pct?: number | null;
    verified?: boolean | null;
    certifications?: string[] | null;
    bee_level?: string | null;
  },
  query: CardQuery
): boolean {
  if (query.status !== BLANK && !same(row.status || 'prospect', query.status)) return false;
  if (query.region !== BLANK && !same(placeLabel(row), query.region)) return false;
  if (query.industry !== BLANK && !same(industryLabel(row), query.industry)) return false;
  if (query.band !== BLANK && scoreBand(row.otifef_pct) !== query.band) return false;
  if (query.compliance === 'certified' && !supplierCertified(row)) return false;
  if (query.compliance === 'missing' && supplierCertified(row)) return false;
  const needle = query.q.trim().toLowerCase();
  if (!needle) return true;
  const blob = [
    row.trading_name,
    row.legal_name,
    row.email,
    row.contact_name,
    row.city,
    row.country,
    row.industry,
    row.bee_level,
    ...(row.certifications || []),
  ]
    .filter(Boolean)
    .join(' ');
  return includes(blob, needle);
}

export function resultCount(shown: number, total: number, noun: string): string {
  const plural = total === 1 ? noun : `${noun}s`;
  if (shown === total) return `${total} ${plural}`;
  return `${shown} of ${total}`;
}
