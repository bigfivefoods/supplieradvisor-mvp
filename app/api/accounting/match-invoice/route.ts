import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { matchBankToInvoice } from '@/lib/accounting/allocate';

/**
 * POST { companyId, bankTxnId, invoiceId }
 * One-click bank → invoice match (accounting invoices or CRM customer_invoices).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    const bankTxnId = body.bankTxnId;
    const invoiceId = Number(body.invoiceId);
    if (
      !Number.isFinite(companyId) ||
      bankTxnId == null ||
      !Number.isFinite(invoiceId)
    ) {
      return NextResponse.json(
        { error: 'companyId, bankTxnId, invoiceId required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyPermission(
      request,
      companyId,
      'accounting',
      'write',
      { legacyPrivyUserId: legacyPrivyFrom(request, body) }
    );
    // Soft: also allow company members without accounting write for CRM path
    if (!gate.ok) {
      const soft = await import('@/lib/auth/api-auth').then((m) =>
        m.requireCompanyAccess(request, companyId, {
          legacyPrivyUserId: legacyPrivyFrom(request, body),
        })
      );
      if (!soft.ok) return soft.response;
      const result = await matchBankToInvoice({
        profileId: companyId,
        bankTxnId,
        invoiceId,
        privyUserId: soft.userId,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await matchBankToInvoice({
      profileId: companyId,
      bankTxnId,
      invoiceId,
      privyUserId: gate.userId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
