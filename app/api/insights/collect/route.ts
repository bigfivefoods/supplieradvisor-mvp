import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { forwardInsights } from '@/lib/insights/forward';
import { lookupNetwork } from '@/lib/insights/ipinfo';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  geoFromHeaders,
  insightsOptOut,
  isBotUa,
  isPublicIp,
  sanitizeBatch,
  type InsightEvent,
} from '@/lib/insights/visitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 12_000;
/** Per visitor and per address, per instance: 120 batches in 10 minutes (same budget as the collector). */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function noContent() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Read the visitor address for a lookup and then drop it.
 * Nothing in this function returns the address to the caller of POST.
 */
function visitorAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || '';
  if (!first || !isPublicIp(first)) return null;
  return first;
}

/**
 * Public beacon. Same envelope as bigfivegroup.africa/api/insights/collect.
 * Do Not Track and Global Privacy Control record nothing.
 * Bots (user agent) are dropped, and each visitor and address is rate limited.
 * Coarse place comes from Vercel's edge headers; organisation, industry, size and
 * network type from an optional server-side IPinfo lookup. The raw IP, email, GPS and form contents are not stored,
 * cached, logged, or forwarded.
 */
export async function POST(request: NextRequest) {
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

  const address = visitorAddress(request);
  const visitorKey = batch.e.find((event) => event.vid)?.vid || null;
  for (const key of [visitorKey ? `insights:vid:${visitorKey}` : '', address ? `insights:ip:${address}` : '']) {
    if (key && !checkRateLimit({ key, limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS }).ok) return noContent();
  }

  // Place from Vercel's edge headers; IPinfo (optional) adds the organisation, and fills the
  // place only when the edge headers are missing. The address itself is never forwarded.
  const geo = geoFromHeaders(request.headers);
  let network: Partial<InsightEvent> = {};
  try {
    // Page-speed readings are not enriched, so a vitals-only batch needs no lookup.
    if (batch.e.some((event) => event.k !== 'vital')) network = await lookupNetwork(address);
  } catch {
    network = {};
  }
  const place = geo.country ? geo : { country: network.country, region: network.region, city: network.city, timezone: network.timezone, ...geo };
  const org: Partial<InsightEvent> = {
    organisation: network.organisation,
    industry: network.industry,
    size: network.size,
    network: network.network,
  };
  const clean = (o: Partial<InsightEvent>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

  const events: InsightEvent[] = batch.e.map((event) =>
    event.k === 'vital' ? event : ({ ...event, ...clean(place), ...clean(org) } as InsightEvent)
  );
  try {
    await forwardInsights({ ...batch, e: events }, fetch, ua);
  } catch {
    // Drop the batch rather than log a payload or an address.
  }
  return noContent();
}

export function GET() {
  return new NextResponse('Method not allowed', {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  });
}
