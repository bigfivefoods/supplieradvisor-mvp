import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import { runCipcAfterPayment } from '@/lib/business/cipc-after-payment';
import { logActivity } from '@/lib/customers/access';

async function gateOps(request: NextRequest, body?: Record<string, unknown>) {
  const cron = assertCronSecret(request);
  if (cron.ok) return { ok: true as const, userId: 'ops:cron' };
  const ops = await requireReferralOps(request, {
    legacyPrivyUserId:
      legacyPrivyFrom(request, body) ||
      request.nextUrl.searchParams.get('privyUserId') ||
      null,
  });
  if (!ops.ok) return { ok: false as const, response: ops.response };
  return { ok: true as const, userId: ops.userId || 'ops:user' };
}

/**
 * GET /api/system/verification-queue
 * Ops: companies that paid / ran CIPC but are not verified.
 * Auth: CRON_SECRET / REFERRAL_OPS_SECRET or referral ops membership.
 *
 * POST { companyId, action: 'rerun' | 'recover' | 'apply_cipc_name', privyUserId? }
 * One-click ops actions without opening each company profile.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await gateOps(request);
    if (!gate.ok) return gate.response;

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const gate = await gateOps(request, body);
    if (!gate.ok) return gate.response;

    const companyId = Number(body.companyId);
    const action = String(body.action || '').toLowerCase();
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!['rerun', 'recover', 'apply_cipc_name'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be rerun | recover | apply_cipc_name' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    if (action === 'rerun') {
      // Load stored payment ref then run CIPC
      let payRef: string | null = null;
      const { data: p } = await supabase
        .from('profiles')
        .select('id, verification_payment_ref, metadata, verification_status')
        .eq('id', companyId)
        .maybeSingle();
      if (!p) {
        // retry without payment col
        const retry = await supabase
          .from('profiles')
          .select('id, metadata, verification_status')
          .eq('id', companyId)
          .maybeSingle();
        if (!retry.data) {
          return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }
        const meta =
          retry.data.metadata && typeof retry.data.metadata === 'object'
            ? (retry.data.metadata as Record<string, unknown>)
            : {};
        const v =
          meta.verification && typeof meta.verification === 'object'
            ? (meta.verification as Record<string, unknown>)
            : {};
        payRef = String(v.paystack_reference || v.paystackReference || '').trim() || null;
      } else {
        payRef = String(p.verification_payment_ref || '').trim() || null;
        if (!payRef) {
          const meta =
            p.metadata && typeof p.metadata === 'object'
              ? (p.metadata as Record<string, unknown>)
              : {};
          const v =
            meta.verification && typeof meta.verification === 'object'
              ? (meta.verification as Record<string, unknown>)
              : {};
          payRef =
            String(v.paystack_reference || v.paystackReference || '').trim() ||
            null;
        }
      }

      if (!payRef) {
        return NextResponse.json(
          {
            error: 'No stored Paystack reference for this company',
            hint: 'They must complete R69 payment once first.',
          },
          { status: 402 }
        );
      }

      const result = await runCipcAfterPayment({
        companyId,
        paystackReference: payRef,
        actorUserId: gate.userId,
        source: 'ops_queue_rerun',
      });

      return NextResponse.json({
        success: result.ok || result.status !== 'error',
        action: 'rerun',
        companyId,
        result,
      });
    }

    if (action === 'recover') {
      // Delegate to verify route logic via internal apply — call DB promote
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, registration_number, metadata, verification_status')
        .eq('id', companyId)
        .maybeSingle();
      if (!profile) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      const meta =
        profile.metadata && typeof profile.metadata === 'object'
          ? (profile.metadata as Record<string, unknown>)
          : {};
      const v =
        meta.verification && typeof meta.verification === 'object'
          ? (meta.verification as Record<string, unknown>)
          : {};
      const companyName = String(v.company_name || '').trim();
      const nameMatch = String(v.name_match || '').toLowerCase();
      const raw = v.raw && typeof v.raw === 'object' ? v.raw : null;

      let can = String(v.status || '').toLowerCase() === 'verified';
      if (!can && companyName && nameMatch !== 'mismatch') {
        can = true;
      }
      if (!can && raw) can = true;

      if (!can) {
        return NextResponse.json(
          {
            error: 'No recoverable CIPC snapshot',
            hint: 'Re-run CIPC first, or apply CIPC name if mismatch.',
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();
      const payRef = String(v.paystack_reference || 'recovered').trim();
      const nextMeta = {
        ...meta,
        verification: {
          ...v,
          status: 'verified',
          verified_at: now,
          checked_at: now,
          recovered_by: gate.userId,
          recovered_at: now,
        },
      };

      // Tolerant update without is_verified
      let { error } = await supabase
        .from('profiles')
        .update({
          verification_status: 'verified',
          metadata: nextMeta,
          updated_at: now,
        })
        .eq('id', companyId);

      if (error && /column|schema/i.test(error.message)) {
        const retry = await supabase
          .from('profiles')
          .update({ verification_status: 'verified', updated_at: now })
          .eq('id', companyId);
        error = retry.error;
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await logActivity({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: 'business.verification_ops_recover',
        entity_type: 'profiles',
        entity_id: String(companyId),
        summary: `Ops recovered verified badge (${companyName || companyId})`,
        metadata: { paystackReference: payRef, companyName },
      });

      void import('@/lib/notifications/email-alerts').then(
        ({ notifyCipcVerificationOutcome }) =>
          notifyCipcVerificationOutcome({
            profileId: companyId,
            tradingName: profile.trading_name || profile.legal_name,
            status: 'verified',
            companyNameCipc: companyName,
            paystackReference: payRef,
            recovered: true,
            detail: 'Ops queue recover',
          })
      );

      return NextResponse.json({
        success: true,
        action: 'recover',
        companyId,
        status: 'verified',
        companyName: companyName || null,
      });
    }

    // apply_cipc_name — fix mismatch by copying CIPC name onto profile
    {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, metadata')
        .eq('id', companyId)
        .maybeSingle();
      if (!profile) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      const meta =
        profile.metadata && typeof profile.metadata === 'object'
          ? (profile.metadata as Record<string, unknown>)
          : {};
      const v =
        meta.verification && typeof meta.verification === 'object'
          ? (meta.verification as Record<string, unknown>)
          : {};
      const cipcName = String(
        v.company_name || v.trade_name || ''
      ).trim();
      if (!cipcName) {
        return NextResponse.json(
          {
            error: 'No CIPC company name in metadata',
            hint: 'Re-run CIPC first so the name is stored.',
          },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          trading_name: cipcName,
          legal_name: cipcName,
          updated_at: now,
          metadata: {
            ...meta,
            verification: {
              ...v,
              name_applied_at: now,
              name_applied_from: 'ops_queue',
              previous_trading_name: profile.trading_name,
              previous_legal_name: profile.legal_name,
            },
          },
        })
        .eq('id', companyId);

      if (error) {
        // retry without metadata
        const retry = await supabase
          .from('profiles')
          .update({
            trading_name: cipcName,
            legal_name: cipcName,
            updated_at: now,
          })
          .eq('id', companyId);
        if (retry.error) {
          return NextResponse.json(
            { error: retry.error.message },
            { status: 500 }
          );
        }
      }

      await logActivity({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: 'business.verification_apply_cipc_name',
        entity_type: 'profiles',
        entity_id: String(companyId),
        summary: `Applied CIPC name to profile: ${cipcName}`,
        metadata: {
          previous: {
            trading_name: profile.trading_name,
            legal_name: profile.legal_name,
          },
        },
      });

      // Auto re-run CIPC after name fix if payment exists
      let rerun: unknown = null;
      const payRef = String(v.paystack_reference || v.paystackReference || '').trim();
      if (payRef) {
        rerun = await runCipcAfterPayment({
          companyId,
          paystackReference: payRef,
          actorUserId: gate.userId,
          source: 'ops_queue_after_name_fix',
        });
      }

      return NextResponse.json({
        success: true,
        action: 'apply_cipc_name',
        companyId,
        trading_name: cipcName,
        legal_name: cipcName,
        rerun,
      });
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
