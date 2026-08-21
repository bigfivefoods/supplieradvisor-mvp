/**
 * Dual-write CRM customer_invoices onto Finance invoices and post
 * Dr AR · Cr Sales · Cr VAT when the invoice is issued (not draft).
 *
 * Cash later is settlement (Dr bank · Cr AR) — not a second sale.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  isIssuedInvoiceStatus,
  recognizeInvoiceIfNeeded,
  reverseInvoiceBooks,
} from '@/lib/accounting/invoice-gl';
import { round2 } from '@/lib/accounting/server';

const CRM_ISSUED = new Set([
  'sent',
  'partial',
  'paid',
  'overdue',
  'issued',
  'viewed',
  'unpaid',
]);

const CRM_VOID = new Set(['void', 'cancelled', 'canceled']);

export function crmInvoiceIsIssued(status: string | null | undefined): boolean {
  return CRM_ISSUED.has(String(status || '').toLowerCase());
}

export function crmInvoiceIsVoid(status: string | null | undefined): boolean {
  return CRM_VOID.has(String(status || '').toLowerCase());
}

/** Map CRM status onto the Finance invoices status set. */
export function financeStatusFromCrm(status: string | null | undefined): string {
  const s = String(status || '').toLowerCase();
  if (s === 'partial') return 'partial';
  if (s === 'paid') return 'paid';
  if (s === 'overdue') return 'overdue';
  if (CRM_VOID.has(s)) return 'void';
  if (CRM_ISSUED.has(s)) return 'sent';
  return 'draft';
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

async function stampCrmFinanceId(
  crmId: number,
  profileId: number,
  prev: Record<string, unknown>,
  financeInvoiceId: number
) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('customer_invoices')
    .update({
      metadata: { ...prev, finance_invoice_id: financeInvoiceId },
      updated_at: new Date().toISOString(),
    })
    .eq('id', crmId)
    .eq('profile_id', profileId);
  if (error && /column|schema cache|metadata/i.test(error.message || '')) {
    /* CRM metadata optional — match by invoice_number */
  }
}

async function insertFinanceTolerant(
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  let row = { ...payload };
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from('invoices')
      .insert(row)
      .select('*')
      .maybeSingle();
    if (!error && data) return data as Record<string, unknown>;
    const msg = error?.message || '';
    const m =
      /'([^']+)' column/i.exec(msg) ||
      /column ["']?([a-z0-9_]+)["']?/i.exec(msg);
    if (
      m?.[1] &&
      row[m[1]] !== undefined &&
      /column|schema cache|does not exist|could not find/i.test(msg)
    ) {
      delete row[m[1]];
      continue;
    }
    console.warn('[crm-invoice-gl] finance insert', msg);
    return null;
  }
  return null;
}

async function findFinanceTwin(
  profileId: number,
  crm: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  const meta = asMeta(crm.metadata);
  const stamped = Number(meta.finance_invoice_id || 0);
  if (stamped > 0) {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', stamped)
      .eq('profile_id', profileId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  const number = String(crm.invoice_number || '').trim();
  if (!number) return null;
  // limit(1) — maybeSingle() errors when two finance twins already exist,
  // which used to insert a third invoice and post sales twice.
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .eq('profile_id', profileId)
    .eq('invoice_number', number)
    .eq('direction', 'receivable')
    .order('id', { ascending: true })
    .limit(1);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as Record<string, unknown>) || null;
}

export async function syncCrmInvoiceToBooks(opts: {
  profileId: number;
  crmInvoice: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<{
  ok: boolean;
  financeInvoiceId?: number;
  journalId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const crm = opts.crmInvoice;
  const crmId = Number(crm.id);
  if (!Number.isFinite(crmId) || crmId <= 0) {
    return { ok: true, skipped: true };
  }

  const financeStatus = financeStatusFromCrm(String(crm.status || ''));
  let twin = await findFinanceTwin(opts.profileId, crm);

  if (crmInvoiceIsVoid(String(crm.status || ''))) {
    if (!twin) return { ok: true, skipped: true };
    const rev = await reverseInvoiceBooks({
      profileId: opts.profileId,
      invoice: twin,
      createdBy: opts.createdBy,
    });
    if (!rev.ok) return { ok: false, error: rev.error };
    const supabase = getSupabaseServer();
    await supabase
      .from('invoices')
      .update({ status: 'void', updated_at: new Date().toISOString() })
      .eq('id', Number(twin.id))
      .eq('profile_id', opts.profileId);
    return { ok: true, financeInvoiceId: Number(twin.id), skipped: true };
  }

  if (!isIssuedInvoiceStatus(financeStatus) && !crmInvoiceIsIssued(String(crm.status || ''))) {
    return { ok: true, skipped: true };
  }

  const total = round2(Number(crm.total_amount || 0));
  if (total < 0.005) return { ok: true, skipped: true };

  const issueDate =
    String(crm.issue_date || crm.created_at || new Date().toISOString()).slice(
      0,
      10
    ) || new Date().toISOString().slice(0, 10);

  if (!twin) {
    twin = await insertFinanceTolerant({
      profile_id: opts.profileId,
      direction: 'receivable',
      customer_id: crm.customer_id ? Number(crm.customer_id) : null,
      counterparty_name: crm.customer_name || null,
      invoice_number: crm.invoice_number || `CRM-${crmId}`,
      status: financeStatus,
      issue_date: issueDate,
      due_date: crm.due_date || null,
      currency: crm.currency || 'ZAR',
      subtotal: Number(crm.subtotal || 0),
      tax_rate: Number(crm.tax_rate ?? 15),
      tax_amount: Number(crm.tax_amount || 0),
      total_amount: total,
      amount_paid: Number(crm.amount_paid || 0),
      notes: crm.notes || null,
      items: Array.isArray(crm.items) ? crm.items : [],
      bill_to_email: crm.contact_email || null,
      billing_address: crm.billing_address || null,
      order_id: crm.order_id ? Number(crm.order_id) : null,
      metadata: {
        crm_invoice_id: crmId,
        crm_invoice_number: crm.invoice_number || null,
      },
    });
    if (!twin) {
      return { ok: false, error: 'Could not create Finance invoice twin' };
    }
  } else {
    const supabase = getSupabaseServer();
    const prevTotal = round2(Number(twin.total_amount || 0));
    const prevTax = round2(Number(twin.tax_amount || 0));
    const totalsChanged =
      Math.abs(prevTotal - total) > 0.005 ||
      Math.abs(prevTax - round2(Number(crm.tax_amount || 0))) > 0.005;
    const alreadyOnBooks = Boolean(asMeta(twin.metadata).recognition_journal_id);
    if (alreadyOnBooks && totalsChanged) {
      const rev = await reverseInvoiceBooks({
        profileId: opts.profileId,
        invoice: twin,
        createdBy: opts.createdBy,
      });
      if (!rev.ok) return { ok: false, error: rev.error };
      const meta = asMeta(twin.metadata);
      delete meta.recognition_journal_id;
      twin.metadata = meta;
    }
    const { data: patched } = await supabase
      .from('invoices')
      .update({
        status: financeStatus,
        counterparty_name: crm.customer_name || twin.counterparty_name,
        issue_date: issueDate,
        due_date: crm.due_date ?? twin.due_date,
        subtotal: Number(crm.subtotal || twin.subtotal || 0),
        tax_amount: Number(crm.tax_amount || 0),
        total_amount: total,
        amount_paid: Number(crm.amount_paid || 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', Number(twin.id))
      .eq('profile_id', opts.profileId)
      .select('*')
      .maybeSingle();
    if (patched) twin = patched as Record<string, unknown>;
    else twin.status = financeStatus;
  }

  const gl = await recognizeInvoiceIfNeeded({
    profileId: opts.profileId,
    invoice: twin,
    createdBy: opts.createdBy,
  });
  if (!gl.ok) return { ok: false, error: gl.error, financeInvoiceId: Number(twin.id) };

  await stampCrmFinanceId(
    crmId,
    opts.profileId,
    asMeta(crm.metadata),
    Number(twin.id)
  );

  return {
    ok: true,
    financeInvoiceId: Number(twin.id),
    journalId: gl.journalId,
    skipped: gl.skipped,
  };
}

/** Recognize issued CRM invoices that are not yet on the books (period backfill). */
export async function recognizeIssuedCrmInvoices(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
  limit?: number;
}): Promise<{ recognized: number; skipped: number; errors: string[] }> {
  const supabase = getSupabaseServer();
  const limit = Math.min(Math.max(opts.limit ?? 80, 1), 200);
  const { data, error } = await supabase
    .from('customer_invoices')
    .select('*')
    .eq('profile_id', opts.profileId)
    .in('status', [...CRM_ISSUED])
    .order('id', { ascending: false })
    .limit(limit);
  if (error) {
    return { recognized: 0, skipped: 0, errors: [error.message] };
  }

  const from = opts.from ? String(opts.from).slice(0, 10) : '';
  const to = opts.to ? String(opts.to).slice(0, 10) : '';
  let recognized = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of data || []) {
    const d = String(row.issue_date || row.created_at || '').slice(0, 10);
    if (from && d && d < from) continue;
    if (to && d && d > to) continue;
    const r = await syncCrmInvoiceToBooks({
      profileId: opts.profileId,
      crmInvoice: row as Record<string, unknown>,
    });
    if (!r.ok && r.error) {
      errors.push(
        `${row.invoice_number || row.id}: ${r.error}`.slice(0, 200)
      );
    } else if (r.skipped) {
      skipped += 1;
    } else if (r.journalId) {
      recognized += 1;
    } else {
      skipped += 1;
    }
  }

  return { recognized, skipped, errors };
}
