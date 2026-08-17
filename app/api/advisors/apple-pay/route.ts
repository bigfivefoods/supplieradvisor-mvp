/**
 * Advisor Apple Pay setup — platform domain status + optional Paystack register.
 * GET  ?companyId=
 * POST { companyId, action: 'register' }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  isAdvisorPayoutReady,
  readAdvisorPayout,
} from '@/lib/billing/advisor-payout';
import {
  applePaySetupSnapshot,
  registerPaystackApplePayDomains,
} from '@/lib/billing/apple-pay-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const supabase = getSupabaseServer();
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, metadata')
      .eq('id', companyId)
      .maybeSingle();
    if (!prof) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const meta =
      prof.metadata && typeof prof.metadata === 'object'
        ? (prof.metadata as Record<string, unknown>)
        : {};
    const snap = await applePaySetupSnapshot();
    return NextResponse.json({
      success: true,
      payout_ready: isAdvisorPayoutReady(readAdvisorPayout(meta)),
      ...snap,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'register');
    if (action !== 'register') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    const registerResults = await registerPaystackApplePayDomains();
    const snap = await applePaySetupSnapshot();
    return NextResponse.json({
      success: true,
      registerResults,
      ...snap,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
