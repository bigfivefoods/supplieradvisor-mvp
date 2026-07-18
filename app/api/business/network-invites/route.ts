import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * Company-scoped invite CRM (activity_log backed).
 * GET  ?companyId= — list sent invites + per-email funnel
 * POST { companyId, action: 'send'|'resend'|'bulk_from_emails'|'track_open'|'track_accept', email?, emails?, name?, note? }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, summary, metadata, created_at')
      .eq('profile_id', companyId)
      .in('action', [
        'directory.invite_sent',
        'directory.invite_resent',
        'network.invite_sent',
        'network.invite_opened',
        'network.invite_accepted',
        'network.invite_seq_3',
        'network.invite_seq_7',
      ])
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      return NextResponse.json({
        success: true,
        invites: [],
        funnel: [],
        warning: error.message,
      });
    }

    const invites = (data || []).map((r) => {
      const meta =
        r.metadata && typeof r.metadata === 'object'
          ? (r.metadata as Record<string, unknown>)
          : {};
      return {
        id: r.id,
        action: r.action,
        summary: r.summary,
        email: meta.email ? String(meta.email) : null,
        status: meta.status ? String(meta.status) : 'sent',
        note: meta.note || meta.personalNote || meta.message || null,
        created_at: r.created_at,
        metadata: meta,
      };
    });

    const { loadInviteFunnel, countRecentInviteSends, INVITE_BULK_DAILY_CAP } =
      await import('@/lib/business/invite-funnel');
    const funnel = await loadInviteFunnel(companyId, 60);
    const sent24h = await countRecentInviteSends(companyId);

    return NextResponse.json({
      success: true,
      invites,
      funnel: funnel.rows,
      sent24h,
      dailyCap: INVITE_BULK_DAILY_CAP,
      remainingToday: Math.max(0, INVITE_BULK_DAILY_CAP - sent24h),
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
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'send').toLowerCase();
    const supabase = getSupabaseServer();
    const base = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com'
    ).replace(/\/$/, '');

    // Track open/accept without Resend (public-ish via company member or cron)
    if (action === 'track_open' || action === 'track_accept') {
      const email = String(body.email || '').toLowerCase().trim();
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
      }
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        actor_user_id: gate.userId || 'invite:track',
        action:
          action === 'track_open'
            ? 'network.invite_opened'
            : 'network.invite_accepted',
        entity_type: 'invite',
        entity_id: email,
        summary: `Invite ${action === 'track_open' ? 'opened' : 'accepted'}: ${email}`,
        metadata: { email, status: action === 'track_open' ? 'opened' : 'accepted' },
      });
      return NextResponse.json({ success: true, action, email });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 503 }
      );
    }

    const { data: seller } = await supabase
      .from('profiles')
      .select('trading_name')
      .eq('id', companyId)
      .maybeSingle();
    const sellerName = seller?.trading_name || 'A SupplierAdvisor company';
    const personalNote = String(body.note || body.message || '')
      .trim()
      .slice(0, 500);

    const {
      countRecentInviteSends,
      INVITE_BULK_DAILY_CAP,
      INVITE_BULK_BATCH_MAX,
    } = await import('@/lib/business/invite-funnel');

    const sendOne = async (email: string, name?: string, note?: string) => {
      const e = email.toLowerCase().trim();
      if (!e.includes('@')) return { ok: false as const, email: e, error: 'invalid' };
      // Quality: resend without note when already spammed is discouraged client-side; server soft-allows
      const q = new URLSearchParams();
      q.set('email', e);
      q.set('ref', String(companyId));
      if (name) q.set('name', name);
      q.set('src', 'network-invite');
      const inviteHref = `${base}/invite?${q.toString()}`;
      const noteHtml = note
        ? `<p style="background:#f0f9ff;border-radius:12px;padding:12px;color:#0c4a6e;font-size:14px">${note
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</p>`
        : '';
      const resend = getResend();
      const { error } = await resend.emails.send({
        from: getResendFrom(),
        to: [e],
        subject: note
          ? `${sellerName} — personal invite on SupplierAdvisor`
          : `${sellerName} invited you to SupplierAdvisor`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#0077b6">You're invited</h2>
            <p><strong>${sellerName}</strong> invited you to join SupplierAdvisor® and trade.</p>
            ${noteHtml}
            <p>
              <a href="${inviteHref}" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Accept invite →</a>
            </p>
            <p style="font-size:12px;color:#64748b">After signup, open First trade to close a real loop in ~30 minutes.</p>
          </div>
        `,
      });
      if (error) return { ok: false as const, email: e, error: String(error) };

      await supabase.from('activity_log').insert({
        profile_id: companyId,
        actor_user_id: gate.userId || null,
        action:
          action === 'resend' ? 'directory.invite_resent' : 'network.invite_sent',
        entity_type: 'invite',
        entity_id: e,
        summary: `Invite ${action === 'resend' ? 're' : ''}sent to ${e}${
          note ? ' · personal note' : ''
        }`,
        metadata: {
          email: e,
          name: name || null,
          status: 'sent',
          inviteHref,
          note: note || null,
          personalNote: Boolean(note),
        },
      });
      return { ok: true as const, email: e };
    };

    if (action === 'bulk_from_emails' || action === 'bulk') {
      const sent24h = await countRecentInviteSends(companyId);
      const remaining = Math.max(0, INVITE_BULK_DAILY_CAP - sent24h);
      if (remaining <= 0) {
        return NextResponse.json(
          {
            error: `Daily invite cap reached (${INVITE_BULK_DAILY_CAP}/24h). Quality over volume.`,
            code: 'INVITE_DAILY_CAP',
            sent24h,
          },
          { status: 429 }
        );
      }
      const emails: string[] = Array.isArray(body.emails)
        ? body.emails.map((x: unknown) => String(x).toLowerCase().trim())
        : String(body.csv || '')
            .split(/[\n,;]+/)
            .map((x) => x.toLowerCase().trim());
      const unique = [...new Set(emails.filter((e) => e.includes('@')))].slice(
        0,
        Math.min(INVITE_BULK_BATCH_MAX, remaining)
      );
      // Require note for bulk > 5
      if (unique.length > 5 && !personalNote) {
        return NextResponse.json(
          {
            error:
              'Personal note required for bulk sends over 5 addresses (invite quality).',
            code: 'NOTE_REQUIRED',
          },
          { status: 400 }
        );
      }
      let sent = 0;
      const failed: string[] = [];
      for (const email of unique) {
        const r = await sendOne(email, undefined, personalNote || undefined);
        if (r.ok) sent += 1;
        else failed.push(email);
      }
      return NextResponse.json({
        success: true,
        sent,
        failed,
        total: unique.length,
        remainingToday: Math.max(0, remaining - sent),
      });
    }

    if (action === 'resend' || action === 'send') {
      const email = String(body.email || '').toLowerCase().trim();
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
      }
      if (action === 'resend' && !personalNote) {
        return NextResponse.json(
          {
            error: 'Add a short personal note when resending (quality gate).',
            code: 'NOTE_REQUIRED',
          },
          { status: 400 }
        );
      }
      const r = await sendOne(
        email,
        body.name ? String(body.name) : undefined,
        personalNote || undefined
      );
      if (!r.ok) {
        return NextResponse.json(
          { error: r.error || 'Send failed' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, email, note: Boolean(personalNote) });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
