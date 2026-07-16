import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId=
 * Recent CIPC / bank verification activity from activity_log for this company.
 * Also returns last known VerifyNow remaining credits from profile metadata if present.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: logs } = await supabase
      .from('activity_log')
      .select('id, action, summary, metadata, created_at, actor_user_id')
      .eq('profile_id', companyId)
      .or(
        'action.ilike.%verif%,action.ilike.%bank_verif%,action.eq.business.verification_verifynow,action.eq.business.bank_verification_verifynow'
      )
      .order('created_at', { ascending: false })
      .limit(40);

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'verification_status, is_verified, bank_verification_status, bank_verified_at, metadata'
      )
      .eq('id', companyId)
      .maybeSingle();

    const meta =
      profile?.metadata && typeof profile.metadata === 'object'
        ? (profile.metadata as Record<string, unknown>)
        : {};
    const v =
      meta.verification && typeof meta.verification === 'object'
        ? (meta.verification as Record<string, unknown>)
        : {};
    const bv =
      meta.bank_verification && typeof meta.bank_verification === 'object'
        ? (meta.bank_verification as Record<string, unknown>)
        : {};

    return NextResponse.json({
      success: true,
      events: logs || [],
      profile: {
        verification_status: profile?.verification_status ?? null,
        is_verified: profile?.is_verified ?? null,
        bank_verification_status: profile?.bank_verification_status ?? null,
        bank_verified_at: profile?.bank_verified_at ?? null,
      },
      lastCipcCredits: v.remaining_credits ?? v.remainingCredits ?? null,
      lastBankCredits: bv.remaining_credits ?? bv.remainingCredits ?? null,
      paystackConfigured: Boolean(
        process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
      ),
      verifynowConfigured: Boolean(process.env.VERIFYNOW_API_KEY),
      verifynowMode: process.env.VERIFYNOW_MODE || 'production',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
