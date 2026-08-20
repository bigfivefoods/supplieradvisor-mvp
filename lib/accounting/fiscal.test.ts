/**
 * Run: npx --yes tsx lib/accounting/fiscal.test.ts
 */
import assert from 'node:assert/strict';
import {
  normalizeFyStartMonth,
  overlayLedgerFiscalYear,
  resolveFiscalYearStartMonth,
} from './fiscal';

assert.equal(normalizeFyStartMonth(3), 3);
assert.equal(normalizeFyStartMonth(0), 3);
assert.equal(normalizeFyStartMonth(13), 3);
assert.equal(resolveFiscalYearStartMonth(7, 3), 7);
assert.equal(resolveFiscalYearStartMonth(null, 9), 9);
assert.equal(resolveFiscalYearStartMonth(undefined, undefined), 3);

const overlaid = overlayLedgerFiscalYear(
  { fiscal_year_start_month: 3, base_currency: 'ZAR' },
  4
);
assert.equal(overlaid.fiscal_year_start_month, 4);
assert.equal(overlaid.base_currency, 'ZAR');

console.log('fiscal.test.ts ok');
