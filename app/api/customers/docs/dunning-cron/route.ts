import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * Daily dunning ladder for overdue commercial invoices.
 * Days past due: 1 (gentle), 7 (firm), 14 (final).
 * Marks notes with [dunning dayN YYYY-MM-DD] to avoid re-send same day/level.
 */
const LADDER = [
  { day: 1, label: 'gentle', subject: 'Friendly reminder' },
  { day: 7, label: 'firm', subject: 'Payment overdue' },
  { day: 14, label: 'final', subject: 'Final notice — account overdue' },
] as const;

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

function daysPastDue(due: string | null | undefined, today: string): number {
  if (!due) return 0;
  const d = String(due).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 0;
  const ms =
    new Date(today + 'T12:00:00Z').getTime() -
    new Date(d + 'T12:00:00Z').getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

async function runDunning(limit = 80) {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('customer_invoices')
    .select(
      'id, profile_id, invoice_number, customer_name, contact_email, total_amount, amount_paid, currency, due_date, status, notes'
    )
    .in('status', ['overdue', 'sent', 'partial', 'viewed'])
    .not('due_date', 'is', null)
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(Math.min(300, Math.max(1, limit * 3)));

  if (error) {
    return { ok: false as const, error: error.message, sent: 0, scanned: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const inv of rows || []) {
    if (sent >= limit) break;
    const balance = Math.max(
      0,
      Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
    );
    if (balance <= 0.009) {
      skipped += 1;
      continue;
    }
    const dpd = daysPastDue(inv.due_date as string, today);
    // Pick highest ladder step reached
    let step: (typeof LADDER)[number] = LADDER[0];
    for (const s of LADDER) {
      if (dpd >= s.day) step = s;
    }
    const markerPrefix = `[dunning day${step.day}`;
    const notes = inv.notes != null ? String(inv.notes) : '';
    // Already sent this ladder level — skip (higher levels fire when day threshold rises)
    if (notes.includes(markerPrefix)) {
      skipped += 1;
      continue;
    }

    const toCustomer = String(inv.contact_email || '').trim();
    const profileId = Number(inv.profile_id);
    const invNum = inv.invoice_number || `#${inv.id}`;
    const ccy = String(inv.currency || 'ZAR').toUpperCase();
    const { emails: sellerEmails, tradingName } = await resolveCompanyEmails(
      profileId,
      { roleAllowlist: ['owner', 'admin', 'finance'], limit: 4 }
    );

    const recipients: string[] = [];
    if (toCustomer.includes('@')) recipients.push(toCustomer.toLowerCase());
    // Always BCC-style copy to seller finance via separate send if no customer email
    if (!recipients.length && sellerEmails.length) {
      recipients.push(...sellerEmails.slice(0, 2));
    }

    if (!recipients.length || !process.env.RESEND_API_KEY) {
      skipped += 1;
      results.push({ id: inv.id, skipped: true, reason: 'no_email' });
      continue;
    }

    const seller = tradingName || 'Your supplier';
    const tone =
      step.label === 'gentle'
        ? `This is a friendly reminder that invoice <strong>${invNum}</strong> is ${dpd} day(s) past due.`
        : step.label === 'firm'
          ? `Invoice <strong>${invNum}</strong> is now <strong>${dpd} days overdue</strong>. Please arrange payment urgently.`
          : `Final notice: invoice <strong>${invNum}</strong> is <strong>${dpd} days overdue</strong>. Account may be placed on hold.`;

    try {
      const resend = getResend();
      await resend.emails.send({
        from: getResendFrom(),
        to: recipients.slice(0, 4),
        subject: `[SupplierAdvisor] ${step.subject}: ${invNum} · ${ccy} ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#b45309">${step.subject}</h2>
            <p>${tone}</p>
            <p>Customer: <strong>${inv.customer_name || 'Account'}</strong><br/>
            Balance: <strong>${ccy} ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><br/>
            Due: ${String(inv.due_date).slice(0, 10)}</p>
            <p>From: <strong>${seller}</strong></p>
            <p style="font-size:12px;color:#64748b">Dunning step day ${step.day} · ${appBase()}</p>
          </div>
        `,
      });

      const line = `${markerPrefix} ${today}] to=${recipients[0]}`;
      const notesOut = notes ? `${notes}\n${line}` : line;
      await supabase
        .from('customer_invoices')
        .update({ notes: notesOut, updated_at: now })
        .eq('id', inv.id);

      void supabase.from('activity_log').insert({
        profile_id: profileId,
        action: 'invoice.dunning',
        entity_type: 'customer_invoices',
        entity_id: String(inv.id),
        summary: `Dunning day${step.day} for ${invNum}`,
        metadata: {
          invoiceId: inv.id,
          day: step.day,
          label: step.label,
          to: recipients[0],
          balance,
        },
      });

      // In-app for seller
      void supabase.from('notifications').insert({
        profile_id: profileId,
        type: 'invoice_dunning',
        title: `Dunning day ${step.day}: ${invNum}`,
        body: `${inv.customer_name || 'Customer'} · ${ccy} ${balance.toLocaleString()}`,
        metadata: {
          invoiceId: inv.id,
          href: '/dashboard/customers/invoices?status=overdue',
        },
        read: false,
      });

      sent += 1;
      results.push({ id: inv.id, day: step.day, to: recipients[0] });
    } catch (e) {
      results.push({
        id: inv.id,
        error: e instanceof Error ? e.message : 'send failed',
      });
    }
  }

  return {
    ok: true as const,
    sent,
    skipped,
    scanned: (rows || []).length,
    asOf: today,
    results: results.slice(0, 40),
  };
}

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  const limit = Number(request.nextUrl.searchParams.get('limit') || 80);
  const result = await runDunning(limit);
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
    const result = await runDunning(Number(body.limit || 80));
    return NextResponse.json({ success: result.ok, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
