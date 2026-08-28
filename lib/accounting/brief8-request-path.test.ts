/**
 * Brief 8: GET paths must not relabel-all, advisor-sync, or full-book ensure.
 * Run: npx --yes tsx lib/accounting/brief8-request-path.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const customersGet = src('app/api/customers/route.ts').split('export async function POST')[0];
assert.doesNotMatch(customersGet, /ensurePartyGlAccounts/);
assert.doesNotMatch(customersGet, /relabelPartyCoaHeadersAllOnce/);
assert.doesNotMatch(customersGet, /seedRequesterBooksFromPendingInvites/);
assert.doesNotMatch(customersGet, /syncAdvisorModulePeopleToCrm/);

const coaGet = src('app/api/accounting/chart-of-accounts/route.ts').split('export async function POST')[0];
assert.doesNotMatch(coaGet, /ensurePartyGlAccounts/);
assert.doesNotMatch(coaGet, /relabelPartyCoaHeadersAllOnce/);
assert.match(coaGet, /get\('balances'\) === '1'/);

const core360 = src('lib/core-os/server.ts');
assert.doesNotMatch(core360, /ensurePartyGlAccounts\(/);
assert.doesNotMatch(core360, /syncAdvisorModulePeopleToCrm/);

const resolveSrc = src('lib/accounting/party-gl-accounts.ts');
const resolveFn = resolveSrc.split('export async function resolvePartyControlAccountId')[1] || '';
assert.doesNotMatch(
  resolveFn.slice(0, 400),
  /ensurePartyGlAccountsCached/
);
assert.match(resolveSrc, /gl_account_id/);

const mgmt = src('lib/accounting/management-pack.ts');
assert.doesNotMatch(mgmt, /recognizeIssuedCrmInvoices/);
assert.doesNotMatch(mgmt, /applyInvoiceDedupe/);

const reportsGet = src('app/api/accounting/reports/route.ts');
assert.doesNotMatch(reportsGet, /apply:\s*true/);

const ensureBody = resolveSrc.split('export async function ensurePartyGlAccounts')[1] || '';
assert.doesNotMatch(ensureBody.slice(0, 800), /relabelPartyCoaHeadersAllOnce/);
assert.doesNotMatch(ensureBody.slice(0, 800), /syncAdvisorModulePeopleToCrm/);

const health = src('app/api/system/health/route.ts');
assert.doesNotMatch(health, /getSupabaseServer/);
assert.doesNotMatch(health, /requirePlatformConsoleAccess/);
assert.doesNotMatch(health, /ADVISOR_SKINS/);
assert.match(health, /service: 'health'/);
assert.match(health, /runtime = 'edge'/);

const healthTwin = src('app/api/health/route.ts');
assert.doesNotMatch(healthTwin, /getSupabaseServer/);
assert.match(healthTwin, /service: 'health'/);
assert.match(healthTwin, /runtime = 'edge'/);

console.log('brief8-request-path.test.ts ok');
