import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';

/**
 * GET /api/system/verification-queue
 * Ops: companies that paid / ran CIPC but are not verified.
 * Auth: CRON_SECRET / REFERRAL_OPS_SECRET or referral ops membership.
 */
export async function GET(request: NextRequest) {
  try {
    const cron = assertCronSecret(request);
    if (!cron.ok) {
      const ops = await requireReferralOps(request, {
        legacyPrivyUserId:
          request.nextUrl.searchParams.get('privyUserId') || null,
      });
      if (!ops.ok) return ops.response;
    }

    const supabase = getSupabaseServer();
    const limit = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 40))
    );

    // Primary: status pending / failed / mismatch
    let rows: Array<Record<string, unknown>> = [];
    {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, verification_status, registration_number, email, updated_at, metadata, created_at'
        )
        .in('verification_status', ['pending', 'failed', 'mismatch'])
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (!error && data) rows = data as Array<Record<string, unknown>>;
      else if (error && /column|schema/i.test(error.message)) {
        const retry = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name, verification_status, metadata, updated_at')
          .in('verification_status', ['pending', 'failed', 'mismatch'])
          .order('updated_at', { ascending: false })
          .limit(limit);
        rows = (retry.data || []) as Array<Record<string, unknown>>;
      }
    }

    // Enrich from activity (recent paid verifies)
    const { data: acts } = await supabase
      .from('activity_log')
      .select('profile_id, action, summary, metadata, created_at')
      .eq('action', 'business.verification_verifynow')
      .order('created_at', { ascending: false })
      .limit(80);

    const queue = rows.map((p) => {
      const meta =
        p.metadata && typeof p.metadata === 'object'
          ? (p.metadata as Record<string, unknown>)
          : {};
      const v =
        meta.verification && typeof meta.verification === 'object'
          ? (meta.verification as Record<string, unknown>)
          : {};
      const lastAct = (acts || []).find(
        (a) => Number(a.profile_id) === Number(p.id)
      );
      return {
        id: Number(p.id),
        trading_name: p.trading_name,
        legal_name: p.legal_name,
        verification_status: p.verification_status,
        registration_number: p.registration_number ?? null,
        email: p.email ?? null,
        updated_at: p.updated_at,
        paystack_reference:
          v.paystack_reference || v.paystackReference || null,
        cipc_name: v.company_name || null,
        name_match: v.name_match || null,
        last_error: v.error || null,
        checked_at: v.checked_at || null,
        last_activity: lastAct?.summary || null,
        has_payment: Boolean(v.paystack_reference || v.paystackReference),
        recover_hint:
          String(p.verification_status) !== 'verified' &&
          Boolean(v.company_name || v.raw)
            ? 'Re-run CIPC or Apply verified from metadata on Profile'
            : null,
      };
    });

    // Also surface recent successful payments that never got status updated
    const paidNotListed = (acts || [])
      .filter((a) => {
        const m =
          a.metadata && typeof a.metadata === 'object'
            ? (a.metadata as Record<string, unknown>)
            : {};
        return String(m.status || '') !== 'verified';
      })
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      count: queue.length,
      queue,
      recentNonVerifiedActivity: paidNotListed,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
