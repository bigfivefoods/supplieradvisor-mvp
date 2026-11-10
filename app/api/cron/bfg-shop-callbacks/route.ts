import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { drainFlowBack } from '@/lib/bfg-shop-sync/flow-back';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET/POST /api/cron/bfg-shop-callbacks
 * Retries the payment notices SupplierAdvisor® owes the shop (contract section 7).
 * Auth: CRON_SECRET. A no-op while BFG_SYNC_ENABLED is not "true".
 * Not scheduled in vercel.json: adding a schedule is a separate approval.
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
