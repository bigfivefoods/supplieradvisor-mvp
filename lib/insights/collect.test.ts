/**
 * Run: npx --yes tsx lib/insights/collect.test.ts
 * Uses an in-memory fetch. It does not call the production collector or database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectInsights } from './collect';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const VID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';

function beacon(headers: Record<string, string>, body: string) {
  return new Request('https://www.supplieradvisor.com/api/insights/collect', {
    method: 'POST',
    headers: { 'user-agent': UA, ...headers },
    body,
  });
}

function pageview(visitor = VID) {
  return JSON.stringify({ v: 1, e: [{ k: 'pageview', p: '/', visitor }] });
}

async function main() {
const prevKey = process.env.INSIGHTS_INGEST_KEY;
process.env.INSIGHTS_INGEST_KEY = 'test-key';

let deferred = 0;
const optedOut = await collectInsights(
  beacon({ dnt: '1' }, pageview()),
  { defer() { deferred += 1; } }
);
assert.equal(optedOut.status, 204);
assert.equal(deferred, 0);

const gpc = await collectInsights(
  beacon({ 'sec-gpc': '1' }, pageview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02')),
  { defer() { deferred += 1; } }
);
assert.equal(gpc.status, 204);
assert.equal(deferred, 0);

const bot = await collectInsights(
  beacon({ 'user-agent': 'curl/8.5.0' }, pageview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03')),
  { defer() { deferred += 1; } }
);
assert.equal(bot.status, 204);
assert.equal(deferred, 0);

const bad = await collectInsights(beacon({}, '{'), {
  defer() { deferred += 1; },
});
assert.equal(bad.status, 204);
assert.equal(deferred, 0);

let gate: () => void = () => undefined;
const opened = new Promise<void>((resolveGate) => {
  gate = resolveGate;
});
let started = false;
let finished = false;
let seenBody = '';
let seenAddressInUrl = false;
const jobs: Promise<void>[] = [];
const startedAt = performance.now();
const recorded = await collectInsights(
  beacon(
    {
      'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      'x-vercel-ip-country': 'ZA',
      'x-vercel-ip-country-region': 'KZN',
      'x-vercel-ip-city': 'Durban',
    },
    JSON.stringify({
      v: 1,
      e: [{ k: 'pageview', p: '/', visitor: VID, email: 'owner@example.com', ip: '203.0.113.50' }],
    })
  ),
  {
    defer(task) {
      jobs.push(task());
    },
    lookup: async (ip) => {
      assert.equal(ip, '203.0.113.50');
      return { organisation: 'Example Pty Ltd', country: 'US', city: 'Elsewhere' };
    },
    fetchImpl: async (url, init) => {
      started = true;
      seenAddressInUrl = String(url).includes('203.0.113.50');
      seenBody = String(init?.body || '');
      await opened;
      finished = true;
      return new Response(null, { status: 204 });
    },
  }
);
const responseMs = performance.now() - startedAt;
assert.equal(recorded.status, 204);
assert.equal(recorded.headers.get('cache-control'), 'no-store');
assert.equal(started, true);
assert.equal(finished, false);
assert.ok(responseMs < 100, `response waited ${responseMs.toFixed(1)} ms`);
assert.equal(seenAddressInUrl, false);
assert.match(seenBody, /"organisation":"Example Pty Ltd"/);
assert.match(seenBody, /"country":"ZA"/);
assert.match(seenBody, /"city":"Durban"/);
assert.doesNotMatch(seenBody, /203\.0\.113\.50/);
assert.doesNotMatch(seenBody, /owner@example.com/);
assert.doesNotMatch(seenBody, /Elsewhere/);
gate();
await Promise.all(jobs);
assert.equal(finished, true);
const forwardMs = performance.now() - startedAt;
assert.ok(forwardMs >= responseMs);
console.log(
  `collect defer timing: response ${responseMs.toFixed(1)} ms, forward finished ${forwardMs.toFixed(1)} ms (gate held the collector)`
);

const sleepJobs: Promise<void>[] = [];
const sleepStarted = performance.now();
await collectInsights(
  beacon({ 'x-forwarded-for': '203.0.113.77' }, pageview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04')),
  {
    defer(task) {
      sleepJobs.push(task());
    },
    lookup: async () => ({}),
    fetchImpl: async () => {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 200));
      return new Response(null, { status: 204 });
    },
  }
);
const sleepResponseMs = performance.now() - sleepStarted;
assert.ok(sleepResponseMs < 100, `slept response ${sleepResponseMs.toFixed(1)} ms`);
await Promise.all(sleepJobs);
const sleepTotalMs = performance.now() - sleepStarted;
assert.ok(sleepTotalMs >= 200, `forward ${sleepTotalMs.toFixed(1)} ms`);
console.log(
  `collect defer timing: response ${sleepResponseMs.toFixed(1)} ms while a 200 ms collector was in flight (done at ${sleepTotalMs.toFixed(1)} ms)`
);

let lookups = 0;
let vitalSent = false;
const vitalJobs: Promise<void>[] = [];
await collectInsights(
  beacon({}, JSON.stringify({ v: 1, e: [{ k: 'vital', p: '/', l: 'lcp', v: 1200, visitor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05' }] })),
  {
    defer(task) {
      vitalJobs.push(task());
    },
    lookup: async () => {
      lookups += 1;
      return { organisation: 'Should Not Run' };
    },
    fetchImpl: async (_url, init) => {
      vitalSent = true;
      assert.match(String(init?.body || ''), /"l":"lcp"/);
      assert.doesNotMatch(String(init?.body || ''), /Should Not Run/);
      return new Response(null, { status: 204 });
    },
  }
);
await Promise.all(vitalJobs);
assert.equal(lookups, 0);
assert.equal(vitalSent, true);

const limitIp = '198.51.100.20';
const limitVisitor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06';
let scheduled = 0;
for (let i = 0; i < 120; i += 1) {
  const res = await collectInsights(
    beacon({ 'x-forwarded-for': limitIp }, pageview(limitVisitor)),
    { defer() { scheduled += 1; } }
  );
  assert.equal(res.status, 204);
}
assert.equal(scheduled, 120);
scheduled = 0;
const limited = await collectInsights(
  beacon({ 'x-forwarded-for': limitIp }, pageview(limitVisitor)),
  { defer() { scheduled += 1; } }
);
assert.equal(limited.status, 204);
assert.equal(scheduled, 0);

const route = readFileSync(resolve('app/api/insights/collect/route.ts'), 'utf8');
const collectSrc = readFileSync(resolve('lib/insights/collect.ts'), 'utf8');
assert.match(route, /deferInsightsRecord/);
assert.match(route, /after\(fn\)/);
assert.match(route, /\(\) => task\(\)\.catch\(\(\) => undefined\)/);
assert.match(route, /withRequestTiming\('\/api\/insights\/collect'/);
assert.doesNotMatch(route, /await forwardInsights/);
assert.doesNotMatch(route, /await lookupNetwork/);
assert.doesNotMatch(route, /console\./);
assert.doesNotMatch(route, /verifyPrivyAccessToken/);
assert.doesNotMatch(route, /sessionEmail/);
assert.match(collectSrc, /insightsOptOut/);
assert.match(collectSrc, /isBotUa/);
assert.match(collectSrc, /checkRateLimit/);
assert.match(collectSrc, /sanitizeBatch/);
assert.match(collectSrc, /lookupNetwork/);
assert.match(collectSrc, /forwardInsights/);
assert.match(collectSrc, /batchContainsRawIp|forwardInsights/);
assert.doesNotMatch(collectSrc, /console\./);
assert.doesNotMatch(collectSrc, /verifyPrivyAccessToken/);

if (prevKey === undefined) delete process.env.INSIGHTS_INGEST_KEY;
else process.env.INSIGHTS_INGEST_KEY = prevKey;

console.log('insights collect tests ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
