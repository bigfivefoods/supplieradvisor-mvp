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
/** Canonical site the Big Five Group collector stores. Aliases are rewritten to this. */
export const INSIGHTS_SITE = 'supplieradvisor.com';
export const INSIGHTS_COLLECT_PATH = '/api/insights/collect';
/** Hardcoded so production does not need a second URL env var. */
export const DEFAULT_INGEST_URL = 'https://bigfivegroup.africa/api/insights/collect';

const VISITOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** 32 hex, or any UUID (8-4-4-4-12). The visitor cookie id is not reused as an event id. */
const EVENT_ID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const EVENT_KINDS = ['pageview', 'engage', 'pdf', 'outbound', 'click', 'vital'] as const;
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
  /**
   * Visitor id the collector reads (32 hex or UUID). Set to the 180-day cookie id so a visitor's
   * events group together; older collectors read only this field.
   */
  id: string;
  /** Same cookie id, explicit. The collector prefers it over `id`. */
  vid?: string;
  /** Random id of this one event (not stored as a visitor). */
  eid?: string;
  /** Core Web Vitals reading (kind "vital"): `l` is lcp / inp / cls. */
  v?: number;
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
};

export type InsightsBatch = {
  v: 1;
  site: typeof INSIGHTS_SITE;
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

const DASHBOARD_GROUPS: Record<string, string> = {
  suppliers: 'purchasing',
  procurement: 'purchasing',
  buyer: 'purchasing',
  customers: 'sales',
  loyalty: 'sales',
  accounting: 'finance',
  finance: 'finance',
  escrow: 'finance',
  settle: 'finance',
  inventory: 'operations',
  operations: 'operations',
  manufacturing: 'operations',
  distribution: 'operations',
  supplychain: 'operations',
  quality: 'operations',
  sheq: 'operations',
  projects: 'operations',
  containers: 'operations',
  people: 'people',
  schools: 'people',
  calendar: 'people',
  connections: 'network',
  network: 'network',
  'network-invites': 'network',
  'invite-business': 'network',
  ecosystem: 'network',
  messages: 'network',
  'select-company': 'account',
  'my-business': 'account',
  settings: 'account',
  platform: 'account',
  governance: 'account',
  guide: 'account',
  intelligence: 'insights',
  sustainability: 'insights',
  health: 'insights',
  'industry-tools': 'insights',
};

/** Signed-in app areas. Their pages are recorded as one grouped route each, never the real URL. */
const APP_TOP: Record<string, string> = {
  sales: '/app/sales',
  me: '/app/account',
  onboarding: '/app/onboarding',
  supplier: '/app/onboarding',
  member: '/app/member',
  staff: '/app/staff',
  coach: '/app/staff',
  checkin: '/app/staff',
};

/** Links that carry an id or token in the second segment. */
const ID_ROUTES = new Set(['c', 'i', 'p', 'r', 't', 'pay', 'hire', 'apparel', 'claim-review']);
const MODULE_ROUTES = new Set(['f', 'clinician', 'pwa']);
const KNOWN_SECOND: Record<string, Set<string>> = {
  join: new Set(['fitgraph', 'member', 'work']),
  embed: new Set(['advisor', 'containers', 'fitgraph', 'hire', 'retail', 'store']),
  nsnp: new Set(['menu', 'transparency']),
  s: new Set(['food', 'peu', 'serve']),
  marketplace: new Set(['advisors']),
};

function idLike(seg: string): boolean {
  if (/^\d+$/.test(seg)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(seg)) return true;
  if (seg.length >= 24 && /^[a-z0-9_-]+$/.test(seg)) return true;
  if (seg.length >= 8 && /\d/.test(seg) && /^[a-z0-9_-]+$/.test(seg) && /[a-z]/.test(seg) && /\d{3,}/.test(seg)) return true;
  return false;
}

export type InsightsRoute = { path: string; app: boolean };

/**
 * The route pattern Website Insights stores for a pathname. Never a query string, an id, a
 * token, a company slug or an email. Signed-in app pages collapse to one group each
 * (for example `/dashboard/suppliers/po/123` → `/app/purchasing`), store pages to
 * `/store/:company`. Returns null for paths that are not recorded (`/api`, `/portal`).
 */
export function insightsRoute(pathname: string | null | undefined): InsightsRoute | null {
  const raw = String(pathname || '').split('?')[0].split('#')[0];
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('@')) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (decoded.includes('@')) return null;
  const segs = decoded.toLowerCase().split('/').filter(Boolean);
  const first = segs[0] || '';
  if (first === 'api' || first === 'portal') return null;
  if (!first) return { path: '/', app: false };

  if (first === 'dashboard') {
    const second = segs[1] || '';
    if (!second) return { path: '/app/home', app: true };
    const group = DASHBOARD_GROUPS[second] || (second.endsWith('graph') ? 'industry' : 'other');
    return { path: `/app/${group}`, app: true };
  }
  if (APP_TOP[first]) return { path: APP_TOP[first], app: true };
  if (first === 'store') return { path: segs[1] ? '/store/:company' : '/store', app: false };
  if (ID_ROUTES.has(first)) return { path: segs[1] ? `/${first}/:id` : `/${first}`, app: false };
  if (MODULE_ROUTES.has(first)) return { path: segs[1] ? `/${first}/:module` : `/${first}`, app: false };
  if (first === 'industries') {
    const slug = segs[1];
    return { path: slug && /^[a-z0-9-]{1,40}$/.test(slug) && !idLike(slug) ? `/industries/${slug}` : slug ? '/industries/:slug' : '/industries', app: false };
  }
  const known = KNOWN_SECOND[first];
  if (known) {
    const second = segs[1];
    if (!second) return { path: `/${first}`, app: false };
    const mid = known.has(second) ? second : first === 'join' ? ':id' : ':page';
    return { path: segs[2] ? `/${first}/${mid}/:id` : `/${first}/${mid}`, app: false };
  }
  const parts = segs.slice(0, 3).map((seg) => (idLike(seg) ? ':id' : seg.replace(/[^a-z0-9._~:-]/g, '').slice(0, 60) || ':id'));
  return { path: `/${parts.join('/')}`.slice(0, 180), app: false };
}

/** Route pattern to record, or null. Kept for callers that only need the path. */
export function publicPath(pathname: string | null | undefined): string | null {
  return insightsRoute(pathname)?.path ?? null;
}

/** True for a grouped signed-in app route (`/app/...`). In-app button text is never recorded. */
export function isAppRoute(path: string | null | undefined): boolean {
  return typeof path === 'string' && (path === '/app' || path.startsWith('/app/'));
}

/** Labels a page may set with `data-insights` (named actions). Anything else becomes generic. */
const ACTION_LABEL = /^cta-[a-z0-9-]{2,40}$/;
const DATA_LABEL = /^[a-z0-9][a-z0-9-]{1,40}$/;

/**
 * Click label to record. Inside the signed-in app only a developer-set `data-insights` label
 * (lower-case slug) is kept, otherwise `app-button`; the visible text is never used there.
 * On public pages a `data-insights` label wins, then the clipped visible text.
 */
export function clickLabelFor(opts: { path: string; dataLabel?: string | null; text?: string | null }): string | undefined {
  const data = String(opts.dataLabel || '').trim().toLowerCase();
  if (data && (ACTION_LABEL.test(data) || DATA_LABEL.test(data))) return data;
  if (isAppRoute(opts.path)) return 'app-button';
  const text = clipLabel(opts.text);
  if (!text) return undefined;
  if (/\bstart\b.{0,20}\bfree trial\b/i.test(text)) return 'cta-start-free-trial';
  return text;
}

/** Coarse place from Vercel's edge headers (country, region code, city, timezone). The IP is never read here. */
export function geoFromHeaders(headers: Headers): Pick<InsightEvent, 'country' | 'region' | 'city' | 'timezone'> {
  const out: Pick<InsightEvent, 'country' | 'region' | 'city' | 'timezone'> = {};
  const country = String(headers.get('x-vercel-ip-country') || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country) && country !== 'XX') out.country = country;
  const region = String(headers.get('x-vercel-ip-country-region') || '').trim();
  if (/^[A-Za-z0-9 -]{1,40}$/.test(region)) out.region = region;
  let city = String(headers.get('x-vercel-ip-city') || '').trim();
  try {
    city = decodeURIComponent(city);
  } catch {
    /* keep raw */
  }
  city = city.replace(/[\u0000-\u001f]/g, '').slice(0, 80);
  if (city.length >= 2 && !city.includes('@') && !looksLikeIp(city)) out.city = city;
  const tz = String(headers.get('x-vercel-ip-timezone') || '').trim();
  if (/^[A-Za-z0-9_+/-]{1,64}$/.test(tz)) out.timezone = tz;
  return out;
}

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora link|preview|lighthouse|pagespeed|headlesschrome|phantomjs|puppeteer|playwright|selenium|wget|curl\/|python-requests|httpclient|axios|node-fetch|go-http|java\/|okhttp|vercel-screenshot|vercel-favicon|uptime|pingdom|monitor|statuscake|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baiduspider|bytespider|gptbot|claudebot|perplexity|ccbot|applebot|bingpreview|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|twitterbot|skypeuripreview/i;

/** Same bot rule as the Big Five Group collector. A missing or very short user agent counts as a bot. */
export function isBotUa(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT_UA.test(ua);
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

export function validEventId(raw: unknown): string | null {
  if (typeof raw !== 'string' || !EVENT_ID.test(raw)) return null;
  return raw.toLowerCase();
}

/** Accept a client event and return only the fields we are willing to forward. */
export function sanitizeClientEvent(input: unknown): InsightEvent | null {
  const row = asRecord(input);
  if (!row) return null;
  const kind = row.k;
  if (typeof kind !== 'string' || !EVENT_KINDS.includes(kind as EventKind)) return null;
  const path = publicPath(typeof row.p === 'string' ? row.p : '');
  if (!path) return null;

  const visitor = typeof row.visitor === 'string' && VISITOR_ID.test(row.visitor) ? row.visitor.toLowerCase() : null;
  const eventId = validEventId(row.eid) || validEventId(row.id) || crypto.randomUUID();
  const event: InsightEvent = {
    k: kind as EventKind,
    p: path,
    // The visitor id goes in `id` too: collectors before the vid fix read only `id`.
    id: visitor || eventId,
    eid: eventId,
  };
  if (visitor) event.vid = visitor;

  if (kind === 'vital') {
    const metric = typeof row.l === 'string' ? row.l.toLowerCase() : '';
    const max = metric === 'cls' ? 10 : 120000;
    if (metric !== 'lcp' && metric !== 'inp' && metric !== 'cls') return null;
    if (typeof row.v !== 'number' || !Number.isFinite(row.v) || row.v < 0 || row.v > max) return null;
    event.l = metric;
    event.v = Math.round(row.v * 1000) / 1000;
    if (typeof row.device === 'string' && DEVICES.includes(row.device as DeviceKind)) event.device = row.device as DeviceKind;
    return event;
  }
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
  let label = clipLabel(typeof row.l === 'string' ? row.l : '');
  // Server-side guard: inside the app only slug labels (data-insights / app-button) pass.
  if (label && kind === 'click' && isAppRoute(path) && !/^[a-z0-9][a-z0-9-]{1,40}$/.test(label)) label = 'app-button';
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
  if (kind === 'engage') {
    const ms = event.ms ?? 0;
    const scroll = event.scroll ?? 0;
    if (ms < 500 && scroll <= 0) return null;
  }
  if (visitor) event.visitor = visitor;
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
  return { v: 1, site: INSIGHTS_SITE, e: events };
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

const EMAIL_KEYS = ['email', 'email_address', 'emailAddress', 'e_mail'];

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function batchHasForbidden(
  batch: InsightsBatch,
  keys: string[],
  valueHit: (value: string) => boolean
): boolean {
  const stack: unknown[] = [batch];
  const seen = new Set<unknown>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') {
      if (typeof cur === 'string' && valueHit(cur)) return true;
      continue;
    }
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    for (const [key, value] of Object.entries(cur as Record<string, unknown>)) {
      if (keys.includes(key)) return true;
      stack.push(value);
    }
  }
  return false;
}

/** Last-line check before anything is forwarded or logged. */
export function batchContainsRawIp(batch: InsightsBatch): boolean {
  return batchHasForbidden(batch, STORED_IP_KEYS, looksLikeIp);
}

/** Email addresses and form-style email fields never leave this server. */
export function batchContainsEmail(batch: InsightsBatch): boolean {
  return batchHasForbidden(batch, EMAIL_KEYS, looksLikeEmail);
}
