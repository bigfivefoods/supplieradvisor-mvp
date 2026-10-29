import { SA_DEBIT_BANKS, parseDebitAccountType } from '@/lib/fitness/member-debit-bank';
import type { MandateAccountType, NetcashSettings } from '@/lib/fitness/netcash/types';

export const CONSENT_VERSION = 'gym-debit-consent-v1';

export function consentText(gymName: string): string {
  const gym = String(gymName || 'this gym').trim() || 'this gym';
  return `I authorise ${gym} to collect the invoiced membership amount, including the plan, add-ons, and agreed fees, from the bank account below by debit order on the debit day, through Netcash, until I cancel in writing. I confirm I am the account holder or I have authority to sign. This is an electronic signature.`;
}

export type MandateInput = {
  accountHolder: string;
  bankName: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
  debitDay: number;
  amountCents: number;
  accepted: boolean;
};

export type MandateFieldError = { field: string; message: string };

export function digits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

export function validateMandateInput(input: MandateInput): { ok: true; accountType: MandateAccountType; branchCode: string; accountNumber: string; bankName: string } | { ok: false; errors: MandateFieldError[] } {
  const errors: MandateFieldError[] = [];
  const holder = String(input.accountHolder || '').trim();
  const bankName = String(input.bankName || '').trim();
  const branchCode = digits(input.branchCode);
  const accountNumber = digits(input.accountNumber);
  const accountType = parseDebitAccountType(input.accountType);
  if (holder.length < 2 || holder.length > 80) errors.push({ field: 'accountHolder', message: 'Enter the account holder name.' });
  if (bankName.length < 2 || bankName.length > 60) errors.push({ field: 'bankName', message: 'Select the bank.' });
  if (!SA_DEBIT_BANKS.some((bank) => bank.name === bankName) && bankName !== 'Other') {
    errors.push({ field: 'bankName', message: 'Select a bank from the list.' });
  }
  if (branchCode.length !== 6) errors.push({ field: 'branchCode', message: 'Branch code must be 6 digits.' });
  if (accountNumber.length < 6 || accountNumber.length > 16) {
    errors.push({ field: 'accountNumber', message: 'Enter a valid account number.' });
  }
  if (/^0+$/.test(accountNumber)) errors.push({ field: 'accountNumber', message: 'Account number is not valid.' });
  if (!accountType) errors.push({ field: 'accountType', message: 'Select the account type.' });
  const day = Number(input.debitDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) errors.push({ field: 'debitDay', message: 'Debit day must be from 1 to 31.' });
  const amount = Number(input.amountCents);
  if (!Number.isInteger(amount) || amount < 100 || amount > 50_000_000) {
    errors.push({ field: 'amountCents', message: 'Amount must be between R 1.00 and R 500 000.00.' });
  }
  if (input.accepted !== true) errors.push({ field: 'accepted', message: 'The debit order consent must be signed.' });
  if (errors.length || !accountType) return { ok: false, errors };
  return { ok: true, accountType, branchCode, accountNumber, bankName };
}

/** Test-mode account validation. Numbers ending 0000 are rejected. No live call. */
export function mockAccountValidation(accountNumber: string, branchCode: string): { status: 'valid' | 'invalid'; ref: string; message: string } {
  const account = digits(accountNumber);
  const branch = digits(branchCode);
  if (branch.length !== 6 || account.length < 6 || /^0+$/.test(account) || account.endsWith('0000') || account.startsWith('999')) {
    return { status: 'invalid', ref: '', message: 'The bank account could not be validated.' };
  }
  const ref = `AVS-TEST-${account.slice(-4)}-${branch}`;
  return { status: 'valid', ref, message: 'Account accepted in Netcash test mode.' };
}

export function validateSettingsPatch(input: Partial<NetcashSettings> & { serviceKey?: string; accountKey?: string }): { ok: true; patch: Partial<NetcashSettings> & { serviceKey?: string; accountKey?: string } } | { ok: false; error: string } {
  const patch: Partial<NetcashSettings> & { serviceKey?: string; accountKey?: string } = {};
  if (input.merchantAccount != null) {
    const merchant = String(input.merchantAccount).trim();
    if (merchant.length > 40) return { ok: false, error: 'Merchant account is too long.' };
    patch.merchantAccount = merchant;
  }
  if (input.mode != null) {
    if (input.mode !== 'test' && input.mode !== 'live') return { ok: false, error: 'Mode must be test or live.' };
    patch.mode = input.mode;
  }
  if (input.debitDay != null) {
    const day = Number(input.debitDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) return { ok: false, error: 'Debit day must be from 1 to 31.' };
    patch.debitDay = day;
  }
  if (input.cadence != null) {
    if (input.cadence !== 'monthly' && input.cadence !== 'weekly' && input.cadence !== 'fortnightly') {
      return { ok: false, error: 'Cadence must be monthly, weekly, or fortnightly.' };
    }
    patch.cadence = input.cadence;
  }
  if (input.leadBusinessDays != null) {
    const lead = Number(input.leadBusinessDays);
    if (!Number.isInteger(lead) || lead < 0 || lead > 10) return { ok: false, error: 'Lead time must be 0 to 10 business days.' };
    patch.leadBusinessDays = lead;
  }
  if (input.cutoffHourSast != null) {
    const hour = Number(input.cutoffHourSast);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: 'Cut-off hour is invalid.' };
    patch.cutoffHourSast = hour;
  }
  if (input.vatBps != null) {
    const vat = Number(input.vatBps);
    if (!Number.isInteger(vat) || vat < 0 || vat > 3000) return { ok: false, error: 'VAT rate is invalid.' };
    patch.vatBps = vat;
  }
  if (input.lateFeeCents != null) {
    const fee = Number(input.lateFeeCents);
    if (!Number.isInteger(fee) || fee < 0 || fee > 100_000) return { ok: false, error: 'Late fee must be from R 0.00 to R 1 000.00.' };
    patch.lateFeeCents = fee;
  }
  if (input.retryMaxAttempts != null) {
    const attempts = Number(input.retryMaxAttempts);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) return { ok: false, error: 'Retries must be from 1 to 5.' };
    patch.retryMaxAttempts = attempts;
  }
  if (input.invoicePrefix != null) {
    const prefix = String(input.invoicePrefix).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (prefix.length < 2 || prefix.length > 8) return { ok: false, error: 'Invoice prefix must be 2 to 8 letters or digits.' };
    patch.invoicePrefix = prefix;
  }
  if (input.serviceKey != null) {
    const key = String(input.serviceKey).trim();
    if (key && (key.length < 8 || key.length > 80)) return { ok: false, error: 'Service key looks invalid.' };
    patch.serviceKey = key;
  }
  if (input.accountKey != null) {
    const key = String(input.accountKey).trim();
    if (key && (key.length < 8 || key.length > 80)) return { ok: false, error: 'Account service key looks invalid.' };
    patch.accountKey = key;
  }
  for (const flag of ['pricesIncludeVat', 'autoSubmit', 'autoSuspendAccess', 'dunningEmail', 'allowAmountVariance'] as const) {
    if (input[flag] != null) patch[flag] = input[flag] === true;
  }
  for (const code of ['glBankCode', 'glArCode', 'glRevenueCode', 'glVatCode', 'glFeeCode'] as const) {
    if (input[code] != null) {
      const value = String(input[code]).trim();
      if (!/^\d{3,6}$/.test(value)) return { ok: false, error: 'GL codes are numeric.' };
      patch[code] = value;
    }
  }
  return { ok: true, patch };
}
