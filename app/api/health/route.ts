import { NextRequest, NextResponse } from 'next/server';

/**
 * Public liveness on the Edge — exact GET /api/health only.
 * Programme APIs stay at /api/health/agency and /api/health/programme-role.
 * Full probe: GET /api/system/health/ops (Node) with cron secret or ?live=1.
 *
 * `commit` is the first 7 characters of VERCEL_GIT_COMMIT_SHA (null off Vercel).
 * The repo is public, so the short SHA is not a secret. No database call.
 */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export function deployedCommit(sha: string | undefined | null = process.env.VERCEL_GIT_COMMIT_SHA): string | null {
  const trimmed = (sha ?? '').trim();
  if (trimmed.length < 7) return null;
  return trimmed.slice(0, 7);
}

export async function GET(request: NextRequest) {
  const live = request.nextUrl.searchParams.get('live') === '1';
  if (live) {
    return NextResponse.redirect(
      new URL('/api/system/health/ops?live=1', request.url)
    );
  }
  return NextResponse.json(
    { ok: true, service: 'health', commit: deployedCommit() },
    {
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
      },
    }
  );
}
