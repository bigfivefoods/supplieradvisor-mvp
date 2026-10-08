/**
 * Run: npx --yes tsx lib/insights/visitor.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { forwardInsights, insightsIngestUrl } from './forward';
import { lookupNetwork } from './ipinfo';
import {
  DEFAULT_INGEST_URL,
  INSIGHTS_SITE,
  VISITOR_COOKIE,
  VISITOR_MAX_AGE_SEC,
  batchContainsEmail,
  batchContainsRawIp,
  factsFromIpinfo,
  insightsOptOut,
  nextVisitorState,
  outboundHost,
  parseVisitorCookie,
  pdfName,
  publicPath,
  readUtm,
  sanitizeBatch,
  screenBand,
  scrollBand,
  visitorCookieValue,
} from './visitor';

const EVENT_ID =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

assert.equal(VISITOR_MAX_AGE_SEC, 180 * 24 * 60 * 60);
assert.equal(VISITOR_COOKIE, 'sa_vid');
assert.equal(insightsOptOut({ doNotTrack: '1' }), true);
assert.equal(insightsOptOut({ doNotTrack: 'yes' }), true);
assert.equal(insightsOptOut({ msDoNotTrack: '1' }), true);
assert.equal(insightsOptOut({ globalPrivacyControl: true }), true);
assert.equal(insightsOptOut({ secGpc: '1' }), true);
assert.equal(insightsOptOut({ doNotTrack: '0', globalPrivacyControl: false }), false);
assert.equal(insightsOptOut({}), false);

assert.equal(screenBand(320), 'xs');
assert.equal(screenBand(480), 'sm');
assert.equal(screenBand(800), 'md');
assert.equal(screenBand(1200), 'lg');
assert.equal(screenBand(1440), 'xl');
assert.equal(screenBand(1920), 'xl');
assert.equal(scrollBand(0.37), 25);
assert.equal(scrollBand(1), 100);

assert.equal(publicPath('/portal/secret-token'), null);
assert.equal(publicPath('/api/insights/collect'), null);
assert.equal(publicPath('/pricing?utm_source=x'), '/pricing');
assert.equal(
  publicPath('/share/abcdefghijklmnopqrstuvwxyz012345'),
  '/share/:token'
);

const utm = readUtm('?utm_source=newsletter&utm_medium=email&utm_campaign=spring&utm_content=hero&utm_term=supply');
assert.deepEqual(utm, {
  s: 'newsletter',
  m: 'email',
  c: 'spring',
  content: 'hero',
  term: 'supply',
});

assert.equal(pdfName('https://www.supplieradvisor.com/files/Profile.PDF', 'https://www.supplieradvisor.com'), 'profile.pdf');
assert.equal(outboundHost('https://www.bigfivegroup.africa/contact', 'https://www.supplieradvisor.com'), 'bigfivegroup.africa');
assert.equal(outboundHost('/privacy', 'https://www.supplieradvisor.com'), undefined);

const id = '11111111-1111-4111-8111-111111111111';
const first = nextVisitorState(null, 1_700_000_000, id);
assert.equal(first.isNew, true);
assert.equal(first.recencyDays, null);
assert.equal(first.cookie.visits, 1);
const again = nextVisitorState(
  parseVisitorCookie(visitorCookieValue(first.cookie)),
  1_700_000_000 + 3 * 86400,
  '22222222-2222-4222-8222-222222222222'
);
assert.equal(again.isNew, false);
assert.equal(again.cookie.id, id);
assert.equal(again.cookie.visits, 2);
assert.equal(again.recencyDays, 3);
assert.equal(parseVisitorCookie('8.8.8.8.1.1'), null);

const batch = sanitizeBatch({
  v: 1,
  e: [
    {
      k: 'pageview',
      p: '/pricing',
      a: false,
      r: 'https://www.google.com/search?q=secret',
      u: utm,
      device: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
      screen: 'lg',
      lang: 'en-ZA',
      landing: '/',
      exit: '/pricing',
      pages: ['/', '/pricing'],
      scroll: 62,
      visitor: id,
      new: false,
      frequency: 2,
      recency_days: 3,
      email: 'person@example.com',
      ip: '8.8.8.8',
      city: 'Cape Town',
      latitude: -33.9,
    },
    { k: 'pdf', p: '/files', l: 'profile.pdf' },
    { k: 'outbound', p: '/', l: 'bigfivegroup.africa' },
    { k: 'click', p: '/', l: 'Start free trial' },
    { k: 'click', p: '/', l: 'person@example.com' },
    { k: 'pageview', p: '/portal/abc' },
  ],
});
assert.ok(batch);
assert.equal(batch.site, INSIGHTS_SITE);
assert.equal(INSIGHTS_SITE, 'supplieradvisor.com');
assert.equal('project' in batch, false);
assert.equal(batch.e.length, 4);
assert.equal(batch.e[0].r, 'https://www.google.com/search');
assert.equal(batch.e[0].u?.content, 'hero');
assert.equal(batch.e[0].u?.term, 'supply');
assert.equal(batch.e[0].scroll, 50);
assert.equal((batch.e[0] as { email?: string }).email, undefined);
assert.equal((batch.e[0] as { ip?: string }).ip, undefined);
assert.equal(batch.e[0].city, undefined);
assert.equal(batch.e[3].l, 'Start free trial');
for (const event of batch.e) assert.match(event.id, EVENT_ID);
assert.equal(batchContainsRawIp(batch), false);
assert.equal(batchContainsEmail(batch), false);

const keptId = 'ab'.repeat(16);
const aliased = sanitizeBatch({
  v: 1,
  site: 'supplieradvisor-mvp',
  e: [
    { k: 'pageview', p: '/', id: keptId },
    { k: 'engage', p: '/', ms: 100, scroll: 0 },
    { k: 'engage', p: '/', ms: 500 },
    { k: 'engage', p: '/about', ms: 0, scroll: 25 },
    { k: 'pageview', p: '/a' },
    { k: 'pageview', p: '/b' },
    { k: 'pageview', p: '/c' },
    { k: 'pageview', p: '/d' },
    { k: 'pageview', p: '/e' },
    { k: 'pageview', p: '/f' },
    { k: 'pageview', p: '/g' },
    { k: 'pageview', p: '/dropped' },
  ],
});
assert.ok(aliased);
assert.equal(aliased.site, 'supplieradvisor.com');
assert.equal(aliased.e.length, 9);
assert.equal(aliased.e[0].id, keptId);
assert.equal(aliased.e[1].k, 'engage');
assert.equal(aliased.e[1].ms, 500);
assert.equal(aliased.e[2].k, 'engage');
assert.equal(aliased.e[2].scroll, 25);
assert.equal(aliased.e.some((event) => event.p === '/dropped'), false);
assert.equal(
  sanitizeBatch({ v: 1, site: 'www.supplieradvisor.com', e: [{ k: 'pageview', p: '/' }] })?.site,
  'supplieradvisor.com'
);
assert.equal(
  sanitizeBatch({ v: 1, site: 'bigfivegroup.africa', e: [{ k: 'pageview', p: '/' }] })?.site,
  'supplieradvisor.com'
);

const facts = factsFromIpinfo({
  ip: '8.8.8.8',
  city: 'Mountain View',
  region: 'California',
  country: 'US',
  loc: '37.4056,-122.0775',
  postal: '94043',
  timezone: 'America/Los_Angeles',
  org: 'AS15169 Google LLC',
  company: { name: 'Google LLC', domain: 'google.com', type: 'hosting', industry: 'Internet', size: 5000 },
  asn: { type: 'hosting' },
});
assert.equal(facts.city, 'Mountain View');
assert.equal(facts.region, 'California');
assert.equal(facts.country, 'US');
assert.equal(facts.timezone, 'America/Los_Angeles');
assert.equal(facts.organisation, 'Google LLC');
assert.equal(facts.industry, 'Internet');
assert.equal(facts.size, '1000+');
assert.equal(facts.network, 'hosting');
assert.equal((facts as { ip?: string }).ip, undefined);
assert.equal((facts as { loc?: string }).loc, undefined);
assert.equal(batchContainsRawIp({ ...batch, e: [{ ...batch.e[0], ...facts }] }), false);

const enriched = {
  ...batch,
  e: batch.e.map((event) => ({ ...event, ...facts })),
};
assert.equal((enriched.e[0] as { email?: string }).email, undefined);
assert.equal(batchContainsRawIp(enriched), false);
assert.equal(batchContainsEmail(enriched), false);

async function main() {
const prevKey = process.env.INSIGHTS_INGEST_KEY;
const prevUrl = process.env.WEBSITE_INSIGHTS_INGEST_URL;
const prevSecret = process.env.WEBSITE_INSIGHTS_INGEST_SECRET;
delete process.env.INSIGHTS_INGEST_KEY;
process.env.WEBSITE_INSIGHTS_INGEST_URL = 'https://insights.example/collect';
process.env.WEBSITE_INSIGHTS_INGEST_SECRET = 'old-secret';
assert.equal(insightsIngestUrl(), DEFAULT_INGEST_URL);
assert.equal(insightsIngestUrl(), 'https://bigfivegroup.africa/api/insights/collect');
let calls = 0;
await forwardInsights(enriched, async () => {
  calls += 1;
  throw new Error('missing key must not forward');
});
assert.equal(calls, 0);

process.env.INSIGHTS_INGEST_KEY = 'test-key';
let seenUrl = '';
let seenKey = '';
let seenAuth = '';
let seenBody = '';
await forwardInsights(enriched, async (url, init) => {
  seenUrl = String(url);
  const headers = new Headers(init?.headers);
  seenKey = headers.get('x-insights-key') || '';
  seenAuth = headers.get('authorization') || '';
  seenBody = String(init?.body);
  return new Response(null, { status: 204 });
});
assert.equal(seenUrl, 'https://bigfivegroup.africa/api/insights/collect');
assert.equal(seenKey, 'test-key');
assert.equal(seenAuth, '');
assert.match(seenBody, /"site":"supplieradvisor.com"/);
assert.doesNotMatch(seenBody, /"project"/);
assert.doesNotMatch(seenBody, /"site":"bigfivegroup\.africa"/);
assert.doesNotMatch(seenBody, /"site":"supplieradvisor-mvp"/);
assert.match(seenBody, /"organisation":"Google LLC"/);
assert.match(seenBody, /hero/);
assert.doesNotMatch(seenBody, /8\.8\.8\.8/);
assert.doesNotMatch(seenBody, /@/);
await forwardInsights(
  { ...enriched, e: [{ ...enriched.e[0], ip: '8.8.8.8' } as never] },
  async () => {
    calls += 1;
    return new Response(null, { status: 204 });
  }
);
await forwardInsights(
  { ...enriched, e: [{ ...enriched.e[0], email: 'owner@example.com' } as never] },
  async () => {
    calls += 1;
    throw new Error('email must not send');
  }
);
assert.equal(calls, 0);
if (prevKey === undefined) delete process.env.INSIGHTS_INGEST_KEY;
else process.env.INSIGHTS_INGEST_KEY = prevKey;
if (prevUrl === undefined) delete process.env.WEBSITE_INSIGHTS_INGEST_URL;
else process.env.WEBSITE_INSIGHTS_INGEST_URL = prevUrl;
if (prevSecret === undefined) delete process.env.WEBSITE_INSIGHTS_INGEST_SECRET;
else process.env.WEBSITE_INSIGHTS_INGEST_SECRET = prevSecret;

const prevToken = process.env.IPINFO_TOKEN;
process.env.IPINFO_TOKEN = 'test-token';
const looked = await lookupNetwork('8.8.8.8', async (url) => {
  const href = String(url);
  assert.match(href, /8\.8\.8\.8/);
  if (href.includes('/company')) {
    return new Response(JSON.stringify({ ip: '8.8.8.8', name: 'Example Pty Ltd', type: 'business', industry: 'Food', employees: 40 }), { status: 200 });
  }
  return new Response(
    JSON.stringify({
      ip: '8.8.8.8',
      city: 'Pietermaritzburg',
      region: 'KwaZulu-Natal',
      country: 'ZA',
      loc: '-29.6,30.3',
      timezone: 'Africa/Johannesburg',
    }),
    { status: 200 }
  );
});
assert.equal(looked.organisation, 'Example Pty Ltd');
assert.equal(looked.industry, 'Food');
assert.equal(looked.size, '11-50');
assert.equal(looked.network, 'business');
assert.equal(looked.city, 'Pietermaritzburg');
assert.equal(looked.region, 'KwaZulu-Natal');
assert.equal(looked.country, 'ZA');
assert.equal(looked.timezone, 'Africa/Johannesburg');
assert.equal((looked as { ip?: string }).ip, undefined);
assert.equal((looked as { loc?: string }).loc, undefined);
delete process.env.IPINFO_TOKEN;
assert.deepEqual(await lookupNetwork('8.8.8.8', async () => {
  throw new Error('token missing should not fetch');
}), {});
if (prevToken === undefined) delete process.env.IPINFO_TOKEN;
else process.env.IPINFO_TOKEN = prevToken;

const privacy = readFileSync(resolve('app/privacy/page.tsx'), 'utf8');
for (const phrase of [
  'city',
  'region',
  'timezone',
  'Organisation label',
  'sa_vid',
  '180 days',
  'scroll depth',
  'outbound',
  'button label',
  'Do Not Track',
  'Global Privacy Control',
  'cookie banner',
  'raw IP address',
]) {
  assert.match(privacy, new RegExp(phrase, 'i'), phrase);
}
assert.match(privacy, /do not show a cookie banner/i);
assert.match(privacy, /do not record email addresses/i);
assert.match(privacy, /form contents/i);
assert.doesNotMatch(privacy, /insights record may include the email/i);

const route = readFileSync(resolve('app/api/insights/collect/route.ts'), 'utf8');
assert.match(route, /insightsOptOut/);
assert.match(route, /lookupNetwork/);
assert.match(route, /forwardInsights/);
assert.doesNotMatch(route, /console\./);
assert.doesNotMatch(route, /verifyPrivyAccessToken/);
assert.doesNotMatch(route, /sessionEmail/);
const recorder = readFileSync(resolve('components/insights/VisitRecorder.tsx'), 'utf8');
assert.match(recorder, /optedOut\(\)/);
assert.match(recorder, /VISITOR_COOKIE/);
assert.match(recorder, /utm_source|readUtm/);
assert.match(recorder, /k: 'pdf'/);
assert.match(recorder, /k: 'outbound'/);
assert.match(recorder, /k: 'click'/);
assert.match(recorder, /randomUUID/);
assert.doesNotMatch(recorder, /project:/);
assert.doesNotMatch(recorder, /navigator\.geolocation/);
const forwardSrc = readFileSync(resolve('lib/insights/forward.ts'), 'utf8');
assert.match(forwardSrc, /INSIGHTS_INGEST_KEY/);
assert.match(forwardSrc, /x-insights-key/);
assert.match(forwardSrc, /https:\/\/bigfivegroup\.africa\/api\/insights\/collect/);
assert.doesNotMatch(forwardSrc, /WEBSITE_INSIGHTS_INGEST_URL/);
assert.doesNotMatch(forwardSrc, /WEBSITE_INSIGHTS_INGEST_SECRET/);
assert.doesNotMatch(forwardSrc, /WEBSITE_INSIGHTS_INGEST_KEY/);
assert.doesNotMatch(forwardSrc, /WEBSITE_INSIGHTS_FORWARD/);

const layout = readFileSync(resolve('app/layout.tsx'), 'utf8');
assert.match(layout, /VisitRecorder/);
assert.match(layout, /<Analytics/);

console.log('visitor insights tests ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
