/**
 * Trial ending + subscription expiry email reminders (Resend).
 * Loads only companies inside the reminder window, then claims a dedupe
 * key before sending so a repeated cron run does not send twice.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';
import { isVukaNotificationSuppressed } from '@/lib/notifications/email-suppress';

const TRIAL_STATUSES = ['trial', 'trialing'] as const;
const PAID_STATUSES = ['active', 'paid'] as const;
const PAGE_SIZE = 200;
const MAX_PAGES = 5;
const MEMBER_CHUNK = 200;
const SELECT_FULL =
  'id, trading_name, email, subscription_status, subscription_trial_ends_at, subscription_ends_at, subscription_plan, subscription_reminder_meta';
const SELECT_BASE =
  'id, trading_name, email, subscription_status, subscription_trial_ends_at, subscription_ends_at, subscription_plan';

const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderDb = {
  from: (table: string) => ReminderQuery;
};

type ReminderQuery = PromiseLike<{ data: unknown; error: { message?: string } | null }> & {
  select: (columns?: string) => ReminderQuery;
  update: (patch: Record<string, unknown>) => ReminderQuery;
  in: (column: string, values: readonly unknown[]) => ReminderQuery;
  gte: (column: string, value: string) => ReminderQuery;
  lt: (column: string, value: string) => ReminderQuery;
  not: (column: string, op: string, value: null) => ReminderQuery;
  eq: (column: string, value: unknown) => ReminderQuery;
  is: (column: string, value: null) => ReminderQuery;
  order: (column: string, opts: { ascending: boolean }) => ReminderQuery;
  range: (from: number, to: number) => ReminderQuery;
  limit: (count: number) => ReminderQuery;
  filter: (column: string, op: string, value: unknown) => ReminderQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type ReminderProfile = {
  id: number;
  trading_name?: string | null;
  email?: string | null;
  subscription_status?: string | null;
  subscription_trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  subscription_plan?: string | null;
  subscription_reminder_meta?: unknown;
};

export type ReminderMember = {
  profile_id?: number | string | null;
  email?: string | null;
  invited_email?: string | null;
  role?: string | null;
  status?: string | null;
};

type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  tags: Array<{ name: string; value: string }>;
};

export type SubscriptionReminderResult = {
  ok: boolean;
  trialEmails: number;
  expiryEmails: number;
  scanned: number;
  candidates: number;
  durationMs: number;
  error?: string;
};

export type SendSubscriptionRemindersOpts = {
  limit?: number;
  now?: Date;
  supabase?: ReminderDb;
  sendEmail?: (message: OutboundEmail) => Promise<void>;
  resendConfigured?: boolean;
};

const MEMBER_ROLES = ['owner', 'admin', 'operations', 'ops', 'sales', 'finance'];

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

function utcDay(now: Date, offsetDays: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

/** Inclusive UTC dates from tomorrow through seven days ahead. */
export function reminderHorizon(now: Date): { start: string; end: string } {
  return {
    start: utcDay(now, 1).toISOString(),
    end: utcDay(now, 8).toISOString(),
  };
}

export function daysUntilUtc(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  const t = parsed.getTime();
  if (!Number.isFinite(t)) return null;
  const target = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / DAY_MS);
}

/**
 * Day 1 uses the 1-day key. Days 2–7 use the 7-day key, including a catch-up
 * when the 07:00 run was missed earlier in that week.
 */
export function reminderOffset(days: number | null): 1 | 7 | null {
  if (days === 1) return 1;
  if (days != null && days >= 2 && days <= 7) return 7;
  return null;
}

export function skippedSubscriptionPlan(status: string, plan: string): boolean {
  return (
    status === 'lifetime' ||
    plan === 'lifetime' ||
    plan.includes('founding') ||
    plan.includes('complimentary')
  );
}

export function usableCompanyEmail(value: unknown): string | null {
  const email = String(value || '').trim().toLowerCase();
  return email.includes('@') ? email : null;
}

export function choosePrimaryCompanyEmail(
  profileEmail: string | null | undefined,
  members: ReminderMember[]
): string | null {
  const direct = usableCompanyEmail(profileEmail);
  if (direct) return direct;
  for (const member of members) {
    const role = String(member.role || '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (role && !MEMBER_ROLES.includes(role)) continue;
    const email = usableCompanyEmail(member.email) || usableCompanyEmail(member.invited_email);
    if (email) return email;
  }
  return null;
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

function missingMetaColumn(message: string): boolean {
  return /subscription_reminder_meta|column .* does not exist/i.test(message);
}

function errorMessage(error: { message?: string } | null | undefined): string {
  return error?.message || '';
}

async function loadStatusWindow(
  supabase: ReminderDb,
  select: string,
  statuses: readonly string[],
  column: 'subscription_trial_ends_at' | 'subscription_ends_at',
  horizon: { start: string; end: string }
): Promise<{ rows: ReminderProfile[]; error?: string }> {
  const rows: ReminderProfile[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .in('subscription_status', statuses)
      .gte(column, horizon.start)
      .lt(column, horizon.end)
      .not('trading_name', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: errorMessage(error) || 'profile query failed' };
    const batch = (data || []) as ReminderProfile[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return { rows };
}

async function loadDueProfiles(
  supabase: ReminderDb,
  select: string,
  horizon: { start: string; end: string }
): Promise<{ rows: ReminderProfile[]; error?: string }> {
  const [trial, paid] = await Promise.all([
    loadStatusWindow(supabase, select, TRIAL_STATUSES, 'subscription_trial_ends_at', horizon),
    loadStatusWindow(supabase, select, PAID_STATUSES, 'subscription_ends_at', horizon),
  ]);
  if (trial.error) return { rows: [], error: trial.error };
  if (paid.error) return { rows: [], error: paid.error };
  const byId = new Map<number, ReminderProfile>();
  for (const row of [...trial.rows, ...paid.rows]) {
    byId.set(Number(row.id), row);
  }
  return { rows: [...byId.values()] };
}

async function loadMemberEmails(
  supabase: ReminderDb,
  profileIds: number[]
): Promise<{ byProfile: Map<number, ReminderMember[]>; error?: string }> {
  const byProfile = new Map<number, ReminderMember[]>();
  for (let i = 0; i < profileIds.length; i += MEMBER_CHUNK) {
    const chunk = profileIds.slice(i, i + MEMBER_CHUNK);
    const { data, error } = await supabase
      .from('business_users')
      .select('profile_id, email, invited_email, role, status')
      .in('profile_id', chunk)
      .eq('status', 'active')
      .limit(1000);
    if (error) return { byProfile, error: errorMessage(error) || 'member query failed' };
    for (const member of (data || []) as ReminderMember[]) {
      const id = Number(member.profile_id);
      const list = byProfile.get(id) || [];
      list.push(member);
      byProfile.set(id, list);
    }
  }
  return { byProfile };
}

type ClaimResult =
  | { status: 'claimed'; previous: unknown; next: Record<string, unknown> }
  | { status: 'already' }
  | { status: 'error'; message: string }
  | { status: 'no-meta' };

async function claimReminder(
  supabase: ReminderDb,
  id: number,
  key: string,
  now: Date
): Promise<ClaimResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_reminder_meta')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      const message = errorMessage(error) || 'claim read failed';
      if (missingMetaColumn(message)) return { status: 'no-meta' };
      return { status: 'error', message };
    }
    const current = (data || {}) as { subscription_reminder_meta?: unknown };
    const raw = current.subscription_reminder_meta;
    const meta = asMeta(raw);
    if (meta[key]) return { status: 'already' };
    const next = { ...meta, [key]: now.toISOString() };
    const written = await supabase
      .from('profiles')
      .update({ subscription_reminder_meta: next })
      .eq('id', id)
      .filter(`subscription_reminder_meta->>${key}`, 'is', null)
      .select('id');
    if (written.error) {
      const message = errorMessage(written.error) || 'claim write failed';
      if (missingMetaColumn(message)) return { status: 'no-meta' };
      return { status: 'error', message };
    }
    const updated = (written.data || []) as Array<{ id?: number }>;
    if (updated.length > 0) return { status: 'claimed', previous: raw ?? null, next };
  }
  return { status: 'already' };
}

async function releaseReminder(
  supabase: ReminderDb,
  id: number,
  previous: unknown,
  next: Record<string, unknown>,
  key: string
): Promise<void> {
  const stamp = next[key];
  await supabase
    .from('profiles')
    .update({ subscription_reminder_meta: asMeta(previous) })
    .eq('id', id)
    .filter(`subscription_reminder_meta->>${key}`, 'eq', stamp);
}

async function defaultSend(message: OutboundEmail): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: getResendFrom(),
    replyTo: getResendReplyTo(),
    to: message.to,
    subject: message.subject,
    html: message.html,
    tags: message.tags,
  });
}

export async function sendSubscriptionLifecycleEmails(
  opts?: SendSubscriptionRemindersOpts
): Promise<SubscriptionReminderResult> {
  const started = Date.now();
  const empty = (patch: Partial<SubscriptionReminderResult>): SubscriptionReminderResult => ({
    ok: patch.ok ?? false,
    trialEmails: patch.trialEmails ?? 0,
    expiryEmails: patch.expiryEmails ?? 0,
    scanned: patch.scanned ?? 0,
    candidates: patch.candidates ?? 0,
    durationMs: Date.now() - started,
    error: patch.error,
  });

  const resendConfigured =
    opts?.resendConfigured ?? Boolean(process.env.RESEND_API_KEY);
  if (!resendConfigured) {
    return empty({
      ok: true,
      error: 'RESEND_API_KEY not set',
    });
  }

  const limit = opts?.limit ?? 200;
  const now = opts?.now ?? new Date();
  const supabase = opts?.supabase ?? (getSupabaseServer() as unknown as ReminderDb);
  const sendEmail = opts?.sendEmail ?? defaultSend;
  const horizon = reminderHorizon(now);

  try {
    let hasMetaColumn = true;
    let loaded = await loadDueProfiles(supabase, SELECT_FULL, horizon);
    if (loaded.error && missingMetaColumn(loaded.error)) {
      hasMetaColumn = false;
      loaded = await loadDueProfiles(supabase, SELECT_BASE, horizon);
    }
    if (loaded.error) {
      return empty({ error: loaded.error });
    }

    const needingMembers = loaded.rows
      .filter((row) => !usableCompanyEmail(row.email))
      .map((row) => Number(row.id));
    const members: { byProfile: Map<number, ReminderMember[]>; error?: string } =
      needingMembers.length
        ? await loadMemberEmails(supabase, needingMembers)
        : { byProfile: new Map<number, ReminderMember[]>() };
    if (members.error && hasMetaColumn) {
      return empty({
        candidates: loaded.rows.length,
        scanned: loaded.rows.length,
        error: members.error,
      });
    }

    const base = appUrl();
    let trialEmails = 0;
    let expiryEmails = 0;
    let scanned = 0;
    let claimErrors = 0;

    for (const row of loaded.rows) {
      scanned += 1;
      const status = String(row.subscription_status || '').toLowerCase();
      const plan = String(row.subscription_plan || '').toLowerCase();
      if (skippedSubscriptionPlan(status, plan)) continue;

      const trialDays = daysUntilUtc(row.subscription_trial_ends_at, now);
      const endDays = daysUntilUtc(row.subscription_ends_at, now);
      const trialOffset =
        status === 'trial' || status === 'trialing' ? reminderOffset(trialDays) : null;
      const endOffset =
        status === 'active' || status === 'paid' ? reminderOffset(endDays) : null;
      const kind = trialOffset ? 'trial' : endOffset ? 'ends' : null;
      const offset = trialOffset || endOffset;
      const days = trialOffset ? trialDays : endDays;
      if (!kind || !offset || days == null) continue;

      const key = `${kind}_${offset}d`;
      const meta = asMeta(row.subscription_reminder_meta);
      if (hasMetaColumn && meta[key]) continue;

      const email = choosePrimaryCompanyEmail(
        row.email,
        members.byProfile.get(Number(row.id)) || []
      );
      if (!email) continue;

      const name = String(row.trading_name || 'your company');
      if (
        isVukaNotificationSuppressed({
          companyId: Number(row.id),
          companyName: name,
        })
      ) {
        continue;
      }

      let claimed: ClaimResult | null = null;
      if (hasMetaColumn) {
        claimed = await claimReminder(supabase, Number(row.id), key, now);
        if (claimed.status === 'no-meta') {
          hasMetaColumn = false;
          claimed = null;
        } else if (claimed.status === 'already') {
          continue;
        } else if (claimed.status === 'error') {
          claimErrors += 1;
          continue;
        }
      }

      const message: OutboundEmail = {
        to: email,
        subject:
          kind === 'trial'
            ? days === 1
              ? 'Your SupplierAdvisor trial ends tomorrow'
              : `Your SupplierAdvisor trial ends in ${days} days`
            : days === 1
              ? 'Your SupplierAdvisor subscription renews/ends tomorrow'
              : `Subscription ends in ${days} days — renew to keep access`,
        html:
          kind === 'trial'
            ? trialEmailHtml({
                name,
                days,
                href: `${base}/dashboard/my-business/billing`,
              })
            : expiryEmailHtml({
                name,
                days,
                href: `${base}/dashboard/my-business/billing`,
              }),
        tags: [{ name: 'company_id', value: String(row.id) }],
      };

      try {
        await sendEmail(message);
        if (kind === 'trial') trialEmails += 1;
        else expiryEmails += 1;
      } catch (e) {
        console.warn('subscription reminder soft-fail', row.id, e);
        if (claimed?.status === 'claimed') {
          try {
            await releaseReminder(supabase, Number(row.id), claimed.previous, claimed.next, key);
          } catch (releaseError) {
            console.warn('subscription reminder release soft-fail', row.id, releaseError);
          }
        }
      }

      if (trialEmails + expiryEmails >= limit) break;
    }

    return empty({
      ok: true,
      trialEmails,
      expiryEmails,
      scanned,
      candidates: loaded.rows.length,
      error: !hasMetaColumn
        ? 'subscription_reminder_meta missing — emails sent without de-dupe flags'
        : claimErrors
          ? `${claimErrors} reminder claims failed`
          : members.error,
    });
  } catch (e: unknown) {
    return empty({
      error: e instanceof Error ? e.message : 'reminders failed',
    });
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
