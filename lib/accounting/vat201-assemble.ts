/**
 * Turn posted journals, invoices and payments into VAT documents.
 * Cash on the payment basis comes from settlement journals, then payment
 * rows, then a single paid_at date. Invoice-date VAT journals are not
 * treated as cash.
 */
import { resolveVatCategory } from '@/lib/accounting/vat';
import {
  accountIsVatControl,
  type TaxInvoiceFacts,
  type VatCashEvent,
  type VatDocument,
  type VatSupplyKind,
} from '@/lib/accounting/vat201-model';

export type AssembleJournal = {
  id: number;
  entry_date: string;
  source?: string | null;
  source_id?: string | null;
  metadata?: unknown;
};

export type AssembleLine = {
  journal_entry_id: number;
  account_id: number;
  debit?: number | null;
  credit?: number | null;
  memo?: string | null;
};

export type AssembleAccount = {
  id: number;
  code: string;
  name: string;
  account_type?: string | null;
  subtype?: string | null;
};

export type AssembleInvoice = {
  id: number;
  direction?: string | null;
  status?: string | null;
  issue_date?: string | null;
  invoice_number?: string | null;
  counterparty_name?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  tax_code?: string | null;
  tax_rate?: number | null;
  amount_paid?: number | null;
  paid_at?: string | null;
  metadata?: unknown;
  items?: unknown;
  billing_address?: string | null;
  supplier_vat_number?: string | null;
  customer_vat_number?: string | null;
};

export type AssemblePayment = {
  invoice_id?: number | null;
  amount?: number | null;
  paid_at?: string | null;
  status?: string | null;
};

export type AssembleCompany = {
  tradingName: string;
  vatNumber: string;
  address: string;
};

const SKIP_STATUS = new Set(['draft', 'void', 'cancelled', 'canceled']);

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function day(value: unknown): string {
  return String(value || '').slice(0, 10);
}

function invoiceIdOf(journal: AssembleJournal): number | null {
  const meta = asMeta(journal.metadata);
  const fromMeta = Number(meta.invoice_id || 0);
  if (fromMeta > 0) return fromMeta;
  const fromSource = Number(journal.source_id || 0);
  return fromSource > 0 ? fromSource : null;
}

function reversed(journal: AssembleJournal): boolean {
  return Boolean(asMeta(journal.metadata).reversed_by_journal_id);
}

export function assembleVatDocuments(input: {
  company: AssembleCompany;
  invoices: AssembleInvoice[];
  journals: AssembleJournal[];
  lines: AssembleLine[];
  payments: AssemblePayment[];
  accounts: AssembleAccount[];
}): VatDocument[] {
  const accounts = new Map(input.accounts.map((account) => [Number(account.id), account]));
  const linesByJournal = new Map<number, AssembleLine[]>();
  for (const line of input.lines) {
    const id = Number(line.journal_entry_id);
    const list = linesByJournal.get(id) || [];
    list.push(line);
    linesByJournal.set(id, list);
  }

  const settlements = new Map<number, VatCashEvent[]>();
  for (const journal of input.journals) {
    if (reversed(journal)) continue;
    if (String(journal.source || '') !== 'invoice_settlement') continue;
    const invoiceId = invoiceIdOf(journal);
    if (!invoiceId) continue;
    const debit = (linesByJournal.get(journal.id) || []).reduce(
      (sum, line) => sum + Number(line.debit || 0),
      0
    );
    if (debit < 0.005) continue;
    const list = settlements.get(invoiceId) || [];
    list.push({ date: day(journal.entry_date), amount: debit });
    settlements.set(invoiceId, list);
  }

  const payments = new Map<number, VatCashEvent[]>();
  for (const payment of input.payments) {
    const invoiceId = Number(payment.invoice_id || 0);
    if (!(invoiceId > 0)) continue;
    if (payment.status && /void|fail|cancel/i.test(payment.status)) continue;
    const amount = Math.abs(Number(payment.amount || 0));
    const date = day(payment.paid_at);
    if (amount < 0.005 || !date) continue;
    const list = payments.get(invoiceId) || [];
    list.push({ date, amount });
    payments.set(invoiceId, list);
  }

  const documents: VatDocument[] = [];
  const recognised = new Set<number>();

  for (const invoice of input.invoices) {
    const status = String(invoice.status || '').toLowerCase();
    if (SKIP_STATUS.has(status)) continue;
    const side = String(invoice.direction || '').toLowerCase() === 'payable' ? 'input' : 'output';
    const meta = asMeta(invoice.metadata);
    const tax = Number(invoice.tax_amount || 0);
    const total = Number(invoice.total_amount || 0);
    const exclusive = Number(invoice.subtotal || 0) || Math.round((total - tax) * 100) / 100;
    const inclusive = total || Math.round((exclusive + tax) * 100) / 100;
    const kind = kindFor(invoice, side, meta, linesByJournal, accounts);
    const cash = cashFor(invoice, settlements, payments);
    recognised.add(Number(invoice.id));
    documents.push({
      id: `inv-${invoice.id}`,
      side,
      documentDate: day(invoice.issue_date),
      reference: String(invoice.invoice_number || `Invoice ${invoice.id}`),
      counterparty: String(invoice.counterparty_name || ''),
      exclusive,
      vat: tax,
      inclusive,
      kind,
      cash,
      facts: factsFor(invoice, side, input.company, meta),
      source: 'invoice',
    });
  }

  for (const journal of input.journals) {
    if (reversed(journal)) continue;
    const source = String(journal.source || '');
    if (
      source === 'invoice_recognition' ||
      source === 'invoice_settlement' ||
      source === 'invoice_cogs' ||
      source === 'vat201_settlement'
    ) {
      continue;
    }
    if (invoiceIdOf(journal) && recognised.has(invoiceIdOf(journal) || 0) && source === 'invoice_recognition') {
      continue;
    }
    const lines = linesByJournal.get(journal.id) || [];
    let inputVat = 0;
    let outputVat = 0;
    for (const line of lines) {
      const account = accounts.get(Number(line.account_id));
      if (!account || !accountIsVatControl(account)) continue;
      const code = String(account.code || '');
      if (code === '1150' || String(account.account_type || '') === 'asset') {
        inputVat += Number(line.debit || 0) - Number(line.credit || 0);
      } else {
        outputVat += Number(line.credit || 0) - Number(line.debit || 0);
      }
    }
    const meta = asMeta(journal.metadata);
    const date = day(journal.entry_date);
    if (Math.abs(outputVat) >= 0.005) {
      documents.push(directDoc(journal, 'output', outputVat, date, meta));
    }
    if (Math.abs(inputVat) >= 0.005) {
      documents.push(directDoc(journal, 'input', inputVat, date, meta));
    }
  }
  return documents;
}

function cashFor(
  invoice: AssembleInvoice,
  settlements: Map<number, VatCashEvent[]>,
  payments: Map<number, VatCashEvent[]>
): VatCashEvent[] {
  const settled = settlements.get(Number(invoice.id));
  if (settled?.length) return settled;
  const paid = payments.get(Number(invoice.id));
  if (paid?.length) return paid;
  const amount = Math.abs(Number(invoice.amount_paid || 0));
  const date = day(invoice.paid_at);
  if (amount >= 0.005 && date) return [{ date, amount }];
  return [];
}

function kindFor(
  invoice: AssembleInvoice,
  side: 'output' | 'input',
  meta: Record<string, unknown>,
  linesByJournal: Map<number, AssembleLine[]>,
  accounts: Map<number, AssembleAccount>
): VatSupplyKind {
  const explicit = String(meta.vat201_field || meta.vat_field || '');
  const mapped: Record<string, VatSupplyKind> = {
    '1A': 'standard_capital',
    '2': 'zero_rated',
    '2A': 'zero_rated_export',
    '3': 'exempt',
    '5': 'accommodation_over_28',
    '7': 'accommodation_under_28',
    '10': 'change_in_use_output',
    '12': 'other_output',
    '14': 'standard_capital',
    '14A': 'imported_capital',
    '15': 'standard',
    '15A': 'imported_other',
    '16': 'change_in_use_input',
    '17': 'bad_debt',
    '18': 'other_input',
  };
  if (mapped[explicit]) return mapped[explicit];
  const category = resolveVatCategory({
    code: invoice.tax_code,
    rate: invoice.tax_rate,
    category: meta.vat_category != null ? String(meta.vat_category) : null,
  });
  if (category === 'zero_rated') return meta.export ? 'zero_rated_export' : 'zero_rated';
  if (category === 'exempt' || category === 'out_of_scope') return 'exempt';
  if (isCapital(meta, linesByJournal, accounts)) {
    return side === 'input' || side === 'output' ? 'standard_capital' : 'standard';
  }
  return 'standard';
}

function isCapital(
  meta: Record<string, unknown>,
  linesByJournal: Map<number, AssembleLine[]>,
  accounts: Map<number, AssembleAccount>
): boolean {
  if (meta.capital === true || meta.vat_capital === true) return true;
  const category = String(meta.cost_category || '').toLowerCase();
  if (/ppe|capital|fixed|equipment|machinery/.test(category)) return true;
  const journalId = Number(meta.recognition_journal_id || 0);
  const lines = linesByJournal.get(journalId) || [];
  return lines.some((line) => {
    const code = String(accounts.get(Number(line.account_id))?.code || '');
    return code === '1210' || code.startsWith('1210');
  });
}

function present(value: unknown): boolean {
  return String(value || '').trim().length > 0;
}

function itemText(items: unknown, key: string): boolean {
  if (!Array.isArray(items)) return false;
  return items.some((item) => present((item as Record<string, unknown>)?.[key]));
}

function factsFor(
  invoice: AssembleInvoice,
  side: 'output' | 'input',
  company: AssembleCompany,
  meta: Record<string, unknown>
): TaxInvoiceFacts {
  const sales = side === 'output';
  const explicit = meta.tax_invoice === true || meta.has_tax_invoice === true;
  return {
    labelled: sales ? meta.tax_invoice !== false : explicit,
    supplierName: sales ? present(company.tradingName) : present(invoice.counterparty_name),
    supplierAddress: sales ? present(company.address) : present(meta.supplier_address),
    supplierVat: sales
      ? present(company.vatNumber)
      : present(invoice.supplier_vat_number || meta.supplier_vat_number),
    recipientName: sales ? present(invoice.counterparty_name) : present(company.tradingName),
    recipientAddress: sales ? present(invoice.billing_address) : present(company.address),
    recipientVat: sales
      ? present(invoice.customer_vat_number || meta.customer_vat_number)
      : present(company.vatNumber),
    serial: present(invoice.invoice_number),
    date: present(invoice.issue_date),
    description: itemText(invoice.items, 'description') || present(meta.description),
    quantity: itemText(invoice.items, 'quantity'),
    consideration: Number(invoice.total_amount || invoice.subtotal || 0) !== 0,
    vatShown: invoice.tax_amount != null,
    customsCode: present(meta.customs_code),
  };
}

function directDoc(
  journal: AssembleJournal,
  side: 'output' | 'input',
  vat: number,
  date: string,
  meta: Record<string, unknown>
): VatDocument {
  const kind = String(meta.vat201_field || '') === '16' ? 'change_in_use_input' : side === 'output' ? 'other_output' : 'other_input';
  const amount = Math.round(vat * 100) / 100;
  return {
    id: `je-${journal.id}-${side}`,
    side,
    documentDate: date,
    reference: String(journal.source_id || `JE ${journal.id}`),
    counterparty: String(meta.counterparty || ''),
    exclusive: 0,
    vat: amount,
    inclusive: amount,
    kind,
    cash: [{ date, amount: Math.abs(amount) }],
    facts: {
      labelled: true,
      supplierName: true,
      supplierAddress: true,
      supplierVat: true,
      recipientName: true,
      recipientAddress: true,
      recipientVat: true,
      serial: true,
      date: true,
      description: true,
      quantity: true,
      consideration: true,
      vatShown: true,
      customsCode: true,
    },
    source: String(journal.source || 'journal'),
  };
}
