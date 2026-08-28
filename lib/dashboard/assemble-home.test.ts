/**
 * Brief 11 — home assembler is rollup RPCs, not fat table scans.
 * Brief 14 — never select profiles.phone.
 * Run: npx --yes tsx lib/dashboard/assemble-home.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HOME_PROFILE_COLUMNS,
  dropUnknownProfileColumn,
} from './assemble-home';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const home = src('lib/dashboard/assemble-home.ts');
const homeFn = home.split('export async function assembleDashboardSummary')[1] || '';
assert.match(home, /sa_dashboard_home_rollup/);
assert.match(home, /sa_accounting_kpi_rollup/);
assert.match(home, /sa_customers_hub_summary/);
assert.doesNotMatch(homeFn, /\.from\('container_inventory'\)/);
assert.doesNotMatch(homeFn, /\.from\('invoice_feedback'\)/);
assert.doesNotMatch(homeFn, /\.from\('company_ratings'\)/);
assert.doesNotMatch(homeFn, /\.from\('opportunities'\)/);
assert.doesNotMatch(homeFn, /\.from\('containers'\)/);
assert.doesNotMatch(homeFn, /loadCompanyKpiSnapshot/);
assert.doesNotMatch(homeFn, /loadHoldingSubtree/);
assert.doesNotMatch(homeFn, /\.limit\(200\)/);
assert.doesNotMatch(homeFn, /\.limit\(500\)/);
assert.doesNotMatch(homeFn, /\.limit\(800\)/);

const summary = src('app/api/dashboard/summary/route.ts');
assert.match(summary, /assembleDashboardSummary/);
assert.doesNotMatch(summary, /container_inventory/);
assert.doesNotMatch(summary, /from\('opportunities'\)/);

const homeRoute = src('app/api/dashboard/home/route.ts');
assert.match(homeRoute, /assembleDashboardSummary/);
assert.match(homeRoute, /lib\/dashboard\/assemble-home/);

assert.ok(!HOME_PROFILE_COLUMNS.includes('phone'));
assert.ok(HOME_PROFILE_COLUMNS.includes('contact_phone'));
assert.ok(HOME_PROFILE_COLUMNS.includes('contact_number'));
assert.ok(!HOME_PROFILE_COLUMNS.includes('is_verified'));
assert.ok(!HOME_PROFILE_COLUMNS.includes('certifications'));
assert.ok(!HOME_PROFILE_COLUMNS.includes('industries'));
assert.doesNotMatch(homeFn, /[^_\w]phone[^_\w]/);
assert.doesNotMatch(homeFn, /companyRes\.error\.message/);

assert.deepEqual(
  dropUnknownProfileColumn(
    ['id', 'phone', 'email'],
    'column profiles.phone does not exist'
  ),
  ['id', 'email']
);
assert.equal(
  dropUnknownProfileColumn(
    ['id', 'contact_phone'],
    'column profiles.phone does not exist'
  ),
  null
);

const completeness = src('lib/business/completeness.ts');
assert.match(completeness, /contact_phone/);
assert.match(completeness, /contact_number/);

console.log('assemble-home Brief 11/14 tests ok');
