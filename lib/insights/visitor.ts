/**
 * First-party Website Insights events for www.supplieradvisor.com.
 *
 * The investor portal already accepts the Big Five Group collector envelope
 * (`POST /api/insights/collect`, body `{ v: 1, e: [...] }`). Short keys match
 * that recorder: k, p, a, r, u.{s,m,c}, ms, l. Metadata fields are added beside
 * them so the same report can show organisation, place, device, campaign and
 * visit history. The raw IP address is never a field on this object.
 */

export const VISITOR_COOKIE = 'sa_vid';
/** About 180 days. The id is random; it is not derived from an IP address. */
export const VISITOR_MAX_AGE_SEC = 180 * 24 * 60 * 60;
export const INSIGHTS_SITE = 'supplieradvisor-mvp';
export const INSIGHTS_COLLECT_PATH = '/api/insights/collect';
export const DEFAULT_INGEST_URL = 'https://bigfivegroup.africa/api/insights/collect';

const VISITOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EVENT_KINDS = ['pageview', 'engage', 'pdf', 'outbound', 'click'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const SCREEN_BANDS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type ScreenBand = (typeof SCREEN_BANDS)[number];

export const DEVICES = ['mobile', 'tablet', 'desktop'] as const;
export type DeviceKind = (typeof DEVICES)[number];

export type Utm = {
  s?: string;
  m?: string;
  c?: string;
  content?: string;
  term?: string;
};

export type InsightEvent = {
  k: EventKind;
  p: string;
  a?: boolean;
  r?: string;
  u?: Utm;
  ms?: number;
  l?: string;
  device?: DeviceKind;
  browser?: string;
  os?: string;
  screen?: ScreenBand;
  lang?: string;
  landing?: string;
  exit?: string;
  pages?: string[];
  scroll?: number;
  visitor?: string;
  /** True when this is the first visit stored on the cookie. */
  new?: boolean;
  /** How many visits this cookie has counted, including this one. */
  frequency?: number;
  /** Days since the previous visit. Null on the first visit. */
  recency_days?: number | null;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  organisation?: string;
  industry?: string;
  size?: string;
  network?: string;
  /** Session email, attached only by the server from a verified session. */
  email?: string;
};

export type InsightsBatch = {
  v: 1;
  site: typeof INSIGHTS_SITE;
  project: typeof INSIGHTS_SITE;
  e: InsightEvent[];
};

const BROWSERS = new Set(['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Other']);
const SYSTEMS = new Set(['Windows', 'macOS', 'iOS', 'Android', 'Linux', 'ChromeOS', 'Other']);
const NETWORK_TYPES = new Set(['isp', 'business', 'education', 'hosting', 'government']);

export function insightsOptOut(signals: {
  doNotTrack?: string | null;
  msDoNotTrack?: string | null;
  globalPrivacyControl?: boolean | null;
  secGpc?: string | null;
}): boolean {
  const dnt = String(signals.doNotTrack ?? signals.msDoNotTrack ?? '')
    .trim()
    .toLowerCase();
  if (dnt === '1' || dnt === 'yes') return true;
  if (signals.globalPrivacyControl === true) return true;
  if (String(signals.secGpc ?? '').trim() === '1') return true;
  return false;
}

export function screenBand(width: number): ScreenBand | undefined {
  if (!Number.isFinite(width) || width <= 0) return undefined;
  if (width < 480) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1440) return 'lg';
  return 'xl';
}

/** Scroll depth as a quarter of the page, never a pixel coordinate. */
export function scrollBand(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  return Math.round(pct / 25) * 25;
}

export function deviceFromUa(ua: string, width?: number): DeviceKind {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s) || (/android/.test(s) && !/mobile/.test(s))) {
    return 'tablet';
  }
  if (/mobi|iphone|ipod|android/.test(s)) return 'mobile';
  if (width && width > 0 && width < 768) return 'mobile';
  return 'desktop';
}

export function browserFromUa(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

export function osFromUa(ua: string): string {
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/mac os|macintosh/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}

export function languageTag(raw: string | null | undefined): string | undefined {
  const s = String(raw || '').trim();
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,2}$/.test(s)) return undefined;
  return s.slice(0, 16);
}

/** Drop query strings and token-like path segments. Returns null for paths we do not record. */
export function publicPath(pathname: string | null | undefined): string | null {
  const raw = String(pathname || '').split('?')[0].split('#')[0];
  if (!raw.startsWith('/')) return null;
  const lower = raw.toLowerCase();
  if (
    lower === '/api' ||
    lower.startsWith('/api/') ||
    lower === '/portal' ||
    lower.startsWith('/portal/')
  ) {
    return null;
  }
  if (raw.includes('@')) return null;
  const parts = raw.split('/').map((seg) => {
    if (seg.length >= 24 && /^[A-Za-z0-9_-]+$/.test(seg)) return ':token';
    return seg.slice(0, 80);
  });
  const path = parts.join('/') || '/';
  return path.slice(0, 180);
}

export function cleanReferrer(raw: string | null | undefined): string | undefined {
  try {
    const url = new URL(String(raw || ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return undefined;
  }
}

function clipUtm(value: string | null): string | undefined {
  const s = String(value || '').trim().slice(0, 80);
  if (!s || s.includes('@') || looksLikeIp(s)) return undefined;
  return s;
}

export function readUtm(search: string | null | undefined): Utm | undefined {
  const q = new URLSearchParams(
    String(search || '').startsWith('?') ? String(search).slice(1) : String(search || '')
  );
  const u: Utm = {
    s: clipUtm(q.get('utm_source')),
    m: clipUtm(q.get('utm_medium')),
    c: clipUtm(q.get('utm_campaign')),
    content: clipUtm(q.get('utm_content')),
    term: clipUtm(q.get('utm_term')),
  };
  if (!u.s && !u.m && !u.c && !u.content && !u.term) return undefined;
  return u;
}

export function clipLabel(raw: string | null | undefined): string | undefined {
  const s = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!s || s.includes('@') || looksLikeIp(s)) return undefined;
  return s;
}

export function outboundHost(href: string, pageOrigin: string): string | undefined {
  try {
    const url = new URL(href, pageOrigin);
    if (url.origin === pageOrigin) return undefined;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.hostname.replace(/^www\./i, '').toLowerCase().slice(0, 80);
  } catch {
    return undefined;
  }
}

export function pdfName(href: string, pageOrigin: string): string | undefined {
  try {
    const url = new URL(href, pageOrigin);
    if (!url.pathname.toLowerCase().endsWith('.pdf')) return undefined;
    const name = decodeURIComponent(url.pathname.split('/').pop() || '').toLowerCase();
    if (!name || name.includes('@') || name.includes('/') || name.includes('\\')) return undefined;
    return name.slice(0, 80);
  } catch {
    return undefined;
  }
}

export function looksLikeIp(value: string): boolean {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return true;
  if (value.includes(':') && /^[0-9a-f:]+$/i.test(value)) return true;
  return false;
}

export function isPublicIp(ip: string): boolean {
  if (!looksLikeIp(ip) || ip === '::1') return false;
  const lower = ip.toLowerCase();
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return false;
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4) return true;
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  return true;
}

export type VisitorCookie = { id: string; visits: number; lastSeen: number };

export function parseVisitorCookie(raw: string | null | undefined): VisitorCookie | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const [id, visits, last] = decoded.split('.');
  if (!id || !VISITOR_ID.test(id)) return null;
  const n = Number(visits);
  const seen = Number(last);
  if (!Number.isInteger(n) || n < 1 || n > 100000) return null;
  if (!Number.isInteger(seen) || seen < 0) return null;
  return { id: id.toLowerCase(), visits: n, lastSeen: seen };
}

export function visitorCookieValue(state: VisitorCookie): string {
  return `${state.id}.${state.visits}.${state.lastSeen}`;
}

/**
 * Advance the 180-day cookie at the start of a visit.
 * The id is the random value the caller supplies when there is no cookie yet.
 */
export function nextVisitorState(
  prev: VisitorCookie | null,
  nowSec: number,
  freshId: string
): { cookie: VisitorCookie; isNew: boolean; recencyDays: number | null } {
  const now = Math.floor(nowSec);
  if (!prev) {
    const id = VISITOR_ID.test(freshId) ? freshId.toLowerCase() : freshId;
    return {
      cookie: { id, visits: 1, lastSeen: now },
      isNew: true,
      recencyDays: null,
    };
  }
  const recencyDays = Math.max(0, Math.floor((now - prev.lastSeen) / 86400));
  return {
    cookie: { id: prev.id, visits: prev.visits + 1, lastSeen: now },
    isNew: false,
    recencyDays,
  };
}

function clipPlace(value: unknown, max = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.replace(/\s+/g, ' ').trim().slice(0, max);
  if (!s || s.includes('@') || looksLikeIp(s)) return undefined;
  return s;
}

function sizeLabel(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    if (value < 11) return '1-10';
    if (value < 51) return '11-50';
    if (value < 201) return '51-200';
    if (value < 1001) return '201-1000';
    return '1000+';
  }
  return clipPlace(value, 40);
}

function networkLabel(value: unknown): string | undefined {
  const s = clipPlace(value, 32)?.toLowerCase();
  if (!s || !NETWORK_TYPES.has(s)) return undefined;
  return s;
}

/**
 * Keep only coarse network facts from an IPinfo-style payload.
 * The address, coordinates and postal code are dropped on purpose.
 */
export function factsFromIpinfo(payload: unknown): Pick<
  InsightEvent,
  'country' | 'region' | 'city' | 'timezone' | 'organisation' | 'industry' | 'size' | 'network'
> {
  if (!payload || typeof payload !== 'object') return {};
  const row = payload as Record<string, unknown>;
  const company =
    row.company && typeof row.company === 'object'
      ? (row.company as Record<string, unknown>)
      : null;
  const asn =
    (row.asn && typeof row.asn === 'object' ? row.asn : null) ||
    (row.as && typeof row.as === 'object' ? row.as : null);
  const asnRow = asn as Record<string, unknown> | null;
  const orgField = clipPlace(row.org, 120);
  const orgFromAsn = orgField?.replace(/^AS\d+\s+/i, '');
  const facts = {
    country: /^[A-Za-z]{2}$/.test(String(row.country || ''))
      ? String(row.country).toUpperCase()
      : undefined,
    region: clipPlace(row.region),
    city: clipPlace(row.city),
    timezone: clipPlace(row.timezone, 64),
    organisation: clipPlace(company?.name, 120) || orgFromAsn,
    industry: clipPlace(company?.industry ?? row.industry),
    size: sizeLabel(company?.size ?? company?.employees ?? row.size),
    network: networkLabel(asnRow?.type ?? company?.type ?? row.network),
  };
  return Object.fromEntries(
    Object.entries(facts).filter(([, v]) => v != null && v !== '')
  ) as Pick<
    InsightEvent,
    'country' | 'region' | 'city' | 'timezone' | 'organisation' | 'industry' | 'size' | 'network'
  >;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Accept a client event and return only the fields we are willing to forward. */
export function sanitizeClientEvent(input: unknown): InsightEvent | null {
  const row = asRecord(input);
  if (!row) return null;
  const kind = row.k;
  if (typeof kind !== 'string' || !EVENT_KINDS.includes(kind as EventKind)) return null;
  const path = publicPath(typeof row.p === 'string' ? row.p : '');
  if (!path) return null;

  const event: InsightEvent = { k: kind as EventKind, p: path };
  if (typeof row.a === 'boolean') event.a = row.a;

  const referrer = cleanReferrer(typeof row.r === 'string' ? row.r : '');
  if (referrer) event.r = referrer;

  const utm = asRecord(row.u);
  if (utm) {
    const u: Utm = {
      s: clipUtm(typeof utm.s === 'string' ? utm.s : null),
      m: clipUtm(typeof utm.m === 'string' ? utm.m : null),
      c: clipUtm(typeof utm.c === 'string' ? utm.c : null),
      content: clipUtm(typeof utm.content === 'string' ? utm.content : null),
      term: clipUtm(typeof utm.term === 'string' ? utm.term : null),
    };
    if (u.s || u.m || u.c || u.content || u.term) event.u = u;
  }

  if (typeof row.ms === 'number' && Number.isFinite(row.ms)) {
    event.ms = Math.max(0, Math.min(36e5, Math.round(row.ms)));
  }
  const label = clipLabel(typeof row.l === 'string' ? row.l : '');
  if (label) event.l = label;
  if ((kind === 'pdf' || kind === 'outbound' || kind === 'click') && !event.l) return null;

  if (typeof row.device === 'string' && DEVICES.includes(row.device as DeviceKind)) {
    event.device = row.device as DeviceKind;
  }
  if (typeof row.browser === 'string' && BROWSERS.has(row.browser)) event.browser = row.browser;
  if (typeof row.os === 'string' && SYSTEMS.has(row.os)) event.os = row.os;
  if (typeof row.screen === 'string' && SCREEN_BANDS.includes(row.screen as ScreenBand)) {
    event.screen = row.screen as ScreenBand;
  }
  const lang = languageTag(typeof row.lang === 'string' ? row.lang : '');
  if (lang) event.lang = lang;

  const landing = publicPath(typeof row.landing === 'string' ? row.landing : '');
  if (landing) event.landing = landing;
  const exit = publicPath(typeof row.exit === 'string' ? row.exit : '');
  if (exit) event.exit = exit;
  if (Array.isArray(row.pages)) {
    const pages = row.pages
      .map((p) => (typeof p === 'string' ? publicPath(p) : null))
      .filter((p): p is string => Boolean(p))
      .slice(0, 8);
    if (pages.length) event.pages = pages;
  }
  if (typeof row.scroll === 'number' && Number.isFinite(row.scroll)) {
    event.scroll = scrollBand(Math.min(100, Math.max(0, row.scroll)) / 100);
  }
  if (typeof row.visitor === 'string' && VISITOR_ID.test(row.visitor)) {
    event.visitor = row.visitor.toLowerCase();
  }
  if (typeof row.new === 'boolean') event.new = row.new;
  if (typeof row.frequency === 'number' && Number.isInteger(row.frequency)) {
    if (row.frequency >= 1 && row.frequency <= 100000) event.frequency = row.frequency;
  }
  if (row.recency_days === null) event.recency_days = null;
  else if (typeof row.recency_days === 'number' && Number.isInteger(row.recency_days)) {
    if (row.recency_days >= 0 && row.recency_days <= 3650) event.recency_days = row.recency_days;
  }
  return event;
}

export function sanitizeBatch(input: unknown): InsightsBatch | null {
  const row = asRecord(input);
  if (!row || row.v !== 1 || !Array.isArray(row.e)) return null;
  const events = row.e
    .slice(0, 10)
    .map((event) => sanitizeClientEvent(event))
    .filter((event): event is InsightEvent => Boolean(event));
  if (!events.length) return null;
  return { v: 1, site: INSIGHTS_SITE, project: INSIGHTS_SITE, e: events };
}

const STORED_IP_KEYS = [
  'ip',
  'ip_address',
  'ipAddress',
  'client_ip',
  'clientIp',
  'remote_addr',
  'loc',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'postal',
  'postal_code',
  'postalCode',
  'zip',
];

/** Last-line check before anything is forwarded or logged. */
export function batchContainsRawIp(batch: InsightsBatch): boolean {
  const stack: unknown[] = [batch];
  const seen = new Set<unknown>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') {
      if (typeof cur === 'string' && looksLikeIp(cur)) return true;
      continue;
    }
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    for (const [key, value] of Object.entries(cur as Record<string, unknown>)) {
      if (STORED_IP_KEYS.includes(key)) return true;
      stack.push(value);
    }
  }
  return false;
}
