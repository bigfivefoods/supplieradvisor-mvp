import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractAccessToken, verifyPrivyAccessToken } from '@/lib/auth/verify-privy';
import { forwardInsights } from '@/lib/insights/forward';
import { lookupNetwork } from '@/lib/insights/ipinfo';
import {
  insightsOptOut,
  isPublicIp,
  sanitizeBatch,
  type InsightEvent,
} from '@/lib/insights/visitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 12_000;

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

async function sessionEmail(request: NextRequest): Promise<string | undefined> {
  try {
    const token = extractAccessToken(request.headers, request.headers.get('cookie'));
    if (!token) return undefined;
    const verified = await verifyPrivyAccessToken(token);
    if (!verified.ok) return undefined;
    const email = verified.user.emails.find((item) => item.includes('@'));
    return email || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Public beacon. Same envelope as bigfivegroup.africa/api/insights/collect.
 * Do Not Track and Global Privacy Control record nothing.
 * Organisation, industry, size, network type and coarse place come from a
 * server-side lookup. The raw IP is not stored, cached, logged, or forwarded.
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

  const [email, network] = await Promise.all([
    sessionEmail(request),
    lookupNetwork(visitorAddress(request)),
  ]);

  const events: InsightEvent[] = batch.e.map((event) => {
    const next: InsightEvent = { ...event, ...network };
    if (email) next.email = email;
    return next;
  });
  const enriched = { ...batch, e: events };

  try {
    await forwardInsights(enriched);
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
