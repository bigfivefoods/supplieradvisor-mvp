import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { isWebPushConfigured } from '@/lib/push/web-push';

/**
 * POST { companyId, privyUserId, subscription: PushSubscriptionJSON, topics? }
 * DELETE { companyId, privyUserId, endpoint }
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
    const companyId = Number(body.companyId);
    const privyUserId = String(body.privyUserId || '').trim();
    const sub = body.subscription as
      | {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        }
      | null;

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!privyUserId) {
      return NextResponse.json({ error: 'privyUserId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const endpoint = String(sub?.endpoint || '').trim();
    const p256dh = String(sub?.keys?.p256dh || '').trim();
    const auth = String(sub?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'subscription.endpoint and keys required' },
        { status: 400 }
      );
    }

    const topics = Array.isArray(body.topics)
      ? body.topics.map((t: unknown) => String(t)).filter(Boolean)
      : ['po', 'deals'];

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const row = {
      profile_id: companyId,
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
      .select('id, endpoint, topics')
      .maybeSingle();

    if (error) {
      // Fallback insert if unique conflict name differs
      if (/unique|duplicate/i.test(error.message)) {
        const upd = await supabase
          .from('push_subscriptions')
          .update(row)
          .eq('endpoint', endpoint)
          .select('id, endpoint, topics')
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
    const companyId = Number(body.companyId);
    const privyUserId = String(body.privyUserId || '').trim();
    const endpoint = String(body.endpoint || '').trim();

    if (!Number.isFinite(companyId) || !privyUserId) {
      return NextResponse.json(
        { error: 'companyId and privyUserId required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let q = supabase
      .from('push_subscriptions')
      .delete()
      .eq('privy_user_id', privyUserId)
      .eq('profile_id', companyId);
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
