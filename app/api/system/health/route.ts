import { NextRequest, NextResponse } from 'next/server';

/**
 * Public liveness on the Edge — no supabase, no Node, no ops probe graph.
 * Full probe: GET /api/system/health/ops (Node) with cron secret or ?live=1.
 */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const live = request.nextUrl.searchParams.get('live') === '1';
  if (live) {
    return NextResponse.redirect(new URL('/api/system/health/ops?live=1', request.url));
  }
  return NextResponse.json(
    { ok: true, service: 'health' },
    { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' } }
  );
}
