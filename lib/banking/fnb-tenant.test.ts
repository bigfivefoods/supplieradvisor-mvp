/**
 * FNB Integration Channel is Big Five Foods (profile 102) only.
 * Run: npx --yes tsx lib/banking/fnb-tenant.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FNB_INTEGRATION_COMPANY_ID,
  bankingProviderStatus,
  fnbConfiguredForCompany,
  isFnbIntegrationCompany,
} from './fnb-tenant';

assert.equal(FNB_INTEGRATION_COMPANY_ID, 102);
assert.equal(isFnbIntegrationCompany(102), true);
assert.equal(isFnbIntegrationCompany(110), false);
assert.equal(isFnbIntegrationCompany(123), false);
assert.equal(isFnbIntegrationCompany(0), false);

const prevId = process.env.FNB_CLIENT_ID;
const prevSecret = process.env.FNB_CLIENT_SECRET;
const prevCompany = process.env.FNB_COMPANY_ID;
process.env.FNB_CLIENT_ID = 'test-id';
process.env.FNB_CLIENT_SECRET = 'test-secret';
delete process.env.FNB_COMPANY_ID;
assert.equal(fnbConfiguredForCompany(102), true);
assert.equal(fnbConfiguredForCompany(110), false);
assert.equal(bankingProviderStatus(110).fnb.configured, false);
assert.equal(bankingProviderStatus(110).name, 'BankLink');
assert.equal(bankingProviderStatus(102).fnb.configured, true);
assert.equal(bankingProviderStatus(102).name, 'FNB Integration Channel');
process.env.FNB_COMPANY_ID = '999';
assert.equal(isFnbIntegrationCompany(999), true);
assert.equal(isFnbIntegrationCompany(102), false);
if (prevId == null) delete process.env.FNB_CLIENT_ID;
else process.env.FNB_CLIENT_ID = prevId;
if (prevSecret == null) delete process.env.FNB_CLIENT_SECRET;
else process.env.FNB_CLIENT_SECRET = prevSecret;
if (prevCompany == null) delete process.env.FNB_COMPANY_ID;
else process.env.FNB_COMPANY_ID = prevCompany;

const page = readFileSync(
  resolve('app/dashboard/accounting/bank-reconciliation/page.tsx'),
  'utf8'
);
assert.doesNotMatch(page, /Big Five Foods/);
assert.match(page, /fnb\?\.configured/);

const connections = readFileSync(
  resolve('app/api/banking/connections/route.ts'),
  'utf8'
);
assert.match(connections, /bankingProviderStatus/);
assert.match(connections, /fnbConfiguredForCompany|bankingProviderStatus/);

const connect = readFileSync(
  resolve('app/api/banking/connect/route.ts'),
  'utf8'
);
assert.match(connect, /isFnbIntegrationCompany/);
assert.match(connect, /not available for this company/);

const sync = readFileSync(resolve('app/api/banking/sync/route.ts'), 'utf8');
assert.match(sync, /isFnbIntegrationCompany/);

const probe = readFileSync(
  resolve('app/api/banking/fnb/probe/route.ts'),
  'utf8'
);
assert.match(probe, /isFnbIntegrationCompany/);

console.log('fnb-tenant.test.ts ok');
