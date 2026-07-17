import { NextRequest, NextResponse } from 'next/server';
import { getResend, getResendFrom } from '@/lib/resend';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

/**
 * POST { email, companyName?, companyId?, message? }
 * Public invite-to-join / claim from directory (rate limited).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `dir-invite:${ip}`,
      limit: 12,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many invites. Try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email not configured' },
        { status: 503 }
      );
    }

    const companyName = body.companyName
      ? String(body.companyName).slice(0, 200)
      : 'your company';
    const companyId = Number(body.companyId || 0);
    const note = body.message ? String(body.message).slice(0, 400) : '';
    const base = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com'
    ).replace(/\/$/, '');

    const ref = body.ref ? String(body.ref).slice(0, 80) : '';
    const inviteQ = new URLSearchParams();
    inviteQ.set('email', email);
    if (Number.isFinite(companyId) && companyId > 0) {
      inviteQ.set('claim', String(companyId));
      inviteQ.set('companyId', String(companyId));
    }
    if (companyName) inviteQ.set('name', companyName);
    if (ref) inviteQ.set('ref', ref);
    if (note) inviteQ.set('message', note);
    const inviteHref = `${base}/invite?${inviteQ.toString()}`;
    const dirHref = `${base}/directory`;

    const resend = getResend();
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to: [email],
      subject: `You're invited to SupplierAdvisor — ${companyName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0077b6">Join the SupplierAdvisor network</h2>
          <p>Someone invited <strong>${companyName}</strong> to SupplierAdvisor® — the B2B trade OS for verified partners.</p>
          ${note ? `<p style="color:#475569">${note}</p>` : ''}
          <p>
            <a href="${inviteHref}" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Accept invite →</a>
          </p>
          <p style="margin-top:12px"><a href="${dirHref}" style="color:#00b4d8">Browse the directory →</a></p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }

    return NextResponse.json({ success: true, to: email });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
