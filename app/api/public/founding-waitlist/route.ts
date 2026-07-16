import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

/**
 * GET — remaining founding slots
 * POST { email, companyName? } — join waitlist when full
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);

    const used = count ?? 0;
    const remaining = Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - used);

    return NextResponse.json({
      success: true,
      limit: FOUNDING_FREE_COMPANY_LIMIT,
      used,
      remaining,
      full: remaining <= 0,
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
    const body = await request.json();
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const companyName = body.companyName
      ? String(body.companyName).slice(0, 200)
      : null;

    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);

    const remaining = Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - (count ?? 0));
    const full = remaining <= 0;
    const status = full ? 'waiting' : 'slots_available';

    const { error } = await supabase.from('founding_waitlist').upsert(
      {
        email,
        company_name: companyName,
        user_id: body.userId ? String(body.userId) : null,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        status,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    // unique index is on lower(email) — upsert may need insert only
    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260716_platform_improvements.sql',
          },
          { status: 503 }
        );
      }
      // try plain insert ignore duplicate
      if (/duplicate|unique/i.test(error.message)) {
        // Soft confirm again for already-on-list
        void sendWaitlistConfirmEmail({
          to: email,
          companyName,
          full,
          alreadyOnList: true,
        }).catch(() => undefined);
        return NextResponse.json({
          success: true,
          alreadyOnList: true,
          remaining,
          full,
          message: full
            ? 'You are already on the founding waitlist. We will contact you when access options open.'
            : 'You are on our list — founding slots are still available; register your company now.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void sendWaitlistConfirmEmail({
      to: email,
      companyName,
      full,
      alreadyOnList: false,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      remaining,
      full,
      message: full
        ? 'You are on the founding waitlist. Check your email for confirmation — we will contact you when access options open.'
        : 'Founding slots are still available — register your company now.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function sendWaitlistConfirmEmail(opts: {
  to: string;
  companyName?: string | null;
  full: boolean;
  alreadyOnList: boolean;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const resend = getResend();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com';
    const name = opts.companyName
      ? escapeHtml(opts.companyName)
      : 'your company';
    const subject = opts.full
      ? 'You’re on the SupplierAdvisor founding waitlist'
      : 'SupplierAdvisor founding slots still open';
    const bodyHtml = opts.full
      ? `<p style="color:#475569;font-size:14px;line-height:1.6;">
          Thanks for your interest${opts.companyName ? ` from <strong>${name}</strong>` : ''}.
          The first ${FOUNDING_FREE_COMPANY_LIMIT} free-for-life founding company slots are full.
          You’re on the waitlist${opts.alreadyOnList ? ' (we already had this email)' : ''} —
          we’ll email you when access options open.
        </p>`
      : `<p style="color:#475569;font-size:14px;line-height:1.6;">
          Great news — founding free-for-life slots are still available.
          Register ${name} on SupplierAdvisor to claim a founding seat.
        </p>`;

    await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: opts.to,
      subject,
      html: `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:0.08em;text-transform:uppercase;">Founding cohort</div>
    <h1 style="font-size:20px;margin:12px 0 8px;color:#0f172a;">${escapeHtml(subject)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0;">
      <a href="${appUrl}/onboarding" style="background:#7c3aed;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">
        Open SupplierAdvisor →
      </a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">SupplierAdvisor® · Free for life for founding companies</p>
  </div>
</body></html>`,
    });
  } catch (e) {
    console.warn('founding waitlist email soft-fail:', e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
