import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyRoles } from '@/lib/auth/api-auth';
import { createWalletChallenge } from '@/lib/business/company-wallet-server';

/**
 * POST { companyId, newAddress } — owner-only nonce for a payout wallet change.
 * profile:write is not enough. The owner signs the returned message.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const gate = await requireCompanyRoles(request, companyId, ['owner'], {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const created = await createWalletChallenge({
      companyId,
      userId: gate.userId,
      role: gate.role,
      newAddress: String(body.newAddress || body.wallet_address || ''),
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: created.status });
    }
    return NextResponse.json({
      success: true,
      nonce: created.nonce,
      expiresAt: created.expiresAt,
      message: created.message,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
