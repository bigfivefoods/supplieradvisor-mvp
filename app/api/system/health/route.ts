import { NextRequest, NextResponse } from 'next/server';

/**
 * Public liveness — no supabase, no platform-console, no advisor skins.
 * Ops probe: GET ?live=1 or cron secret (dynamic-imported).
 */
export const dynamic = 'force-dynamic';

function isCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  return provided === secret;
}

export async function GET(request: NextRequest) {
  const live = request.nextUrl.searchParams.get('live') === '1';
  if (!live && !isCron(request)) {
    return NextResponse.json(
      { ok: true, service: 'health' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const { runHealthOps } = await import('./ops-probe');
  return runHealthOps(request);
}
