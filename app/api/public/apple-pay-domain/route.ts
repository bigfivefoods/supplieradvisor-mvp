import { NextResponse } from 'next/server';
import { APPLE_PAY_DOMAIN_ASSOCIATION_BODY } from '@/lib/billing/apple-pay-domain-association';

/**
 * Canonical Apple Pay / Paystack domain association body.
 * Rewritten from:
 *   /.well-known/apple-developer-merchantid-domain-association
 *   /.well-known/apple-developer-merchantid-domain-association/
 *
 * Paystack + Apple require:
 * - HTTP 200 (no redirect)
 * - Content-Type: application/text
 * - Exact verification file body
 *
 * @see https://paystack.com/docs/payments/apple-pay/
 */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function associationResponse() {
  // Do not .trim() — body must match Paystack download exactly
  const body = APPLE_PAY_DOMAIN_ASSOCIATION_BODY;
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/text',
      'Cache-Control': 'public, max-age=300, must-revalidate',
      // Avoid content negotiation / charset surprises
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET() {
  return associationResponse();
}

export async function HEAD() {
  return associationResponse();
}
