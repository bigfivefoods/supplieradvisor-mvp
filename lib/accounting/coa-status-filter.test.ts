/**
 * Chart status filter: inactive accounts are opt-in.
 * Bank allocation keeps the default active, non-header list.
 * Run: npx --yes tsx lib/accounting/coa-status-filter.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  countCoaStatus,
  filterOperatingCoa,
  parseCoaStatus,
  type CoaListRow,
} from './coa-list';
import { coaPreviewJson } from './coa-preview';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const rows: CoaListRow[] = [
  { code: '1000', name: 'Assets', is_header: true, account_type: 'asset', is_active: true },
  { code: '1110', name: 'Bank', is_header: false, account_type: 'asset', is_active: true },
  { code: '6100', name: 'Salaries', is_header: false, account_type: 'expense', is_active: true },
  { code: '6200', name: 'Old rent', is_header: false, account_type: 'expense', is_active: false },
  { code: '6300', name: 'Retired insurance', is_header: false, account_type: 'expense', is_active: false },
  {
    code: '1180-0000004',
    name: 'AR — Hidden',
    is_header: false,
    account_type: 'asset',
    is_active: false,
  },
];

assert.equal(parseCoaStatus(null), null);
assert.equal(parseCoaStatus(''), null);
assert.equal(parseCoaStatus('active'), 'active');
assert.equal(parseCoaStatus('Inactive'), 'inactive');
assert.equal(parseCoaStatus('all'), 'all');
assert.equal(parseCoaStatus('closed'), null);

const omitted = filterOperatingCoa(rows, {});
assert.ok(omitted.some((a) => a.code === '1110'));
assert.ok(!omitted.some((a) => a.is_active === false));
assert.ok(!omitted.some((a) => String(a.code).startsWith('1180-')));

const inactive = filterOperatingCoa(rows, { status: 'inactive' });
assert.deepEqual(
  inactive.map((a) => a.code),
  ['6200', '6300']
);
assert.ok(inactive.every((a) => a.is_active === false));

const counts = countCoaStatus(filterOperatingCoa(rows, { status: 'all' }));
assert.equal(counts.inactive, 2);
assert.equal(counts.active, 3);

const searchedInactive = filterOperatingCoa(rows, { status: 'inactive', q: 'hidden' });
assert.ok(searchedInactive.some((a) => a.code === '1180-0000004'));
assert.ok(!filterOperatingCoa(rows, { status: 'active', q: 'hidden' }).length);

const coaGet = src('app/api/accounting/chart-of-accounts/route.ts').split(
  'export async function POST'
)[0];
assert.match(coaGet, /parseCoaStatus\(request\.nextUrl\.searchParams\.get\('status'\)\)/);
assert.match(coaGet, /countCoaStatus/);
const assigned = coaGet.split('accounts = filterOperatingCoa(')[1]?.slice(0, 220) || '';
assert.match(assigned, /status,/);
assert.doesNotMatch(assigned, /status:\s*'all'/);

const page = src('app/dashboard/accounting/chart-of-accounts/page.tsx');
assert.match(page, /aria-label="Status"/);
assert.match(page, /<option value="inactive">Inactive<\/option>/);
assert.match(page, /<option value="all">All statuses<\/option>/);
assert.match(page, /Reactivate/);
assert.match(page, /params\.set\('status', statusFilter\)/);
assert.match(page, /params\.set\('status', next\)/);
assert.match(page, /countBadge/);
assert.match(page, /setStatusFilter\('inactive'\)/);
assert.match(page, /limit['"]?\s*,\s*['"]500['"]/);
assert.doesNotMatch(page, /party_leaves/);
assert.doesNotMatch(page, /balances=1/);

const bank = src('app/dashboard/accounting/bank-reconciliation/page.tsx');
assert.match(bank, /!a\.is_header && a\.is_active !== false/);
assert.match(
  bank,
  /setCoa\(\(coaData\.accounts \|\| \[\]\)\.filter\(\(a: CoaAccount\) => !a\.is_header && a\.is_active !== false\)\)/
);
const coaParamsBlock = bank.split('const coaParams = new URLSearchParams')[1]?.split('const connParams')[0] || '';
assert.doesNotMatch(coaParamsBlock, /status/);
assert.match(
  bank,
  /\(seedData\.accounts as CoaAccount\[\]\)\.filter\(\s*\(a\) => !a\.is_header && a\.is_active !== false/
);

const previewInactive = coaPreviewJson(
  '/api/accounting/chart-of-accounts',
  new URLSearchParams('status=inactive')
) as { accounts: { code: string; is_active: boolean }[]; counts: { inactive: number } };
assert.ok(previewInactive.accounts.length > 0);
assert.ok(previewInactive.accounts.every((a) => a.is_active === false));
assert.equal(previewInactive.counts.inactive, previewInactive.accounts.length);
assert.ok(previewInactive.accounts.some((a) => a.code === '6200'));
assert.ok(!previewInactive.accounts.some((a) => a.code === '1110'));

const previewDefault = coaPreviewJson(
  '/api/accounting/chart-of-accounts',
  new URLSearchParams()
) as { accounts: { is_active?: boolean }[] };
assert.ok(previewDefault.accounts.every((a) => a.is_active !== false));

assert.match(page, /text-\[#00b4d8\]/);
assert.match(src('app/globals.css'), /background-color: #00b4d8/);
assert.doesNotMatch(src('lib/accounting/coa-preview.ts'), /supabase/i);
assert.doesNotMatch(src('lib/accounting/coa-preview.ts'), /\.insert\(/);

console.log('coa-status-filter.test.ts ok');
