/**
 * Member bank details for gym debit orders.
 * Collected on the member profile. The owner sets up the debit order —
 * this is not a Paystack / Apple Pay charge.
 */
import type { FitClient, FitgraphStore } from '@/lib/fitness/fitgraph';

export const DEBIT_ACCOUNT_TYPES = [
  'cheque',
  'current',
  'savings',
  'transmission',
] as const;

export type DebitAccountType = (typeof DEBIT_ACCOUNT_TYPES)[number];

export type FitMemberDebitBank = {
  account_holder: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: DebitAccountType | string;
  debit_order_authorised: boolean;
  authorised_at?: string | null;
  updated_at: string;
};

export const SA_DEBIT_BANKS: Array<{ name: string; branch_code: string }> = [
  { name: 'Absa', branch_code: '632005' },
  { name: 'African Bank', branch_code: '430000' },
  { name: 'Bidvest Bank', branch_code: '462005' },
  { name: 'Capitec', branch_code: '470010' },
  { name: 'Discovery Bank', branch_code: '679000' },
  { name: 'FNB', branch_code: '250655' },
  { name: 'Investec', branch_code: '580105' },
  { name: 'Nedbank', branch_code: '198765' },
  { name: 'Standard Bank', branch_code: '051001' },
  { name: 'TymeBank', branch_code: '678910' },
  { name: 'Bank Zero', branch_code: '888000' },
  { name: 'Sasfin', branch_code: '683000' },
  { name: 'Other', branch_code: '' },
];

export function gymCollectsDebitBank(store: FitgraphStore): boolean {
  if (store.settings?.require_debit_bank === true) return true;
  return store.settings?.collect_debit_bank === true;
}

export function gymRequiresDebitBank(store: FitgraphStore): boolean {
  return store.settings?.require_debit_bank === true;
}

export function digitsOnly(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

export function maskAccountNumber(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length < 4) return d ? '••••' : '';
  return `•••• ${d.slice(-4)}`;
}

export function memberDebitBankComplete(
  client: Pick<FitClient, 'debit_bank'> | null | undefined
): boolean {
  const b = client?.debit_bank;
  if (!b) return false;
  const holder = String(b.account_holder || '').trim();
  const bank = String(b.bank_name || '').trim();
  const acct = digitsOnly(b.account_number);
  const branch = digitsOnly(b.branch_code);
  const type = String(b.account_type || '').trim();
  return (
    holder.length >= 2 &&
    bank.length >= 2 &&
    acct.length >= 6 &&
    acct.length <= 16 &&
    branch.length === 6 &&
    type.length > 0 &&
    b.debit_order_authorised === true
  );
}

export function parseDebitAccountType(raw: unknown): DebitAccountType | '' {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'current' || v === 'cheque') return v === 'current' ? 'current' : 'cheque';
  if (v === 'savings' || v === 'transmission') return v;
  if (v.includes('sav')) return 'savings';
  if (v.includes('trans')) return 'transmission';
  if (v.includes('cheq') || v.includes('current')) return 'cheque';
  return '';
}

/** Match a Jotform / free-text bank name to the SA debit-order table. */
export function matchSaDebitBank(
  name: string
): { name: string; branch_code: string } | null {
  const n = String(name || '')
    .toLowerCase()
    .replace(/\bbank\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!n) return null;
  for (const b of SA_DEBIT_BANKS) {
    if (b.name === 'Other') continue;
    const bn = b.name
      .toLowerCase()
      .replace(/\bbank\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (
      bn === n ||
      bn.startsWith(n) ||
      n.startsWith(bn) ||
      bn.includes(n) ||
      n.includes(bn)
    ) {
      return b;
    }
  }
  return null;
}

export function applyMemberDebitBank(
  client: FitClient,
  raw: unknown,
  nowIso?: string
): { ok: true } | { ok: false; error: string } {
  if (raw == null || raw === '') {
    client.debit_bank = undefined;
    return { ok: true };
  }
  if (typeof raw !== 'object') {
    return { ok: false, error: 'Bank details are invalid' };
  }
  const rec = raw as Record<string, unknown>;
  const holder = String(rec.account_holder || '').trim();
  const bank = String(rec.bank_name || '').trim();
  const acct = digitsOnly(rec.account_number);
  const branch = digitsOnly(rec.branch_code);
  const type = parseDebitAccountType(rec.account_type);
  const authorised = rec.debit_order_authorised === true;
  if (holder.length < 2) {
    return { ok: false, error: 'Account holder name is required' };
  }
  if (bank.length < 2) {
    return { ok: false, error: 'Select your bank' };
  }
  if (acct.length < 6 || acct.length > 16) {
    return { ok: false, error: 'Enter a valid account number' };
  }
  if (branch.length !== 6) {
    return { ok: false, error: 'Branch code must be 6 digits' };
  }
  if (!type) {
    return { ok: false, error: 'Select the account type' };
  }
  if (!authorised) {
    return {
      ok: false,
      error:
        'Tick the debit-order authorisation so the gym can collect your membership fee',
    };
  }
  const now = nowIso || new Date().toISOString();
  const prev = client.debit_bank;
  client.debit_bank = {
    account_holder: holder,
    bank_name: bank,
    account_number: acct,
    branch_code: branch,
    account_type: type,
    debit_order_authorised: true,
    authorised_at: prev?.authorised_at || now,
    updated_at: now,
  };
  return { ok: true };
}

export function memberDebitBankPublic(client: FitClient | null | undefined) {
  const b = client?.debit_bank;
  const complete = memberDebitBankComplete(client);
  if (!b) {
    return {
      complete: false,
      account_holder: '',
      bank_name: '',
      account_number: '',
      account_number_masked: '',
      branch_code: '',
      account_type: '',
      debit_order_authorised: false,
      authorised_at: null as string | null,
    };
  }
  return {
    complete,
    account_holder: b.account_holder,
    bank_name: b.bank_name,
    account_number: b.account_number,
    account_number_masked: maskAccountNumber(b.account_number),
    branch_code: b.branch_code,
    account_type: b.account_type,
    debit_order_authorised: b.debit_order_authorised === true,
    authorised_at: b.authorised_at || null,
  };
}
