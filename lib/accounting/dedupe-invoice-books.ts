/**
 * Find and reverse duplicate invoice books:
 *  - two posted invoice_recognition journals for the same invoice
 *  - a bank allocation coded to income for an invoice that is already recognised
 *
 * Keep the journal stamped on the invoice (or the earliest). Cash that was
 * booked as a second sale is reversed, then settled against AR.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  reversePostedJournal,
  resolveCoaAccountIdByCode,
} from '@/lib/accounting/post-journal';
import { unallocateBankTransaction } from '@/lib/accounting/allocate';
import { round2 } from '@/lib/accounting/server';

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export function isLivePosted(j: {
  status?: string | null;
  metadata?: unknown;
}): boolean {
  return (
    String(j.status || '') === 'posted' &&
    !asMeta(j.metadata).reversed_by_journal_id
  );
}

export function extraPostedJournalsForSource(opts: {
  source: string;
  stampField: string;
  journals: Array<{
    id: number;
    source?: string | null;
    source_id?: string | null;
    status?: string | null;
    metadata?: unknown;
  }>;
  invoices: Array<{ id: number; metadata?: unknown }>;
}): number[] {
  const keepByInvoice = new Map<number, number>();
  for (const inv of opts.invoices) {
    const stamped = Number(asMeta(inv.metadata)[opts.stampField]);
    if (stamped > 0) keepByInvoice.set(Number(inv.id), stamped);
  }
  const reversed = new Set<number>();
  for (const j of opts.journals) {
    const rid = Number(asMeta(j.metadata).reverses_journal_id || 0);
    if (String(j.source || '') === 'reversal' && rid > 0) reversed.add(rid);
  }
  const groups = new Map<number, number[]>();
  for (const j of opts.journals) {
    if (String(j.source || '') !== opts.source || !isLivePosted(j)) {
      continue;
    }
    if (reversed.has(Number(j.id))) continue;
    const meta = asMeta(j.metadata);
    const invId = Number(j.source_id || meta.invoice_id);
    if (!Number.isFinite(invId) || invId <= 0) continue;
    const list = groups.get(invId) || [];
    list.push(Number(j.id));
    groups.set(invId, list);
  }
  const reverse: number[] = [];
  for (const [invId, ids] of groups) {
    const uniq = [...new Set(ids)].sort((a, b) => a - b);
    if (uniq.length < 2) continue;
    const stamped = keepByInvoice.get(invId);
    const keeper = stamped && uniq.includes(stamped) ? stamped : uniq[0];
    for (const id of uniq) if (id !== keeper) reverse.push(id);
  }
  return reverse;
}

export function extraRecognitionJournalIds(opts: {
  journals: Array<{
    id: number;
    source?: string | null;
    source_id?: string | null;
    status?: string | null;
    metadata?: unknown;
  }>;
  invoices: Array<{ id: number; metadata?: unknown }>;
}): number[] {
  return extraPostedJournalsForSource({
    ...opts,
    source: 'invoice_recognition',
    stampField: 'recognition_journal_id',
  });
}

export function extraCogsJournalIds(opts: {
  journals: Array<{
    id: number;
    source?: string | null;
    source_id?: string | null;
    status?: string | null;
    metadata?: unknown;
  }>;
  invoices: Array<{ id: number; metadata?: unknown }>;
}): number[] {
  return extraPostedJournalsForSource({
    ...opts,
    source: 'invoice_cogs',
    stampField: 'cogs_journal_id',
  });
}

export function bankIncomeMatchesInvoice(opts: {
  memo: string;
  amount: number;
  date: string;
  invoice: {
    invoice_number?: string | null;
    total_amount?: number | null;
    issue_date?: string | null;
  };
}): boolean {
  const memo = String(opts.memo || '').toUpperCase();
  const num = String(opts.invoice.invoice_number || '')
    .trim()
    .toUpperCase();
  if (num && memo.includes(num)) return true;
  const token = memo.match(/INV[-A-Z0-9]+/);
  if (token && num.startsWith(token[0]) && token[0].length >= 10) return true;
  const amt = Math.abs(Number(opts.amount) || 0);
  const tot = Math.abs(Number(opts.invoice.total_amount) || 0);
  if (amt < 0.02 || tot < 0.02 || Math.abs(amt - tot) > 0.02) return false;
  const d = String(opts.invoice.issue_date || '').slice(0, 10);
  return Boolean(d && d === String(opts.date || '').slice(0, 10));
}

export type DedupeAction = {
  kind: 'reverse_recognition' | 'reverse_cogs' | 'unallocate_bank_income' | 'settle_ar';
  journalId?: number;
  invoiceId?: number;
  invoiceNumber?: string | null;
  bankTxnId?: string;
  amount?: number;
  memo?: string;
};

export type DedupeReport = {
  profileId: number;
  actions: DedupeAction[];
  applied: boolean;
  results: string[];
  errors: string[];
};

async function allRows(
  table: string,
  select: string,
  profileId: number
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseServer();
  const page = 1000;
  let from = 0;
  const out: Record<string, unknown>[] = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('profile_id', profileId)
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return out;
}

export async function planInvoiceDedupe(
  profileId: number
): Promise<DedupeAction[]> {
  const invoices = await allRows(
    'invoices',
    'id, invoice_number, status, direction, total_amount, tax_amount, amount_paid, issue_date, metadata',
    profileId
  );
  const journals = await allRows(
    'journal_entries',
    'id, entry_number, entry_date, memo, status, source, source_id, metadata',
    profileId
  );
  const journalLite = journals.map((j) => ({
    id: Number(j.id),
    source: j.source != null ? String(j.source) : null,
    source_id: j.source_id != null ? String(j.source_id) : null,
    status: j.status != null ? String(j.status) : null,
    metadata: j.metadata,
  }));
  const invoiceLite = invoices.map((i) => ({
    id: Number(i.id),
    metadata: i.metadata,
  }));
  const recExtra = extraRecognitionJournalIds({
    journals: journalLite,
    invoices: invoiceLite,
  });
  const cogsExtra = extraCogsJournalIds({
    journals: journalLite,
    invoices: invoiceLite,
  });
  const invById = new Map(invoices.map((i) => [Number(i.id), i]));
  const actions: DedupeAction[] = [];
  for (const jid of recExtra) {
    const je = journals.find((j) => Number(j.id) === jid);
    const invId = Number(
      je?.source_id || asMeta(je?.metadata).invoice_id
    );
    const inv = invById.get(invId);
    actions.push({
      kind: 'reverse_recognition',
      journalId: jid,
      invoiceId: invId,
      invoiceNumber: inv?.invoice_number != null ? String(inv.invoice_number) : null,
      memo: je?.memo != null ? String(je.memo) : undefined,
    });
  }
  for (const jid of cogsExtra) {
    const je = journals.find((j) => Number(j.id) === jid);
    const invId = Number(
      je?.source_id || asMeta(je?.metadata).invoice_id
    );
    const inv = invById.get(invId);
    actions.push({
      kind: 'reverse_cogs',
      journalId: jid,
      invoiceId: invId,
      invoiceNumber: inv?.invoice_number != null ? String(inv.invoice_number) : null,
      memo: je?.memo != null ? String(je.memo) : undefined,
    });
  }

  const supabase = getSupabaseServer();
  const { data: accts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, account_type')
    .eq('profile_id', profileId);
  const revenueIds = new Set(
    (accts || [])
      .filter((a) => String(a.account_type) === 'revenue')
      .map((a) => Number(a.id))
  );
  const reversedIds = new Set<number>();
  for (const j of journals) {
    const rid = Number(asMeta(j.metadata).reverses_journal_id || 0);
    if (String(j.source) === 'reversal' && rid > 0) reversedIds.add(rid);
  }
  const bankAlloc = journals.filter(
    (j) =>
      String(j.source) === 'bank_allocation' &&
      isLivePosted(j as { status?: string; metadata?: unknown }) &&
      !reversedIds.has(Number(j.id))
  );
  const bankIds = bankAlloc.map((j) => Number(j.id));
  const revByJournal = new Map<number, number>();
  for (let i = 0; i < bankIds.length; i += 200) {
    const chunk = bankIds.slice(i, i + 200);
    if (!chunk.length) break;
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('journal_entry_id, account_id, debit, credit')
      .in('journal_entry_id', chunk);
    for (const l of lines || []) {
      if (!revenueIds.has(Number(l.account_id))) continue;
      const amt = round2(Number(l.credit || 0) - Number(l.debit || 0));
      if (amt <= 0.02) continue;
      revByJournal.set(
        Number(l.journal_entry_id),
        round2((revByJournal.get(Number(l.journal_entry_id)) || 0) + amt)
      );
    }
  }

  const issued = invoices.filter((i) => {
    const st = String(i.status || '').toLowerCase();
    return !['draft', 'void', 'cancelled', 'canceled'].includes(st);
  });

  const seenTxn = new Set<string>();
  for (const je of bankAlloc) {
    const jid = Number(je.id);
    const income = revByJournal.get(jid);
    if (!income) continue;
    const memo = String(je.memo || '');
    const date = String(je.entry_date || '');
    const hit = issued.find((inv) =>
      bankIncomeMatchesInvoice({
        memo,
        amount: income,
        date,
        invoice: {
          invoice_number: inv.invoice_number != null ? String(inv.invoice_number) : null,
          total_amount: Number(inv.total_amount || 0),
          issue_date: inv.issue_date != null ? String(inv.issue_date) : null,
        },
      })
    );
    if (!hit) continue;
    const meta = asMeta(je.metadata);
    const txnId = String(meta.bank_transaction_id || je.source_id || '');
    if (!txnId || seenTxn.has(txnId)) continue;
    seenTxn.add(txnId);
    actions.push({
      kind: 'unallocate_bank_income',
      journalId: jid,
      invoiceId: Number(hit.id),
      invoiceNumber: hit.invoice_number != null ? String(hit.invoice_number) : null,
      bankTxnId: txnId,
      amount: income,
      memo,
    });
    const paid = round2(Number(hit.amount_paid || 0));
    const total = round2(Number(hit.total_amount || 0));
    if (paid + 0.02 >= total || String(hit.status).toLowerCase() === 'paid') {
      actions.push({
        kind: 'settle_ar',
        invoiceId: Number(hit.id),
        invoiceNumber: hit.invoice_number != null ? String(hit.invoice_number) : null,
        bankTxnId: txnId,
        amount: round2(Number(hit.total_amount || income)),
      });
    }
  }

  return actions;
}

export async function applyInvoiceDedupe(opts: {
  profileId: number;
  createdBy?: string | null;
  apply?: boolean;
}): Promise<DedupeReport> {
  const actions = await planInvoiceDedupe(opts.profileId);
  const report: DedupeReport = {
    profileId: opts.profileId,
    actions,
    applied: Boolean(opts.apply),
    results: [],
    errors: [],
  };
  if (!opts.apply) {
    report.results.push(
      actions.length
        ? `Would apply ${actions.length} correction(s)`
        : 'No duplicate invoice books found'
    );
    return report;
  }

  const supabase = getSupabaseServer();
  for (const a of actions) {
    try {
      if (
        (a.kind === 'reverse_recognition' || a.kind === 'reverse_cogs') &&
        a.journalId
      ) {
        const label = a.kind === 'reverse_cogs' ? 'COGS' : 'recognition';
        const r = await reversePostedJournal({
          profileId: opts.profileId,
          journalId: a.journalId,
          createdBy: opts.createdBy,
          memo: `Reverse duplicate invoice ${label} ${a.invoiceNumber || a.invoiceId}`,
          metadata: {
            invoice_id: a.invoiceId,
            invoice_number: a.invoiceNumber,
            dedupe: true,
            invoice_cogs: a.kind === 'reverse_cogs',
          },
        });
        if (!r.ok) {
          report.errors.push(`${a.invoiceNumber}: ${r.error}`);
          continue;
        }
        report.results.push(
          `Reversed duplicate ${label} ${a.invoiceNumber} (JE ${a.journalId})`
        );
      } else if (a.kind === 'unallocate_bank_income' && a.bankTxnId) {
        const r = await unallocateBankTransaction({
          profileId: opts.profileId,
          bankTxnId: a.bankTxnId,
          privyUserId: opts.createdBy,
        });
        if (!r.ok) {
          report.errors.push(
            `${a.invoiceNumber} bank: ${r.error}`
          );
          continue;
        }
        report.results.push(
          `Unallocated bank income for ${a.invoiceNumber} (was JE ${a.journalId})`
        );
      } else if (a.kind === 'settle_ar' && a.invoiceId && a.amount) {
        const { data: inv } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', a.invoiceId)
          .eq('profile_id', opts.profileId)
          .maybeSingle();
        if (!inv) {
          report.errors.push(`Invoice ${a.invoiceId} missing for settlement`);
          continue;
        }
        const ar =
          (await resolveCoaAccountIdByCode(opts.profileId, '1130')) ||
          (await resolveCoaAccountIdByCode(opts.profileId, '1100'));
        const bank = await resolveCoaAccountIdByCode(opts.profileId, '1110');
        if (!ar || !bank) {
          report.errors.push('COA missing AR 1130 or bank 1110');
          continue;
        }
        const meta = asMeta(inv.metadata);
        const posted = await postBalancedJournal({
          profileId: opts.profileId,
          entryDate: new Date().toISOString().slice(0, 10),
          memo: `Settle AR ${inv.invoice_number || inv.id} (receipt was coded to income)`,
          source: 'invoice_settlement',
          sourceId: `dedupe:${inv.id}`,
          createdBy: opts.createdBy || null,
          metadata: {
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            bank_transaction_id: a.bankTxnId,
            dedupe: true,
          },
          lines: [
            {
              accountId: bank,
              debit: a.amount,
              credit: 0,
              memo: `Settle ${inv.invoice_number}`,
            },
            {
              accountId: ar,
              debit: 0,
              credit: a.amount,
              memo: `Settle ${inv.invoice_number}`,
              counterparty:
                inv.counterparty_name != null ? String(inv.counterparty_name) : null,
            },
          ],
        });
        if (!posted.ok) {
          report.errors.push(`${inv.invoice_number}: ${posted.error}`);
          continue;
        }
        const prior = Array.isArray(meta.settlement_journal_ids)
          ? (meta.settlement_journal_ids as unknown[])
          : [];
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            metadata: {
              ...meta,
              settlement_journal_ids: [
                ...prior,
                { journal_id: posted.journalId, bank_transaction_id: a.bankTxnId },
              ],
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', inv.id)
          .eq('profile_id', opts.profileId);
        if (invErr && /updated_at/i.test(invErr.message)) {
          await supabase
            .from('invoices')
            .update({
              metadata: {
                ...meta,
                settlement_journal_ids: [
                  ...prior,
                  { journal_id: posted.journalId, bank_transaction_id: a.bankTxnId },
                ],
              },
            })
            .eq('id', inv.id)
            .eq('profile_id', opts.profileId);
        }
        if (a.bankTxnId) {
          await supabase
            .from('bank_transactions')
            .update({
              allocation_status: 'matched_invoice',
              matched_invoice_id: inv.id,
              matched_journal_id: posted.journalId,
              status: 'reconciled',
              allocated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', a.bankTxnId)
            .eq('profile_id', opts.profileId);
        }
        report.results.push(
          `Settled AR ${inv.invoice_number} ${a.amount} (JE ${posted.journalId})`
        );
      }
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : 'Failed');
    }
  }
  return report;
}
