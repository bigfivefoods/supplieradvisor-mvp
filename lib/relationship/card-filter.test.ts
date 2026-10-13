/**
 * Run: npx --yes tsx lib/relationship/card-filter.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crmPreviewBook } from '../customers/crm-preview';
import { srmPreviewBook } from '../suppliers/srm-preview';
import {
  cardQueryActive,
  cardQueryFromParams,
  customerMatches,
  emptyCardQuery,
  resultCount,
  scoreBand,
  supplierMatches,
  writeListParams,
} from './card-filter';

const customers = crmPreviewBook('2026-10-13').customers;
const suppliers = srmPreviewBook('2026-10-13').suppliers;
const open = emptyCardQuery();

assert.equal(customers.filter((row) => customerMatches(row, open)).length, 4);
const prospect = { ...open, status: 'prospect' };
assert.deepEqual(
  customers.filter((row) => customerMatches(row, prospect)).map((row) => row.trading_name),
  ['Limekiln Quarry']
);
const cape = { ...open, q: 'cape town' };
assert.equal(customers.filter((row) => customerMatches(row, cape)).length, 2);

assert.equal(suppliers.filter((row) => supplierMatches(row, open)).length, 2);
const preferred = { ...open, status: 'preferred' };
assert.deepEqual(
  suppliers.filter((row) => supplierMatches(row, preferred)).map((row) => row.trading_name),
  ['Kelpac Marine']
);
const high = { ...open, band: 'high' };
assert.deepEqual(
  suppliers.filter((row) => supplierMatches(row, high)).map((row) => row.trading_name),
  ['Kelpac Marine']
);
assert.equal(scoreBand(null), 'none');
assert.equal(scoreBand(96), 'high');
const missing = { ...open, compliance: 'missing' };
assert.deepEqual(
  suppliers.filter((row) => supplierMatches(row, missing)).map((row) => row.trading_name),
  ['Noord Mill']
);

const parsed = cardQueryFromParams(new URLSearchParams('status=prospect&q=lime'));
assert.equal(parsed.status, 'prospect');
assert.equal(parsed.q, 'lime');
assert.equal(cardQueryActive(parsed), true);
assert.equal(cardQueryActive(open), false);

const written = writeListParams(new URLSearchParams('screen=profiles&id=-1'), prospect, 'name');
assert.equal(written.get('status'), 'prospect');
assert.equal(written.get('screen'), 'profiles');
assert.equal(written.get('id'), '-1');
assert.equal(written.get('sort'), null);
assert.equal(written.get('band'), null);
assert.equal(resultCount(1, 4, 'customer'), '1 of 4');
assert.equal(resultCount(4, 4, 'customer'), '4 customers');

const card = readFileSync(resolve('components/relationship/ProfileCard.tsx'), 'utf8');
const bar = readFileSync(resolve('components/relationship/CardFilterBar.tsx'), 'utf8');
for (const src of [card, bar]) {
  assert.match(src, /#00b4d8/);
  assert.match(src, /text-slate-950/);
  assert.doesNotMatch(src, /#0099b8/);
  assert.doesNotMatch(src, /bg-\[#00b4d8\][^"'`]*text-white/);
}
assert.match(bar, /aria-pressed/);
assert.match(bar, /Escape/);

console.log('relationship/card-filter.test.ts ok');
