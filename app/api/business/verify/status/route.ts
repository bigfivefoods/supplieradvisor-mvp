import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { buildVerificationSla } from '@/lib/business/verification-sla';

/**
 * GET ?companyId= — Customer-visible paid CIPC SLA status.
 * Auth: company member.
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

    const supabase = getSupabaseServer();
    let profile: Record<string, unknown> | null = null;
    for (const sel of [
      'id, trading_name, legal_name, registration_number, verification_status, verification_payment_ref, verification_paid_at, verified_at, metadata, updated_at',
      'id, trading_name, legal_name, registration_number, verification_status, verification_payment_ref, verified_at, metadata, updated_at',
      'id, trading_name, legal_name, registration_number, verification_status, metadata, updated_at',
    ]) {
      const { data, error } = await supabase
        .from('profiles')
        .select(sel)
        .eq('id', companyId)
        .maybeSingle();
      if (!error && data && typeof data === 'object') {
        profile = data as unknown as Record<string, unknown>;
        break;
      }
    }
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Prefer column verification_paid_at if present
    const meta =
      profile.metadata && typeof profile.metadata === 'object'
        ? (profile.metadata as Record<string, unknown>)
        : {};
    const v =
      meta.verification && typeof meta.verification === 'object'
        ? { ...(meta.verification as Record<string, unknown>) }
        : {};
    if (profile.verification_paid_at && !v.paid_at) {
      v.paid_at = profile.verification_paid_at;
      profile = {
        ...profile,
        metadata: { ...meta, verification: v },
      };
    }

    const sla = buildVerificationSla(profile);

    // Recent CIPC-related activity for timeline
    let timeline: Array<{
      at: string;
      action: string;
      summary: string | null;
    }> = [];
    try {
      const { data: logs } = await supabase
        .from('activity_log')
        .select('action, summary, created_at')
        .eq('profile_id', companyId)
        .in('action', [
          'billing.paystack_cipc_webhook',
          'business.verification_verifynow',
          'business.verification_rerun',
          'billing.paystack_dead_letter',
        ])
        .order('created_at', { ascending: false })
        .limit(8);
      timeline = (logs || []).map((r) => ({
        at: String(r.created_at),
        action: String(r.action),
        summary: r.summary ? String(r.summary) : null,
      }));
    } catch {
      timeline = [];
    }

    return NextResponse.json({
      success: true,
      companyId,
      tradingName: profile.trading_name || profile.legal_name || null,
      sla,
      timeline,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
