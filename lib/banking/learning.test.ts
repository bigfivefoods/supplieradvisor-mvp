/**
 * Run: npx --yes tsx lib/banking/learning.test.ts
 */
import assert from 'node:assert/strict';
import {
  merchantKeyFromTxn,
  proposeForBankLine,
  taxAmountForCode,
  winningVote,
  type LearnedPattern,
} from './learning';
import type { CoaAccount } from '@/lib/accounting/types';

assert.equal(winningVote(new Map([[1, 2], [4, 5], [3, 5]]))?.key, 4);
assert.equal(winningVote(new Map<number, number>())?.key, undefined);

const key = merchantKeyFromTxn('POS PURCHASE SHELL 123456 01 JAN', null);
assert.ok(key.includes('shell') || key.includes('pos purchase'));

assert.ok(taxAmountForCode(115, 'VAT15') > 0);
assert.equal(taxAmountForCode(115, 'OUT'), 0);

const coa: CoaAccount[] = [
  {
    id: 10,
    code: '6500',
    name: 'Travel',
    account_type: 'expense',
    is_header: false,
    is_active: true,
  },
  {
    id: 11,
    code: '4100',
    name: 'Sales',
    account_type: 'revenue',
    is_header: false,
    is_active: true,
  },
];

const learned = new Map<string, LearnedPattern>([
  [
    merchantKeyFromTxn('POS PURCHASE SHELL MIDRAND', null),
    {
      merchant_key: merchantKeyFromTxn('POS PURCHASE SHELL MIDRAND', null),
      gl_account_id: 10,
      gl_hits: 4,
      tax_code: 'VAT15',
      tax_hits: 4,
      invoice_counterparty: null,
      hits: 4,
      sample_description: 'POS PURCHASE SHELL MIDRAND',
      source: 'bank',
    },
  ],
]);

const p = proposeForBankLine(
  { description: 'POS PURCHASE SHELL MIDRAND', amount: -230 },
  learned,
  coa
);
assert.ok(p);
assert.equal(p?.gl_account_id, 10);
assert.equal(p?.tax_code, 'VAT15');
assert.ok((p?.confidence || 0) >= 58);
assert.equal(p?.source, 'learned');

const keyword = proposeForBankLine(
  { description: 'Bank charge monthly fee', amount: -89 },
  new Map(),
  coa
);
assert.ok(keyword);
assert.equal(keyword?.source, 'keyword');

console.log('learning.test.ts ok');
