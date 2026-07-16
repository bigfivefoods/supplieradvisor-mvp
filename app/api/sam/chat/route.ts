import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getXaiApiKey, samComplete } from '@/lib/sam/client';
import { buildSamSystemPrompt, type SamChatMessage } from '@/lib/sam/prompt';
import { SAM_MODEL, SAM_NAME } from '@/lib/sam/knowledge';
import { getReferralSummary } from '@/lib/billing/supply-chain-referral';
import { computeCompanySubscription } from '@/lib/billing/company-subscription';
import { getPayoutKycStatus } from '@/lib/billing/referral-controls';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IncomingMsg = { role?: string; content?: string };

/**
 * POST /api/sam/chat
 * Body: { messages: [{role, content}], companyId?, pathname?, stream? }
 * SAM — Supplier Advisor Messenger (Grok via xAI Responses API).
 */
export async function POST(request: NextRequest) {
  try {
    if (!getXaiApiKey()) {
      return NextResponse.json(
        {
          error:
            'SAM is not configured yet. Set XAI_API_KEY in the server environment (console.x.ai).',
          code: 'SAM_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId:
        body.privyUserId || legacyPrivyFrom(request) || null,
    });
    if (!auth.ok) return auth.response;

    const rawMessages = Array.isArray(body.messages)
      ? (body.messages as IncomingMsg[])
      : [];
    const history: SamChatMessage[] = rawMessages
      .filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim()
      )
      .slice(-24)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content).slice(0, 8000),
      }));

    if (!history.length || history[history.length - 1].role !== 'user') {
      return NextResponse.json(
        { error: 'Send at least one user message.' },
        { status: 400 }
      );
    }

    let companyName: string | null = null;
    let role: string | null = null;
    const companyId = Number(body.companyId);
    if (Number.isFinite(companyId) && companyId > 0) {
      const mem = await getCompanyMembership(auth.userId, companyId);
      if (mem.ok) {
        role = mem.role;
        try {
          const supabase = getSupabaseServer();
          const { data: co } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', companyId)
            .maybeSingle();
          companyName =
            (co as { trading_name?: string; legal_name?: string } | null)
              ?.trading_name ||
            (co as { legal_name?: string } | null)?.legal_name ||
            null;
        } catch {
          /* ignore */
        }
      }
    }

    // Live tools: billing + referral + KYC (server-side only)
    let liveTools: string | null = null;
    if (Number.isFinite(companyId) && companyId > 0) {
      try {
        const supabase = getSupabaseServer();
        const { data: prof } = await supabase
          .from('profiles')
          .select(
            'subscription_status, subscription_trial_ends_at, subscription_ends_at, subscription_plan, subscription_amount_zar, trust_score, otifef_average, verification_status'
          )
          .eq('id', companyId)
          .maybeSingle();
        const sub = prof
          ? computeCompanySubscription(prof as Parameters<typeof computeCompanySubscription>[0])
          : null;
        const ref = await getReferralSummary(companyId);
        const kyc = await getPayoutKycStatus(companyId);
        liveTools = [
          `Billing: status=${sub?.status || 'unknown'}, trialEnds=${sub?.trialEndsAt || 'n/a'}, endsAt=${sub?.endsAt || 'n/a'}, plan=${sub?.plan || 'n/a'}, hasAccess=${sub?.hasAccess}`,
          `Trust: score=${prof?.trust_score ?? 'n/a'}, otifef=${prof?.otifef_average ?? 'n/a'}, verification=${prof?.verification_status || 'n/a'}`,
          `Referral: pending=R${ref.pendingZar}, approved=R${ref.approvedZar}, requested=R${ref.payoutRequestedZar}, paid=R${ref.paidZar}, directReferrals=${ref.directReferrals}, rates=${ref.ratesSummary}`,
          `Payout KYC complete=${kyc.complete}, missing=${kyc.missing.join(',') || 'none'}`,
          'Routes: /dashboard/my-business/billing, /dashboard/my-business/trust, /dashboard/my-business/referral-ops (ops only)',
        ].join('\n');
      } catch {
        liveTools = 'Live tools unavailable for this company.';
      }
    }

    const system = buildSamSystemPrompt({
      companyName,
      role,
      pathname: body.pathname ? String(body.pathname).slice(0, 200) : null,
      liveTools,
    });

    const messages: SamChatMessage[] = [
      { role: 'system', content: system },
      ...history,
    ];

    // Prefer non-streaming Responses API (docs.x.ai preferred path).
    // stream=true still available for progressive UI via chat completions.
    const wantStream = body.stream === true;

    const result = await samComplete({
      messages,
      stream: wantStream,
    });

    if (!result.ok) {
      // Soft-log failed attempts for company admins / ops
      try {
        const lastUser = history[history.length - 1]?.content || '';
        await getSupabaseServer().from('sam_conversations').insert({
          profile_id: Number.isFinite(companyId) && companyId > 0 ? companyId : null,
          user_id: auth.userId,
          pathname: body.pathname ? String(body.pathname).slice(0, 200) : null,
          model: SAM_MODEL,
          api: result.api,
          user_message: lastUser.slice(0, 8000),
          assistant_message: null,
          error: result.error || 'failed',
          metadata: { status: result.status },
          created_at: new Date().toISOString(),
        });
      } catch {
        /* table optional until migration */
      }
      return NextResponse.json(
        {
          error: result.error || 'Grok request failed',
          status: result.status,
          api: result.api,
        },
        { status: result.status === 403 ? 403 : result.status || 502 }
      );
    }

    if (wantStream && result.streamBody) {
      return new Response(result.streamBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Sam-Model': SAM_MODEL,
          'X-Sam-Name': SAM_NAME,
          'X-Sam-Api': result.api,
        },
      });
    }

    // Audit log successful reply
    try {
      const lastUser = history[history.length - 1]?.content || '';
      await getSupabaseServer().from('sam_conversations').insert({
        profile_id: Number.isFinite(companyId) && companyId > 0 ? companyId : null,
        user_id: auth.userId,
        pathname: body.pathname ? String(body.pathname).slice(0, 200) : null,
        model: SAM_MODEL,
        api: result.api,
        user_message: lastUser.slice(0, 8000),
        assistant_message: (result.text || '').slice(0, 16000),
        error: null,
        metadata: {
          companyName,
          role,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      /* optional until migration applied */
    }

    return NextResponse.json({
      success: true,
      name: SAM_NAME,
      model: SAM_MODEL,
      api: result.api,
      message: { role: 'assistant', content: result.text },
    });
  } catch (e: unknown) {
    console.error('SAM chat error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'SAM error' },
      { status: 500 }
    );
  }
}

/** Lightweight health for UI badge */
export async function GET() {
  const configured = Boolean(getXaiApiKey());
  return NextResponse.json({
    name: SAM_NAME,
    fullName: 'Supplier Advisor Messenger',
    model: SAM_MODEL,
    configured,
    status: configured ? 'ready' : 'missing_api_key',
    preferredApi: 'responses',
    endpoint: 'https://api.x.ai/v1/responses',
  });
}
