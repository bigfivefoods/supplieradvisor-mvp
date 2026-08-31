/**
 * Brief 15 — operating chart, not FACE-only; party leaves stay off first paint.
 * Run: npx --yes tsx lib/accounting/coa-list.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COA_LIST_MAX,
  filterOperatingCoa,
  isPartyLeafCode,
  parseCoaListLimit,
} from './coa-list';

const fixture = [
  { code: '1000', name: 'Assets', is_header: true, account_type: 'asset' },
  { code: '1110', name: 'Bank', is_header: false, account_type: 'asset' },
  { code: '1130', name: 'AR', is_header: false, account_type: 'asset' },
  { code: '1180', name: 'Customers', is_header: true, account_type: 'asset' },
  { code: '1180-0000001', name: 'AR — Acme', is_header: false, account_type: 'asset' },
  { code: '2180', name: 'Suppliers', is_header: true, account_type: 'liability' },
  { code: '2180-0000008', name: 'AP — Kelpack', is_header: false, account_type: 'liability' },
  { code: '4100', name: 'Sales revenue', is_header: false, account_type: 'revenue' },
  { code: '4400-0000001', name: 'legacy', is_header: false, account_type: 'revenue' },
  { code: '5100', name: 'COGS', is_header: false, account_type: 'cogs' },
  { code: '6100', name: 'Salaries', is_header: false, account_type: 'expense' },
];

const operating = filterOperatingCoa(fixture, {});
assert.ok(operating.some((a) => a.code === '4100' && !a.is_header));
assert.ok(operating.some((a) => a.code === '6100'));
assert.ok(operating.some((a) => a.code === '1110'));
assert.ok(operating.some((a) => a.code === '1180'));
assert.ok(operating.some((a) => a.code === '2180'));
assert.ok(!operating.some((a) => isPartyLeafCode(a.code)));
assert.ok(!operating.some((a) => String(a.code).startsWith('1180-')));
assert.ok(!operating.some((a) => String(a.code).startsWith('2180-')));
assert.ok(!operating.some((a) => String(a.code).startsWith('4400-')));

const leftovers = filterOperatingCoa(
  [
    ...fixture,
    { code: '1190', name: 'AR — Geeta', is_header: false, account_type: 'asset', is_active: true },
    { code: '4401', name: 'Member — Adele Corbitt', is_header: false, account_type: 'revenue', is_active: true },
    { code: '4400', name: 'Membership & care revenue', is_header: true, account_type: 'revenue', is_active: true },
    { code: '1191', name: 'AR — hidden', is_header: false, account_type: 'asset', is_active: false },
  ],
  {}
);
assert.ok(leftovers.some((a) => a.code === '4400'));
assert.ok(!leftovers.some((a) => a.code === '1190'));
assert.ok(!leftovers.some((a) => a.code === '4401'));
assert.ok(!leftovers.some((a) => a.code === '1191'));
const foundGeeta = filterOperatingCoa(
  [{ code: '1190', name: 'AR — Geeta', is_header: false, account_type: 'asset', is_active: false }],
  { q: 'geeta' }
);
assert.ok(foundGeeta.some((a) => a.code === '1190'));

const withLeaves = filterOperatingCoa(fixture, { partyLeaves: true });
assert.ok(withLeaves.some((a) => a.code === '1180-0000001'));
assert.equal(withLeaves.slice(0, 3).length, 3);
const inactiveLeaves = filterOperatingCoa(
  [...fixture, { code: '1180-0000099', name: 'AR — hidden', is_header: false, account_type: 'asset', is_active: false }],
  { partyLeaves: true }
);
assert.ok(!inactiveLeaves.some((a) => a.code === '1180-0000099'));

const searched = filterOperatingCoa(fixture, { q: '1180-' });
assert.ok(searched.some((a) => a.code === '1180-0000001'));
assert.ok(!searched.some((a) => a.code === '4100'));

assert.equal(parseCoaListLimit(null), 50);
assert.equal(parseCoaListLimit('500'), 500);
assert.equal(parseCoaListLimit('9999'), COA_LIST_MAX);
assert.ok(COA_LIST_MAX >= 500);

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const coaGet = src('app/api/accounting/chart-of-accounts/route.ts').split(
  'export async function POST'
)[0];
assert.match(coaGet, /filterOperatingCoa/);
assert.match(coaGet, /parseCoaListLimit/);
assert.doesNotMatch(coaGet, /FACE/);
assert.doesNotMatch(coaGet, /ensurePartyGlAccounts/);
assert.doesNotMatch(coaGet, /backfillPartyGlAccounts/);
assert.match(coaGet, /balances'\) === '1'/);

const coaPage = src('app/dashboard/accounting/chart-of-accounts/page.tsx');
assert.match(coaPage, /limit['"]?\s*,\s*['"]500['"]/);
assert.doesNotMatch(coaPage, /party_leaves/);
assert.doesNotMatch(coaPage, /balances=1/);

console.log('coa-list Brief 15 tests ok');
