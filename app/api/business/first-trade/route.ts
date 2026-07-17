import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  loadFirstTradePlan,
  bootstrapFirstTrade,
} from '@/lib/business/first-trade';

/**
 * GET  ?companyId= — 30-min first-trade plan + progress
 * POST { companyId, action: 'bootstrap', ... } — one-click customer + draft invoice
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const plan = await loadFirstTradePlan(companyId);
    return NextResponse.json({ success: true, plan });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

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

    const action = String(body.action || 'bootstrap').toLowerCase();
    if (action === 'status' || action === 'plan') {
      const plan = await loadFirstTradePlan(companyId);
      return NextResponse.json({ success: true, plan });
    }

    if (action !== 'bootstrap') {
      return NextResponse.json(
        { error: 'Unknown action', hint: 'bootstrap | plan' },
        { status: 400 }
      );
    }

    const result = await bootstrapFirstTrade({
      companyId,
      actorUserId: gate.userId || 'user',
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      amount: body.amount != null ? Number(body.amount) : undefined,
      currency: body.currency,
    });

    const plan = await loadFirstTradePlan(companyId);
    return NextResponse.json({
      success: true,
      action: 'bootstrap',
      ...result,
      plan,
      openHref: result.invoiceId
        ? `/dashboard/customers/invoices?id=${result.invoiceId}`
        : '/dashboard/customers/invoices',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
