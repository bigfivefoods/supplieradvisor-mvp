import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { runClaimSlaNudge } from '@/lib/customers/claim-sla';

/** GET/POST — nudge sellers on payment claims pending > CLAIM_SLA_HOURS (default 24). */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run(request);
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run(request);
}

async function run(request: NextRequest) {
  try {
    const hours = Number(
      request.nextUrl.searchParams.get('hours') ||
        process.env.CLAIM_SLA_HOURS ||
        24
    );
    const result = await runClaimSlaNudge({ hours });
    return NextResponse.json({
      ok: true,
      hours,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
