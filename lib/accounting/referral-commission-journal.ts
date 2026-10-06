/**
 * A redemption recognises the commission and a payable.
 * The bank payment is coded to that payable later, so cash is not expensed twice.
 */
import type { JournalLineInput } from '@/lib/accounting/post-journal';

export const REFERRAL_EXPENSE_CODES = ['6400', '6600', '6990'] as const;
export const REFERRAL_PAYABLE_CODE = '2110';

export function referralJournalLines(opts: {
  expenseAccountId: number;
  payableAccountId: number;
  amount: number;
  partnerName: string;
  method: string;
}): JournalLineInput[] {
  const amount = Math.round((Number(opts.amount) || 0) * 100) / 100;
  const who = opts.partnerName.trim() || 'Referral partner';
  const how =
    opts.method === 'offset'
      ? 'offset'
      : opts.method === 'credit'
        ? 'credit note'
        : 'paid out';
  const memo = `${who} · ${how}`;
  return [
    {
      accountId: opts.expenseAccountId,
      debit: amount,
      credit: 0,
      memo,
      counterparty: who,
    },
    {
      accountId: opts.payableAccountId,
      debit: 0,
      credit: amount,
      memo,
      counterparty: who,
    },
  ];
}
