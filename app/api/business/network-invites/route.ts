import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * Company-scoped invite CRM (activity_log backed).
 * GET  ?companyId= — list sent invites
 * POST { companyId, action: 'send'|'resend'|'bulk_from_emails', email?, emails?, name? }
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
      ])
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      return NextResponse.json({
        success: true,
        invites: [],
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
        created_at: r.created_at,
        metadata: meta,
      };
    });

    return NextResponse.json({ success: true, invites });
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

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 503 }
      );
    }

    const action = String(body.action || 'send').toLowerCase();
    const supabase = getSupabaseServer();
    const base = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com'
    ).replace(/\/$/, '');

    const { data: seller } = await supabase
      .from('profiles')
      .select('trading_name')
      .eq('id', companyId)
      .maybeSingle();
    const sellerName = seller?.trading_name || 'A SupplierAdvisor company';

    const sendOne = async (email: string, name?: string) => {
      const e = email.toLowerCase().trim();
      if (!e.includes('@')) return { ok: false as const, email: e, error: 'invalid' };
      const q = new URLSearchParams();
      q.set('email', e);
      q.set('ref', String(companyId));
      if (name) q.set('name', name);
      const inviteHref = `${base}/invite?${q.toString()}`;
      const resend = getResend();
      const { error } = await resend.emails.send({
        from: getResendFrom(),
        to: [e],
        subject: `${sellerName} invited you to SupplierAdvisor`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#0077b6">You're invited</h2>
            <p><strong>${sellerName}</strong> invited you to join SupplierAdvisor®.</p>
            <p>
              <a href="${inviteHref}" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Accept invite →</a>
            </p>
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
        summary: `Invite ${action === 'resend' ? 're' : ''}sent to ${e}`,
        metadata: {
          email: e,
          name: name || null,
          status: 'sent',
          inviteHref,
        },
      });
      return { ok: true as const, email: e };
    };

    if (action === 'bulk_from_emails' || action === 'bulk') {
      const emails: string[] = Array.isArray(body.emails)
        ? body.emails.map((x: unknown) => String(x).toLowerCase().trim())
        : String(body.csv || '')
            .split(/[\n,;]+/)
            .map((x) => x.toLowerCase().trim());
      const unique = [...new Set(emails.filter((e) => e.includes('@')))].slice(
        0,
        40
      );
      let sent = 0;
      const failed: string[] = [];
      for (const email of unique) {
        const r = await sendOne(email);
        if (r.ok) sent += 1;
        else failed.push(email);
      }
      return NextResponse.json({ success: true, sent, failed, total: unique.length });
    }

    if (action === 'resend' || action === 'send') {
      const email = String(body.email || '').toLowerCase().trim();
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
      }
      const r = await sendOne(email, body.name ? String(body.name) : undefined);
      if (!r.ok) {
        return NextResponse.json(
          { error: r.error || 'Send failed' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, email });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
