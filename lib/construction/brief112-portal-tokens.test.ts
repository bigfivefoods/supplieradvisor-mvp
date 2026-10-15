/**
 * ConstructionAdvisor® portal token entropy and storage.
 * Run: npx --yes tsx lib/construction/brief112-portal-tokens.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  CONSTRUCTIONGRAPH_HASH_KEY,
  CONSTRUCTIONGRAPH_TOKEN_KEY,
  CONSTRUCTIONGRAPH_TOKENS_KEY,
  emptyConstructiongraphStore,
  writeConstructiongraphToMetadata,
} from './constructiongraph';
import { issueConstructionPortal } from './portal-issue';
import {
  digestsMatch,
  hashPortalToken,
  isPortalTokenShape,
  newPortalToken,
} from './portal-tokens';
import { sha256Hex } from './sha256';

const tokens = new Set<string>();
const prefixes = new Set<string>();
for (let i = 0; i < 10_000; i += 1) {
  const token = newPortalToken();
  assert.match(token, /^cgp_[0-9a-f]{64}$/);
  assert.equal(tokens.has(token), false);
  tokens.add(token);
  // 12 hex characters of the random body. The cgp_ prefix is shared by design.
  const prefix = token.slice(4, 16);
  assert.equal(prefix.length, 12);
  assert.equal(prefixes.has(prefix), false, `prefix collision ${prefix}`);
  prefixes.add(prefix);
}

const tokenSource = readFileSync(resolve('lib/construction/portal-tokens.ts'), 'utf8');
assert.match(tokenSource, /randomBytes/);
assert.equal(tokenSource.includes('Math.random'), false);

for (const rel of [
  'lib/construction/portal-tokens.ts',
  'app/api/public/constructiongraph/route.ts',
  'app/api/construction/constructiongraph/route.ts',
]) {
  assert.equal(readFileSync(resolve(rel), 'utf8').includes('Math.random'), false, rel);
}

const graph = readFileSync(resolve('lib/construction/constructiongraph.ts'), 'utf8');
const mintStart = graph.indexOf('export function mintConstructionToken()');
const mintEnd = graph.indexOf('function newPortalRowIdLocal()');
assert.ok(mintStart >= 0 && mintEnd > mintStart);
const mintBody = graph.slice(mintStart, mintEnd);
assert.equal(mintBody.includes('Math.random'), false);
assert.match(mintBody, /getRandomValues|randomBytes|randomHex/);

const sample = 'cgp_test';
const digest = hashPortalToken(sample);
assert.equal(digest, hashPortalToken(sample));
assert.equal(digest, createHash('sha256').update(sample).digest('hex'));
assert.equal(digest, sha256Hex(sample));
assert.match(digest, /^[0-9a-f]{64}$/);

assert.equal(isPortalTokenShape(''), false);
assert.equal(isPortalTokenShape('abcdefg'), false);
assert.equal(isPortalTokenShape('a'.repeat(129)), false);
for (const bad of ['.', ',', '(', ')', ' ', '>']) {
  assert.equal(isPortalTokenShape(`abcdefgh${bad}ijkl`), false, bad);
}
assert.equal(isPortalTokenShape('abcdefgh'), true);
assert.equal(isPortalTokenShape(`cgp_${'ab'.repeat(32)}`), true);

const hex = hashPortalToken('left');
assert.equal(digestsMatch(hex, hex), true);
assert.equal(digestsMatch(hex, hashPortalToken('right')), false);
assert.equal(digestsMatch('aa', 'aabb'), false);
assert.equal(digestsMatch('zz', 'zz'), false);

const issued = issueConstructionPortal(emptyConstructiongraphStore(), {
  kind: 'public',
  label: 'Client & contractor PWA',
  now: '2026-09-10T08:00:00.000Z',
});
assert.equal(issued.ok, true);
if (!issued.ok) throw new Error('issue failed');
const meta = writeConstructiongraphToMetadata({ timezone: 'Africa/Johannesburg' }, issued.store);
const json = JSON.stringify(meta);
assert.equal(json.includes(issued.issued.token), false);
assert.equal(json.includes('"token":'), false);
assert.equal(meta[CONSTRUCTIONGRAPH_TOKEN_KEY], null);
assert.equal(meta[CONSTRUCTIONGRAPH_TOKENS_KEY], null);
const hashes = meta[CONSTRUCTIONGRAPH_HASH_KEY] as Record<string, string>;
assert.equal(hashes[hashPortalToken(issued.issued.token)], 'public');

console.log('brief112-portal-tokens.test.ts ok');
