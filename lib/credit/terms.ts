import { createHash } from 'crypto';
import type { CreditTermsOption } from '@/lib/credit/types';

export const TERMS_VERSION = 'brief79-v1';

export const CREDIT_TERM_OPTIONS: readonly CreditTermsOption[] = [
  'COD',
  '7 days',
  '14 days',
  '30 days from statement',
  '60 days from statement',
  'Other',
] as const;

function clamp(v: unknown, n: number) {
  return String(v || '').trim().slice(0, n);
}

export function normalizeRequestedTerms(input: {
  requested_terms?: unknown;
  requested_terms_other?: unknown;
}): string {
  const selected = clamp(input.requested_terms, 80);
  if (!selected) return '';
  if (selected !== 'Other') return selected;
  return clamp(input.requested_terms_other, 80);
}

export function buildSaCreditTermsText(supplierTradingName: string): string {
  const supplier = clamp(supplierTradingName, 120) || 'the supplier company';
  return [
    `Credit terms and suretyship (${supplier})`,
    '',
    `The applicant requests a trade credit facility from ${supplier} for business purchases.`,
    'The applicant confirms all information submitted is true and complete.',
    'The applicant consents to credit risk checks for credit assessment and account management.',
    'Where applicable, directors/members/owners may provide personal suretyship for amounts due.',
    'Approved limit and payment terms remain at the sole discretion of the supplier.',
    'Any approved account must be settled per agreed payment terms and statutory requirements.',
  ].join('\n');
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
