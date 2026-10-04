/**
 * Clients desk edits identity, bank, and membership in one allocate_member save.
 * Run: npx --yes tsx lib/fitness/gym-client-desk-fields.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const table = readFileSync(
  resolve('components/fitness/MemberAllocateTable.tsx'),
  'utf8'
);
assert.match(table, /MemberDeskEditFields/);
assert.match(table, /id_number: d\.id_number\.trim\(\)/);
assert.match(table, /debit_bank: d\.debit_bank/);
assert.match(table, /occupation: d\.occupation\.trim\(\)/);

const fields = readFileSync(
  resolve('components/fitness/MemberDeskEditFields.tsx'),
  'utf8'
);
assert.match(fields, /ID number/);
assert.match(fields, /MemberDebitBankFields/);
assert.match(fields, /Next of kin/);

const alloc = readFileSync(resolve('lib/fitness/class-allocate.ts'), 'utf8');
assert.match(alloc, /id_number/);
assert.match(alloc, /debit_bank/);
assert.match(alloc, /medical_aid_scheme/);

const route = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
const allocateBlock = route.split("action === 'allocate_member'")[1] || '';
assert.match(allocateBlock, /body\.id_number/);
assert.match(allocateBlock, /body\.debit_bank/);
assert.match(allocateBlock, /body\.occupation/);

const page = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
assert.match(page, /occupation: form\.occupation/);
assert.match(page, /health_updated_by: 'desk'/);
assert.doesNotMatch(page, /\.\.\.\(editing\s*\n\s*\? \{\}/);

console.log('gym-client-desk-fields.test.ts ok');
