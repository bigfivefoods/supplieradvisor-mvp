import { NextResponse } from 'next/server';
import { APPLE_PAY_DOMAIN_ASSOCIATION_BODY } from '@/lib/billing/apple-pay-domain-association';

/**
 * Apple Pay domain verification for Paystack.
 * @see https://paystack.com/docs/payments/apple-pay/
 *
 * Served at: /.well-known/apple-developer-merchantid-domain-association
 *
 * Paystack requires Content-Type: application/text (not text/plain) —
 * a wrong type can cause customer payments to fail.
 *
 * Content ships in-repo. Override without redeploy:
 *   APPLE_PAY_DOMAIN_ASSOCIATION or PAYSTACK_APPLE_PAY_DOMAIN_FILE
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASSOCIATION_CONTENT_TYPE = 'application/text';

export async function GET() {
  const fromEnv =
    process.env.APPLE_PAY_DOMAIN_ASSOCIATION ||
    process.env.PAYSTACK_APPLE_PAY_DOMAIN_FILE ||
    '';
  const body = (fromEnv.trim() || APPLE_PAY_DOMAIN_ASSOCIATION_BODY).trim();

  if (!body) {
    return new NextResponse(
      'Apple Pay domain association not configured.',
      {
        status: 404,
        headers: {
          'Content-Type': ASSOCIATION_CONTENT_TYPE,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': ASSOCIATION_CONTENT_TYPE,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
