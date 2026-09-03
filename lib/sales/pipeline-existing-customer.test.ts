/**
 * Sales pipeline can link a deal to an existing book customer.
 * Run: npx --yes tsx lib/sales/pipeline-existing-customer.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(resolve('app/sales/pipeline/page.tsx'), 'utf8');
assert.match(page, /Existing customer/);
assert.match(page, /applyBookCustomer/);
assert.match(page, /customer_id: form\.customer_id/);
assert.match(page, /New customer — type details below/);
assert.match(page, /None — new or unlinked deal/);
assert.match(page, /\/api\/customers\?/);
assert.match(page, /Invite this customer/);

console.log('pipeline-existing-customer.test.ts ok');
