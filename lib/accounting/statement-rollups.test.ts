/**
 * Run: npx --yes tsx lib/accounting/statement-rollups.test.ts
 */
import assert from 'node:assert/strict';
import { classifyBsSection } from './balance-sheet-allocate';
import {
  collapseBsStatementRows,
  rollTradeReceivables,
  rollsIntoTradePayables,
  rollsIntoTradeReceivables,
} from './statement-rollups';

assert.equal(
  classifyBsSection('asset', 'contra_asset', '1135'),
  'current_assets'
);
assert.equal(
  classifyBsSection('asset', 'contra_asset', '1220'),
  'non_current_assets'
);
assert.equal(classifyBsSection('asset', 'receivable', '1130'), 'current_assets');
assert.equal(classifyBsSection('asset', 'fixed', '1210'), 'non_current_assets');

assert.equal(
  rollsIntoTradeReceivables({
    code: '1180-0000009',
    name: 'AR — Ann',
    account_type: 'asset',
    subtype: 'receivable',
  }),
  true
);
assert.equal(
  rollsIntoTradeReceivables({
    code: '1181',
    name: 'AR — Buze',
    account_type: 'asset',
    subtype: 'receivable',
  }),
  true
);
assert.equal(
  rollsIntoTradeReceivables({
    code: '1135',
    name: 'Allowance for expected credit losses',
    account_type: 'asset',
    subtype: 'contra_asset',
  }),
  true
);
assert.equal(
  rollsIntoTradeReceivables({
    code: '1110',
    name: 'Bank',
    account_type: 'asset',
    subtype: 'bank',
  }),
  false
);
assert.equal(
  rollsIntoTradePayables({
    code: '2180-0000008',
    name: 'AP — Holtz',
    account_type: 'liability',
    subtype: 'payable',
  }),
  true
);
assert.equal(
  rollsIntoTradePayables({
    code: '2120',
    name: 'VAT output',
    account_type: 'liability',
    subtype: 'tax',
  }),
  false
);
assert.equal(
  rollsIntoTradePayables({
    code: '2140',
    name: 'Customer deposits',
    account_type: 'liability',
    subtype: 'current',
  }),
  false
);

const zero = () => ({ debit: 0, credit: 0 });
const byId: Record<number, { debit: number; credit: number }> = {
  5: { debit: 1000, credit: 0 },
  77: { debit: 500, credit: 0 },
  6: { debit: 0, credit: 80 },
};
const rolled = rollTradeReceivables({
  accounts: [
    { id: 5, code: '1130', name: 'Accounts receivable', account_type: 'asset', subtype: 'receivable' },
    { id: 77, code: '1180-0000009', name: 'AR — Ann', account_type: 'asset', subtype: 'receivable' },
    { id: 6, code: '1135', name: 'Allowance for expected credit losses', account_type: 'asset', subtype: 'contra_asset' },
    { id: 3, code: '1110', name: 'Bank', account_type: 'asset', subtype: 'bank' },
  ],
  currentOf: (id) => byId[id] || zero(),
  priorOf: () => zero(),
});
assert.equal(rolled.face.name, 'Trade and other receivables');
assert.equal(rolled.face.current, 1420);
assert.equal(rolled.detail.length >= 3, true);
assert.ok(!rolled.detail.some((d) => d.code === '1110'));

const collapsed = collapseBsStatementRows([
  {
    id: 5,
    code: '1130',
    name: 'Accounts receivable',
    account_type: 'asset',
    subtype: 'receivable',
    section: 'current_assets',
    amount: 1000,
  },
  {
    id: 77,
    code: '1180-0000009',
    name: 'AR — Ann',
    account_type: 'asset',
    subtype: 'receivable',
    section: 'current_assets',
    amount: 500,
  },
  {
    id: 6,
    code: '1135',
    name: 'Allowance for expected credit losses',
    account_type: 'asset',
    subtype: 'contra_asset',
    section: 'current_assets',
    amount: -80,
  },
  {
    id: 3,
    code: '1110',
    name: 'Bank — operating',
    account_type: 'asset',
    subtype: 'bank',
    section: 'current_assets',
    amount: 200,
  },
  {
    id: 88,
    code: '2180-0000008',
    name: 'AP — Holtz',
    account_type: 'liability',
    subtype: 'payable',
    section: 'current_liabilities',
    amount: 300,
  },
  {
    id: 90,
    code: '2140',
    name: 'Customer deposits',
    account_type: 'liability',
    subtype: 'current',
    section: 'current_liabilities',
    amount: 150,
  },
]);
assert.equal(collapsed.filter((r) => r.section === 'current_assets').length, 2);
assert.equal(
  collapsed.find((r) => r.name === 'Trade and other receivables')?.amount,
  1420
);
assert.ok(!collapsed.some((r) => r.code === '1180-0000009'));
assert.equal(
  collapsed.find((r) => r.name === 'Trade and other payables')?.amount,
  300
);
assert.equal(collapsed.find((r) => r.code === '2140')?.amount, 150);

console.log('statement-rollups tests ok');
