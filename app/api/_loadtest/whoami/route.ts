import { NextResponse } from 'next/server';
import { loadtestWhoami } from '@/lib/loadtest/whoami';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Public on purpose. Returns 404 unless LOADTEST_ENDPOINTS=1.
 * The 200 body is only the public project ref and the word staging.
 */
export function GET() {
  const result = loadtestWhoami({
    LOADTEST_ENDPOINTS: process.env.LOADTEST_ENDPOINTS,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
