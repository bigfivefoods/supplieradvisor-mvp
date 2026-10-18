import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/api-auth';
import { loadtestAuthEnabled } from '@/lib/loadtest/staging-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Staging load-test session probe. 404 unless every load-test gate holds.
 * The body is the seeded user id and the word staging. No key, no cookie.
 */
export async function GET(request: NextRequest) {
  if (!loadtestAuthEnabled(process.env)) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(
    { userId: auth.userId, stage: 'staging' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
