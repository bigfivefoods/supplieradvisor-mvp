/**
 * Ops diagnostic: Apple Pay domain association hosting + Paystack registration.
 * GET /api/system/apple-pay-domain-status
 * Optional: ?register=1 to attempt domain registration (requires PAYSTACK_SECRET_KEY).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPaystackSecretKey } from '@/lib/billing/paystack';
import {
  applePaySetupSnapshot,
  registerPaystackApplePayDomains,
} from '@/lib/billing/apple-pay-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = getPaystackSecretKey();
  const wantRegister =
    request.nextUrl.searchParams.get('register') === '1' ||
    request.nextUrl.searchParams.get('register') === 'true';
  const opsSecret =
    process.env.CRON_SECRET ||
    process.env.PLATFORM_OPS_SECRET ||
    process.env.REFERRAL_OPS_SECRET ||
    '';
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  const opsOk = Boolean(opsSecret) && provided === opsSecret;

  const snap = await applePaySetupSnapshot();
  const registerResults = wantRegister
    ? !opsOk
      ? [
          {
            error:
              'register requires Authorization: Bearer <CRON_SECRET> or x-cron-secret',
          },
        ]
      : !secret
        ? [{ error: 'PAYSTACK_SECRET_KEY not configured' }]
        : await registerPaystackApplePayDomains()
    : undefined;
  const afterRegister = wantRegister ? await applePaySetupSnapshot() : snap;

  return NextResponse.json({
    ok: afterRegister.hostingOk,
    ...afterRegister,
    paystack: {
      ...afterRegister.paystack,
      registerAttempted: wantRegister,
      registerResults,
    },
    webhook: {
      canonical: 'https://www.supplieradvisor.com/api/paystack/webhook',
      alias: 'https://www.supplieradvisor.com/api/billing/webhook',
    },
    opsOk,
  });
}
