/**
 * Advisor money on the Core ledger: VAT, debit-order file, recurring drafts.
 */
import { vatFromInclusive } from '@/lib/accounting/vat';
import { memberDebitBankComplete, maskAccountNumber } from '@/lib/fitness/member-debit-bank';

export const SA_VAT_PCT = 15;

export function splitInclusiveVat(totalIncl: number, ratePct = SA_VAT_PCT) {
  return vatFromInclusive(totalIncl, ratePct);
}

export type DebitOrderLine = {
  member_id: string;
  customer_id: number | null;
  member_name: string;
  email: string | null;
  account_holder: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
  amount_zar: number;
  reference: string;
  period_end?: string | null;
  plan_name?: string;
};

export function debitReference(
  companySlug: string,
  memberCode: string,
  yyyymm: string
): string {
  const slug = String(companySlug || 'SA')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase();
  const code = String(memberCode || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-8)
    .toUpperCase();
  return `${slug}${yyyymm}${code}`.slice(0, 20);
}

export function buildDebitOrderLines(opts: {
  companySlug: string;
  period?: string;
  members: Array<{
    id: string;
    code?: string;
    name: string;
    email?: string | null;
    crm_customer_id?: number | null;
    debit_bank?: {
      account_holder: string;
      bank_name: string;
      account_number: string;
      branch_code: string;
      account_type: string;
      debit_order_authorised?: boolean;
    } | null;
    active?: boolean;
  }>;
  subscriptions: Array<{
    client_id: string;
    plan_id: string;
    status: string;
    current_period_end?: string | null;
  }>;
  plans: Array<{ id: string; name: string; price_zar: number }>;
}): DebitOrderLine[] {
  const period =
    opts.period || new Date().toISOString().slice(0, 7).replace('-', '');
  const lines: DebitOrderLine[] = [];
  for (const m of opts.members) {
    if (m.active === false) continue;
    if (!memberDebitBankComplete(m as never)) continue;
    const bank = m.debit_bank!;
    const subs = opts.subscriptions.filter(
      (s) =>
        s.client_id === m.id &&
        (s.status === 'active' || s.status === 'past_due' || s.status === 'trialing')
    );
    if (!subs.length) continue;
    let amount = 0;
    const names: string[] = [];
    let periodEnd: string | null = null;
    for (const s of subs) {
      const plan = opts.plans.find((p) => p.id === s.plan_id);
      if (!plan) continue;
      amount += Number(plan.price_zar || 0);
      names.push(plan.name);
      if (s.current_period_end) periodEnd = s.current_period_end;
    }
    if (!(amount > 0)) continue;
    lines.push({
      member_id: m.id,
      customer_id: m.crm_customer_id ?? null,
      member_name: m.name,
      email: m.email || null,
      account_holder: bank.account_holder,
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      branch_code: bank.branch_code,
      account_type: bank.account_type,
      amount_zar: Math.round(amount * 100) / 100,
      reference: debitReference(opts.companySlug, m.code || m.id, period),
      period_end: periodEnd,
      plan_name: names.join(' + '),
    });
  }
  return lines;
}

export function debitOrderCsv(lines: DebitOrderLine[], actionDate: string): string {
  const header = [
    'AccountHolder',
    'BankName',
    'AccountNumber',
    'BranchCode',
    'AccountType',
    'Amount',
    'Reference',
    'ActionDate',
    'Member',
    'Plan',
  ].join(',');
  const rows = lines.map((l) =>
    [
      csv(l.account_holder),
      csv(l.bank_name),
      csv(l.account_number),
      csv(l.branch_code),
      csv(l.account_type),
      l.amount_zar.toFixed(2),
      csv(l.reference),
      csv(actionDate),
      csv(l.member_name),
      csv(l.plan_name || ''),
    ].join(',')
  );
  return [header, ...rows].join('\n') + '\n';
}

function csv(v: string): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function matchDebitToBankLine(
  bankRef: string,
  lines: DebitOrderLine[]
): DebitOrderLine | null {
  const ref = String(bankRef || '')
    .replace(/\s/g, '')
    .toUpperCase();
  if (!ref) return null;
  return (
    lines.find((l) => ref.includes(String(l.reference).toUpperCase())) || null
  );
}

export type RecurringInvoiceDraft = {
  customer_id: number | null;
  member_id: string;
  member_name: string;
  member_email: string | null;
  amount_incl: number;
  exclusive: number;
  vat: number;
  description: string;
  period_key: string;
  already_invoiced: boolean;
};

export function recurringInvoiceDrafts(opts: {
  members: Array<{
    id: string;
    name: string;
    email?: string | null;
    crm_customer_id?: number | null;
  }>;
  subscriptions: Array<{
    client_id: string;
    plan_id: string;
    status: string;
    current_period_end?: string | null;
  }>;
  plans: Array<{ id: string; name: string; price_zar: number }>;
  existingInvoiceNotes?: string[];
  periodKey?: string;
}): RecurringInvoiceDraft[] {
  const period =
    opts.periodKey || new Date().toISOString().slice(0, 7);
  const notes = (opts.existingInvoiceNotes || []).join('\n').toLowerCase();
  const drafts: RecurringInvoiceDraft[] = [];
  for (const m of opts.members) {
    const subs = opts.subscriptions.filter(
      (s) => s.client_id === m.id && s.status === 'active'
    );
    if (!subs.length) continue;
    let amount = 0;
    const names: string[] = [];
    for (const s of subs) {
      const plan = opts.plans.find((p) => p.id === s.plan_id);
      if (!plan) continue;
      amount += Number(plan.price_zar || 0);
      names.push(plan.name);
    }
    if (!(amount > 0)) continue;
    const vat = splitInclusiveVat(amount);
    const periodTag = `period:${period}:member:${m.id}`.toLowerCase();
    drafts.push({
      customer_id: m.crm_customer_id ?? null,
      member_id: m.id,
      member_name: m.name,
      member_email: m.email || null,
      amount_incl: vat.inclusive,
      exclusive: vat.exclusive,
      vat: vat.vat,
      description: `${names.join(' + ')} · ${period}`,
      period_key: periodTag,
      already_invoiced: notes.includes(periodTag),
    });
  }
  return drafts;
}

export function publicDebitLine(line: DebitOrderLine): Omit<DebitOrderLine, 'account_number'> & {
  account_number: string;
} {
  return { ...line, account_number: maskAccountNumber(line.account_number) };
}
