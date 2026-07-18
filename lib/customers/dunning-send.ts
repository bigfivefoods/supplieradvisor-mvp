/**
 * Shared dunning email send for cron + manual send-now.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getResend, getResendFrom } from '@/lib/resend';

export const DUNNING_LADDER = [
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

export function daysPastDue(due: string | null | undefined, today: string): number {
  if (!due) return 0;
  const d = String(due).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 0;
  const ms =
    new Date(today + 'T12:00:00Z').getTime() -
    new Date(d + 'T12:00:00Z').getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function pickDunningStep(dpd: number): (typeof DUNNING_LADDER)[number] {
  let step: (typeof DUNNING_LADDER)[number] = DUNNING_LADDER[0];
  for (const s of DUNNING_LADDER) {
    if (dpd >= s.day) step = s;
  }
  return step;
}

export async function sendDunningForInvoice(opts: {
  invoiceId: number;
  companyId?: number;
  force?: boolean;
  skipLevel?: boolean;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  day?: number;
  to?: string;
}> {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data: inv, error } = await supabase
    .from('customer_invoices')
    .select(
      'id, profile_id, invoice_number, customer_name, contact_email, total_amount, amount_paid, currency, due_date, status, notes'
    )
    .eq('id', opts.invoiceId)
    .maybeSingle();

  if (error || !inv) {
    return { ok: false, reason: error?.message || 'not_found' };
  }
  if (
    opts.companyId &&
    Number(inv.profile_id) !== Number(opts.companyId)
  ) {
    return { ok: false, reason: 'forbidden' };
  }

  // Prefer ledger-aware open balance (partials / claims / installments)
  let balance = Math.max(
    0,
    Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
  );
  try {
    const { invoiceOpenBalance } = await import(
      '@/lib/customers/open-balance'
    );
    const b = await invoiceOpenBalance(Number(inv.profile_id), {
      id: Number(inv.id),
      total_amount: inv.total_amount as number,
      amount_paid: inv.amount_paid as number,
      status: inv.status as string,
    });
    balance = b.balance;
  } catch {
    /* soft */
  }
  if (balance <= 0.009) return { ok: true, skipped: true, reason: 'paid' };

  // Soft: if installments exist and next open installment is not yet due, skip ladder
  try {
    const { loadInstallmentsForInvoice } = await import(
      '@/lib/customers/installments'
    );
    const inst = await loadInstallmentsForInvoice(
      Number(inv.profile_id),
      Number(inv.id),
      inv.notes as string
    );
    const openInst = inst.rows.filter((r) => !r.paid);
    if (openInst.length) {
      const next = openInst[0];
      if (next.date && next.date > today) {
        return {
          ok: true,
          skipped: true,
          reason: 'installment_not_due',
          day: 0,
        };
      }
      // Overdue installment: ensure dunning uses invoice balance (already set)
    }
  } catch {
    /* soft */
  }

  const dpd = daysPastDue(inv.due_date as string, today);
  const step = pickDunningStep(Math.max(dpd, 1));
  let notes = inv.notes != null ? String(inv.notes) : '';

  if (opts.skipLevel) {
    const markerPrefix = `[dunning day${step.day}`;
    if (!notes.includes(markerPrefix)) {
      const line = `${markerPrefix} ${today}] skipped`;
      notes = notes ? `${notes}\n${line}` : line;
      await supabase
        .from('customer_invoices')
        .update({ notes, updated_at: now })
        .eq('id', inv.id);
    }
    return { ok: true, skipped: true, reason: 'manual_skip', day: step.day };
  }

  if (/\[dunning paused/i.test(notes) && !opts.force) {
    return { ok: true, skipped: true, reason: 'paused' };
  }
  const markerPrefix = `[dunning day${step.day}`;
  if (notes.includes(markerPrefix) && !opts.force) {
    return { ok: true, skipped: true, reason: 'already_sent', day: step.day };
  }

  const toCustomer = String(inv.contact_email || '').trim();
  const profileId = Number(inv.profile_id);
  const invNum = inv.invoice_number || `#${inv.id}`;

  // Soft: mention overdue installment if schedule is past due
  let installmentNote = '';
  try {
    const { loadInstallmentsForInvoice } = await import(
      '@/lib/customers/installments'
    );
    const inst = await loadInstallmentsForInvoice(
      profileId,
      Number(inv.id),
      inv.notes as string
    );
    const overdueInst = inst.rows.filter(
      (r) => !r.paid && r.date && r.date <= today
    );
    if (overdueInst.length) {
      installmentNote = ` An installment of ${overdueInst[0].amount} was due ${overdueInst[0].date}.`;
    }
  } catch {
    /* soft */
  }
  const ccy = String(inv.currency || 'ZAR').toUpperCase();
  const { emails: sellerEmails, tradingName } = await resolveCompanyEmails(
    profileId,
    { roleAllowlist: ['owner', 'admin', 'finance'], limit: 4 }
  );
  const recipients: string[] = [];
  if (toCustomer.includes('@')) recipients.push(toCustomer.toLowerCase());
  if (!recipients.length && sellerEmails.length) {
    recipients.push(...sellerEmails.slice(0, 2));
  }
  if (!recipients.length || !process.env.RESEND_API_KEY) {
    return { ok: false, reason: 'no_email' };
  }

  const seller = tradingName || 'Your supplier';
  const tone =
    step.label === 'gentle'
      ? `This is a friendly reminder that invoice <strong>${invNum}</strong> is ${dpd || step.day} day(s) past due.`
      : step.label === 'firm'
        ? `Invoice <strong>${invNum}</strong> is now <strong>${dpd || step.day} days overdue</strong>. Please arrange payment urgently.`
        : `Final notice: invoice <strong>${invNum}</strong> is <strong>${dpd || step.day} days overdue</strong>. Account may be placed on hold.`;

  const resend = getResend();
  await resend.emails.send({
    from: getResendFrom(),
    to: recipients.slice(0, 4),
    subject: `[SupplierAdvisor] ${step.subject}: ${invNum} · ${ccy} ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#b45309">${step.subject}</h2>
        <p>${tone}${installmentNote}</p>
        <p>Customer: <strong>${inv.customer_name || 'Account'}</strong><br/>
        Balance: <strong>${ccy} ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><br/>
        Due: ${String(inv.due_date).slice(0, 10)}</p>
        <p>From: <strong>${seller}</strong></p>
        <p style="font-size:12px;color:#64748b">Dunning step day ${step.day} · ${appBase()}</p>
      </div>
    `,
  });

  const line = `${markerPrefix} ${today}] to=${recipients[0]}${opts.force ? ' force' : ''}`;
  notes = notes ? `${notes}\n${line}` : line;
  await supabase
    .from('customer_invoices')
    .update({ notes, updated_at: now })
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
      force: Boolean(opts.force),
    },
  });

  return { ok: true, day: step.day, to: recipients[0] };
}
