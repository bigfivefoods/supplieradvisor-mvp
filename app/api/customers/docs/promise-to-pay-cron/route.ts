import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * GET/POST — Remind sellers when promise-to-pay date is today or past
 * and invoice is still open (sent/partial/overdue).
 * Auth: CRON_SECRET or referral ops.
 *
 * Avoids re-spam: appends [ptp_reminded YYYY-MM-DD] to notes once per day.
 */
const OPEN = ['sent', 'partial', 'overdue', 'unpaid', 'issued', 'viewed'];

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

async function runReminders(limit = 200) {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  let { data: rows, error } = await supabase
    .from('customer_invoices')
    .select(
      'id, profile_id, status, invoice_number, customer_name, total_amount, amount_paid, currency, due_date, promise_to_pay_date, notes, contact_email'
    )
    .in('status', OPEN)
    .lte('promise_to_pay_date', today)
    .not('promise_to_pay_date', 'is', null)
    .order('promise_to_pay_date', { ascending: true })
    .limit(Math.min(500, Math.max(1, limit)));

  if (error && /promise_to_pay|column|schema cache/i.test(error.message || '')) {
    return {
      ok: false as const,
      error:
        'promise_to_pay_date column missing — run supabase/migrations/20260717_customer_invoices_promise_to_pay.sql',
      reminded: 0,
      scanned: 0,
      skipped: 0,
    };
  }
  if (error) {
    return {
      ok: false as const,
      error: error.message,
      reminded: 0,
      scanned: 0,
      skipped: 0,
    };
  }

  const list = rows || [];
  let reminded = 0;
  let skipped = 0;
  const marker = `[ptp_reminded ${today}]`;

  for (const row of list) {
    const notes = row.notes != null ? String(row.notes) : '';
    if (notes.includes(marker)) {
      skipped += 1;
      continue;
    }
    const total = Number(row.total_amount || 0);
    const paid = Number(row.amount_paid || 0);
    const balance = Math.max(0, total - paid);
    if (balance <= 0.009) {
      skipped += 1;
      continue;
    }

    const profileId = Number(row.profile_id);
    const invNum = row.invoice_number || `#${row.id}`;
    const ccy = String(row.currency || 'ZAR').toUpperCase();
    const ptp = String(row.promise_to_pay_date || '').slice(0, 10);
    const href = `${appBase()}/dashboard/customers/invoices`;

    // In-app for seller company
    void supabase.from('notifications').insert({
      profile_id: profileId,
      type: 'promise_to_pay_due',
      title: `Promise-to-pay due — ${invNum}`,
      body: `${row.customer_name || 'Customer'} promised ${ptp}. Balance ${ccy} ${balance.toLocaleString(
        undefined,
        { maximumFractionDigits: 2 }
      )}`,
      metadata: {
        invoiceId: row.id,
        promise_to_pay_date: ptp,
        href,
      },
      read: false,
    });

    // Email finance/owner
    try {
      const { emails, tradingName } = await resolveCompanyEmails(profileId, {
        roleAllowlist: ['owner', 'admin', 'finance'],
        limit: 6,
      });
      if (emails.length && process.env.RESEND_API_KEY) {
        const resend = getResend();
        await resend.emails.send({
          from: getResendFrom(),
          to: emails.slice(0, 6),
          subject: `[SupplierAdvisor] Promise-to-pay due — ${invNum} (${tradingName || 'company'})`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#b45309">Promise-to-pay reminder</h2>
              <p>Invoice <strong>${invNum}</strong> for <strong>${
                row.customer_name || 'customer'
              }</strong> had a promised pay date of <strong>${ptp}</strong>.</p>
              <p>Balance still open: <strong>${ccy} ${balance.toLocaleString(
                undefined,
                { maximumFractionDigits: 2 }
              )}</strong>.</p>
              <p>
                <a href="${href}" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Open invoices →</a>
              </p>
              <p style="font-size:12px;color:#64748b">Follow up, mark paid with payment ref, or set a new promise date.</p>
            </div>
          `,
        });
      }
    } catch (e) {
      console.warn('ptp email soft-fail', e);
    }

    const notesOut = notes ? `${notes}\n${marker}` : marker;
    await supabase
      .from('customer_invoices')
      .update({ notes: notesOut, updated_at: now })
      .eq('id', row.id);

    reminded += 1;
  }

  return {
    ok: true as const,
    reminded,
    scanned: list.length,
    skipped,
    asOf: today,
  };
}

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  const limit = Number(request.nextUrl.searchParams.get('limit') || 200);
  const result = await runReminders(limit);
  return NextResponse.json({ success: result.ok, ...result });
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
    const limit = Number(body.limit || 200);
    const result = await runReminders(limit);
    return NextResponse.json({ success: result.ok, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
