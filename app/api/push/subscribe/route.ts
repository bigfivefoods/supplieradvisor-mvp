import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { isWebPushConfigured } from '@/lib/push/web-push';

/**
 * POST { mode?: 'company'|'member', companyId?, privyUserId, subscription, topics? }
 * DELETE { mode?, companyId?, privyUserId, endpoint }
 *
 * Member mode is for SA Member (no selected company). profile_id stays null
 * unless the same endpoint already belongs to a company subscription — then
 * topics are merged so dual-life users keep PO + care alerts on one device.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isWebPushConfigured()) {
      return NextResponse.json(
        {
          error: 'Web Push not configured on server',
          hint: 'Set VAPID keys in environment',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const mode = body.mode === 'member' ? 'member' : 'company';
    const companyId = Number(body.companyId);
    const privyUserId = String(body.privyUserId || '').trim();
    const sub = body.subscription as
      | {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        }
      | null;

    if (!privyUserId) {
      return NextResponse.json({ error: 'privyUserId required' }, { status: 400 });
    }

    if (mode === 'company') {
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
      }
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!gate.ok) return gate.response;
    } else {
      const auth = await requireVerifiedUser(request, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!auth.ok) return auth.response;
      const uid = getCanonicalUserId(auth.userId);
      if (!uid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const endpoint = String(sub?.endpoint || '').trim();
    const p256dh = String(sub?.keys?.p256dh || '').trim();
    const auth = String(sub?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'subscription.endpoint and keys required' },
        { status: 400 }
      );
    }

    const incomingTopics = Array.isArray(body.topics)
      ? body.topics.map((t: unknown) => String(t)).filter(Boolean)
      : mode === 'member'
        ? ['care', 'bookings', 'hire']
        : ['po', 'deals'];

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    const existing = await supabase
      .from('push_subscriptions')
      .select('id, profile_id, topics')
      .eq('endpoint', endpoint)
      .maybeSingle();

    const prevTopics = Array.isArray(existing.data?.topics)
      ? (existing.data.topics as string[])
      : [];
    const topics = Array.from(new Set([...prevTopics, ...incomingTopics]));
    const keepProfile =
      existing.data?.profile_id != null
        ? Number(existing.data.profile_id)
        : mode === 'company'
          ? companyId
          : null;

    const row = {
      profile_id: keepProfile,
      privy_user_id: privyUserId,
      endpoint,
      p256dh,
      auth,
      user_agent:
        typeof body.userAgent === 'string'
          ? body.userAgent.slice(0, 400)
          : request.headers.get('user-agent')?.slice(0, 400) || null,
      topics,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' })
      .select('id, endpoint, topics, profile_id')
      .maybeSingle();

    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        const upd = await supabase
          .from('push_subscriptions')
          .update(row)
          .eq('endpoint', endpoint)
          .select('id, endpoint, topics, profile_id')
          .maybeSingle();
        if (upd.error) {
          return NextResponse.json(
            {
              error: upd.error.message,
              hint: 'Run supabase/migrations/20260716_push_subscriptions.sql',
            },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, subscription: upd.data });
      }
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260716_push_subscriptions.sql',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === 'member' ? 'member' : 'company';
    const companyId = Number(body.companyId);
    const privyUserId = String(body.privyUserId || '').trim();
    const endpoint = String(body.endpoint || '').trim();

    if (!privyUserId) {
      return NextResponse.json({ error: 'privyUserId required' }, { status: 400 });
    }

    if (mode === 'company') {
      if (!Number.isFinite(companyId)) {
        return NextResponse.json(
          { error: 'companyId and privyUserId required' },
          { status: 400 }
        );
      }
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!gate.ok) return gate.response;
    } else {
      const auth = await requireVerifiedUser(request, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!auth.ok) return auth.response;
    }

    const supabase = getSupabaseServer();
    let q = supabase
      .from('push_subscriptions')
      .delete()
      .eq('privy_user_id', privyUserId);
    if (mode === 'company') q = q.eq('profile_id', companyId);
    if (endpoint) q = q.eq('endpoint', endpoint);
    const { error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
