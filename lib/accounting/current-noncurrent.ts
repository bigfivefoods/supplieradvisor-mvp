/**
 * IAS 1 current vs non-current — due date more than 12 months after period end.
 * Missing due_date stays current. Not a full maturity waterfall.
 */
import { round2 } from '@/lib/accounting/server';

export function twelveMonthsAfter(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').slice(0, 10));
  if (!m) return String(iso || '').slice(0, 10);
  const y = Number(m[1]) + 1;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const last = new Date(Date.UTC(y, month, 0)).getUTCDate();
  return `${y}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

export function isNonCurrentDue(
  dueDate: string | null | undefined,
  periodEnd: string
): boolean {
  const due = String(dueDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due > twelveMonthsAfter(periodEnd);
}

const CLOSED = new Set(['paid', 'void', 'cancelled', 'canceled', 'draft']);

export function invoiceOpenAmount(inv: {
  total_amount?: number | null;
  amount_paid?: number | null;
  status?: string | null;
}): number {
  if (CLOSED.has(String(inv.status || '').toLowerCase())) return 0;
  return round2(
    Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0))
  );
}

export function nonCurrentOpenTotals(
  invoices: Array<{
    direction?: string | null;
    due_date?: string | null;
    total_amount?: number | null;
    amount_paid?: number | null;
    status?: string | null;
  }>,
  periodEnd: string
): { ar: number; ap: number } {
  let ar = 0;
  let ap = 0;
  for (const inv of invoices) {
    if (!isNonCurrentDue(inv.due_date, periodEnd)) continue;
    const open = invoiceOpenAmount(inv);
    if (open < 0.005) continue;
    if (String(inv.direction || '') === 'payable') ap = round2(ap + open);
    else ar = round2(ar + open);
  }
  return { ar, ap };
}

/** Cap the non-current split so it cannot exceed the GL face amount. */
export function splitCurrentNonCurrent(
  faceAmount: number,
  nonCurrentOpen: number
): { current: number; nonCurrent: number } {
  const face = round2(Number(faceAmount) || 0);
  const want = round2(Math.max(0, Number(nonCurrentOpen) || 0));
  if (face <= 0.005 || want < 0.005) {
    return { current: face, nonCurrent: 0 };
  }
  const nc = round2(Math.min(want, face));
  return { current: round2(face - nc), nonCurrent: nc };
}
