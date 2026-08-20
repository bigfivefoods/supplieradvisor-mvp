/**
 * Run: npx --yes tsx lib/accounting/document-number.test.ts
 */
import assert from 'node:assert/strict';
import { formatDocumentNumber } from './document-number';

assert.equal(formatDocumentNumber('INV', 1001), 'INV-01001');
assert.equal(formatDocumentNumber('BILL', 1), 'BILL-00001');
assert.equal(formatDocumentNumber('JE', 12), 'JE-00012');
assert.equal(formatDocumentNumber('JE', 100000), 'JE-100000');
assert.equal(formatDocumentNumber('', 3), 'DOC-00003');
assert.equal(formatDocumentNumber('  AR  ', 9), 'AR-00009');
assert.equal(formatDocumentNumber('INV', 0), 'INV-00001');
assert.equal(formatDocumentNumber('INV', Number.NaN), 'INV-00001');

console.log('document-number.test.ts ok');
