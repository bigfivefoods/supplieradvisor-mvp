/**
 * Brief 11 — 360 with customerId does not load eight advisor stores.
 * Run: npx --yes tsx lib/core-os/brief11-360.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { advisorModuleForCustomer } from './kinds';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(
  advisorModuleForCustomer({ notes: 'advisor_ref:fitgraph:cli_1' }),
  'fitgraph'
);
assert.equal(
  advisorModuleForCustomer({ notes: 'advisor_ref:physiograph:pat_1' }),
  'physiograph'
);
assert.equal(advisorModuleForCustomer({ source: 'website' }), null);

const server = src('lib/core-os/server.ts');
assert.match(server, /loadAdvisorStoreSliceFor360/);
assert.match(server, /advisorModuleForCustomer/);
assert.match(server, /opts\?\.customerId && customers\[0\]/);
assert.doesNotMatch(server, /loadAdvisorStoresFor360/);
assert.doesNotMatch(
  server,
  /Promise\.all\(\s*\[\s*loadFitgraphMerged/
);
assert.doesNotMatch(server, /loadAdvisorModuleStore\(\s*companyId,\s*'physiograph'/);

const lists = src('lib/http/tenant-list.ts');
assert.match(lists, /DEFAULT_LIST_LIMIT = 50/);
assert.match(lists, /MAX_LIST_LIMIT = 100/);

const customersGet = src('app/api/customers/route.ts').split(
  'export async function POST'
)[0];
assert.match(customersGet, /parseListLimit/);
assert.doesNotMatch(customersGet, /select\('\*'\)/);

const suppliersGet = src('app/api/suppliers/route.ts').split(
  'export async function POST'
)[0];
assert.match(suppliersGet, /parseListLimit/);
assert.doesNotMatch(suppliersGet, /select\('\*'\)/);

const coaGet = src('app/api/accounting/chart-of-accounts/route.ts').split(
  'export async function POST'
)[0];
assert.match(coaGet, /1180\|2180\|4400/);
assert.match(coaGet, /includePartyLeaves/);

const acctSummary = src('app/api/accounting/summary/route.ts');
assert.match(acctSummary, /sa_accounting_kpi_rollup/);

console.log('brief11-360 tests ok');
