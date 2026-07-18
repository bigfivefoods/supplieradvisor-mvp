/**
 * Installment schedules — notes block (legacy) + first-class table.
 * Format (notes):
 * [installments]
 * YYYY-MM-DD|amount|paid?
 * [/installments]
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { recordArPayment, sumLedgerPaid } from '@/lib/customers/ar-ledger';

export type Installment = {
  date: string;
  amount: number;
  paid: boolean;
  index: number;
  id?: number;
  status?: string;
  amount_paid?: number;
};

export type InstallmentRow = {
  id: number;
  profile_id: number;
  invoice_id: number;
  customer_id?: number | null;
  sequence_no: number;
  due_date: string;
  amount: number;
  currency: string;
  status: string;
  amount_paid: number;
  paid_at?: string | null;
  notes?: string | null;
};

export function isMissingInstallmentsTable(
  msg: string | undefined | null
): boolean {
  return /relation|does not exist|schema cache|customer_invoice_installments/i.test(
    msg || ''
  );
}

export function parseInstallments(notes: string | null | undefined): Installment[] {
  const text = notes != null ? String(notes) : '';
  const m = text.match(/\[installments\]([\s\S]*?)\[\/installments\]/i);
  if (!m) return [];
  const lines = m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Installment[] = [];
  lines.forEach((line, index) => {
    const parts = line.split('|').map((p) => p.trim());
    const date = parts[0] || '';
    const amount = Number(String(parts[1] || '').replace(/,/g, ''));
    const paid =
      String(parts[2] || '').toLowerCase() === 'paid' ||
      String(parts[2] || '') === '1' ||
      String(parts[2] || '').toLowerCase() === 'true';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount)) return;
    out.push({ date, amount, paid, index });
  });
  return out;
}

export function writeInstallments(
  notes: string | null | undefined,
  rows: Installment[]
): string {
  let base = notes != null ? String(notes) : '';
  base = base.replace(/\[installments\][\s\S]*?\[\/installments\]/gi, '').trim();
  if (!rows.length) return base;
  const block = `[installments]\n${rows
    .map((r) => `${r.date}|${r.amount}${r.paid ? '|paid' : ''}`)
    .join('\n')}\n[/installments]`;
  return base ? `${base}\n${block}` : block;
}

export function installmentSummary(rows: Installment[]): {
  total: number;
  paid: number;
  remaining: number;
  nextDue: string | null;
} {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const paid = rows
    .filter((r) => r.paid)
    .reduce((s, r) => s + (r.amount_paid != null ? r.amount_paid : r.amount), 0);
  const unpaid = rows.filter((r) => !r.paid);
  return {
    total,
    paid,
    remaining: Math.max(0, total - paid),
    nextDue: unpaid[0]?.date || null,
  };
}

export function rowsToInstallments(rows: InstallmentRow[]): Installment[] {
  return rows.map((r, index) => ({
    id: r.id,
    date: String(r.due_date).slice(0, 10),
    amount: Number(r.amount),
    paid:
      String(r.status) === 'paid' ||
      Number(r.amount_paid || 0) >= Number(r.amount) - 0.01,
    index,
    status: r.status,
    amount_paid: Number(r.amount_paid || 0),
  }));
}

/** Load installments from table; fall back to notes. */
export async function loadInstallmentsForInvoice(
  profileId: number,
  invoiceId: number,
  notes?: string | null
): Promise<{
  rows: Installment[];
  source: 'table' | 'notes' | 'none';
  tableMissing: boolean;
}> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_invoice_installments')
      .select('*')
      .eq('profile_id', profileId)
      .eq('invoice_id', invoiceId)
      .order('sequence_no', { ascending: true });
    if (error) {
      if (isMissingInstallmentsTable(error.message)) {
        const fromNotes = parseInstallments(notes);
        return {
          rows: fromNotes,
          source: fromNotes.length ? 'notes' : 'none',
          tableMissing: true,
        };
      }
      const fromNotes = parseInstallments(notes);
      return {
        rows: fromNotes,
        source: fromNotes.length ? 'notes' : 'none',
        tableMissing: false,
      };
    }
    if (data?.length) {
      return {
        rows: rowsToInstallments(data as InstallmentRow[]),
        source: 'table',
        tableMissing: false,
      };
    }
    const fromNotes = parseInstallments(notes);
    return {
      rows: fromNotes,
      source: fromNotes.length ? 'notes' : 'none',
      tableMissing: false,
    };
  } catch {
    const fromNotes = parseInstallments(notes);
    return {
      rows: fromNotes,
      source: fromNotes.length ? 'notes' : 'none',
      tableMissing: true,
    };
  }
}

/**
 * Replace schedule for an invoice (table + notes dual-write).
 */
export async function replaceInstallmentSchedule(opts: {
  profileId: number;
  invoiceId: number;
  customerId?: number | null;
  currency?: string;
  notes?: string | null;
  schedule: Array<{ date: string; amount: number }>;
}): Promise<{
  ok: boolean;
  notes: string;
  rows: Installment[];
  tableMissing?: boolean;
  error?: string;
}> {
  const schedule = opts.schedule
    .map((s) => ({
      date: String(s.date).slice(0, 10),
      amount: Number(s.amount),
    }))
    .filter(
      (s) =>
        /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
        Number.isFinite(s.amount) &&
        s.amount > 0
    );

  const asInstallments: Installment[] = schedule.map((s, index) => ({
    date: s.date,
    amount: s.amount,
    paid: false,
    index,
  }));
  const notesOut = writeInstallments(opts.notes, asInstallments);

  try {
    const supabase = getSupabaseServer();
    // Clear existing open schedule rows
    const del = await supabase
      .from('customer_invoice_installments')
      .delete()
      .eq('profile_id', opts.profileId)
      .eq('invoice_id', opts.invoiceId)
      .in('status', ['open', 'partial']);
    if (del.error && isMissingInstallmentsTable(del.error.message)) {
      return {
        ok: true,
        notes: notesOut,
        rows: asInstallments,
        tableMissing: true,
      };
    }

    if (schedule.length) {
      const now = new Date().toISOString();
      const insertRows = schedule.map((s, i) => ({
        profile_id: opts.profileId,
        invoice_id: opts.invoiceId,
        customer_id: opts.customerId ?? null,
        sequence_no: i + 1,
        due_date: s.date,
        amount: s.amount,
        currency: opts.currency || 'ZAR',
        status: 'open',
        amount_paid: 0,
        created_at: now,
        updated_at: now,
      }));
      const { data, error } = await supabase
        .from('customer_invoice_installments')
        .insert(insertRows)
        .select('*');
      if (error) {
        if (isMissingInstallmentsTable(error.message)) {
          return {
            ok: true,
            notes: notesOut,
            rows: asInstallments,
            tableMissing: true,
          };
        }
        return {
          ok: false,
          notes: notesOut,
          rows: asInstallments,
          error: error.message,
        };
      }
      return {
        ok: true,
        notes: notesOut,
        rows: rowsToInstallments((data || []) as InstallmentRow[]),
        tableMissing: false,
      };
    }
    return { ok: true, notes: notesOut, rows: [], tableMissing: false };
  } catch (e: unknown) {
    return {
      ok: true,
      notes: notesOut,
      rows: asInstallments,
      tableMissing: true,
      error: e instanceof Error ? e.message : undefined,
    };
  }
}

/** Mark installment paid (table preferred) + optional ledger line. */
export async function markInstallmentPaid(opts: {
  profileId: number;
  invoiceId: number;
  index: number;
  paid?: boolean;
  actorUserId?: string | null;
  notes?: string | null;
  totalAmount?: number;
  amountPaid?: number;
  currency?: string;
  customerId?: number | null;
}): Promise<{
  ok: boolean;
  notes: string;
  rows: Installment[];
  amountPaid: number;
  status: string;
  error?: string;
  tableMissing?: boolean;
}> {
  const paidFlag = opts.paid !== false;
  const loaded = await loadInstallmentsForInvoice(
    opts.profileId,
    opts.invoiceId,
    opts.notes
  );
  let rows = [...loaded.rows];
  if (!rows.length) {
    return {
      ok: false,
      notes: opts.notes || '',
      rows: [],
      amountPaid: Number(opts.amountPaid || 0),
      status: 'sent',
      error: 'No installments on this invoice',
    };
  }
  if (opts.index < 0 || opts.index >= rows.length) {
    return {
      ok: false,
      notes: opts.notes || '',
      rows,
      amountPaid: Number(opts.amountPaid || 0),
      status: 'sent',
      error: 'Invalid installment index',
    };
  }

  const target = rows[opts.index];
  const wasPaid = target.paid;
  rows[opts.index] = { ...target, paid: paidFlag };
  const notesOut = writeInstallments(opts.notes, rows);
  const sum = installmentSummary(rows);
  let amountPaid = Number(opts.amountPaid || 0);
  if (paidFlag && !wasPaid) {
    amountPaid = Math.max(amountPaid, sum.paid);
  } else if (!paidFlag && wasPaid) {
    amountPaid = Math.max(0, amountPaid - Number(target.amount));
  }
  const total = Number(opts.totalAmount || 0);
  const fullyPaid = total > 0 && amountPaid >= total - 0.01;
  const nextStatus = fullyPaid
    ? 'paid'
    : amountPaid > 0
      ? 'partial'
      : 'sent';

  // Update table row
  if (target.id && !loaded.tableMissing) {
    try {
      const supabase = getSupabaseServer();
      const now = new Date().toISOString();
      await supabase
        .from('customer_invoice_installments')
        .update({
          status: paidFlag ? 'paid' : 'open',
          amount_paid: paidFlag ? Number(target.amount) : 0,
          paid_at: paidFlag ? now : null,
          updated_at: now,
        })
        .eq('id', target.id)
        .eq('profile_id', opts.profileId);
    } catch {
      /* soft */
    }
  } else if (!loaded.tableMissing && loaded.source === 'notes' && paidFlag) {
    // Promote notes schedule into table when paying
    await replaceInstallmentSchedule({
      profileId: opts.profileId,
      invoiceId: opts.invoiceId,
      customerId: opts.customerId,
      currency: opts.currency,
      notes: notesOut,
      schedule: rows.map((r) => ({ date: r.date, amount: r.amount })),
    });
    // Re-mark paid on promoted rows
    const reloaded = await loadInstallmentsForInvoice(
      opts.profileId,
      opts.invoiceId,
      notesOut
    );
    if (reloaded.rows[opts.index]?.id) {
      const supabase = getSupabaseServer();
      const now = new Date().toISOString();
      await supabase
        .from('customer_invoice_installments')
        .update({
          status: 'paid',
          amount_paid: reloaded.rows[opts.index].amount,
          paid_at: now,
          updated_at: now,
        })
        .eq('id', reloaded.rows[opts.index].id!)
        .eq('profile_id', opts.profileId);
      rows = reloaded.rows.map((r, i) =>
        i === opts.index ? { ...r, paid: true } : r
      );
    }
  }

  // Ledger line when newly marking paid
  if (paidFlag && !wasPaid && Number(target.amount) > 0) {
    try {
      await recordArPayment({
        profile_id: opts.profileId,
        invoice_id: opts.invoiceId,
        customer_id: opts.customerId ?? null,
        amount: Number(target.amount),
        currency: opts.currency || 'ZAR',
        paid_at: new Date().toISOString(),
        method: 'installment',
        reference: `installment-${opts.index + 1}`,
        notes: `Installment ${opts.index + 1} due ${target.date}`,
        created_by: opts.actorUserId || null,
      });
      const sumLed = await sumLedgerPaid(opts.profileId, opts.invoiceId);
      if (sumLed.total != null && !sumLed.tableMissing) {
        amountPaid = sumLed.total;
      }
    } catch {
      /* soft */
    }
  }

  return {
    ok: true,
    notes: notesOut,
    rows,
    amountPaid,
    status: fullyPaid
      ? 'paid'
      : amountPaid > 0
        ? 'partial'
        : nextStatus,
    tableMissing: loaded.tableMissing,
  };
}
