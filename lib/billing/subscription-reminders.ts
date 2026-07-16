/**
 * Trial ending + subscription expiry email reminders (Resend).
 * Soft-fail; uses profiles.subscription_* + metadata flags to avoid spam.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const ms = dayStart(new Date(iso)).getTime() - dayStart(new Date()).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export async function sendSubscriptionLifecycleEmails(opts?: {
  limit?: number;
}): Promise<{
  ok: boolean;
  trialEmails: number;
  expiryEmails: number;
  scanned: number;
  error?: string;
}> {
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: true,
      trialEmails: 0,
      expiryEmails: 0,
      scanned: 0,
      error: 'RESEND_API_KEY not set',
    };
  }

  const limit = opts?.limit ?? 200;
  try {
    const supabase = getSupabaseServer();
    // Pull companies with trial end or paid end in a useful window
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, email, contact_email, subscription_status, subscription_trial_ends_at, subscription_ends_at, subscription_plan, subscription_reminder_meta'
      )
      .not('trading_name', 'is', null)
      .limit(limit * 3);

    if (error) {
      return {
        ok: false,
        trialEmails: 0,
        expiryEmails: 0,
        scanned: 0,
        error: error.message,
      };
    }

    const resend = getResend();
    const base = appUrl();
    let trialEmails = 0;
    let expiryEmails = 0;
    let scanned = 0;

    for (const row of data || []) {
      scanned += 1;
      const status = String(row.subscription_status || '').toLowerCase();
      if (status === 'lifetime' || row.subscription_plan === 'lifetime') continue;

      const email =
        (row.email && String(row.email)) ||
        (row.contact_email && String(row.contact_email)) ||
        '';
      if (!email.includes('@')) continue;

      const meta =
        row.subscription_reminder_meta &&
        typeof row.subscription_reminder_meta === 'object' &&
        !Array.isArray(row.subscription_reminder_meta)
          ? { ...(row.subscription_reminder_meta as Record<string, unknown>) }
          : {};

      const name = String(row.trading_name || 'your company');
      const trialDays = daysUntil(row.subscription_trial_ends_at as string);
      const endDays = daysUntil(row.subscription_ends_at as string);

      // Trial ending in 7 or 1 day
      if (
        (status === 'trial' || status === 'trialing') &&
        trialDays != null &&
        (trialDays === 7 || trialDays === 1)
      ) {
        const key = `trial_${trialDays}d`;
        if (meta[key]) continue;
        try {
          await resend.emails.send({
            from: getResendFrom(),
            replyTo: getResendReplyTo(),
            to: email.toLowerCase(),
            subject:
              trialDays === 1
                ? 'Your SupplierAdvisor trial ends tomorrow'
                : `Your SupplierAdvisor trial ends in ${trialDays} days`,
            html: trialEmailHtml({
              name,
              days: trialDays,
              href: `${base}/dashboard/my-business/billing`,
            }),
          });
          meta[key] = new Date().toISOString();
          trialEmails += 1;
          await supabase
            .from('profiles')
            .update({ subscription_reminder_meta: meta })
            .eq('id', row.id);
        } catch (e) {
          console.warn('trial reminder soft-fail', row.id, e);
        }
      }

      // Paid plan ending in 7 or 1 day
      if (
        (status === 'active' || status === 'paid') &&
        endDays != null &&
        (endDays === 7 || endDays === 1)
      ) {
        const key = `ends_${endDays}d`;
        if (meta[key]) continue;
        try {
          await resend.emails.send({
            from: getResendFrom(),
            replyTo: getResendReplyTo(),
            to: email.toLowerCase(),
            subject:
              endDays === 1
                ? 'Your SupplierAdvisor subscription renews/ends tomorrow'
                : `Subscription ends in ${endDays} days — renew to keep access`,
            html: expiryEmailHtml({
              name,
              days: endDays,
              href: `${base}/dashboard/my-business/billing`,
            }),
          });
          meta[key] = new Date().toISOString();
          expiryEmails += 1;
          await supabase
            .from('profiles')
            .update({ subscription_reminder_meta: meta })
            .eq('id', row.id);
        } catch (e) {
          console.warn('expiry reminder soft-fail', row.id, e);
        }
      }

      if (trialEmails + expiryEmails >= limit) break;
    }

    return { ok: true, trialEmails, expiryEmails, scanned };
  } catch (e: unknown) {
    return {
      ok: false,
      trialEmails: 0,
      expiryEmails: 0,
      scanned: 0,
      error: e instanceof Error ? e.message : 'reminders failed',
    };
  }
}

function trialEmailHtml(opts: {
  name: string;
  days: number;
  href: string;
}): string {
  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="font-size:12px;font-weight:700;color:#0284c7;letter-spacing:0.08em;text-transform:uppercase;">Trial</div>
    <h1 style="font-size:20px;margin:12px 0 8px;color:#0f172a;">
      ${opts.days === 1 ? 'Trial ends tomorrow' : `Trial ends in ${opts.days} days`}
    </h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      Hi <strong>${escapeHtml(opts.name)}</strong> — your ${COMPANY_TRIAL_DAYS}-day free trial
      is almost over. Subscribe from <strong>R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo</strong>
      (or prepay and save up to 30%) to keep full access.
    </p>
    <p style="margin:24px 0;">
      <a href="${opts.href}" style="background:#00b4d8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">
        Open billing →
      </a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">SupplierAdvisor®</p>
  </div>
</body></html>`;
}

function expiryEmailHtml(opts: {
  name: string;
  days: number;
  href: string;
}): string {
  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="font-size:12px;font-weight:700;color:#d97706;letter-spacing:0.08em;text-transform:uppercase;">Subscription</div>
    <h1 style="font-size:20px;margin:12px 0 8px;color:#0f172a;">
      ${opts.days === 1 ? 'Access ends tomorrow' : `Access ends in ${opts.days} days`}
    </h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      Hi <strong>${escapeHtml(opts.name)}</strong> — renew your company plan to avoid interruption.
      Prepaid multi-year terms save up to 30%.
    </p>
    <p style="margin:24px 0;">
      <a href="${opts.href}" style="background:#0077b6;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">
        Renew on billing →
      </a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">SupplierAdvisor®</p>
  </div>
</body></html>`;
}
