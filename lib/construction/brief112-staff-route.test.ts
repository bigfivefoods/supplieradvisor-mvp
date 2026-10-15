/**
 * ConstructionAdvisor® staff route: roles, sanitised book, compare-and-swap.
 * Run: npx --yes tsx lib/construction/brief112-staff-route.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { ROLES_OPS_CRITICAL } from '../auth/api-auth';
import { ROLE_PERMISSIONS, canAccess, type TeamRole } from '../business/permissions';
import { GET, POST } from '../../app/api/construction/constructiongraph/route';
import {
  CONSTRUCTIONGRAPH_HASH_KEY,
  CONSTRUCTIONGRAPH_TOKEN_KEY,
  CONSTRUCTIONGRAPH_TOKENS_KEY,
  constructiongraphSeedStore,
  emptyConstructiongraphStore,
  readConstructiongraphFromMetadata,
  writeConstructiongraphToMetadata,
  type ConstructiongraphStore,
} from './constructiongraph';
import { CONSTRUCTION_CAS_CONFLICT, commitProfileMetadata } from './metadata-commit';
import { hashPortalToken } from './portal-tokens';
import { constructionStaffAllows, type ConstructionStaffAction } from './staff-access';
import { REPLACE_CONFIRM, applyStaffConstructionAction } from './staff-book';
import { servePublicPortal, type ConstructionPortalDb } from './public-book';
import { reissueConstructionPortal } from './portal-issue';

const routeSrc = readFileSync(resolve('app/api/construction/constructiongraph/route.ts'), 'utf8');

function extractFn(name: 'GET' | 'POST'): string {
  const marker = `export async function ${name}(`;
  const start = routeSrc.indexOf(marker);
  assert.ok(start >= 0, name);
  let depth = 0;
  let inside = false;
  let end = start;
  for (let i = start; i < routeSrc.length; i += 1) {
    if (routeSrc[i] === '{') {
      depth += 1;
      inside = true;
    } else if (routeSrc[i] === '}') {
      depth -= 1;
    }
    if (inside && depth === 0) {
      end = i;
      break;
    }
  }
  return routeSrc.slice(start, end + 1);
}

const getFn = extractFn('GET');
const postFn = extractFn('POST');
assert.ok(getFn.indexOf('requireCompanyAccess') < getFn.indexOf('if (!gate.ok) return gate.response'));
assert.ok(getFn.indexOf('if (!gate.ok) return gate.response') < getFn.indexOf('requireCompanyPermission'));
assert.ok(getFn.indexOf('requireCompanyPermission') < getFn.indexOf('getSupabaseServer'));
assert.equal(getFn.includes('upgradePlaintextPortals'), false);
assert.equal(getFn.includes('commitProfileMetadata'), false);
assert.ok(postFn.indexOf('if (!gate.ok) return gate.response') < postFn.indexOf('requireCompanyRoles'));
assert.ok(postFn.indexOf('requireCompanyRoles') < postFn.indexOf('getSupabaseServer'));
assert.match(postFn, /REPLACE ALL DATA|confirm/);
assert.match(routeSrc, /sanitiseConstructiongraphStore/);

const replaceList = postFn.match(/action === 'replace'[\s\S]*?\[([^\]]+)\]/);
assert.ok(replaceList);
const replaceRoles = replaceList[1]
  .split(',')
  .map((part) => part.trim().replace(/['"]/g, ''))
  .filter(Boolean);

const roles = Object.keys(ROLE_PERMISSIONS) as TeamRole[];
const opsActions: ConstructionStaffAction[] = [
  'ensure_portal',
  'ensure_client_portal',
  'ensure_contractor_portal',
  'revoke_portal',
  'reissue_portal',
  'seed_demo',
];

for (const role of roles) {
  const view = canAccess(role, 'operations', 'view');
  const write = canAccess(role, 'operations', 'write');
  assert.equal(constructionStaffAllows(role, 'read'), view, role);
  assert.equal(constructionStaffAllows(role, 'merge'), write, role);
  if (!view) {
    assert.equal(constructionStaffAllows(role, 'read'), false);
    assert.equal(constructionStaffAllows(role, 'merge'), false);
  }
  if (view && !write) {
    assert.equal(constructionStaffAllows(role, 'read'), true);
    assert.equal(constructionStaffAllows(role, 'merge'), false);
  }
  const critical = (ROLES_OPS_CRITICAL as readonly string[]).includes(role);
  for (const action of opsActions) {
    assert.equal(constructionStaffAllows(role, action), critical, `${role} ${action}`);
  }
  assert.equal(constructionStaffAllows(role, 'replace'), replaceRoles.includes(role), role);
}

function noSecrets(value: unknown, rawTokens: string[]) {
  const json = JSON.stringify(value);
  assert.equal(json.includes('"token_hash"'), false);
  assert.equal(json.includes('public_token'), false);
  assert.equal(json.includes('"token":'), false);
  for (const token of rawTokens) assert.equal(json.includes(token), false);
}

const seed = constructiongraphSeedStore('2026-09-10T08:00:00.000Z');
const meta = writeConstructiongraphToMetadata({ timezone: 'Africa/Johannesburg' }, seed);
const merged = applyStaffConstructionAction({
  meta,
  action: 'merge',
  actorId: 'user_1',
  now: '2026-09-10T09:00:00.000Z',
  patch: {
    portals: [{ id: 'forged', token: 'forgedtokenvalue', kind: 'public', label: 'forged' }],
    settings: { public_token: 'forgedtokenvalue' },
    sites: seed.sites.map((site) =>
      site.id === 'site_1' ? { ...site, notes: 'staff note' } : site
    ),
  },
});
assert.equal('error' in merged, false);
if ('error' in merged) throw new Error('merge');
assert.equal(merged.value.store.sites.find((site) => site.id === 'site_1')?.notes, 'staff note');
assert.equal(
  merged.value.store.portals.filter((portal) => portal.kind === 'public').length,
  1
);
assert.equal(merged.value.store.portals.some((portal) => portal.id === 'forged'), false);
noSecrets(merged.value, ['forgedtokenvalue']);
const mergedHashes = (merged.metadata[CONSTRUCTIONGRAPH_HASH_KEY] || {}) as Record<string, string>;
const originalHashes = (meta[CONSTRUCTIONGRAPH_HASH_KEY] || {}) as Record<string, string>;
assert.deepEqual(Object.keys(mergedHashes).sort(), Object.keys(originalHashes).sort());

const blockedSeed = applyStaffConstructionAction({
  meta,
  action: 'seed_demo',
  actorId: 'user_1',
  now: '2026-09-10T09:00:00.000Z',
});
assert.deepEqual(blockedSeed, { error: 'The book already has data', status: 409 });

const emptyMeta = writeConstructiongraphToMetadata({}, emptyConstructiongraphStore());
const seeded = applyStaffConstructionAction({
  meta: emptyMeta,
  action: 'seed_demo',
  actorId: 'user_1',
  now: '2026-09-10T09:00:00.000Z',
});
assert.equal('error' in seeded, false);
if ('error' in seeded) throw new Error('seed');
const issued = seeded.value.issued;
assert.ok(Array.isArray(issued) && issued.length === 3);
const issuedTokens = (issued as Array<{ token: string }>).map((row) => row.token);
const stored = JSON.stringify(seeded.metadata);
for (const token of issuedTokens) assert.equal(stored.includes(token), false);
noSecrets(
  {
    store: seeded.value.store,
    summary: seeded.value.summary,
    programme: seeded.value.programme,
  },
  issuedTokens
);
assert.equal(stored.includes('"token_hash"'), true);

const replaceDenied = applyStaffConstructionAction({
  meta,
  action: 'replace',
  actorId: 'user_1',
  confirm: 'replace',
  patch: emptyConstructiongraphStore(),
});
assert.equal('error' in replaceDenied, true);
if (!('error' in replaceDenied)) throw new Error('replace should fail');
assert.equal(replaceDenied.status, 400);
const replaced = applyStaffConstructionAction({
  meta,
  action: 'replace',
  actorId: 'user_1',
  now: '2026-09-10T09:00:00.000Z',
  confirm: REPLACE_CONFIRM,
  patch: {
    clients: [{ id: 'cli_new', name: 'Apex Developments' }],
    portals: [{ id: 'forged', kind: 'public', token_hash: 'ab'.repeat(32), label: 'forged' }],
    settings: { public_token: 'should-not-stick' },
  },
});
assert.equal('error' in replaced, false);
if ('error' in replaced) throw new Error('replace');
assert.equal(replaced.value.store.clients.length, 1);
assert.equal(replaced.value.store.sites.length, 0);
const replacedBook = readConstructiongraphFromMetadata(replaced.metadata);
assert.deepEqual(
  replacedBook.portals.map((portal) => portal.token_hash).sort(),
  seed.portals.map((portal) => portal.token_hash).sort()
);
assert.deepEqual(
  replacedBook.portals.map((portal) => portal.id).sort(),
  seed.portals.map((portal) => portal.id).sort()
);
assert.equal(replaced.value.store.portals.some((portal) => portal.id === 'forged'), false);
assert.equal(replacedBook.settings.public_token, undefined);
assert.equal(JSON.stringify(replaced.metadata).includes('should-not-stick'), false);
assert.equal(
  (replaced.metadata[CONSTRUCTIONGRAPH_HASH_KEY] as Record<string, string>)[
    seed.portals.find((portal) => portal.kind === 'public')?.token_hash || ''
  ],
  'public'
);
const audit = replaced.metadata.constructiongraph_audit as Array<{ action: string }>;
assert.equal(audit[audit.length - 1]?.action, 'replace');

let metadata = meta;
let updatedAt: string | null = 't0';
let steal = true;
const contractor = seed.portals.find((portal) => portal.kind === 'contractor');
assert.ok(contractor?.id);
const live = reissueConstructionPortal(seed, contractor.id, 'desk', '2026-09-10T08:00:00.000Z');
assert.equal(live.ok, true);
if (!live.ok) throw new Error('live');
metadata = writeConstructiongraphToMetadata({}, live.store);
updatedAt = 't0';

const db: ConstructionPortalDb = {
  async findByHash(hash) {
    const map = metadata[CONSTRUCTIONGRAPH_HASH_KEY] as Record<string, string> | undefined;
    if (!map?.[hash]) return null;
    return { id: 7, trading_name: 'SiteCo', metadata, updated_at: updatedAt };
  },
  async findByLegacyToken() {
    return null;
  },
  async commit(_id, prev, nextMeta, nextAt) {
    if (steal) {
      steal = false;
      const staff = applyStaffConstructionAction({
        meta: metadata,
        action: 'merge',
        actorId: 'user_1',
        now: '2026-09-10T10:00:00.000Z',
        patch: {
          sites: live.store.sites.map((site) =>
            site.id === 'site_1' ? { ...site, notes: 'kept by staff' } : site
          ),
        },
      });
      if ('error' in staff) throw new Error(staff.error);
      metadata = staff.metadata;
      updatedAt = 'staff-write';
      return 'lost';
    }
    const same = updatedAt === prev || (updatedAt == null && prev == null);
    if (!same) return 'lost';
    metadata = nextMeta;
    updatedAt = nextAt;
    return 'ok';
  },
  async isThrottled() {
    return 'no';
  },
  async registerFailure() {
    return 'ok';
  },
};

async function main() {
const claimed = await servePublicPortal({
  request: new NextRequest('http://localhost/api/public/constructiongraph'),
  token: live.issued.token,
  db,
  body: { action: 'claim', paymentId: 'pay_2', amount: 50 },
});
assert.equal(claimed.status, 200);
const after = readConstructiongraphFromMetadata(metadata);
assert.equal(after.sites.find((site) => site.id === 'site_1')?.notes, 'kept by staff');
assert.equal(after.payments.find((row) => row.id === 'pay_2')?.reported_via, 'portal');
assert.equal(after.payments.find((row) => row.id === 'pay_2')?.status, 'claimed');

let losses = 0;
const conflict = await commitProfileMetadata({
  read: async () => ({ metadata, updated_at: updatedAt }),
  write: async () => {
    losses += 1;
    return 'lost';
  },
  change: (row) => ({ metadata: row.metadata, value: true }),
});
assert.equal(losses, 3);
assert.deepEqual(conflict, { ok: false, status: 409, error: CONSTRUCTION_CAS_CONFLICT });

let sawNull = false;
const nullRow = { metadata: { timezone: 'Africa/Johannesburg' }, updated_at: null as string | null };
const nullWrite = await commitProfileMetadata({
  read: async () => nullRow,
  write: async (args) => {
    sawNull = args.prevUpdatedAt === null;
    nullRow.metadata = args.metadata;
    nullRow.updated_at = args.nextUpdatedAt;
    return 'ok';
  },
  change: (row) => ({ metadata: { ...row.metadata, touched: true }, value: true }),
});
assert.equal(nullWrite.ok, true);
assert.equal(sawNull, true);

const roundStore = constructiongraphSeedStore('2026-09-10T08:00:00.000Z');
const roundIn = writeConstructiongraphToMetadata(
  { timezone: 'Africa/Johannesburg', owner_note: 'keep-me' },
  roundStore
);
(roundIn.constructiongraph as Record<string, unknown>).future_briefs = [{ id: 'brief113' }];
const reread = readConstructiongraphFromMetadata(roundIn);
const roundOut = writeConstructiongraphToMetadata(roundIn, reread);
assert.equal(roundOut.timezone, 'Africa/Johannesburg');
assert.equal(roundOut.owner_note, 'keep-me');
assert.deepEqual(
  (roundOut.constructiongraph as Record<string, unknown>).future_briefs,
  [{ id: 'brief113' }]
);
assert.equal(roundOut[CONSTRUCTIONGRAPH_TOKEN_KEY], null);
assert.equal(roundOut[CONSTRUCTIONGRAPH_TOKENS_KEY], null);
const left = readConstructiongraphFromMetadata(roundIn);
const right = readConstructiongraphFromMetadata(roundOut);
const keys = [
  'clients',
  'sites',
  'quotes',
  'drawings',
  'boq',
  'costs',
  'subcontractors',
  'materials',
  'plant',
  'programme',
  'safety',
  'variations',
  'certificates',
  'payments',
  'snags',
] as const;
for (const key of keys) {
  assert.deepEqual(right[key], left[key], key);
}

const badJson = await POST(
  new NextRequest('http://localhost/api/construction/constructiongraph', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  })
);
assert.equal(badJson.status, 400);
const badJsonBody = await badJson.text();
assert.equal(badJsonBody.includes('Unexpected'), false);
assert.equal(badJsonBody.includes('SyntaxError'), false);
assert.match(badJsonBody, /Invalid JSON/);

const signedOut = await GET(
  new NextRequest('http://localhost/api/construction/constructiongraph?companyId=1')
);
assert.ok(signedOut.status === 401 || signedOut.status === 403);
const signedOutBody = await signedOut.text();
assert.equal(signedOutBody.includes('"store"'), false);
assert.equal(hashPortalToken('cgp_staff') , hashPortalToken('cgp_staff'));

console.log('brief112-staff-route.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
