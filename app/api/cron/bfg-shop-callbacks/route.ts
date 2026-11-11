import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { drainFlowBack } from '@/lib/bfg-shop-sync/flow-back';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET/POST /api/cron/bfg-shop-callbacks
 * Retries the payment notices SupplierAdvisor® owes the shop (contract section 7).
 * Auth: CRON_SECRET (Vercel Cron sends Authorization: Bearer $CRON_SECRET).
 * A no-op while BFG_SYNC_ENABLED is not "true", or when the outbox is empty.
 * Scheduled every 5 minutes in vercel.json, matching the shop's sa-sync cron.
 */
async function run(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  try {
    const out = await drainFlowBack(25);
    return NextResponse.json({ ok: true, ...out });
  } catch {
    return NextResponse.json({ ok: false, error: 'drain failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
