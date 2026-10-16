/**
 * Run: npx --yes tsx lib/brief119-catalogue-downloads.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GET } from '@/app/catalogues/[id]/download/route';
import { catalogueFileUrl, catalogueById } from '@/lib/catalogues';
import {
  CATALOGUE_DOWNLOAD_EVENT,
  CATALOGUE_DOWNLOAD_TRACK_HEADERS,
  CATALOGUE_DOWNLOAD_TRACK_TIMEOUT_MS,
  recordCatalogueDownload,
  shouldRecordCatalogueDownload,
} from '@/lib/catalogues/download-count';

const HUMAN =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const VISITOR_IP = '203.0.113.50';
const VISITOR_COOKIE = 'sb-access-token=secret-session';

type Captured = {
  headers: Headers;
  body: { en?: string; ed?: Record<string, unknown> };
};

function request(id: string, method: string, userAgent: string | null) {
  const headers = new Headers();
  if (userAgent !== null) headers.set('user-agent', userAgent);
  headers.set('x-forwarded-for', VISITOR_IP);
  headers.set('cookie', VISITOR_COOKIE);
  return new Request(`https://example.com/catalogues/${id}/download?download=1`, { method, headers });
}

async function withCapture(run: (calls: Captured[]) => Promise<void>) {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.VERCEL_URL;
  const calls: Captured[] = [];
  process.env.VERCEL_URL = 'analytics.example.test';
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? '{}')) as Captured['body'],
    });
    return new Response('ok', { status: 200 });
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousUrl;
  }
}

function assertNoVisitorLeak(call: Captured) {
  const headerText = [...call.headers.entries()].map(([key, value]) => `${key}: ${value}`).join('\n');
  assert.equal(call.body.en, CATALOGUE_DOWNLOAD_EVENT);
  assert.deepEqual(call.body.ed, { id: 'trade' });
  assert.deepEqual(Object.keys(call.body.ed ?? {}), ['id']);
  assert.doesNotMatch(headerText, new RegExp(VISITOR_IP));
  assert.doesNotMatch(headerText, /sb-access-token/);
  assert.doesNotMatch(headerText, /secret-session/);
  assert.doesNotMatch(headerText, /iPhone/);
  assert.equal(call.headers.get('user-agent'), CATALOGUE_DOWNLOAD_TRACK_HEADERS['user-agent']);
  // The SDK copies these fields from the headers we pass. We omit them, so the
  // outbound values are empty placeholders, never the visitor session or address.
  for (const key of ['cookie', 'x-vercel-ip'] as const) {
    const value = call.headers.get(key);
    assert.ok(value === null || value === '' || value === 'undefined', `${key}=${value}`);
  }
}

assert.equal(shouldRecordCatalogueDownload({ method: 'GET', userAgent: HUMAN }), true);
assert.equal(shouldRecordCatalogueDownload({ method: 'HEAD', userAgent: HUMAN }), false);
assert.equal(shouldRecordCatalogueDownload({ method: 'POST', userAgent: HUMAN }), false);
assert.equal(shouldRecordCatalogueDownload({ method: 'GET', userAgent: GOOGLEBOT }), false);
assert.equal(shouldRecordCatalogueDownload({ method: 'GET', userAgent: 'curl/8.0' }), false);
assert.equal(shouldRecordCatalogueDownload({ method: 'GET', userAgent: 'Mozilla/5.0' }), false);
assert.equal(shouldRecordCatalogueDownload({ method: 'GET', userAgent: null }), false);
assert.equal(shouldRecordCatalogueDownload({ method: 'GET', userAgent: '' }), false);

assert.deepEqual(Object.keys(CATALOGUE_DOWNLOAD_TRACK_HEADERS), ['user-agent']);
assert.equal(CATALOGUE_DOWNLOAD_TRACK_HEADERS['user-agent'], 'catalogue-download');

const routeSrc = readFileSync(resolve(process.cwd(), 'app/catalogues/[id]/download/route.ts'), 'utf8');
const helperSrc = readFileSync(resolve(process.cwd(), 'lib/catalogues/download-count.ts'), 'utf8');
assert.match(routeSrc, /recordCatalogueDownload/);
assert.doesNotMatch(routeSrc, /searchParams|request\.url|x-forwarded-for|@vercel\/analytics/);
assert.match(helperSrc, /CATALOGUE_DOWNLOAD_EVENT/);
assert.doesNotMatch(helperSrc, /x-forwarded-for|cookie|incoming\.headers/);

async function main() {
await withCapture(async (calls) => {
  const res = await GET(request('trade', 'GET', HUMAN), { params: Promise.resolve({ id: 'trade' }) });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), catalogueFileUrl(catalogueById('trade')!, { download: true }));
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  assert.equal(calls.length, 1);
  assertNoVisitorLeak(calls[0]!);
});

await withCapture(async (calls) => {
  for (const [id, method, ua] of [
    ['trade', 'HEAD', HUMAN],
    ['trade', 'GET', GOOGLEBOT],
    ['trade', 'GET', 'Mozilla/5.0'],
    ['trade', 'GET', null],
    ['not-a-catalogue', 'GET', HUMAN],
    ['system', 'GET', HUMAN],
    ['recover', 'GET', HUMAN],
  ] as const) {
    const res = await GET(request(id, method, ua), { params: Promise.resolve({ id }) });
    if (id === 'trade') assert.equal(res.status, 302, `${method} ${ua}`);
    else assert.equal(res.status, 404, id);
  }
  assert.equal(calls.length, 0);
});

await withCapture(async (calls) => {
  const previousFetch = globalThis.fetch;
  const previousError = console.error;
  globalThis.fetch = (() => {
    throw new Error('analytics down');
  }) as typeof fetch;
  console.error = () => {};
  try {
    const res = await GET(request('gym', 'GET', HUMAN), { params: Promise.resolve({ id: 'gym' }) });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('Location') ?? '', /gym-advisor-catalogue\.pdf\?download=1/);
  } finally {
    globalThis.fetch = previousFetch;
    console.error = previousError;
  }
  assert.equal(calls.length, 0);
});

const started = Date.now();
await recordCatalogueDownload('trade', () => new Promise<void>(() => {}));
const elapsed = Date.now() - started;
assert.ok(elapsed >= CATALOGUE_DOWNLOAD_TRACK_TIMEOUT_MS - 50, `elapsed ${elapsed}`);
assert.ok(elapsed < CATALOGUE_DOWNLOAD_TRACK_TIMEOUT_MS + 400, `elapsed ${elapsed}`);

await recordCatalogueDownload('trade', () => {
  throw new Error('track threw');
});
await recordCatalogueDownload('not-a-catalogue');
await recordCatalogueDownload('system');
await recordCatalogueDownload('recover');

console.log('brief119-catalogue-downloads.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
