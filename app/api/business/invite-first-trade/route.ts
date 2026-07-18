import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { bootstrapFirstTrade } from '@/lib/business/first-trade';

/**
 * POST { companyId, customerName?, customerEmail?, amount? }
 * Bootstrap first-trade draft from invite CRM context (name/email prefilled).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const result = await bootstrapFirstTrade({
      companyId,
      actorUserId: gate.userId,
      customerName: body.customerName
        ? String(body.customerName).slice(0, 120)
        : body.name
          ? String(body.name).slice(0, 120)
          : undefined,
      customerEmail: body.customerEmail || body.email || undefined,
      amount: body.amount != null ? Number(body.amount) : undefined,
      currency: body.currency || undefined,
    });

    return NextResponse.json({
      success: Boolean(result.invoiceId || result.customerId),
      ...result,
      nextHref: result.invoiceId
        ? `/dashboard/customers/invoices?id=${result.invoiceId}`
        : '/dashboard',
      moneyHref: '/dashboard/customers/money',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
