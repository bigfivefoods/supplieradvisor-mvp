/**
 * Run: npx --yes tsx lib/storefront/brief122-slug-resolve.test.ts
 * Fails if storefront resolve goes back to a slug scan loop or a second ilike.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { persistStorefrontCatalog, resolveStoreCompany, seedBigFiveFoodsCatalog } from './catalog';
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
import {
  mergeProfileMetadata,
  setCompanyDataClientForTests,
} from '@/lib/business/company-data';

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
  assert.deepEqual(filter?.args, ['metadata->>store_slug', 'eq', 'northwind']);
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
  writeStoreSlugCache('northwind', sampleCompany(7, 'northwind'));
  now += 59_000;
  assert.equal(readStoreSlugCache('northwind').hit, true);
  now += 1_000;
  assert.equal(readStoreSlugCache('northwind').hit, false);
}

{
  reset();
  writeStoreSlugCache('shop', sampleCompany(7, 'other-co'));
  const db = fakeDb((call) => {
    const filter = call.filters.find((item) => item.method === 'filter');
    if (filter && filter.args[1] === 'eq' && filter.args[2] === 'shop') {
      return { data: [profileRow({ id: 8, trading_name: 'Tenant B', metadata: { store_slug: 'shop' } })] };
    }
    return { data: [] };
  });
  const served = await resolveStoreCompany('shop', db);
  assert.equal(served?.id, 8);
  assert.equal(db.calls.length, 1);
}

{
  reset();
  for (let n = 0; n < 2_000; n += 1) {
    writeStoreSlugCache(`co-${n}`, sampleCompany(7, `co-${n}`));
  }
  assert.equal(readStoreSlugCache('co-0').hit, true);
  writeStoreSlugCache('co-2000', sampleCompany(7, 'co-2000'));
  assert.equal(readStoreSlugCache('co-0').hit, false);
  assert.equal(readStoreSlugCache('co-2000').hit, true);
}

assert.equal(storefrontMetaTouchesSlugCache({ store_slug: 'northwind' }), true);
assert.equal(storefrontMetaTouchesSlugCache({ storefront_catalog: { mode: 'all' } }), true);
assert.equal(storefrontMetaTouchesSlugCache({ store_tagline: 'Desk' }), true);
assert.equal(storefrontMetaTouchesSlugCache({ city: 'Durban' }), false);

{
  reset();
  const mixed = profileRow({
    id: 7,
    trading_name: 'Tenant A',
    metadata: { store_slug: 'Shop' },
  });
  const lower = profileRow({
    id: 8,
    trading_name: 'Tenant B',
    metadata: { store_slug: 'shop' },
  });
  const db = fakeDb((call) => {
    const filter = call.filters.find((item) => item.method === 'filter');
    if (!filter) return { data: [] };
    if (filter.args[1] === 'in') return { data: [mixed] };
    if (filter.args[1] === 'eq' && filter.args[2] === 'shop') return { data: [lower] };
    return { data: [mixed] };
  });
  const fromMixed = await resolveStoreCompany('Shop', db);
  assert.equal(fromMixed?.id, 8);
  assert.equal(fromMixed?.tradingName, 'Tenant B');
  const fromLower = await resolveStoreCompany('shop', db);
  assert.equal(fromLower?.id, 8);
  assert.equal(db.calls.length, 1, 'the lower-case slug must reuse the cached company');
}

function sampleCompany(id: number, slug: string): StoreCompany {
  return {
    id,
    slug,
    tradingName: 'Northwind',
    legalName: null,
    logoUrl: null,
    shortDescription: null,
    verificationStatus: null,
    city: null,
    country: null,
    tagline: 'Desk',
  };
}

function metadataClient(mode: 'rpc' | 'direct') {
  function builder(result: { data: unknown; error: { message: string; code?: string } | null }) {
    const b: Record<string, unknown> = {
      select() {
        return b;
      },
      update() {
        return b;
      },
      insert() {
        return b;
      },
      eq() {
        return b;
      },
      maybeSingle() {
        return Promise.resolve(result);
      },
      single() {
        return Promise.resolve(result);
      },
      then(onFulfilled: (value: unknown) => unknown) {
        return Promise.resolve(result).then(onFulfilled);
      },
    };
    return b;
  }
  return {
    rpc() {
      if (mode === 'rpc') return Promise.resolve({ error: null });
      return Promise.resolve({
        error: { code: 'PGRST202', message: 'Could not find the function sa_merge_profile_metadata' },
      });
    },
    from() {
      return builder({ data: { metadata: {}, id: 7 }, error: null });
    },
  };
}

async function expectDrop(patch: Record<string, unknown>, mode: 'rpc' | 'direct') {
  reset();
  writeStoreSlugCache('northwind', sampleCompany(7, 'northwind'));
  setCompanyDataClientForTests(metadataClient(mode));
  await mergeProfileMetadata(7, patch);
  setCompanyDataClientForTests(null);
  assert.equal(readStoreSlugCache('northwind').hit, false, JSON.stringify(patch));
}

await expectDrop({ store_slug: 'other-co' }, 'rpc');
await expectDrop({ storefront_catalog: { mode: 'all' } }, 'rpc');
await expectDrop({ store_tagline: 'Desk line' }, 'rpc');
await expectDrop({ store_slug: 'other-co' }, 'direct');
await expectDrop({ storefront_catalog: { mode: 'all' } }, 'direct');
await expectDrop({ store_tagline: 'Desk line' }, 'direct');

{
  reset();
  writeStoreSlugCache('northwind', sampleCompany(7, 'northwind'));
  setCompanyDataClientForTests(metadataClient('rpc'));
  await mergeProfileMetadata(7, { city: 'Durban' });
  setCompanyDataClientForTests(null);
  assert.equal(readStoreSlugCache('northwind').hit, true);
}

{
  reset();
  writeStoreSlugCache('northwind', sampleCompany(7, 'northwind'));
  const saved = await persistStorefrontCatalog(metadataClient('rpc'), 7, {
    mode: 'all',
    product_ids: [],
    seed_keys: [],
    gym_item_ids: [],
  });
  assert.equal(saved, null);
  assert.equal(readStoreSlugCache('northwind').hit, false);
}

{
  reset();
  writeStoreSlugCache('big-five-foods', sampleCompany(7, 'big-five-foods'));
  const seeded = await seedBigFiveFoodsCatalog({
    profileId: 7,
    client: metadataClient('rpc'),
  });
  assert.equal(seeded.profileId, 7);
  assert.equal(readStoreSlugCache('big-five-foods').hit, false);
}

const catalogSrc = readFileSync('lib/storefront/catalog.ts', 'utf8');
assert.equal(catalogSrc.includes('%'), false);
assert.equal(catalogSrc.includes('.ilike('), false);
assert.equal(catalogSrc.includes('invalidateStoreSlugCache'), true);
const inventorySrc = readFileSync('app/api/inventory/storefront/route.ts', 'utf8');
assert.equal(inventorySrc.includes('persistStorefrontCatalog'), true);
assert.equal(inventorySrc.includes('.update('), false);
const companyDataSrc = readFileSync('lib/business/company-data.ts', 'utf8');
assert.equal(companyDataSrc.includes('dropCachedStoreCompany'), true);

setStoreSlugCacheClockForTests(null);
clearStoreSlugCacheForTests();
console.log('brief122-slug-resolve.test.ts ok');
}

main();
