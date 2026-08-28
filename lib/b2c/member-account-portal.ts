/**
 * Advisor invoices on a patient / member portal payload.
 */
import {
  chargesForMember,
  paymentsForMember,
  readMemberAccountStore,
} from '@/lib/b2c/member-account';
import type { AdvisorAccountKind } from '@/lib/b2c/member-account-types';
import { formatZar } from '@/lib/b2c/member-account-types';

export type PortalInvoice = {
  id: string;
  description: string;
  amount_zar: number;
  status: string;
  invoice_number?: string | null;
  due_date?: string | null;
  created_at: string;
};

export type PortalAccountPayment = {
  id: string;
  amount_zar: number;
  method: string;
  status: string;
  paid_at: string;
  reference?: string | null;
};

export type PortalStatement = {
  key: string;
  label: string;
  charges: PortalInvoice[];
  payments: PortalAccountPayment[];
  billed_zar: number;
  paid_zar: number;
  open_zar: number;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function statementMonthKey(iso: string | null | undefined): string {
  const s = String(iso || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : '';
}

export function statementMonthLabel(key: string): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const name = MONTHS[m - 1];
  if (!name || !y) return key;
  return `${name} ${y}`;
}

function toPortalInvoice(c: {
  id: string;
  description: string;
  amount_zar: number;
  status: string;
  invoice_number?: string | null;
  due_date?: string | null;
  created_at: string;
}): PortalInvoice {
  return {
    id: c.id,
    description: c.description,
    amount_zar: c.amount_zar,
    status: c.status,
    invoice_number: c.invoice_number || null,
    due_date: c.due_date || null,
    created_at: c.created_at,
  };
}

export function portalInvoicesForPerson(
  meta: Record<string, unknown>,
  opts: {
    kind: AdvisorAccountKind;
    refId: string;
    email?: string | null;
    userId?: string | null;
  }
): PortalInvoice[] {
  return chargesForMember(readMemberAccountStore(meta), {
    kind: opts.kind,
    ref_id: opts.refId,
    email: opts.email,
    userId: opts.userId,
  })
    .filter((c) => c.status !== 'void')
    .map(toPortalInvoice);
}

export function groupPortalStatements(opts: {
  charges: PortalInvoice[];
  payments: PortalAccountPayment[];
}): PortalStatement[] {
  const buckets = new Map<
    string,
    { charges: PortalInvoice[]; payments: PortalAccountPayment[] }
  >();
  const bucket = (key: string) => {
    const k = key || 'undated';
    const cur = buckets.get(k) || { charges: [], payments: [] };
    buckets.set(k, cur);
    return cur;
  };
  for (const c of opts.charges) {
    bucket(statementMonthKey(c.due_date || c.created_at)).charges.push(c);
  }
  for (const p of opts.payments) {
    bucket(statementMonthKey(p.paid_at)).payments.push(p);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, v]) => {
      const billed = v.charges.reduce((n, c) => n + (Number(c.amount_zar) || 0), 0);
      const paid = v.payments
        .filter((p) => p.status === 'confirmed' || p.status === 'paid')
        .reduce((n, p) => n + (Number(p.amount_zar) || 0), 0);
      const open = v.charges
        .filter((c) => c.status === 'open' || c.status === 'pending_pop')
        .reduce((n, c) => n + (Number(c.amount_zar) || 0), 0);
      return {
        key,
        label: key === 'undated' ? 'Other' : statementMonthLabel(key),
        charges: v.charges,
        payments: v.payments,
        billed_zar: billed,
        paid_zar: paid,
        open_zar: open,
      };
    });
}

export function portalAccountHistory(
  meta: Record<string, unknown>,
  opts: {
    kind: AdvisorAccountKind;
    refId: string;
    email?: string | null;
    userId?: string | null;
  }
): {
  invoices: PortalInvoice[];
  payments: PortalAccountPayment[];
  statements: PortalStatement[];
  open_zar: number;
} {
  const store = readMemberAccountStore(meta);
  const match = {
    kind: opts.kind,
    ref_id: opts.refId,
    email: opts.email,
    userId: opts.userId,
  };
  const invoices = chargesForMember(store, match)
    .filter((c) => c.status !== 'void')
    .map(toPortalInvoice);
  const payments = paymentsForMember(store, match).map((p) => ({
    id: p.id,
    amount_zar: p.amount_zar,
    method: p.method,
    status: p.status,
    paid_at: p.paid_at,
    reference: p.reference || null,
  }));
  const statements = groupPortalStatements({ charges: invoices, payments });
  const open_zar = invoices
    .filter((c) => c.status === 'open' || c.status === 'pending_pop')
    .reduce((n, c) => n + (Number(c.amount_zar) || 0), 0);
  return { invoices, payments, statements, open_zar };
}

export function withPortalInvoices<T extends object>(
  portal: T,
  meta: Record<string, unknown>,
  opts: {
    kind: AdvisorAccountKind;
    refId: string;
    email?: string | null;
    userId?: string | null;
  }
): T & { invoices: PortalInvoice[] } {
  return {
    ...portal,
    invoices: portalInvoicesForPerson(meta, opts),
  };
}

export { formatZar };
