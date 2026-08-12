/**
 * POST /api/schools/migrate-schooladvisor
 * Normalize every school / DBE / NSNP SP company onto SchoolAdvisor®
 * public-sector (government process) packaging.
 *
 * Auth: Bearer CRON_SECRET or platform operator session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { migrateAllSchoolAdvisorPackaging } from '@/lib/schools/schooladvisor-packaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) {
    // Allow platform operators without cron secret when session cookie present
    // (assertCronSecret already failed) — keep cron-only for safety
    return gate.response;
  }

  try {
    const supabase = getSupabaseServer();
    const result = await migrateAllSchoolAdvisorPackaging(supabase);
    return NextResponse.json({
      success: true,
      message:
        'SchoolAdvisor® packaging applied: public_sector sector, public_procurement pack, schools module.',
      ...result,
    });
  } catch (e: unknown) {
    console.error('[migrate-schooladvisor]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Migration failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
