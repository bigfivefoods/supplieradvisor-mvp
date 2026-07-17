import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import {
  listCompaniesWithOpenAr,
  loadOpenArForCompany,
} from '@/lib/customers/ar-digest';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * GET/POST monthly statement digest — summary email of open AR by customer.
 * Full PDF statements remain on-demand via /api/customers/ar-statement.
 * Schedule: 1st of month 07:15 UTC (vercel.json).
 */
function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

async function runMonthly(opts: { limit: number; dryRun: boolean }) {
  const profileIds = await listCompaniesWithOpenAr(opts.limit);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const profileId of profileIds) {
    try {
      const { invoices, openTotal, overdueCount } =
        await loadOpenArForCompany(profileId, 300);
      if (!invoices.length || openTotal <= 0) {
        skipped += 1;
        continue;
      }

      // Roll up by customer name
      const byCust = new Map<
        string,
        { name: string; balance: number; count: number; broken: number }
      >();
      const today = new Date().toISOString().slice(0, 10);
      for (const inv of invoices) {
        const name = inv.customer_name || 'Customer';
        const key = name.toLowerCase();
        const cur = byCust.get(key) || {
          name,
          balance: 0,
          count: 0,
          broken: 0,
        };
        cur.balance += inv.balance;
        cur.count += 1;
        if (
          inv.promise_to_pay_date &&
          String(inv.promise_to_pay_date).slice(0, 10) < today
        ) {
          cur.broken += 1;
        }
        byCust.set(key, cur);
      }
      const top = [...byCust.values()]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 15);

      if (opts.dryRun) {
        results.push({ profileId, dryRun: true, openTotal, customers: top.length });
        continue;
      }

      const { emails, tradingName } = await resolveCompanyEmails(profileId, {
        roleAllowlist: ['owner', 'admin', 'finance'],
        limit: 8,
      });
      if (!emails.length || !process.env.RESEND_API_KEY) {
        skipped += 1;
        results.push({ profileId, skipped: true, reason: 'no_email' });
        continue;
      }

      const name = tradingName || `Company #${profileId}`;
      const rows = top
        .map(
          (c) =>
            `<li><strong>${c.name}</strong> — ${c.count} inv · ${c.balance.toLocaleString(
              undefined,
              { maximumFractionDigits: 0 }
            )}${c.broken ? ` · <span style="color:#9f1239">${c.broken} broken promise</span>` : ''}</li>`
        )
        .join('');

      const resend = getResend();
      const { error } = await resend.emails.send({
        from: getResendFrom(),
        to: emails.slice(0, 8),
        subject: `[SupplierAdvisor] Monthly AR statement · open ${openTotal.toLocaleString(
          undefined,
          { maximumFractionDigits: 0 }
        )} — ${name}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto">
            <h2 style="color:#0f172a">Monthly AR statement</h2>
            <p><strong>${name}</strong> — open receivables by customer.</p>
            <ul>
              <li>Open AR: <strong>${openTotal.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}</strong></li>
              <li>Overdue invoices: <strong>${overdueCount}</strong></li>
            </ul>
            <h3>Top customers</h3>
            <ul>${rows}</ul>
            <p>
              <a href="${appBase()}/dashboard/customers/ar" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Open AR aging →</a>
            </p>
            <p style="font-size:12px;color:#64748b">Download per-customer PDF statements from AR rollup in the app.</p>
          </div>
        `,
      });
      if (error) {
        failed += 1;
        results.push({ profileId, ok: false, reason: String(error) });
      } else {
        sent += 1;
        results.push({ profileId, ok: true, openTotal });
      }
    } catch (e: unknown) {
      failed += 1;
      results.push({
        profileId,
        ok: false,
        reason: e instanceof Error ? e.message : 'error',
      });
    }
  }

  return {
    ok: true,
    companies: profileIds.length,
    sent,
    skipped,
    failed,
    dryRun: opts.dryRun,
    results: results.slice(0, 40),
    at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  const limit = Number(request.nextUrl.searchParams.get('limit') || 100);
  const dryRun = ['1', 'true', 'yes'].includes(
    String(request.nextUrl.searchParams.get('dryRun') || '').toLowerCase()
  );
  try {
    return NextResponse.json(await runMonthly({ limit, dryRun }));
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cron = assertCronSecret(request);
    if (!cron.ok) {
      const ops = await requireReferralOps(request, {
        legacyPrivyUserId: legacyPrivyFrom(request, body) || null,
      });
      if (!ops.ok) return ops.response;
    }
    return NextResponse.json(
      await runMonthly({
        limit: Number(body.limit || 100),
        dryRun: Boolean(body.dryRun),
      })
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
