/**
 * Brief 108 — a real TradeAdvisor® book token must not serve quote PDFs or calendars.
 * Run: npx --yes tsx lib/trades/brief108-public-feeds.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { NextRequest } from 'next/server';
import { handleQuotePdf, type QuotePdfDeps } from '../../app/api/public/tradegraph/quote-pdf/route';
import { handleTradeIcs, type IcsDeps } from '../../app/api/public/tradegraph/ics/route';
import { TRADE_SESSION_COOKIE } from './customer-session';
import { emptyDesk, type Book } from './desk';
import { newIcsToken } from './public-feeds';
import { emptyTradeStore } from './tradegraph';

const REAL = 'tg_real_book_108';
const ICS = 'a'.repeat(64);
const SESSION_A = 'session-customer-a-0123456789';
const SESSION_B = 'session-customer-b-0123456789';

function fixture(): Book {
  const store = emptyTradeStore('2026-10-14T08:00:00.000Z', REAL);
  store.settings.brand_name = 'Real Plumbing';
  store.settings.city = 'Cape Town';
  store.settings.phone = '021 555 0100';
  store.customers = [
    {
      id: 'ca',
      name: 'Customer A',
      email: 'a@example.com',
      phone: '',
      address: '1 Secret Street',
      suburb: 'Rondebosch',
      city: 'Cape Town',
    },
    {
      id: 'cb',
      name: 'Customer B',
      email: 'b@example.com',
      phone: '',
      address: '9 Other Road',
      suburb: 'Bellville',
      city: 'Cape Town',
    },
  ];
  store.quotes = [
    {
      id: 'qa',
      number: 'Q-1',
      customer_id: 'ca',
      status: 'sent',
      title: 'Fix A',
      lines: [{ id: 'l1', description: 'Labour', qty: 1, unit_cents: 10000 }],
      source_request_id: null,
      created_at: '2026-10-14T08:00:00.000Z',
    },
    {
      id: 'qb',
      number: 'Q-2',
      customer_id: 'cb',
      status: 'sent',
      title: 'Fix B',
      lines: [{ id: 'l2', description: 'Parts', qty: 1, unit_cents: 20000 }],
      source_request_id: null,
      created_at: '2026-10-14T08:00:00.000Z',
    },
    {
      id: 'qd',
      number: 'Q-D',
      customer_id: 'ca',
      status: 'draft',
      title: 'Draft A',
      lines: [{ id: 'l3', description: 'Hidden', qty: 1, unit_cents: 30000 }],
      source_request_id: null,
      created_at: '2026-10-14T08:00:00.000Z',
    },
  ];
  store.jobs = [
    {
      id: 'ja',
      number: 'J-1',
      customer_id: 'ca',
      quote_id: 'qa',
      title: 'Fix A',
      status: 'scheduled',
      address: '1 Secret Street',
      progress_pct: 0,
      lines: [],
      updates: [],
    },
    {
      id: 'jb',
      number: 'J-2',
      customer_id: 'cb',
      quote_id: 'qb',
      title: 'Fix B',
      status: 'scheduled',
      address: '9 Other Road',
      progress_pct: 0,
      lines: [],
      updates: [],
    },
  ];
  store.schedule = [
    {
      id: 'sa',
      job_id: 'ja',
      title: 'Visit A',
      starts_at: '2026-10-14T09:00:00.000Z',
      ends_at: '2026-10-14T10:00:00.000Z',
      address: '1 Secret Street',
    },
    {
      id: 'sb',
      job_id: 'jb',
      title: 'Visit B',
      starts_at: '2026-10-14T11:00:00.000Z',
      ends_at: '2026-10-14T12:00:00.000Z',
      address: '9 Other Road',
    },
  ];
  return { store, desk: emptyDesk() };
}

const book = fixture();

function quoteDeps(desk = false): QuotePdfDeps {
  return {
    workspaceByToken: async (token) => (token === REAL ? { companyId: 7 } : null),
    loadTradeBook: async () => book,
    customerFromSession: async (token) => {
      if (token === SESSION_A) return { companyId: 7, customerId: 'ca' };
      if (token === SESSION_B) return { companyId: 7, customerId: 'cb' };
      return null;
    },
    deskMember: async () => desk,
  };
}

function icsDeps(valid = ICS): IcsDeps {
  return {
    workspaceByToken: async (token) => (token === REAL ? { companyId: 7 } : null),
    workspaceByIcsToken: async (token) => (token === valid ? { companyId: 7 } : null),
    loadTradeBook: async () => book,
    customerFromSession: async (token) => {
      if (token === SESSION_A) return { companyId: 7, customerId: 'ca' };
      if (token === SESSION_B) return { companyId: 7, customerId: 'cb' };
      return null;
    },
  };
}

function req(path: string, session?: string): NextRequest {
  const headers = new Headers();
  if (session) headers.set('cookie', `${TRADE_SESSION_COOKIE}=${session}`);
  return new NextRequest(`http://localhost${path}`, { headers });
}

async function bodyOf(res: Response): Promise<string> {
  return Buffer.from(await res.arrayBuffer()).toString('latin1');
}

function pdfPlain(raw: string): string {
  const buf = Buffer.from(raw, 'latin1');
  const parts = [raw];
  let start = 0;
  while (start < buf.length) {
    const marker = buf.indexOf('stream', start);
    if (marker < 0) break;
    let dataStart = marker + 'stream'.length;
    if (buf[dataStart] === 0x0d && buf[dataStart + 1] === 0x0a) dataStart += 2;
    else if (buf[dataStart] === 0x0a) dataStart += 1;
    const end = buf.indexOf('endstream', dataStart);
    if (end < 0) break;
    const trim = buf[end - 2] === 0x0d ? 2 : buf[end - 1] === 0x0a ? 1 : 0;
    try {
      parts.push(inflateSync(buf.subarray(dataStart, end - trim)).toString('latin1'));
    } catch {
      /* not a compressed stream */
    }
    start = end + 'endstream'.length;
  }
  return parts.join('\n').replace(/<([0-9A-Fa-f]+)>/g, (token, hex: string) => {
    if (hex.length % 2 !== 0) return token;
    return Buffer.from(hex, 'hex').toString('latin1');
  });
}

async function main(): Promise<void> {
  const minted = newIcsToken();
  assert.match(minted, /^[0-9a-f]{64}$/);
  assert.notEqual(newIcsToken(), minted);

  let anonymousLoads = 0;
  const anonymousDeps = quoteDeps();
  const loadBook = anonymousDeps.loadTradeBook;
  anonymousDeps.loadTradeBook = async (companyId) => {
    anonymousLoads += 1;
    return loadBook(companyId);
  };
  const openQuote = await handleQuotePdf(
    req(`/api/public/tradegraph/quote-pdf?token=${REAL}&quote=qa`),
    anonymousDeps
  );
  assert.equal(anonymousLoads, 0, 'a signed-out real token must not load the book');
  assert.ok(openQuote.status === 401 || openQuote.status === 404);
  const openQuoteBody = await bodyOf(openQuote);
  assert.equal(openQuoteBody, '');
  assert.doesNotMatch(openQuoteBody, /%PDF|Customer A|Customer B/);
  assert.equal(openQuote.headers.get('cache-control'), 'private, no-store');

  let anonymousIcsLoads = 0;
  const anonymousIcsDeps = icsDeps();
  const loadIcsBook = anonymousIcsDeps.loadTradeBook;
  anonymousIcsDeps.loadTradeBook = async (companyId) => {
    anonymousIcsLoads += 1;
    return loadIcsBook(companyId);
  };
  const openIcs = await handleTradeIcs(req(`/api/public/tradegraph/ics?token=${REAL}`), anonymousIcsDeps);
  assert.equal(anonymousIcsLoads, 0, 'a signed-out real token must not load the calendar');
  assert.equal(openIcs.status, 404);
  const openIcsBody = await bodyOf(openIcs);
  assert.equal(openIcsBody, '');
  assert.doesNotMatch(openIcsBody, /BEGIN:VCALENDAR|Secret Street|Other Road/);

  const own = await handleQuotePdf(
    req(`/api/public/tradegraph/quote-pdf?token=${REAL}&quote=qa`, SESSION_A),
    quoteDeps()
  );
  assert.equal(own.status, 200);
  assert.equal(own.headers.get('content-type'), 'application/pdf');
  assert.equal(own.headers.get('cache-control'), 'private, no-store');
  const ownPdf = await bodyOf(own);
  assert.ok(ownPdf.startsWith('%PDF'));
  const ownText = pdfPlain(ownPdf);
  assert.match(ownText, /Customer A/);
  assert.doesNotMatch(ownText, /Customer B/);
  assert.doesNotMatch(ownText, /9 Other Road/);

  const foreign = await handleQuotePdf(
    req(`/api/public/tradegraph/quote-pdf?token=${REAL}&quote=qb`, SESSION_A),
    quoteDeps()
  );
  assert.equal(foreign.status, 404);
  const foreignBody = await bodyOf(foreign);
  assert.equal(foreignBody, '');
  assert.doesNotMatch(foreignBody, /Customer B|%PDF/);

  const missingQuote = await handleQuotePdf(
    req(`/api/public/tradegraph/quote-pdf?token=${REAL}`, SESSION_A),
    quoteDeps()
  );
  assert.equal(missingQuote.status, 404);
  assert.equal(await bodyOf(missingQuote), '');

  const draft = await handleQuotePdf(
    req(`/api/public/tradegraph/quote-pdf?token=${REAL}&quote=qd`, SESSION_A),
    quoteDeps()
  );
  assert.equal(draft.status, 404);

  const full = await handleTradeIcs(
    req(`/api/public/tradegraph/ics?token=${REAL}&ics=${ICS}`),
    icsDeps()
  );
  assert.equal(full.status, 200);
  assert.match(full.headers.get('content-type') || '', /text\/calendar/);
  assert.equal(full.headers.get('cache-control'), 'private, no-store');
  const fullBody = await bodyOf(full);
  assert.match(fullBody, /BEGIN:VCALENDAR/);
  assert.match(fullBody, /1 Secret Street/);
  assert.match(fullBody, /9 Other Road/);

  const wrong = await handleTradeIcs(
    req(`/api/public/tradegraph/ics?token=${REAL}&ics=${'b'.repeat(64)}`),
    icsDeps()
  );
  assert.equal(wrong.status, 404);
  assert.equal(await bodyOf(wrong), '');

  const ownFeed = await handleTradeIcs(
    req(`/api/public/tradegraph/ics?token=${REAL}`, SESSION_A),
    icsDeps()
  );
  assert.equal(ownFeed.status, 200);
  const ownFeedBody = await bodyOf(ownFeed);
  assert.match(ownFeedBody, /1 Secret Street/);
  assert.match(ownFeedBody, /Visit A/);
  assert.doesNotMatch(ownFeedBody, /9 Other Road/);
  assert.doesNotMatch(ownFeedBody, /Visit B/);

  const demoQuote = await handleQuotePdf(req('/api/public/tradegraph/quote-pdf?token=demo&quote=tq_waste'));
  assert.equal(demoQuote.status, 200);
  assert.equal(demoQuote.headers.get('content-type'), 'application/pdf');
  assert.equal(demoQuote.headers.get('cache-control'), null);
  assert.ok((await bodyOf(demoQuote)).startsWith('%PDF'));

  const demoFallback = await handleQuotePdf(req('/api/public/tradegraph/quote-pdf?token=demo'));
  assert.equal(demoFallback.status, 200);
  assert.ok((await bodyOf(demoFallback)).startsWith('%PDF'));

  const harbourQuote = await handleQuotePdf(
    req('/api/public/tradegraph/quote-pdf?token=tg_harbour&quote=tq_basin')
  );
  assert.equal(harbourQuote.status, 200);

  const demoIcs = await handleTradeIcs(req('/api/public/tradegraph/ics?token=demo'));
  assert.equal(demoIcs.status, 200);
  assert.equal(demoIcs.headers.get('cache-control'), null);
  const demoIcsBody = await bodyOf(demoIcs);
  assert.match(demoIcsBody, /BEGIN:VCALENDAR/);
  assert.match(demoIcsBody, /UID:ts_thandi@supplieradvisor\.tradegraph/);
  assert.match(demoIcsBody, /22 Lower Main Road\\, Observatory/);

  const harbourIcs = await handleTradeIcs(req('/api/public/tradegraph/ics?token=tg_harbour'));
  assert.equal(harbourIcs.status, 200);
  assert.match(await bodyOf(harbourIcs), /BEGIN:VCALENDAR/);

  const desk = await handleQuotePdf(
    req(`/api/public/tradegraph/quote-pdf?token=${REAL}&quote=qb`),
    quoteDeps(true)
  );
  assert.equal(desk.status, 200);
  const deskPdf = await bodyOf(desk);
  assert.ok(deskPdf.startsWith('%PDF'));
  assert.match(pdfPlain(deskPdf), /Customer B/);
  assert.equal(desk.headers.get('cache-control'), 'private, no-store');

  const root = process.cwd();
  const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /\/api\/public\/tradegraph\//);
  assert.match(sw, /cache:\s*'no-store'/);
  assert.match(sw, /token === 'demo' \|\| token === 'tg_harbour'/);

  const screens = readFileSync(resolve(root, 'components/trades/TradeScreens.tsx'), 'utf8');
  assert.match(screens, /ics=\$\{encodeURIComponent\(icsToken\)\}/);
  assert.doesNotMatch(screens, /tradegraph\/ics\?token=\$\{encodeURIComponent\(book\.store\.settings\.public_token/);
  assert.match(screens, /quotePdfHref\(book\.store\.settings\.public_token, quote\.id\)/);

  const more = readFileSync(resolve(root, 'components/trades/TradeMore.tsx'), 'utf8');
  assert.match(more, /rotate_ics|rotateIcs/);
  assert.match(more, /Subscribe to calendar/);

  const client = readFileSync(resolve(root, 'components/trades/CustomerTradeApp.tsx'), 'utf8');
  assert.match(client, /quote-pdf\?token=\$\{encodeURIComponent\(token\)\}&quote=/);
  assert.match(client, /ics\?token=\$\{encodeURIComponent\(token\)\}/);

  const embed = readFileSync(resolve(root, 'app/embed/tradegraph/[token]/page.tsx'), 'utf8');
  assert.doesNotMatch(embed, /ics_token|quote-pdf|\/ics\?/);

  const migration = readFileSync(resolve(root, 'supabase/migrations/20261016_tradegraph_ics_token.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS ics_token/);
  assert.match(migration, /32,80/);
  const previous = readFileSync(resolve(root, 'supabase/migrations/20261015_tradegraph_desk.sql'), 'utf8');
  assert.doesNotMatch(previous, /ics_token/);

  const smoke = readFileSync(resolve(root, 'e2e/auth-smoke.spec.ts'), 'utf8');
  assert.match(smoke, /quote-pdf\?token=tg_real_probe_108/);
  assert.match(smoke, /ics\?token=tg_real_probe_108/);
  assert.match(smoke, /not\.toContain\('%PDF'\)/);
  assert.match(smoke, /not\.toContain\('BEGIN:VCALENDAR'\)/);

  console.log('brief108-public-feeds.test.ts ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
