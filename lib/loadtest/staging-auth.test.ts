/**
 * Run: npx --yes tsx lib/loadtest/staging-auth.test.ts
 * Clean-room tokens are built with node:crypto, not with mintLoadtestJwt.
 * The signing key below is a fixture. It is not a deployed secret.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { isPublicApiPath } from '../auth/public-paths';
import { GET as sessionGet } from '../../app/api/loadtest/session/route';
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  STAGING_SUPABASE_PROJECT_REF,
  supabaseProjectRefFromUrl,
} from '../system/env-guard';
import { mintLoadtestJwt, verifyLoadtestJwt } from './jwt.js';
import { parseLoadtestUsers, userForVu } from '../../loadtest/lib/seed-users.js';
import { authenticateLoadtestToken, loadtestAuthEnabled } from './staging-auth';

const KEY = 'staging-loadtest-signing-key-32ch';
const OTHER_KEY = 'other-loadtest-signing-key-32chars';
const NOW = 1_800_000_000;
const SUB = 'loadtest-user-1-1';
const PROFILE_ID = 101;
const NONCE = 'nonce-fixture-0001';

function hmacSha256Hex(data: string, key: string) {
  return createHmac('sha256', key).update(data).digest('hex');
}

function b64url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function cleanRoomToken(overrides: Record<string, unknown> = {}, key = KEY) {
  const header = { alg: 'HS256', typ: 'JWT', ...(overrides.header as object | undefined) };
  delete (overrides as { header?: unknown }).header;
  const payload = {
    sub: SUB,
    profile_id: PROFILE_ID,
    ref: STAGING_SUPABASE_PROJECT_REF,
    nonce: NONCE,
    iat: NOW - 10,
    exp: NOW + 600,
    ...overrides,
  };
  const h = b64url(header);
  const p = b64url(payload);
  const sig = Buffer.from(hmacSha256Hex(`${h}.${p}`, key), 'hex').toString('base64url');
  return `${h}.${p}.${sig}`;
}

function stagingEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    VERCEL_ENV: 'preview',
    LOADTEST_ENDPOINTS: '1',
    LOADTEST_SIGNING_KEY: KEY,
    SUPABASE_URL: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
    ...overrides,
  };
}

const open = stagingEnv();
const token = cleanRoomToken();
const minted = mintLoadtestJwt({
  key: KEY,
  sub: SUB,
  profileId: PROFILE_ID,
  ref: STAGING_SUPABASE_PROJECT_REF,
  nonce: NONCE,
  iat: NOW - 10,
  exp: NOW + 600,
  hmacSha256Hex,
});
assert.equal(minted, token, 'shared minter matches the clean-room token');

const rows: Array<{ name: string; env: Record<string, string | undefined>; tok: string; code: string }> = [
  { name: 'production env and production ref', env: stagingEnv({ VERCEL_ENV: 'production', SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`, NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co` }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'production env and staging ref', env: stagingEnv({ VERCEL_ENV: 'production' }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'production env with every other flag set', env: stagingEnv({ VERCEL_ENV: 'production', LOADTEST_ENDPOINTS: '1' }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'preview pointed at production', env: stagingEnv({ SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`, NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co` }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'preview public url is production', env: stagingEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co` }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'endpoints off', env: stagingEnv({ LOADTEST_ENDPOINTS: '0' }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'endpoints unset', env: stagingEnv({ LOADTEST_ENDPOINTS: undefined }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'key missing', env: stagingEnv({ LOADTEST_SIGNING_KEY: undefined }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'key too short', env: stagingEnv({ LOADTEST_SIGNING_KEY: 'short-key' }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'development', env: stagingEnv({ VERCEL_ENV: 'development' }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'empty vercel env', env: stagingEnv({ VERCEL_ENV: '' }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'refs disagree', env: stagingEnv({ SUPABASE_URL: 'https://otherexampleref.supabase.co' }), tok: token, code: 'LOADTEST_AUTH_DISABLED' },
  { name: 'valid staging preview', env: open, tok: token, code: 'ok' },
  { name: 'pooler staging url', env: stagingEnv({ SUPABASE_URL: `postgresql://postgres.${STAGING_SUPABASE_PROJECT_REF}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres` }), tok: token, code: 'ok' },
  { name: 'wrong key', env: stagingEnv({ LOADTEST_SIGNING_KEY: OTHER_KEY }), tok: token, code: 'BAD_SIGNATURE' },
  { name: 'expired', env: open, tok: cleanRoomToken({ iat: NOW - 3600, exp: NOW - 1 }), code: 'EXPIRED' },
  { name: 'ttl over one hour', env: open, tok: cleanRoomToken({ iat: NOW - 10, exp: NOW + 3601 }), code: 'BAD_EXP' },
  { name: 'missing exp', env: open, tok: cleanRoomToken({ exp: undefined }), code: 'BAD_EXP' },
  { name: 'missing nonce', env: open, tok: cleanRoomToken({ nonce: undefined }), code: 'BAD_NONCE' },
  { name: 'short nonce', env: open, tok: cleanRoomToken({ nonce: 'short' }), code: 'BAD_NONCE' },
  { name: 'wrong ref', env: open, tok: cleanRoomToken({ ref: 'otherexampleref' }), code: 'WRONG_REF' },
  { name: 'claim names the production ref', env: open, tok: cleanRoomToken({ ref: PRODUCTION_SUPABASE_PROJECT_REF }), code: 'WRONG_REF' },
  { name: 'missing sub', env: open, tok: cleanRoomToken({ sub: undefined }), code: 'BAD_SUBJECT' },
  { name: 'privy subject', env: open, tok: cleanRoomToken({ sub: 'did:privy:real-user' }), code: 'BAD_SUBJECT' },
  { name: 'missing profile', env: open, tok: cleanRoomToken({ profile_id: undefined }), code: 'BAD_PROFILE' },
  { name: 'alg none', env: open, tok: `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: SUB, profile_id: PROFILE_ID, ref: STAGING_SUPABASE_PROJECT_REF, nonce: NONCE, iat: NOW - 10, exp: NOW + 60 })}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, code: 'BAD_HEADER' },
  { name: 'empty token', env: open, tok: '', code: 'MALFORMED' },
];

for (const row of rows) {
  const result = authenticateLoadtestToken(row.tok, row.env, NOW);
  const code = result.ok ? 'ok' : result.code;
  assert.equal(code, row.code, row.name);
  assert.equal(JSON.stringify(result).includes(KEY), false, row.name);
  assert.equal(JSON.stringify(result).includes(OTHER_KEY), false, row.name);
  if (row.name.startsWith('production')) {
    assert.equal(loadtestAuthEnabled(row.env), false, row.name);
    assert.equal(result.ok, false, row.name);
  }
}

const accepted = authenticateLoadtestToken(token, open, NOW);
assert.equal(accepted.ok, true);
if (accepted.ok) {
  assert.equal(accepted.userId, SUB);
  assert.equal(accepted.profileId, PROFILE_ID);
}

const direct = verifyLoadtestJwt({ token, key: KEY, now: NOW, hmacSha256Hex });
assert.equal(direct.ok, true);

assert.equal(
  supabaseProjectRefFromUrl(`postgresql://postgres.${STAGING_SUPABASE_PROJECT_REF}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`),
  STAGING_SUPABASE_PROJECT_REF
);
assert.equal(
  supabaseProjectRefFromUrl(`https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`),
  PRODUCTION_SUPABASE_PROJECT_REF
);

const gateSrc = readFileSync('lib/loadtest/staging-auth.ts', 'utf8');
const gateFn = gateSrc.slice(gateSrc.indexOf('export function loadtestAuthEnabled'));
const productionAt = gateFn.indexOf("env.VERCEL_ENV === 'production'");
const endpointsAt = gateFn.indexOf('LOADTEST_ENDPOINTS');
const keyAt = gateFn.indexOf('LOADTEST_SIGNING_KEY');
assert.ok(productionAt >= 0 && productionAt < endpointsAt && productionAt < keyAt);
assert.equal(gateFn.slice(0, gateFn.indexOf('export function authenticateLoadtestToken')).includes('createHmac'), false);

const authSrc = readFileSync('lib/auth/api-auth.ts', 'utf8');
const loadtestAt = authSrc.indexOf('authenticateLoadtestToken(');
const privyAt = authSrc.indexOf('verifyPrivyAccessToken(token)');
assert.ok(loadtestAt > 0 && privyAt > loadtestAt);
assert.equal(readFileSync('lib/auth/verify-privy.ts', 'utf8').includes('LOADTEST'), false);
assert.equal(readFileSync('middleware.ts', 'utf8').includes('LOADTEST'), false);
assert.equal(readFileSync('next.config.js', 'utf8').includes('LOADTEST_SIGNING_KEY'), false);
assert.equal(readFileSync('loadtest/lib/k6-auth.js', 'utf8').includes('console.'), false);
assert.equal(/LOADTEST_SIGNING_KEY\s*=\s*['"]/.test(readFileSync('loadtest/lib/k6-auth.js', 'utf8')), false);
assert.equal(readFileSync('loadtest/scenarios/authed.js', 'utf8').includes('console.'), false);

assert.equal(isPublicApiPath('/api/loadtest/session'), false);
assert.equal(isPublicApiPath('/api/loadtest/whoami'), true);

const users = parseLoadtestUsers(JSON.stringify([
  { sub: 'loadtest-user-1-1', profileId: 11 },
  { sub: 'loadtest-user-1-2', profileId: 11 },
  { sub: 'loadtest-user-2-1', profileId: 22 },
  { sub: 'loadtest-user-3-1', profileId: 33 },
]));
assert.equal(userForVu(users, 0).sub, 'loadtest-user-1-1');
assert.equal(userForVu(users, 5).sub, 'loadtest-user-1-2');
assert.throws(() => parseLoadtestUsers(''), /LOADTEST_USERS is not set/);
assert.throws(() => parseLoadtestUsers(JSON.stringify([{ sub: 'did:privy:abc', profileId: 1 }])), /seeded user/);
assert.throws(() => userForVu([], 0), /no seeded users/);

const previous = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  LOADTEST_ENDPOINTS: process.env.LOADTEST_ENDPOINTS,
  LOADTEST_SIGNING_KEY: process.env.LOADTEST_SIGNING_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_STRICT: process.env.AUTH_STRICT,
};
function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function routeChecks() {
  const now = Math.floor(Date.now() / 1000);
  const live = cleanRoomToken({ iat: now - 5, exp: now + 600, nonce: 'route-nonce-fixture' });
  for (const [name, value] of Object.entries(open)) setEnv(name, value);
  setEnv('NODE_ENV', 'production');
  setEnv('AUTH_STRICT', '1');
  setEnv('NEXT_PUBLIC_PRIVY_APP_ID', undefined);
  setEnv('PRIVY_APP_ID', undefined);

  const closedEnv = stagingEnv({ VERCEL_ENV: 'production' });
  for (const [name, value] of Object.entries(closedEnv)) setEnv(name, value);
  const hidden = await sessionGet(new NextRequest('http://localhost/api/loadtest/session', {
    headers: { Authorization: `Bearer ${live}` },
  }));
  assert.equal(hidden.status, 404);
  assert.equal(JSON.stringify(await hidden.json()).includes(KEY), false);

  for (const [name, value] of Object.entries(open)) setEnv(name, value);
  const missing = await sessionGet(new NextRequest('http://localhost/api/loadtest/session'));
  assert.equal(missing.status, 401);
  const bad = await sessionGet(new NextRequest('http://localhost/api/loadtest/session', {
    headers: { Authorization: 'Bearer not-a-loadtest-token-and-not-privy' },
  }));
  assert.equal(bad.status, 401);
  assert.equal(JSON.stringify(await bad.json()).includes(KEY), false);

  const ok = await sessionGet(new NextRequest('http://localhost/api/loadtest/session', {
    headers: { Authorization: `Bearer ${live}` },
  }));
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.deepEqual(body, { userId: SUB, stage: 'staging' });
  assert.equal(JSON.stringify(body).includes(KEY), false);
  assert.equal(ok.headers.get('set-cookie'), null);
}

routeChecks()
  .then(() => {
    console.log('staging-auth.test.ts ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    for (const [name, value] of Object.entries(previous)) setEnv(name, value);
  });
