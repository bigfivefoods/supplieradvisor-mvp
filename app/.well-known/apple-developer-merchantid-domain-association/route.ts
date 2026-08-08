import { NextResponse } from 'next/server';

/**
 * Apple Pay domain verification file for Paystack.
 * Set APPLE_PAY_DOMAIN_ASSOCIATION to the file contents from Paystack Dashboard
 * (Settings → Apple Pay → add domain → download verification file).
 *
 * Served at: /.well-known/apple-developer-merchantid-domain-association
 * Content-Type must be text/plain (application/text family).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const body =
    process.env.APPLE_PAY_DOMAIN_ASSOCIATION ||
    process.env.PAYSTACK_APPLE_PAY_DOMAIN_FILE ||
    '';

  if (!body.trim()) {
    return new NextResponse(
      'Apple Pay domain association not configured. Set APPLE_PAY_DOMAIN_ASSOCIATION env var to the verification file contents from Paystack Dashboard → Settings → Apple Pay.',
      {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return new NextResponse(body.trim(), {
    status: 200,
    headers: {
      // Paystack docs: application/text — text/plain is widely accepted
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
