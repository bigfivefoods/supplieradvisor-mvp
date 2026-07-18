import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom } from '@/lib/resend';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/**
 * POST { companyId, peerId, message }
 * Request-to-trade: pending connection + personal note.
 * GET ?companyId=&industry?&city? — open-to-trade ranking
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId') || 0);
    if (companyId > 0) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;
    }

    const { loadOpenToTradeRanking } = await import(
      '@/lib/business/network-ranking'
    );
    const ranked = await loadOpenToTradeRanking({
      viewerCompanyId: companyId > 0 ? companyId : null,
      industry: request.nextUrl.searchParams.get('industry'),
      city: request.nextUrl.searchParams.get('city'),
      limit: Number(request.nextUrl.searchParams.get('limit') || 30),
    });
    const list =
      companyId > 0 ? ranked.filter((r) => r.id !== companyId) : ranked;
    return NextResponse.json({ success: true, companies: list });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`request-trade:${ip}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    const peerId = Number(body.peerId);
    if (!Number.isFinite(companyId) || !Number.isFinite(peerId) || peerId <= 0) {
      return NextResponse.json(
        { error: 'companyId and peerId required' },
        { status: 400 }
      );
    }
    if (companyId === peerId) {
      return NextResponse.json({ error: 'Cannot trade with self' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    // Per-company daily soft cap
    const companyRl = rateLimit(`request-trade-co:${companyId}`, {
      limit: 40,
      windowMs: 24 * 3600_000,
    });
    if (!companyRl.ok) {
      return NextResponse.json(
        {
          error: 'Daily request-to-trade cap reached for this company',
          code: 'TRADE_REQ_CAP',
        },
        { status: 429 }
      );
    }

    const message = String(body.message || body.note || '')
      .trim()
      .slice(0, 500);
    if (!message) {
      return NextResponse.json(
        { error: 'message required for request-to-trade quality' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('business_connections')
      .select('id, status')
      .or(
        `and(requester_profile_id.eq.${companyId},requestee_profile_id.eq.${peerId}),and(requester_profile_id.eq.${peerId},requestee_profile_id.eq.${companyId})`
      )
      .limit(1)
      .maybeSingle();

    if (existing && String(existing.status) === 'accepted') {
      return NextResponse.json({
        success: true,
        alreadyConnected: true,
        firstTradeHref: `/dashboard?peerTrade=${peerId}`,
        message: 'Already connected — open first trade',
      });
    }

    if (!existing) {
      const { error } = await supabase.from('business_connections').insert({
        requester_profile_id: companyId,
        requestee_profile_id: peerId,
        connection_type: body.connection_type || 'partner',
        status: 'pending',
        created_at: now,
        updated_at: now,
        metadata: {
          request_to_trade: true,
          message,
          requested_by: gate.userId,
        },
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    try {
      const { data: peer } = await supabase
        .from('profiles')
        .select('email, trading_name')
        .eq('id', peerId)
        .maybeSingle();
      const { data: me } = await supabase
        .from('profiles')
        .select('trading_name')
        .eq('id', companyId)
        .maybeSingle();
      const to = peer?.email ? String(peer.email).trim() : '';
      if (to.includes('@') && process.env.RESEND_API_KEY) {
        const resend = getResend();
        const base = (
          process.env.NEXT_PUBLIC_APP_URL ||
          'https://www.supplieradvisor.com'
        ).replace(/\/$/, '');
        await resend.emails.send({
          from: getResendFrom(),
          to: [to],
          subject: `${me?.trading_name || 'A company'} wants to trade on SupplierAdvisor`,
          html: `<p><strong>${me?.trading_name || 'A company'}</strong> requested to trade with you.</p>
            <p style="background:#f0f9ff;padding:12px;border-radius:12px">${message
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</p>
            <p><a href="${base}/dashboard/connections">Review connection →</a></p>`,
        });
      }
    } catch {
      /* soft */
    }

    try {
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: 'network.request_to_trade',
        entity_type: 'profiles',
        entity_id: String(peerId),
        summary: `Request-to-trade peer #${peerId}`,
        metadata: { peerId, message },
      });
    } catch {
      /* soft */
    }

    return NextResponse.json({
      success: true,
      peerId,
      firstTradeHref: `/dashboard?peerTrade=${peerId}`,
      message: 'Trade request sent — when accepted, start first trade',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
