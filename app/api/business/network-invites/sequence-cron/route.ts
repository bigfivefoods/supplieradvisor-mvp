import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * GET — Resend invite sequences at day 3 and day 7 if not accepted.
 * Looks at network.invite_sent without a later network.invite_accepted for same email.
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        ok: false,
        error: 'RESEND_API_KEY not set',
      });
    }

    const supabase = getSupabaseServer();
    const now = Date.now();
    const day3 = 3 * 86400000;
    const day7 = 7 * 86400000;

    const { data: sent } = await supabase
      .from('activity_log')
      .select('id, profile_id, metadata, created_at, action')
      .in('action', ['network.invite_sent', 'directory.invite_sent'])
      .order('created_at', { ascending: false })
      .limit(200);

    const { data: accepted } = await supabase
      .from('activity_log')
      .select('metadata, profile_id')
      .eq('action', 'network.invite_accepted')
      .limit(200);

    const acceptedKeys = new Set(
      (accepted || []).map((a) => {
        const m =
          a.metadata && typeof a.metadata === 'object'
            ? (a.metadata as Record<string, unknown>)
            : {};
        return `${a.profile_id}:${String(m.email || '').toLowerCase()}`;
      })
    );

    const { data: seqLogged } = await supabase
      .from('activity_log')
      .select('metadata, profile_id, action')
      .in('action', ['network.invite_seq_3', 'network.invite_seq_7'])
      .limit(300);

    const seqKeys = new Set(
      (seqLogged || []).map((a) => {
        const m =
          a.metadata && typeof a.metadata === 'object'
            ? (a.metadata as Record<string, unknown>)
            : {};
        return `${a.action}:${a.profile_id}:${String(m.email || '').toLowerCase()}`;
      })
    );

    const base = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com'
    ).replace(/\/$/, '');

    let sent3 = 0;
    let sent7 = 0;
    const resend = getResend();

    for (const row of sent || []) {
      const meta =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};
      const email = String(meta.email || '').toLowerCase();
      if (!email.includes('@')) continue;
      const key = `${row.profile_id}:${email}`;
      if (acceptedKeys.has(key)) continue;

      const age = now - new Date(String(row.created_at)).getTime();
      const inviteHref = `${base}/invite?email=${encodeURIComponent(email)}&ref=${row.profile_id}`;

      if (age >= day7) {
        const sk = `network.invite_seq_7:${row.profile_id}:${email}`;
        if (seqKeys.has(sk)) continue;
        await resend.emails.send({
          from: getResendFrom(),
          to: [email],
          subject: 'Still joining SupplierAdvisor? (day 7)',
          html: `<p>Your invite is still open. <a href="${inviteHref}">Accept →</a></p>`,
        });
        await supabase.from('activity_log').insert({
          profile_id: row.profile_id,
          action: 'network.invite_seq_7',
          entity_type: 'invite',
          entity_id: email,
          summary: `Invite sequence day7 → ${email}`,
          metadata: { email, status: 'seq_7' },
        });
        seqKeys.add(sk);
        sent7 += 1;
      } else if (age >= day3) {
        const sk = `network.invite_seq_3:${row.profile_id}:${email}`;
        if (seqKeys.has(sk)) continue;
        await resend.emails.send({
          from: getResendFrom(),
          to: [email],
          subject: 'Reminder: join SupplierAdvisor (day 3)',
          html: `<p>Friendly reminder to accept your invite. <a href="${inviteHref}">Accept →</a></p>`,
        });
        await supabase.from('activity_log').insert({
          profile_id: row.profile_id,
          action: 'network.invite_seq_3',
          entity_type: 'invite',
          entity_id: email,
          summary: `Invite sequence day3 → ${email}`,
          metadata: { email, status: 'seq_3' },
        });
        seqKeys.add(sk);
        sent3 += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      sent3,
      sent7,
      scanned: (sent || []).length,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
