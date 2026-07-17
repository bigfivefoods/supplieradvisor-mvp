/**
 * Daily / weekly ops reports: who signed up + registration funnel metrics.
 * Soft-fail email to connect@supplieradvisor.com (same override as live notify).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom } from '@/lib/resend';

export type ReportPeriod = 'daily' | 'weekly';

type ProfileRow = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  country?: string | null;
  city?: string | null;
  industry?: string | null;
  business_type?: string | null;
  website?: string | null;
  created_at?: string | null;
  claimed_at?: string | null;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  subscription_trial_ends_at?: string | null;
  referred_by_profile_id?: number | null;
  referral_source?: string | null;
  is_discoverable?: boolean | null;
  verification_status?: string | null;
  logo_url?: string | null;
  vat_number?: string | null;
  registration_number?: string | null;
  short_description?: string | null;
  deleted_at?: string | null;
};

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

function opsRecipients(): string[] {
  const toRaw =
    process.env.NEW_COMPANY_NOTIFY_EMAIL ||
    process.env.PLATFORM_OPS_EMAIL ||
    'connect@supplieradvisor.com';
  return toRaw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Window: daily = previous UTC calendar day; weekly = last 7 full UTC days ending yesterday. */
export function reportWindow(
  period: ReportPeriod,
  now = new Date()
): {
  from: string;
  to: string;
  label: string;
} {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  );
  // exclusive end = start of today UTC → window ends end of yesterday
  const toExclusive = end.toISOString();
  if (period === 'daily') {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 1);
    return {
      from: start.toISOString(),
      to: toExclusive,
      label: isoDay(start),
    };
  }
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return {
    from: start.toISOString(),
    to: toExclusive,
    label: `${isoDay(start)} → ${isoDay(new Date(end.getTime() - 86400000))}`,
  };
}

function countBy(
  rows: ProfileRow[],
  key: (r: ProfileRow) => string
): Array<{ key: string; n: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || '—';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .map(([k, n]) => ({ key: k, n }))
    .sort((a, b) => b.n - a.n);
}

export type RegistrationReportResult = {
  ok: boolean;
  period: ReportPeriod;
  from: string;
  to: string;
  label: string;
  signups: number;
  emailsSent: number;
  metrics: Record<string, number | string>;
  error?: string;
};

/**
 * Build metrics + company list for the window and email ops.
 */
export async function sendRegistrationReport(opts: {
  period: ReportPeriod;
  dryRun?: boolean;
  /** Override window (ISO) for manual pulls */
  from?: string;
  to?: string;
}): Promise<RegistrationReportResult> {
  const period = opts.period;
  const win =
    opts.from && opts.to
      ? {
          from: opts.from,
          to: opts.to,
          label: `${opts.from.slice(0, 10)} → ${opts.to.slice(0, 10)}`,
        }
      : reportWindow(period);

  const empty = (error?: string): RegistrationReportResult => ({
    ok: !error,
    period,
    from: win.from,
    to: win.to,
    label: win.label,
    signups: 0,
    emailsSent: 0,
    metrics: {},
    error,
  });

  try {
    const supabase = getSupabaseServer();

    let { data: raw, error } = await supabase
      .from('profiles')
      .select(
        `
        id, trading_name, legal_name, email, contact_name, contact_phone,
        country, city, industry, business_type, website, created_at, claimed_at,
        subscription_status, subscription_plan, subscription_trial_ends_at,
        referred_by_profile_id, referral_source, is_discoverable,
        verification_status, logo_url, vat_number, registration_number,
        short_description, deleted_at
      `
      )
      .gte('created_at', win.from)
      .lt('created_at', win.to)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const retry = await supabase
        .from('profiles')
        .select(
          `id, trading_name, legal_name, email, contact_name, country, city,
           industry, business_type, website, created_at, subscription_status`
        )
        .gte('created_at', win.from)
        .lt('created_at', win.to)
        .order('created_at', { ascending: false })
        .limit(500);
      raw = retry.data as typeof raw;
      error = retry.error;
    }

    if (error) {
      return empty(error.message);
    }

    const rows = ((raw || []) as ProfileRow[]).filter((r) => !r.deleted_at);

    let waitlistCount = 0;
    try {
      const { count } = await supabase
        .from('founding_waitlist')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', win.from)
        .lt('created_at', win.to);
      waitlistCount = count ?? 0;
    } catch {
      /* table optional */
    }

    let ownersCreated = 0;
    try {
      const { count } = await supabase
        .from('business_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .gte('created_at', win.from)
        .lt('created_at', win.to);
      ownersCreated = count ?? 0;
    } catch {
      /* soft */
    }

    let onboardingRows: Array<{
      profile_id?: number;
      steps?: Record<string, boolean> | null;
      completed_at?: string | null;
    }> = [];
    if (rows.length) {
      try {
        const ids = rows.map((r) => r.id);
        const { data: op } = await supabase
          .from('company_onboarding_progress')
          .select('profile_id, steps, completed_at')
          .in('profile_id', ids);
        onboardingRows = (op || []) as typeof onboardingRows;
      } catch {
        /* soft */
      }
    }

    const byCountry = countBy(rows, (r) => String(r.country || 'Unknown'));
    const byIndustry = countBy(rows, (r) =>
      String(r.industry || 'Unspecified')
    );
    const byType = countBy(rows, (r) => String(r.business_type || 'business'));
    const bySub = countBy(rows, (r) =>
      String(r.subscription_status || 'unknown')
    );

    const referred = rows.filter(
      (r) => Number(r.referred_by_profile_id) > 0
    ).length;
    const withPhone = rows.filter((r) =>
      Boolean(String(r.contact_phone || '').trim())
    ).length;
    const withEmail = rows.filter((r) =>
      Boolean(String(r.email || '').includes('@'))
    ).length;
    const discoverable = rows.filter((r) => r.is_discoverable !== false).length;
    const withLogo = rows.filter((r) => Boolean(r.logo_url)).length;
    const withReg = rows.filter((r) =>
      Boolean(String(r.registration_number || '').trim())
    ).length;
    const withVat = rows.filter((r) =>
      Boolean(String(r.vat_number || '').trim())
    ).length;
    const verified = rows.filter((r) =>
      ['verified', 'approved'].includes(
        String(r.verification_status || '').toLowerCase()
      )
    ).length;
    const lifetime = rows.filter(
      (r) => String(r.subscription_status || '').toLowerCase() === 'lifetime'
    ).length;
    const trial = rows.filter(
      (r) => String(r.subscription_status || '').toLowerCase() === 'trial'
    ).length;

    const stepHits: Record<string, number> = {};
    let anyOnboarding = 0;
    let fullyDone = 0;
    for (const op of onboardingRows) {
      const steps = op.steps && typeof op.steps === 'object' ? op.steps : null;
      if (!steps) continue;
      anyOnboarding += 1;
      if (op.completed_at) fullyDone += 1;
      for (const [k, v] of Object.entries(steps)) {
        if (v) stepHits[k] = (stepHits[k] || 0) + 1;
      }
    }

    const metrics: Record<string, number | string> = {
      signups: rows.length,
      waitlist_signups: waitlistCount,
      owner_memberships_created: ownersCreated,
      referred,
      referral_rate_pct:
        rows.length > 0 ? Math.round((referred / rows.length) * 100) : 0,
      with_email: withEmail,
      with_phone: withPhone,
      discoverable,
      with_logo: withLogo,
      with_reg_number: withReg,
      with_vat: withVat,
      verified,
      lifetime,
      trial,
      onboarding_rows: anyOnboarding,
      onboarding_completed: fullyDone,
    };

    const topCountries = byCountry
      .slice(0, 8)
      .map((x) => `${x.key} (${x.n})`)
      .join(', ');
    const topIndustries = byIndustry
      .slice(0, 8)
      .map((x) => `${x.key} (${x.n})`)
      .join(', ');

    const companyRowsHtml = rows.length
      ? rows
          .map((r) => {
            const name = escapeHtml(
              r.trading_name || r.legal_name || `#${r.id}`
            );
            const when = r.created_at
              ? new Date(r.created_at)
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ')
              : '—';
            const loc = escapeHtml(
              [r.city, r.country].filter(Boolean).join(', ') || '—'
            );
            const access = escapeHtml(r.subscription_status || '—');
            const ref = r.referred_by_profile_id
              ? `#${r.referred_by_profile_id}`
              : '—';
            return `<tr>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${when} UTC</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0"><a href="${appBase()}/c/${r.id}" style="color:#0077b6;font-weight:600">${name}</a> <span style="color:#94a3b8">#${r.id}</span></td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(r.email || '—')}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${loc}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(r.industry || '—')}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${access}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${ref}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="7" style="padding:16px;color:#64748b">No new company registrations in this window.</td></tr>`;

    const stepLines = Object.entries(stepHits)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}: ${n}`)
      .join(' · ');

    const metricCards = [
      ['Signups', String(rows.length)],
      ['Waitlist', String(waitlistCount)],
      ['Referred', `${referred} (${metrics.referral_rate_pct}%)`],
      ['Trial / Lifetime', `${trial} / ${lifetime}`],
      ['Phone on file', String(withPhone)],
      ['Logo / VAT / Reg', `${withLogo} / ${withVat} / ${withReg}`],
      ['Onboarding tracked', String(anyOnboarding)],
      ['Onboarding done', String(fullyDone)],
    ]
      .map(
        ([label, val]) => `
        <td style="padding:10px 12px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;min-width:100px">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em">${label}</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:2px">${val}</div>
        </td>`
      )
      .join('');

    const title =
      period === 'daily'
        ? `Daily registration report — ${win.label}`
        : `Weekly registration report — ${win.label}`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;color:#0f172a">
        <h2 style="color:#0077b6;margin-bottom:4px">${escapeHtml(title)}</h2>
        <p style="color:#64748b;margin-top:0;font-size:13px">
          Window (UTC): <code>${escapeHtml(win.from)}</code> → <code>${escapeHtml(win.to)}</code>
          · ${rows.length} compan${rows.length === 1 ? 'y' : 'ies'}
        </p>

        <table style="width:100%;border-collapse:separate;border-spacing:6px;margin:12px 0">
          <tr>${metricCards}</tr>
        </table>

        <h3 style="font-size:14px;margin:20px 0 8px">Funnel notes</h3>
        <ul style="font-size:13px;color:#334155;line-height:1.5;padding-left:18px">
          <li><strong>Countries:</strong> ${escapeHtml(topCountries || '—')}</li>
          <li><strong>Industries:</strong> ${escapeHtml(topIndustries || '—')}</li>
          <li><strong>Business types:</strong> ${escapeHtml(
            byType.map((x) => `${x.key} (${x.n})`).join(', ') || '—'
          )}</li>
          <li><strong>Subscription mix:</strong> ${escapeHtml(
            bySub.map((x) => `${x.key} (${x.n})`).join(', ') || '—'
          )}</li>
          <li><strong>Discoverable:</strong> ${discoverable}/${rows.length}
            · <strong>Verified:</strong> ${verified}/${rows.length}
            · <strong>Owner links created:</strong> ${ownersCreated}</li>
          ${
            stepLines
              ? `<li><strong>Golden-path steps hit:</strong> ${escapeHtml(stepLines)}</li>`
              : '<li><strong>Golden-path steps:</strong> no onboarding progress rows yet for this cohort</li>'
          }
        </ul>

        <h3 style="font-size:14px;margin:20px 0 8px">Who signed up</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#e0f7fc;text-align:left">
              <th style="padding:8px">When</th>
              <th style="padding:8px">Company</th>
              <th style="padding:8px">Email</th>
              <th style="padding:8px">Location</th>
              <th style="padding:8px">Industry</th>
              <th style="padding:8px">Access</th>
              <th style="padding:8px">Ref</th>
            </tr>
          </thead>
          <tbody>${companyRowsHtml}</tbody>
        </table>

        <p style="font-size:12px;color:#94a3b8;margin-top:24px">
          Live alerts fire on each signup to this inbox.
          Manual: <code>GET /api/onboarding/registration-report/cron?period=${period}</code>
          with <code>Authorization: Bearer $CRON_SECRET</code>.
        </p>
      </div>
    `;

    if (opts.dryRun) {
      return {
        ok: true,
        period,
        from: win.from,
        to: win.to,
        label: win.label,
        signups: rows.length,
        emailsSent: 0,
        metrics,
        error: 'dryRun — email not sent',
      };
    }

    const to = opsRecipients();
    if (!to.length) {
      return empty('No ops recipients');
    }
    if (!process.env.RESEND_API_KEY) {
      return {
        ok: true,
        period,
        from: win.from,
        to: win.to,
        label: win.label,
        signups: rows.length,
        emailsSent: 0,
        metrics,
        error: 'RESEND_API_KEY not set — skipped send',
      };
    }

    const resend = getResend();
    const { error: sendErr } = await resend.emails.send({
      from: getResendFrom(),
      to: to.slice(0, 10),
      subject: `[SupplierAdvisor] ${title} (${rows.length} signup${
        rows.length === 1 ? '' : 's'
      })`,
      html,
    });

    if (sendErr) {
      return {
        ok: false,
        period,
        from: win.from,
        to: win.to,
        label: win.label,
        signups: rows.length,
        emailsSent: 0,
        metrics,
        error: String(sendErr),
      };
    }

    return {
      ok: true,
      period,
      from: win.from,
      to: win.to,
      label: win.label,
      signups: rows.length,
      emailsSent: 1,
      metrics,
    };
  } catch (e: unknown) {
    return empty(e instanceof Error ? e.message : 'report failed');
  }
}
