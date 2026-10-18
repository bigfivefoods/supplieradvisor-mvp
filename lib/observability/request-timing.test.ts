/**
 * Run: npx --yes tsx lib/observability/request-timing.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildTimingLog,
  countedFetch,
  formatServerTiming,
  safeRoutePattern,
  sampleRateFromEnv,
  shouldSample,
} from './request-timing';
import { requestTimingStore, withRequestTiming } from './request-timing-server';

const previousRate = process.env.REQUEST_TIMING_SAMPLE_RATE;

function restoreRate() {
  if (previousRate === undefined) delete process.env.REQUEST_TIMING_SAMPLE_RATE;
  else process.env.REQUEST_TIMING_SAMPLE_RATE = previousRate;
}

assert.equal(sampleRateFromEnv(undefined), 0.05);
assert.equal(sampleRateFromEnv(''), 0.05);
assert.equal(sampleRateFromEnv('nope'), 0.05);
assert.equal(sampleRateFromEnv('0'), 0);
assert.equal(sampleRateFromEnv('1'), 1);
assert.equal(sampleRateFromEnv('0.05'), 0.05);

assert.equal(shouldSample({ totalMs: 10, status: 200, rate: 0, random: 0.99 }), false);
assert.equal(shouldSample({ totalMs: 10, status: 200, rate: 1, random: 0.99 }), true);
assert.equal(shouldSample({ totalMs: 10, status: 200, rate: 0.05, random: 0.04 }), true);
assert.equal(shouldSample({ totalMs: 10, status: 200, rate: 0.05, random: 0.05 }), false);
assert.equal(shouldSample({ totalMs: 1000, status: 200, rate: 0, random: 0.99 }), true);
assert.equal(shouldSample({ totalMs: 12, status: 503, rate: 0, random: 0.99 }), true);

assert.equal(formatServerTiming(12.34, 4, 3), 'total;dur=12.3, db;dur=4.0, dbcalls;desc=3');
assert.equal(safeRoutePattern('/api/customers/4242?email=a@loadtest.invalid'), '/api/customers/:id');
assert.equal(safeRoutePattern('https://example.test/secret'), 'redacted-route');

async function main() {
const logs: string[] = [];
const request = new Request(
  'https://example.test/api/customers/4242?companyId=4242&email=person@loadtest.invalid&userId=user-sample&access_token=token-sample'
);
const ok = await withRequestTiming(
  '/api/customers/4242?email=person@loadtest.invalid',
  request,
  async () => new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Server-Timing': 'load;dur=1.0' } }),
  { sampleRate: 1, now: () => 0, log: (line) => logs.push(line) }
);
assert.equal(ok.status, 201);
assert.equal(await ok.text(), JSON.stringify({ ok: true }));
assert.match(ok.headers.get('Server-Timing') || '', /load;dur=1\.0/);
assert.match(ok.headers.get('Server-Timing') || '', /total;dur=0\.0, db;dur=0\.0, dbcalls;desc=0/);
assert.equal(logs.length, 1);
const parsed = JSON.parse(logs[0]) as { route: string; company?: string; status: number };
assert.equal(parsed.route, '/api/customers/:id');
assert.equal(parsed.status, 201);
assert.equal('company' in parsed, false);
assert.equal(logs[0].includes('4242'), false);
assert.equal(logs[0].includes('person@loadtest.invalid'), false);
assert.equal(logs[0].includes('user-sample'), false);
assert.equal(logs[0].includes('token-sample'), false);
assert.equal(logs[0].includes('access_token'), false);

logs.length = 0;
await withRequestTiming('/api/geo', new Request('https://example.test/api/geo'), async () => new Response('ok'), {
  sampleRate: 0,
  log: (line) => logs.push(line),
});
assert.equal(logs.length, 0);

logs.length = 0;
let ticks = 0;
await withRequestTiming('/api/geo', new Request('https://example.test/api/geo'), async () => new Response('ok', { status: 200 }), {
  sampleRate: 0,
  now: () => (ticks++ === 0 ? 0 : 1500),
  log: (line) => logs.push(line),
});
assert.equal(logs.length, 1);
assert.equal(JSON.parse(logs[0]).ms, 1500);
assert.equal(JSON.parse(logs[0]).status, 200);

logs.length = 0;
await withRequestTiming('/api/geo', new Request('https://example.test/api/geo'), async () => new Response('no', { status: 500 }), {
  sampleRate: 0,
  log: (line) => logs.push(line),
});
assert.equal(logs.length, 1);
assert.equal(JSON.parse(logs[0]).status, 500);

logs.length = 0;
await assert.rejects(
  () =>
    withRequestTiming('/api/dashboard/home', new Request('https://example.test/api/dashboard/home?companyId=7'), async () => {
      throw new Error('handler blew up');
    }, { sampleRate: 0, log: (line) => logs.push(line) }),
  /handler blew up/
);
assert.equal(logs.length, 1, 'a thrown route error logs once');
assert.equal(JSON.parse(logs[0]).status, 500);
assert.equal(logs[0].includes('handler blew up'), false);

const still = await withRequestTiming(
  '/api/geo',
  new Request('https://example.test/api/geo'),
  async () => new Response('body-stays'),
  {
    sampleRate: 1,
    log: () => {
      throw new Error('log sink failed');
    },
  }
);
assert.equal(await still.text(), 'body-stays');
assert.match(still.headers.get('Server-Timing') || '', /dbcalls;desc=0/);

const fakeFetch: typeof fetch = async () => new Response('row');
const wrapped = countedFetch(fakeFetch);
const slot = { dbCalls: 0, dbMs: 0 };
await requestTimingStore.run(slot, async () => {
  for (let i = 0; i < 4; i += 1) {
    const res = await wrapped('https://example.test/rest/v1/profiles');
    assert.equal(await res.text(), 'row');
  }
});
assert.equal(slot.dbCalls, 4);
assert.equal(slot.dbMs >= 0, true);

const outside = { dbCalls: 0, dbMs: 0 };
await wrapped('https://example.test/rest/v1/profiles');
assert.equal(outside.dbCalls, 0);

let failedCalls = 0;
const failing = countedFetch(async () => {
  failedCalls += 1;
  throw new Error('network down');
});
await assert.rejects(
  () => requestTimingStore.run(slot, () => failing('https://example.test/rest/v1/profiles')),
  /network down/
);
assert.equal(failedCalls, 1);
assert.equal(slot.dbCalls, 5);

const countedInside = await withRequestTiming(
  '/api/inventory/products',
  new Request('https://example.test/api/inventory/products?companyId=8'),
  async () => {
    const inner = countedFetch(async () => new Response('x'));
    await inner('https://example.test/rest/v1/products');
    await inner('https://example.test/rest/v1/products');
    return new Response('listed');
  },
  { sampleRate: 1, log: () => undefined }
);
assert.match(countedInside.headers.get('Server-Timing') || '', /dbcalls;desc=2/);
assert.equal(await countedInside.text(), 'listed');

const built = buildTimingLog({
  routePattern: '/api/me/companies',
  totalMs: 2,
  dbMs: 1,
  dbCalls: 1,
  status: 200,
});
assert.equal('company' in built, false);
assert.equal(JSON.stringify(built).includes('@'), false);

const routes: Array<[string, string]> = [
  ['app/api/dashboard/home/route.ts', '/api/dashboard/home'],
  ['app/api/me/companies/route.ts', '/api/me/companies'],
  ['app/api/fitness/fitgraph/route.ts', '/api/fitness/fitgraph'],
  ['app/api/customers/route.ts', '/api/customers'],
  ['app/api/suppliers/route.ts', '/api/suppliers'],
  ['app/api/inventory/products/route.ts', '/api/inventory/products'],
  ['app/api/inventory/stock/route.ts', '/api/inventory/stock'],
  ['app/api/accounting/chart-of-accounts/route.ts', '/api/accounting/chart-of-accounts'],
  ['app/api/accounting/journals/route.ts', '/api/accounting/journals'],
  ['app/api/storefront/[companySlug]/products/route.ts', '/api/storefront/:companySlug/products'],
  ['app/api/geo/route.ts', '/api/geo'],
  ['app/api/insights/collect/route.ts', '/api/insights/collect'],
];
for (const [file, pattern] of routes) {
  const text = readFileSync(file, 'utf8');
  assert.equal(text.includes('withRequestTiming'), true, file);
  assert.equal(text.includes(pattern), true, `${file} ${pattern}`);
}
const fitgraph = readFileSync('app/api/fitness/fitgraph/route.ts', 'utf8');
assert.equal(fitgraph.split("withRequestTiming('/api/fitness/fitgraph'").length - 1, 2);

process.env.REQUEST_TIMING_SAMPLE_RATE = '0';
const samples: number[] = [];
for (let i = 0; i < 30; i += 1) {
  await withRequestTiming('/api/bench', new Request('https://example.test/api/bench'), async () => new Response('ok'));
}
for (let i = 0; i < 80; i += 1) {
  const t0 = performance.now();
  const res = await withRequestTiming(
    '/api/bench',
    new Request('https://example.test/api/bench'),
    async () => new Response('ok')
  );
  samples.push(performance.now() - t0);
  assert.match(res.headers.get('Server-Timing') || '', /dbcalls;desc=0/);
}
samples.sort((a, b) => a - b);
const p50 = samples[Math.floor(samples.length / 2)];
console.log(`wrapper p50 ${p50.toFixed(3)} ms`);
assert.equal(p50 < 1, true, `wrapper p50 ${p50}ms`);

restoreRate();
console.log('request-timing.test.ts ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
