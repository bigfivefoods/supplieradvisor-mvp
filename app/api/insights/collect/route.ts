import { after, NextResponse, type NextRequest } from 'next/server';
import { withRequestTiming } from '@/lib/observability/request-timing-server';
import { collectInsights, type InsightsDefer } from '@/lib/insights/collect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Keep the Cape Town collector write alive after the 204.
 * The callback's promise is returned so the platform does not freeze the
 * invocation before the batch is sent. If there is no request scope, the
 * write still starts and the beacon does not fail.
 */
export function deferInsightsRecord(task: () => Promise<void>, schedule: InsightsDefer = (fn) => after(fn)): void {
  try {
    schedule(() => task().catch(() => undefined));
  } catch {
    void task().catch(() => undefined);
  }
}

/**
 * Public beacon. Same envelope as bigfivegroup.africa/api/insights/collect.
 * Do Not Track and Global Privacy Control record nothing.
 * Bots (user agent) are dropped, and each visitor and address is rate limited
 * before the response. Coarse place comes from Vercel's edge headers;
 * organisation, industry, size and network type from an optional server-side
 * IPinfo lookup. The collector is in Cape Town, so that lookup and the
 * forward run after the 204. The raw IP, email, GPS and form contents are
 * not stored, cached, logged, or forwarded.
 */
export async function POST(request: NextRequest) {
  return withRequestTiming('/api/insights/collect', request, () =>
    collectInsights(request, { defer: deferInsightsRecord })
  );
}

export function GET() {
  return new NextResponse('Method not allowed', {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  });
}
