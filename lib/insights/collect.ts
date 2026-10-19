import { forwardInsights } from './forward';
import { lookupNetwork, type NetworkFacts } from './ipinfo';
import { checkRateLimit } from '../rate-limit';
import {
  geoFromHeaders,
  insightsOptOut,
  isBotUa,
  isPublicIp,
  sanitizeBatch,
  withVitalDevice,
  type InsightEvent,
  type InsightsBatch,
} from './visitor';

const MAX_BODY = 12_000;
/** Per visitor and per address, per instance: 120 batches in 10 minutes (same budget as the collector). */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Schedules the collector write. The handler must not await the task:
 * the 204 is returned first, and the scheduler keeps the invocation alive.
 */
export type InsightsDefer = (task: () => Promise<void>) => void;

export type CollectDeps = {
  defer?: InsightsDefer;
  fetchImpl?: typeof fetch;
  lookup?: (ip: string | null | undefined) => Promise<NetworkFacts>;
};

function noContent() {
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Read the visitor address for a lookup and then drop it.
 * Nothing in this function returns the address to the caller of POST.
 */
function visitorAddress(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim() || headers.get('x-real-ip')?.trim() || '';
  if (!first || !isPublicIp(first)) return null;
  return first;
}

function cleanFacts(facts: Partial<InsightEvent>): Partial<InsightEvent> {
  return Object.fromEntries(
    Object.entries(facts).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

/**
 * IPinfo (optional) and the Cape Town collector. Runs only after the 204.
 * The address is the lookup key and is never written onto the batch.
 */
export async function recordInsightsBatch(
  batch: InsightsBatch,
  input: {
    address: string | null;
    geo: Pick<InsightEvent, 'country' | 'region' | 'city' | 'timezone'>;
    userAgent: string;
    fetchImpl?: typeof fetch;
    lookup?: (ip: string | null | undefined) => Promise<NetworkFacts>;
  }
): Promise<void> {
  const lookup = input.lookup ?? lookupNetwork;
  const fetchImpl = input.fetchImpl ?? fetch;
  let network: NetworkFacts = {};
  try {
    // Page-speed readings are not enriched, so a vitals-only batch needs no lookup.
    if (batch.e.some((event) => event.k !== 'vital')) network = await lookup(input.address);
  } catch {
    network = {};
  }
  const geo = input.geo;
  const place = geo.country
    ? geo
    : {
        country: network.country,
        region: network.region,
        city: network.city,
        timezone: network.timezone,
        ...geo,
      };
  const org: Partial<InsightEvent> = {
    organisation: network.organisation,
    industry: network.industry,
    size: network.size,
    network: network.network,
  };
  const events: InsightEvent[] = withVitalDevice(batch.e, input.userAgent).map((event) =>
    event.k === 'vital' ? event : ({ ...event, ...cleanFacts(place), ...cleanFacts(org) } as InsightEvent)
  );
  try {
    await forwardInsights({ ...batch, e: events }, fetchImpl, input.userAgent);
  } catch {
    // Drop the batch rather than log a payload or an address.
  }
}

/**
 * Public beacon. Same envelope as bigfivegroup.africa/api/insights/collect.
 * Do Not Track and Global Privacy Control record nothing.
 * Bots (user agent) are dropped, and each visitor and address is rate limited
 * before any outside call is scheduled. The raw IP, email, GPS and form
 * contents are not stored, cached, logged, or forwarded.
 */
export async function collectInsights(request: Request, deps: CollectDeps = {}): Promise<Response> {
  if (
    insightsOptOut({
      doNotTrack: request.headers.get('dnt'),
      secGpc: request.headers.get('sec-gpc'),
    })
  ) {
    return noContent();
  }
  const ua = request.headers.get('user-agent') || '';
  if (isBotUa(ua)) return noContent();

  let text = '';
  try {
    text = await request.text();
  } catch {
    return noContent();
  }
  if (!text || text.length > MAX_BODY) return noContent();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return noContent();
  }
  const batch = sanitizeBatch(parsed);
  if (!batch) return noContent();

  const address = visitorAddress(request.headers);
  const visitorKey = batch.e.find((event) => event.vid)?.vid || null;
  for (const key of [visitorKey ? `insights:vid:${visitorKey}` : '', address ? `insights:ip:${address}` : '']) {
    if (key && !checkRateLimit({ key, limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS }).ok) return noContent();
  }

  const geo = geoFromHeaders(request.headers);
  const task = () =>
    recordInsightsBatch(batch, {
      address,
      geo,
      userAgent: ua,
      fetchImpl: deps.fetchImpl,
      lookup: deps.lookup,
    });
  const defer = deps.defer ?? ((run) => {
    void run().catch(() => undefined);
  });
  try {
    defer(task);
  } catch {
    void task().catch(() => undefined);
  }
  return noContent();
}
