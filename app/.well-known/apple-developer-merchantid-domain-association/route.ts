import { NextResponse } from 'next/server';
import { APPLE_PAY_DOMAIN_ASSOCIATION_BODY } from '@/lib/billing/apple-pay-domain-association';

/**
 * Apple Pay domain verification for Paystack.
 * Served at: /.well-known/apple-developer-merchantid-domain-association
 *
 * Content ships in-repo (Paystack domain association payload). Env can override:
 *   APPLE_PAY_DOMAIN_ASSOCIATION or PAYSTACK_APPLE_PAY_DOMAIN_FILE
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      // Apple / Paystack expect plain text domain association body
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
