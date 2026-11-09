/**
 * Load a VAT201 from the posted ledger. Server-only.
 * Uses loadPostedLedger and totalsFromLedger, and signs control accounts
 * with statement-figures so the reconciliation matches the other statements.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadPostedLedger, totalsFromLedger } from '@/lib/accounting/posted-ledger';
import { signedStatementAmount } from '@/lib/accounting/statement-figures';
import { round2 } from '@/lib/accounting/vat';
import {
  assembleVatDocuments,
  type AssembleAccount,
  type AssembleInvoice,
  type AssemblePayment,
} from '@/lib/accounting/vat201-assemble';
import {
  buildVat201Pack,
  type Vat201Report,
  type VatAccountSnap,
  type VatLedgerRow,
  type VatPeriod,
  type VatVendorSettings,
} from '@/lib/accounting/vat201-model';

type Db = { from: (table: string) => any };

function monthShift(ymd: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!match) return ymd;
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

async function pageAll(
  client: Db,
  table: string,
  profileId: number,
  select: string,
  filters: Array<(query: any) => any> = []
): Promise<{ rows: Array<Record<string, unknown>>; warning?: string }> {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    let query = client.from(table).select(select).eq('profile_id', profileId);
    for (const filter of filters) query = filter(query);
    const { data, error } = await query.order('id', { ascending: true }).range(offset, offset + 999);
    if (error) return { rows, warning: error.message };
    const page = (data || []) as Array<Record<string, unknown>>;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return { rows };
}

export function ledgerControlRows(opts: {
  journals: Array<{ id: number; entry_date?: string | null; source?: string | null }>;
  lines: Array<{
    journal_entry_id?: number | null;
    account_id: number;
    debit?: number | null;
    credit?: number | null;
  }>;
  accounts: VatAccountSnap[];
  from: string;
  to: string;
}): VatLedgerRow[] {
  const totals = totalsFromLedger({
    journals: opts.journals,
    lines: opts.lines,
    from: opts.from,
    to: opts.to,
  });
  const byId = new Map(opts.accounts.map((account) => [Number(account.id), account]));
  return totals.rows.map((row) => {
    const account = byId.get(Number(row.account_id));
    const signed = signedStatementAmount(
      account?.account_type,
      Number(row.debit || 0),
      Number(row.credit || 0)
    );
    return {
      account_id: Number(row.account_id),
      debit: round2(row.debit),
      credit: round2(row.credit),
      signed,
    };
  });
}

export async function loadVat201Report(opts: {
  profileId: number;
  settings: VatVendorSettings;
  period: VatPeriod;
  today: string;
  companyName: string;
  companyAddress?: string | null;
  status?: Vat201Report['status'];
  client?: Db;
}): Promise<{ report: Vat201Report; warning?: string }> {
  const client = (opts.client ?? getSupabaseServer()) as Db;
  const lookback = monthShift(opts.period.start, -24);
  const ledger = await loadPostedLedger({
    profileId: opts.profileId,
    from: lookback,
    to: opts.period.end,
    journalColumns: 'detail',
    lineColumns: 'detail',
    client,
  });

  const accountPage = await pageAll(
    client,
    'chart_of_accounts',
    opts.profileId,
    'id, code, name, account_type, subtype, is_header'
  );
  const accounts: VatAccountSnap[] = (accountPage.rows || [])
    .filter((row) => !row.is_header)
    .map((row) => ({
      id: Number(row.id),
      code: String(row.code || ''),
      name: String(row.name || ''),
      account_type: String(row.account_type || ''),
      subtype: row.subtype != null ? String(row.subtype) : null,
    }));

  const invoiceSelect =
    'id, direction, status, issue_date, invoice_number, counterparty_name, subtotal, tax_amount, total_amount, tax_code, tax_rate, amount_paid, paid_at, metadata, items, billing_address';
  let invoicePage = await pageAll(client, 'invoices', opts.profileId, invoiceSelect, [
    (query) => query.lte('issue_date', opts.period.end),
  ]);
  if (invoicePage.warning && /column/i.test(invoicePage.warning)) {
    invoicePage = await pageAll(
      client,
      'invoices',
      opts.profileId,
      'id, direction, status, issue_date, invoice_number, counterparty_name, subtotal, tax_amount, total_amount, amount_paid, paid_at, metadata'
    );
  }

  const paymentPage = await pageAll(
    client,
    'payments',
    opts.profileId,
    'id, invoice_id, amount, paid_at, status'
  );

  const documents = assembleVatDocuments({
    company: {
      tradingName: opts.companyName,
      vatNumber: opts.settings.vatNumber,
      address: opts.companyAddress || '',
    },
    invoices: invoicePage.rows as AssembleInvoice[],
    journals: ledger.journals,
    lines: ledger.lines,
    payments: (paymentPage.warning ? [] : paymentPage.rows) as AssemblePayment[],
    accounts: accounts as AssembleAccount[],
  });

  const ledgerRows = ledgerControlRows({
    journals: ledger.journals,
    lines: ledger.lines,
    accounts,
    from: opts.period.start,
    to: opts.period.end,
  });

  const report = buildVat201Pack({
    companyName: opts.companyName,
    settings: opts.settings,
    period: opts.period,
    documents,
    accounts,
    ledgerRows,
    today: opts.today,
    status: opts.status,
  });
  const warning = [ledger.warning, accountPage.warning, invoicePage.warning]
    .filter(Boolean)
    .join(' ');
  return { report, warning: warning || undefined };
}
