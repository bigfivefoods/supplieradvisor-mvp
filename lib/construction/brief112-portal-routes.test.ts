/**
 * ConstructionAdvisor® public portal route.
 * Run: npx --yes tsx lib/construction/brief112-portal-routes.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import {
  constructiongraphSeedStore,
  writeConstructiongraphToMetadata,
  type ConstructiongraphStore,
} from './constructiongraph';
import { reissueConstructionPortal, revokeConstructionPortal } from './portal-issue';
import { hashPortalToken, newPortalToken } from './portal-tokens';
import { resetPortalThrottleWarning, portalThrottleWarningSeen } from './portal-throttle';
import { servePublicPortal, type ConstructionPortalDb, type PublicProfileRow } from './public-book';
import { GET, POST, constructionPublicDeps } from '../../app/api/public/constructiongraph/route';

const publicSrc = readFileSync(resolve('app/api/public/constructiongraph/route.ts'), 'utf8');
const staffSrc = readFileSync(resolve('app/api/construction/constructiongraph/route.ts'), 'utf8');
const bookSrc = readFileSync(resolve('lib/construction/public-book.ts'), 'utf8');

assert.equal(/e\.message|upErr\.message/.test(publicSrc), false);
assert.equal(/e\.message|upErr\.message/.test(staffSrc), false);
assert.match(publicSrc, /private, no-store/);
assert.equal(publicSrc.includes('public, max-age'), false);
assert.match(publicSrc, /constructiongraph_token_hashes|CONSTRUCTIONGRAPH_HASH_KEY/);

function extractFn(src: string, name: 'GET' | 'POST'): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, name);
  let depth = 0;
  let inside = false;
  let end = start;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') {
      depth += 1;
      inside = true;
    } else if (src[i] === '}') {
      depth -= 1;
    }
    if (inside && depth === 0) {
      end = i;
      break;
    }
  }
  return src.slice(start, end + 1);
}

for (const name of ['GET', 'POST'] as const) {
  const body = extractFn(publicSrc, name);
  assert.ok(body.indexOf('isPortalTokenShape') < body.indexOf('portalDb()'), name);
  assert.equal(body.includes('getSupabaseAdmin()'), false, name);
}
assert.ok(publicSrc.indexOf('if (constructionPublicDeps.db) return') < publicSrc.indexOf('getSupabaseAdmin()'));
const serveBody = bookSrc.slice(bookSrc.indexOf('export async function servePublicPortal'));
assert.ok(serveBody.indexOf('findByHash') < serveBody.indexOf('findByLegacyToken'));

function headersOf(res: Response): string {
  return [...res.headers.entries()]
    .filter(([key]) => key !== 'date')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

type Mem = {
  db: ConstructionPortalDb;
  commits: () => number;
  row: () => PublicProfileRow;
  setThrottle: (value: 'no' | 'yes' | 'missing' | 'error') => void;
  hashes: () => string[];
  legacy: () => string[];
};

function memory(initial: PublicProfileRow, throttle: 'no' | 'yes' | 'missing' | 'error' = 'no'): Mem {
  let row = initial;
  let mode = throttle;
  let commits = 0;
  const hashes: string[] = [];
  const legacy: string[] = [];
  const db: ConstructionPortalDb = {
    async findByHash(hash) {
      hashes.push(hash);
      const map = row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>).constructiongraph_token_hashes
        : null;
      if (map && typeof map === 'object' && !Array.isArray(map) && (map as Record<string, string>)[hash]) {
        return row;
      }
      return null;
    },
    async findByLegacyToken(token) {
      legacy.push(token);
      const meta = (row.metadata || {}) as Record<string, unknown>;
      const map = meta.constructiongraph_tokens;
      if (map && typeof map === 'object' && !Array.isArray(map) && (map as Record<string, string>)[token]) {
        return row;
      }
      if (meta.constructiongraph_public_token === token) return row;
      return null;
    },
    async commit(_id, prev, metadata, next) {
      commits += 1;
      const same = row.updated_at === prev || (row.updated_at == null && prev == null);
      if (!same) return 'lost';
      row = { ...row, metadata, updated_at: next };
      return 'ok';
    },
    async isThrottled() {
      return mode;
    },
    async registerFailure() {
      if (mode === 'missing') return 'missing';
      if (mode === 'error') return 'error';
      return 'ok';
    },
  };
  return {
    db,
    commits: () => commits,
    row: () => row,
    setThrottle(value) {
      mode = value;
    },
    hashes: () => hashes,
    legacy: () => legacy,
  };
}

function profile(store: ConstructiongraphStore, extra: Record<string, unknown> = {}): PublicProfileRow {
  return {
    id: 7,
    trading_name: 'SiteCo',
    metadata: { ...extra, ...writeConstructiongraphToMetadata(extra, store) },
    updated_at: '2026-09-10T08:00:00.000Z',
  };
}

function useDb(mem: Mem) {
  constructionPublicDeps.db = mem.db;
  constructionPublicDeps.opened = 0;
}

async function getToken(token: string) {
  return GET(new NextRequest(`http://localhost/api/public/constructiongraph?token=${encodeURIComponent(token)}`));
}

async function postToken(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/public/constructiongraph', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

async function identical404(left: Response, right: Response) {
  assert.equal(left.status, 404);
  assert.equal(right.status, 404);
  assert.equal(await left.text(), await right.text());
  assert.equal(headersOf(left), headersOf(right));
  assert.match(headersOf(left), /private/);
  assert.match(headersOf(left), /no-store/);
  assert.doesNotMatch(headersOf(left), /max-age/);
}

async function main() {
  const thrown = memory({ id: 1, metadata: {}, updated_at: null });
  const originalFind = thrown.db.findByHash;
  thrown.db.findByHash = async () => {
    throw new Error('db should not be opened');
  };
  useDb(thrown);
  const bad = await getToken('a');
  const badPost = await postToken({ token: 'short', action: 'claim', paymentId: 'pay_2' });
  assert.equal(constructionPublicDeps.opened, 0);
  await identical404(bad, badPost);
  thrown.db.findByHash = originalFind;

  const unknownMem = memory({ id: 7, trading_name: 'SiteCo', metadata: {}, updated_at: 't0' });
  useDb(unknownMem);
  const unknown = await getToken(`cgp_${'0'.repeat(64)}`);
  const shapedMissing = await getToken(`cgp_${'ab'.repeat(32)}`);
  await identical404(unknown, shapedMissing);
  assert.equal(unknownMem.hashes()[0], hashPortalToken(`cgp_${'0'.repeat(64)}`));
  assert.ok(unknownMem.legacy().length > 0);

  const seed = constructiongraphSeedStore('2026-09-10T08:00:00.000Z');
  const contractor = seed.portals.find((portal) => portal.kind === 'contractor');
  assert.ok(contractor?.id);
  const reissued = reissueConstructionPortal(seed, contractor.id, 'desk', '2026-09-10T08:00:00.000Z');
  assert.equal(reissued.ok, true);
  if (!reissued.ok) throw new Error('reissue');
  const live = memory(profile(reissued.store));
  useDb(live);
  const ok = await getToken(reissued.issued.token);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('cache-control') || '', /private, no-store/);
  const okBody = await ok.json();
  assert.equal(okBody.view.kind, 'contractor');

  const revokedStore = revokeConstructionPortal(reissued.store, reissued.issued.id, '2026-09-10T09:00:00.000Z');
  assert.equal(revokedStore.ok, true);
  if (!revokedStore.ok) throw new Error('revoke');
  const revokedMem = memory(profile(revokedStore.store));
  useDb(revokedMem);
  const revoked = await getToken(reissued.issued.token);
  await identical404(revoked, await getToken('a'));

  const expiredStore: ConstructiongraphStore = {
    ...reissued.store,
    portals: reissued.store.portals.map((portal) =>
      portal.id === reissued.issued.id
        ? { ...portal, expires_at: '2020-01-01T00:00:00.000Z' }
        : portal
    ),
  };
  useDb(memory(profile(expiredStore)));
  const expired = await getToken(reissued.issued.token);
  const expiredPost = await postToken({
    token: reissued.issued.token,
    action: 'claim',
    paymentId: 'pay_2',
  });
  await identical404(expired, expiredPost);

  const second = reissueConstructionPortal(
    reissued.store,
    reissued.issued.id,
    'desk',
    '2026-09-11T08:00:00.000Z'
  );
  assert.equal(second.ok, true);
  if (!second.ok) throw new Error('second');
  const swap = memory(profile(reissued.store));
  useDb(swap);
  assert.equal((await getToken(reissued.issued.token)).status, 200);
  swap.row().metadata = writeConstructiongraphToMetadata({}, second.store);
  useDb(swap);
  const oldGone = await getToken(reissued.issued.token);
  const fresh = await getToken(second.issued.token);
  assert.equal(oldGone.status, 404);
  assert.equal(await oldGone.json().then((body) => body.error), 'Portal not found');
  assert.equal(fresh.status, 200);

  const legacyToken = 'legacytoken1';
  const legacyMeta = {
    constructiongraph_tokens: { [legacyToken]: 'client' },
    constructiongraph: {
      clients: [{ id: 'cli_apex', name: 'Apex Developments' }],
      sites: [
        {
          id: 'site_1',
          code: 'PRJ-01',
          name: 'Podium',
          client_id: 'cli_apex',
          contract_value: 100,
          status: 'on_site',
        },
      ],
      quotes: [],
      payments: [],
      programme: [],
      portals: [
        {
          id: legacyToken,
          token: legacyToken,
          kind: 'client',
          client_id: 'cli_apex',
          label: 'Apex Developments',
        },
      ],
      settings: {},
    },
  };
  const legacyMem = memory({
    id: 7,
    trading_name: 'SiteCo',
    metadata: legacyMeta,
    updated_at: '2026-09-10T08:00:00.000Z',
  });
  useDb(legacyMem);
  const legacyRes = await getToken(legacyToken);
  assert.equal(legacyRes.status, 200);
  const legacyBody = await legacyRes.json();
  assert.equal(legacyBody.view.kind, 'client');
  assert.equal(JSON.stringify(legacyBody).includes('costs'), false);
  const upgraded = JSON.stringify(legacyMem.row().metadata);
  assert.equal(upgraded.includes(legacyToken), false);
  assert.equal(upgraded.includes('"token":'), false);
  assert.equal(
    (legacyMem.row().metadata as Record<string, unknown>).constructiongraph_tokens,
    null
  );
  const savedBook = (legacyMem.row().metadata as Record<string, unknown>).constructiongraph as {
    portals: Array<{ legacy?: boolean; token_hash?: string; id?: string }>;
  };
  assert.equal(savedBook.portals[0]?.legacy, true);
  assert.equal(savedBook.portals[0]?.token_hash, hashPortalToken(legacyToken));
  assert.notEqual(savedBook.portals[0]?.id, legacyToken);

  const unscopedToken = newPortalToken();
  const unscopedStore = constructiongraphSeedStore('2026-09-10T08:00:00.000Z', [
    {
      id: 'cgpr_unscoped',
      token_hash: hashPortalToken(unscopedToken),
      token_hint: unscopedToken.slice(-4),
      kind: 'client',
      label: 'Unscoped',
      created_at: '2026-09-10T08:00:00.000Z',
    },
  ]);
  const unscopedMem = memory(profile(unscopedStore));
  useDb(unscopedMem);
  const unscoped = await postToken({
    token: unscopedToken,
    action: 'claim',
    paymentId: 'pay_2',
  });
  assert.equal(unscoped.status, 404);
  assert.equal(unscopedMem.commits(), 0);
  const contractorBare = newPortalToken();
  const bareStore = constructiongraphSeedStore('2026-09-10T08:00:00.000Z', [
    {
      id: 'cgpr_bare_site',
      token_hash: hashPortalToken(contractorBare),
      kind: 'contractor',
      label: 'Bare',
      created_at: '2026-09-10T08:00:00.000Z',
    },
  ]);
  const bareMem = memory(profile(bareStore));
  useDb(bareMem);
  assert.equal(
    (
      await postToken({
        token: contractorBare,
        action: 'claim',
        paymentId: 'pay_2',
      })
    ).status,
    404
  );
  assert.equal(bareMem.commits(), 0);

  useDb(live);
  for (const amount of [-5, 0, 1e12, 12.345, '100']) {
    const res = await postToken({
      token: reissued.issued.token,
      action: 'claim',
      paymentId: 'pay_2',
      amount,
    });
    assert.equal(res.status, 400, String(amount));
  }
  const nan = await servePublicPortal({
    request: new NextRequest('http://localhost/api/public/constructiongraph'),
    token: reissued.issued.token,
    db: live.db,
    body: { action: 'claim', paymentId: 'pay_2', amount: Number.NaN },
  });
  assert.equal(nan.status, 400);

  const paidStore: ConstructiongraphStore = {
    ...reissued.store,
    payments: reissued.store.payments.map((row) =>
      row.id === 'pay_2' ? { ...row, status: 'paid', paid_at: '2026-09-01' } : row
    ),
  };
  const paidMem = memory(profile(paidStore));
  useDb(paidMem);
  const paid = await postToken({
    token: reissued.issued.token,
    action: 'claim',
    paymentId: 'pay_2',
    amount: 10,
  });
  assert.equal(paid.status, 400);
  assert.equal(paidMem.commits(), 0);

  const claimMem = memory(profile(reissued.store));
  useDb(claimMem);
  const claimed = await postToken({
    token: reissued.issued.token,
    action: 'claim',
    paymentId: 'pay_2',
    amount: 100,
  });
  assert.equal(claimed.status, 200);
  assert.match(claimed.headers.get('cache-control') || '', /no-store/);
  const claimedBook = (claimMem.row().metadata as { constructiongraph: ConstructiongraphStore })
    .constructiongraph;
  const stamped = claimedBook.payments.find((row) => row.id === 'pay_2');
  assert.equal(stamped?.reported_via, 'portal');
  assert.equal(stamped?.reported_portal_id, reissued.issued.id);
  assert.ok(stamped?.reported_at);

  resetPortalThrottleWarning();
  const throttled = memory(profile(reissued.store), 'yes');
  useDb(throttled);
  const limited = await getToken(reissued.issued.token);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error, 'Too many tries, try again in a few minutes');

  resetPortalThrottleWarning();
  const missing = memory(profile(reissued.store), 'missing');
  useDb(missing);
  assert.equal((await getToken(reissued.issued.token)).status, 200);
  assert.equal((await getToken(reissued.issued.token)).status, 200);
  assert.equal(portalThrottleWarningSeen(), true);

  const closed = memory(profile(reissued.store), 'error');
  useDb(closed);
  assert.equal((await getToken(reissued.issued.token)).status, 429);

  constructionPublicDeps.opened = 0;
  const limiter = memory(profile(reissued.store), 'missing');
  useDb(limiter);
  let last = 200;
  for (let i = 0; i < 61; i += 1) {
    const res = await getToken(reissued.issued.token);
    last = res.status;
  }
  assert.equal(last, 429);

  console.log('brief112-portal-routes.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
