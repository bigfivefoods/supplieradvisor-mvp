/**
 * Weekly (or on-demand) AR aging digest for finance contacts.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getResend, getResendFrom } from '@/lib/resend';

const OPEN = ['sent', 'partial', 'overdue', 'unpaid', 'issued', 'viewed'] as const;

export type ArDigestInvoice = {
  id: number;
  invoice_number?: string | null;
  customer_name?: string | null;
  status?: string | null;
  currency?: string | null;
  due_date?: string | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  promise_to_pay_date?: string | null;
  balance: number;
  daysPastDue: number;
};

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

function daysPast(due: string | null | undefined, today: string): number {
  if (!due) return 0;
  const d = String(due).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 0;
  const ms =
    new Date(today + 'T12:00:00Z').getTime() -
    new Date(d + 'T12:00:00Z').getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function bucketKey(days: number): string {
  if (days <= 0) return 'current';
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90_plus';
}

export async function loadOpenArForCompany(
  profileId: number,
  limit = 200
): Promise<{
  invoices: ArDigestInvoice[];
  openTotal: number;
  overdueCount: number;
  partialCount: number;
  promiseDueCount: number;
}> {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  let { data, error } = await supabase
    .from('customer_invoices')
    .select(
      'id, invoice_number, customer_name, status, currency, due_date, total_amount, amount_paid, promise_to_pay_date'
    )
    .eq('profile_id', profileId)
    .in('status', [...OPEN])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit);

  // Soft: promise column may be missing
  if (error && /promise_to_pay|column|schema cache/i.test(error.message || '')) {
    const retry = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, customer_name, status, currency, due_date, total_amount, amount_paid'
      )
      .eq('profile_id', profileId)
      .in('status', [...OPEN])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(limit);
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);

  const invoices: ArDigestInvoice[] = [];
  let openTotal = 0;
  let overdueCount = 0;
  let partialCount = 0;
  let promiseDueCount = 0;

  for (const row of data || []) {
    const total = Number(row.total_amount || 0);
    const paid = Number(row.amount_paid || 0);
    const balance = Math.max(0, total - paid);
    if (balance <= 0.009) continue;
    const dpd = daysPast(row.due_date as string | null, today);
    const st = String(row.status || '').toLowerCase();
    if (st === 'overdue' || dpd > 0) overdueCount += 1;
    if (st === 'partial') partialCount += 1;
    const ptp = (row as { promise_to_pay_date?: string | null }).promise_to_pay_date;
    if (ptp && String(ptp).slice(0, 10) <= today) promiseDueCount += 1;
    openTotal += balance;
    invoices.push({
      id: Number(row.id),
      invoice_number: row.invoice_number,
      customer_name: row.customer_name,
      status: row.status,
      currency: row.currency,
      due_date: row.due_date as string | null,
      total_amount: total,
      amount_paid: paid,
      promise_to_pay_date: ptp ? String(ptp).slice(0, 10) : null,
      balance,
      daysPastDue: dpd,
    });
  }

  return { invoices, openTotal, overdueCount, partialCount, promiseDueCount };
}

export function formatArDigestHtml(params: {
  tradingName: string;
  invoices: ArDigestInvoice[];
  openTotal: number;
  overdueCount: number;
  partialCount: number;
  promiseDueCount: number;
}): string {
  const arHref = `${appBase()}/dashboard/customers/ar`;
  const invHref = `${appBase()}/dashboard/customers/invoices?status=overdue&action=resend`;
  const byBucket: Record<string, ArDigestInvoice[]> = {
    current: [],
    d1_30: [],
    d31_60: [],
    d61_90: [],
    d90_plus: [],
  };
  for (const inv of params.invoices) {
    byBucket[bucketKey(inv.daysPastDue)].push(inv);
  }
  const labels: Record<string, string> = {
    current: 'Current (not past due)',
    d1_30: '1–30 days',
    d31_60: '31–60 days',
    d61_90: '61–90 days',
    d90_plus: '90+ days',
  };

  const sections = Object.entries(byBucket)
    .filter(([, list]) => list.length)
    .map(([key, list]) => {
      const amt = list.reduce((s, i) => s + i.balance, 0);
      const rows = list
        .slice(0, 12)
        .map((i) => {
          const ccy = (i.currency || 'ZAR').toUpperCase();
          const ptp = i.promise_to_pay_date
            ? ` · promise ${i.promise_to_pay_date}`
            : '';
          return `<li style="margin:4px 0"><strong>${
            i.invoice_number || '#' + i.id
          }</strong> — ${i.customer_name || 'Customer'} — ${ccy} ${i.balance.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )}${
            i.daysPastDue ? ` · ${i.daysPastDue}d past` : ''
          }${ptp}</li>`;
        })
        .join('');
      return `<h3 style="margin:16px 0 6px;color:#0f172a">${labels[key]} · ${
        list.length
      } · ${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3><ul style="padding-left:18px;margin:0">${rows}</ul>`;
    })
    .join('');

  return `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
      <h2 style="color:#b45309">Weekly AR digest — ${params.tradingName}</h2>
      <p>Open receivables summary for collections follow-up.</p>
      <ul>
        <li><strong>Open AR:</strong> ${params.openTotal.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}</li>
        <li><strong>Overdue invoices:</strong> ${params.overdueCount}</li>
        <li><strong>Partial payments:</strong> ${params.partialCount}</li>
        <li><strong>Promise-to-pay due/past:</strong> ${params.promiseDueCount}</li>
      </ul>
      ${sections || '<p>No open balances.</p>'}
      <p style="margin-top:20px">
        <a href="${arHref}" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Open AR aging →</a>
        &nbsp;
        <a href="${invHref}" style="color:#00b4d8">Follow up overdue →</a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:16px">SupplierAdvisor® collections digest · set promise-to-pay on invoices for reminder cron</p>
    </div>
  `;
}

export async function sendCompanyArDigest(
  profileId: number
): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  recipients?: number;
  openTotal?: number;
  invoiceCount?: number;
}> {
  const { invoices, openTotal, overdueCount, partialCount, promiseDueCount } =
    await loadOpenArForCompany(profileId);
  if (!invoices.length || openTotal <= 0) {
    return { ok: true, skipped: true, reason: 'no_open_ar', openTotal: 0 };
  }

  const { emails, tradingName } = await resolveCompanyEmails(profileId, {
    roleAllowlist: ['owner', 'admin', 'finance'],
    limit: 8,
  });
  if (!emails.length) {
    return { ok: false, reason: 'no_finance_emails', openTotal };
  }
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: 'RESEND_API_KEY not set', openTotal };
  }

  const name = tradingName || `Company #${profileId}`;
  const html = formatArDigestHtml({
    tradingName: name,
    invoices,
    openTotal,
    overdueCount,
    partialCount,
    promiseDueCount,
  });

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: emails.slice(0, 8),
    subject: `[SupplierAdvisor] Weekly AR · ${overdueCount} overdue · open ${openTotal.toLocaleString(
      undefined,
      { maximumFractionDigits: 0 }
    )} — ${name}`,
    html,
  });
  if (error) {
    return { ok: false, reason: String(error), openTotal };
  }
  return {
    ok: true,
    recipients: emails.length,
    openTotal,
    invoiceCount: invoices.length,
  };
}

/** Distinct seller profile ids with open commercial invoices */
export async function listCompaniesWithOpenAr(
  limit = 200
): Promise<number[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customer_invoices')
    .select('profile_id')
    .in('status', [...OPEN])
    .limit(Math.min(2000, Math.max(50, limit * 10)));

  if (error) throw new Error(error.message);
  const ids = new Set<number>();
  for (const row of data || []) {
    const id = Number(row.profile_id);
    if (Number.isFinite(id) && id > 0) ids.add(id);
    if (ids.size >= limit) break;
  }
  return [...ids];
}
