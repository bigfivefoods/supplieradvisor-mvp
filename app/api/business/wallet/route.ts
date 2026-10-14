import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyRoles } from '@/lib/auth/api-auth';
import { changeCompanyWallet } from '@/lib/business/company-wallet-server';

/**
 * POST { companyId, newAddress, nonce, signature }
 * Owner only. Signature is checked with viem verifyMessage against the nonce.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const gate = await requireCompanyRoles(request, companyId, ['owner'], {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const changed = await changeCompanyWallet({
      companyId,
      userId: gate.userId,
      role: gate.role,
      actorName: gate.name,
      newAddress: String(body.newAddress || body.wallet_address || ''),
      nonce: String(body.nonce || ''),
      signature: String(body.signature || ''),
    });
    if (!changed.ok) {
      return NextResponse.json({ error: changed.error }, { status: changed.status });
    }
    return NextResponse.json({
      success: true,
      wallet_address: changed.wallet_address,
      wallet_ready: true,
      emailWarning: changed.emailWarning,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
