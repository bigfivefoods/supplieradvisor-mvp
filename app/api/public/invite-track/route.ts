import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * Public invite funnel track (open/accept).
 * POST { companyId|ref, email, event: 'open'|'accept' }
 * Rate-limited softly by not requiring secrets — activity_log only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId || body.ref);
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    const event = String(body.event || 'open').toLowerCase();
    if (!Number.isFinite(companyId) || companyId <= 0 || !email.includes('@')) {
      return NextResponse.json(
        { error: 'companyId/ref and email required' },
        { status: 400 }
      );
    }
    if (!['open', 'opened', 'accept', 'accepted'].includes(event)) {
      return NextResponse.json({ error: 'event must be open|accept' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const action =
      event.startsWith('accept')
        ? 'network.invite_accepted'
        : 'network.invite_opened';
    await supabase.from('activity_log').insert({
      profile_id: companyId,
      actor_user_id: 'public:invite-track',
      action,
      entity_type: 'invite',
      entity_id: email,
      summary: `Invite ${action.includes('accept') ? 'accepted' : 'opened'}: ${email}`,
      metadata: {
        email,
        status: action.includes('accept') ? 'accepted' : 'opened',
        source: 'public_track',
      },
    });
    return NextResponse.json({ success: true, action });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
