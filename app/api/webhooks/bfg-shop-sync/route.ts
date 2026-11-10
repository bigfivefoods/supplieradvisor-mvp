import { NextRequest, NextResponse } from 'next/server';
import { processSyncRequest } from '@/lib/bfg-shop-sync/process';
import { createSyncPorts } from '@/lib/bfg-shop-sync/supabase-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/bfg-shop-sync
 *
 * bigfivegroup.africa shop -> SupplierAdvisor® sync receiver (contract v1.0).
 * OFF unless BFG_SYNC_ENABLED=true. The path contains "webhook", so the
 * middleware passes it without a user session: the HMAC is the only gate.
 * The signature is verified (verifyBfgSyncSignature, constant time) before
 * the replay window and before the body is parsed.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const res = await processSyncRequest(
    {
      rawBody,
      headers: {
        timestamp: request.headers.get('x-bfg-timestamp'),
        signature: request.headers.get('x-bfg-signature'),
        idempotencyKey: request.headers.get('x-bfg-idempotency-key'),
        event: request.headers.get('x-bfg-event'),
        contentLength: request.headers.get('content-length'),
      },
    },
    { ports: createSyncPorts() }
  );
  return NextResponse.json(res.body, {
    status: res.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
