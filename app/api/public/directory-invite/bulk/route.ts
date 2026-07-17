import { NextRequest, NextResponse } from 'next/server';
import { getResend, getResendFrom } from '@/lib/resend';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

/**
 * POST { emails: string[] | csv, ref?, message? }
 * Bulk directory invites (max 25 per request). Rate limited.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `dir-invite-bulk:${ip}`,
      limit: 4,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many bulk invites. Try again later.' },
        { status: 429 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email not configured' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let emails: string[] = [];
    if (Array.isArray(body.emails)) {
      emails = body.emails.map((e: unknown) => String(e).toLowerCase().trim());
    } else if (typeof body.csv === 'string') {
      emails = body.csv
        .split(/[\n,;]+/)
        .map((e: string) => e.toLowerCase().trim())
        .filter(Boolean);
    }
    emails = [...new Set(emails.filter((e) => e.includes('@')))].slice(0, 25);
    if (!emails.length) {
      return NextResponse.json(
        { error: 'Provide emails[] or csv with valid addresses' },
        { status: 400 }
      );
    }

    const ref = body.ref ? String(body.ref).slice(0, 80) : '';
    const message = body.message ? String(body.message).slice(0, 400) : '';
    const base = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com'
    ).replace(/\/$/, '');

    const resend = getResend();
    let sent = 0;
    const failed: string[] = [];

    for (const email of emails) {
      const q = new URLSearchParams();
      q.set('email', email);
      if (ref) q.set('ref', ref);
      if (message) q.set('message', message);
      const inviteHref = `${base}/invite?${q.toString()}`;
      try {
        const { error } = await resend.emails.send({
          from: getResendFrom(),
          to: [email],
          subject: 'You are invited to SupplierAdvisor',
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#0077b6">Join SupplierAdvisor®</h2>
              <p>You have been invited to the verified B2B trade network.</p>
              ${message ? `<p style="color:#475569">${message}</p>` : ''}
              <p>
                <a href="${inviteHref}" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Accept invite →</a>
              </p>
            </div>
          `,
        });
        if (error) failed.push(email);
        else sent += 1;
      } catch {
        failed.push(email);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: emails.length,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
