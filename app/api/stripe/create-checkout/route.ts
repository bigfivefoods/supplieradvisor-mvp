import { NextResponse } from 'next/server';

/**
 * Unused Stripe checkout. Billing is Paystack (including Apple Pay).
 * Left in place so old clients get a clear 410 instead of an unauthenticated
 * Stripe session. Do not add Stripe webhooks.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Stripe checkout is disabled. Company billing uses Paystack (including Apple Pay).',
      code: 'STRIPE_DISABLED',
    },
    { status: 410 }
  );
}

export async function GET() {
  return POST();
}
