import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

/**
 * POST { event: 'opened'|'accepted', ref?, email?, claim? }
 * Soft tracking for invite funnel (activity_log on referrer company).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `invite-track:${ip}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const body = await request.json().catch(() => ({}));
    const event = String(body.event || 'opened').toLowerCase();
    const ref = Number(body.ref || 0);
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    if (!Number.isFinite(ref) || ref <= 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_ref' });
    }

    const supabase = getSupabaseServer();
    await supabase.from('activity_log').insert({
      profile_id: ref,
      action:
        event === 'accepted'
          ? 'network.invite_accepted'
          : 'network.invite_opened',
      entity_type: 'invite',
      entity_id: email || String(body.claim || 'anon'),
      summary:
        event === 'accepted'
          ? `Invite accepted${email ? ` · ${email}` : ''}`
          : `Invite opened${email ? ` · ${email}` : ''}`,
      metadata: {
        email: email || null,
        claim: body.claim || null,
        event,
        status: event === 'accepted' ? 'accepted' : 'opened',
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true, soft: true });
  }
}
