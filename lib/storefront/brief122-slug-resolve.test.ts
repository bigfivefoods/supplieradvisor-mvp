/**
 * Run: npx --yes tsx lib/storefront/brief122-slug-resolve.test.ts
 * Fails if storefront resolve goes back to a slug scan loop or a second ilike.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveStoreCompany } from './catalog';
import {
  normaliseStoreSlug,
  storeSlugLookupValues,
} from './public-store';
import {
  clearStoreSlugCacheForTests,
  invalidateStoreSlugCache,
  readStoreSlugCache,
  setStoreSlugCacheClockForTests,
  storefrontMetaTouchesSlugCache,
  writeStoreSlugCache,
} from './slug-cache';
import type { StoreCompany } from './types';

const T0 = 1_700_000_000_000;
let now = T0;

type Filter = { method: string; args: unknown[] };
type Call = { table: string; filters: Filter[] };

function fakeDb(
  respond: (call: Call) => {
    data?: Record<string, unknown>[] | null;
    error?: { message: string } | null;
  }
) {
  const calls: Call[] = [];
  function builder(call: Call) {
    const b: Record<string, unknown> = {
      select() {
        return b;
      },
      filter(col: string, op: string, value: string) {
        call.filters.push({ method: 'filter', args: [col, op, value] });
        return b;
      },
      eq(...args: unknown[]) {
        call.filters.push({ method: 'eq', args });
        return b;
      },
      in(...args: unknown[]) {
        call.filters.push({ method: 'in', args });
        return b;
      },
      ilike(...args: unknown[]) {
        call.filters.push({ method: 'ilike', args });
        return b;
      },
      or(expr: string) {
        call.filters.push({ method: 'or', args: [expr] });
        return b;
      },
      not(...args: unknown[]) {
        call.filters.push({ method: 'not', args });
        return b;
      },
      order(...args: unknown[]) {
        call.filters.push({ method: 'order', args });
        return b;
      },
      limit(n: number) {
        call.filters.push({ method: 'limit', args: [n] });
        return b;
      },
      maybeSingle() {
        return b;
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (err: unknown) => unknown) {
        calls.push(call);
        return Promise.resolve(respond(call)).then(onFulfilled, onRejected);
      },
    };
    return b;
  }
  return {
    calls,
    from(table: string) {
      return builder({ table, filters: [] });
    },
  };
}

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    trading_name: 'Northwind',
    legal_name: 'Northwind',
    logo_url: null,
    short_description: 'Goods',
    description: null,
    verification_status: 'listed',
    city: 'Durban',
    country: 'South Africa',
    metadata: { store_slug: 'northwind' },
    is_discoverable: true,
    ...overrides,
  };
}

function reset() {
  now = T0;
  setStoreSlugCacheClockForTests(() => now);
  clearStoreSlugCacheForTests();
}

async function main() {
reset();

assert.equal(normaliseStoreSlug('  /Big-Five-Foods/ '), 'big-five-foods');
assert.equal(normaliseStoreSlug('Cafe\u0301'), 'caf\u00e9');
assert.deepEqual(storeSlugLookupValues('/Northwind/'), ['northwind', 'Northwind']);
assert.deepEqual(storeSlugLookupValues('northwind'), ['northwind']);
assert.deepEqual(storeSlugLookupValues('Cafe\u0301/'), ['caf\u00e9', 'Caf\u00e9']);

{
  const db = fakeDb(() => ({ data: [profileRow()] }));
  const first = await resolveStoreCompany('northwind', db);
  assert.equal(first?.id, 42);
  assert.equal(first?.tradingName, 'Northwind');
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].table, 'profiles');
  const filter = db.calls[0].filters.find((f) => f.method === 'filter');
  assert.deepEqual(filter?.args, ['metadata->>store_slug', 'eq', 'northwind']);
  assert.equal(
    db.calls[0].filters.some((f) => f.method === 'ilike'),
    false
  );
  const second = await resolveStoreCompany('northwind', db);
  assert.equal(second?.id, 42);
  assert.equal(db.calls.length, 1);
}

{
  reset();
  const db = fakeDb(() => ({ data: [profileRow()] }));
  const hit = await resolveStoreCompany('/Northwind/', db);
  assert.equal(hit?.id, 42);
  assert.equal(db.calls.length, 1);
  const filter = db.calls[0].filters.find((f) => f.method === 'filter');
  assert.equal(filter?.args[1], 'in');
  assert.equal(String(filter?.args[2]).includes('northwind'), true);
  assert.equal(String(filter?.args[2]).includes('Northwind'), true);
  const again = await resolveStoreCompany('northwind', db);
  assert.equal(again?.id, 42);
  assert.equal(db.calls.length, 1);
}

{
  reset();
  const db = fakeDb(() => ({ data: [] }));
  const first = await resolveStoreCompany('other-co', db);
  assert.equal(first, null);
  const reads = db.calls.length;
  assert.equal(reads, 2);
  const second = await resolveStoreCompany('other-co', db);
  assert.equal(second, null);
  assert.equal(db.calls.length, reads);
  now += 10_000;
  const third = await resolveStoreCompany('other-co', db);
  assert.equal(third, null);
  assert.equal(db.calls.length, reads + 2);
}

{
  reset();
  const db = fakeDb(() => ({ data: [], error: { message: 'reset' } }));
  await resolveStoreCompany('northwind', db);
  const reads = db.calls.length;
  await resolveStoreCompany('northwind', db);
  assert.ok(db.calls.length > reads);
}

{
  reset();
  const db = fakeDb((call) => {
    const exact = call.filters.some((f) => f.method === 'filter');
    if (exact) return { data: [] };
    const or = call.filters.find((f) => f.method === 'or');
    assert.ok(or);
    assert.equal(String(or.args[0]).includes('%'), false);
    assert.equal(call.filters.some((f) => f.method === 'ilike'), false);
    const limit = call.filters.find((f) => f.method === 'limit');
    assert.deepEqual(limit?.args, [1]);
    return {
      data: [profileRow({ trading_name: 'Big Five Foods', metadata: {} })],
    };
  });
  const company = await resolveStoreCompany('big-five-foods', db);
  assert.equal(company?.tradingName, 'Big Five Foods');
  assert.equal(db.calls.length, 2);
  assert.equal(
    db.calls.filter((c) => c.filters.some((f) => f.method === 'or')).length,
    1
  );
  const cached = await resolveStoreCompany('big-five-foods', db);
  assert.equal(cached?.id, 42);
  assert.equal(db.calls.length, 2);
}

{
  reset();
  const db = fakeDb((call) => {
    if (call.filters.some((f) => f.method === 'or')) {
      return { data: [] };
    }
    return { data: [] };
  });
  const shell = await resolveStoreCompany('big-five-foods', db);
  assert.equal(shell?.id, 0);
  assert.equal(shell?.slug, 'big-five-foods');
  assert.equal(db.calls.length, 2);
  const again = await resolveStoreCompany('big-five-foods', db);
  assert.equal(again?.id, 0);
  assert.equal(db.calls.length, 2);
  invalidateStoreSlugCache({ slug: 'big-five-foods', companyId: 42 });
  await resolveStoreCompany('big-five-foods', db);
  assert.equal(db.calls.length, 4);
}

{
  reset();
  const db = fakeDb((call) => {
    const exact = call.filters.some((f) => f.method === 'filter');
    if (exact) return { data: [] };
    const limit = call.filters.find((f) => f.method === 'limit');
    assert.deepEqual(limit?.args, [400]);
    assert.equal(call.filters.some((f) => f.method === 'or'), false);
    return { data: [profileRow({ metadata: {} })] };
  });
  const company = await resolveStoreCompany('northwind', db);
  assert.equal(company?.id, 42);
  assert.equal(db.calls.length, 2);
}

{
  reset();
  const cached: StoreCompany = {
    id: 7,
    slug: 'northwind',
    tradingName: 'Northwind',
    legalName: null,
    logoUrl: null,
    shortDescription: null,
    verificationStatus: null,
    city: null,
    country: null,
    tagline: 'Desk',
  };
  writeStoreSlugCache('northwind', cached);
  assert.equal(readStoreSlugCache('northwind').hit, true);
  invalidateStoreSlugCache({ companyId: 7 });
  assert.equal(readStoreSlugCache('northwind').hit, false);
  writeStoreSlugCache('northwind', null);
  now += 9_000;
  assert.equal(readStoreSlugCache('northwind').hit, true);
  now += 1_000;
  assert.equal(readStoreSlugCache('northwind').hit, false);
}

assert.equal(storefrontMetaTouchesSlugCache({ store_slug: 'northwind' }), true);
assert.equal(storefrontMetaTouchesSlugCache({ storefront_catalog: { mode: 'all' } }), true);
assert.equal(storefrontMetaTouchesSlugCache({ store_tagline: 'Desk' }), true);
assert.equal(storefrontMetaTouchesSlugCache({ city: 'Durban' }), false);

const catalogSrc = readFileSync('lib/storefront/catalog.ts', 'utf8');
assert.equal(catalogSrc.includes('%'), false);
assert.equal(catalogSrc.includes('.ilike('), false);
assert.equal(catalogSrc.includes('invalidateStoreSlugCache'), true);
const inventorySrc = readFileSync('app/api/inventory/storefront/route.ts', 'utf8');
assert.equal(inventorySrc.includes('invalidateStoreSlugCache'), true);
const companyDataSrc = readFileSync('lib/business/company-data.ts', 'utf8');
assert.equal(companyDataSrc.includes('dropCachedStoreCompany'), true);

setStoreSlugCacheClockForTests(null);
clearStoreSlugCacheForTests();
console.log('brief122-slug-resolve.test.ts ok');
}

main();
