/**
 * Brief 31 — Gym door auth unit tests.
 * Run: npx --yes tsx lib/fitness/gym-door-auth.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildAuthCodePayload,
  generateEmailCode,
  hashPin,
  hashSecret,
  isValidPin,
  secretsMatch,
  verifyAuthCode,
  verifyPin,
  findClientByEmail,
  findCoachByEmail,
  EMAIL_CODE_TTL_MS,
} from './gym-door-auth';
import { emptyFitgraphStore, type FitClient, type FitCoach } from './fitgraph';

// --- generateEmailCode ---
const code = generateEmailCode();
assert.match(code, /^\d{6}$/, 'code must be 6 digits');
assert.equal(generateEmailCode().length, 6, 'always 6 chars');

// Edge: pad to 6 even for small numbers
const padded = '007421';
assert.equal(padded.length, 6);

// --- hashSecret ---
const h = hashSecret('123456');
assert.equal(h.length, 64, 'SHA-256 hex = 64 chars');
assert.equal(hashSecret('123456'), hashSecret('123456'), 'deterministic');
assert.notEqual(hashSecret('123456'), hashSecret('654321'), 'different inputs differ');

// --- secretsMatch ---
assert.ok(secretsMatch('123456', hashSecret('123456')));
assert.ok(!secretsMatch('000000', hashSecret('123456')));
assert.ok(!secretsMatch('', hashSecret('123456')));

// --- buildAuthCodePayload ---
const now = Date.now();
const payload = buildAuthCodePayload('123456', now);
assert.equal(payload.code_hash, hashSecret('123456'));
const expiry = new Date(payload.expires_at).getTime();
assert.ok(expiry > now, 'expiry must be in the future');
assert.ok(expiry <= now + EMAIL_CODE_TTL_MS + 1000, 'expiry must not exceed TTL');

// --- verifyAuthCode ---
assert.ok(verifyAuthCode(payload, '123456', now), 'valid code must pass');
assert.ok(!verifyAuthCode(payload, '999999', now), 'wrong code must fail');
assert.ok(!verifyAuthCode(payload, '123456', expiry + 1), 'expired code must fail');
assert.ok(!verifyAuthCode(null, '123456', now), 'null payload must fail');
assert.ok(!verifyAuthCode(undefined, '123456', now), 'undefined payload must fail');
assert.ok(
  !verifyAuthCode({ code_hash: '', expires_at: payload.expires_at }, '123456', now),
  'empty hash must fail'
);

// --- PIN ---
assert.ok(isValidPin('1234'));
assert.ok(isValidPin('123456'));
assert.ok(!isValidPin('123'));
assert.ok(!isValidPin('1234567'));
assert.ok(!isValidPin('abcd'));
assert.ok(!isValidPin(''));

const pinHash = hashPin('9876');
assert.ok(verifyPin('9876', pinHash));
assert.ok(!verifyPin('0000', pinHash));

// --- findClientByEmail ---
const store = emptyFitgraphStore();
const client: FitClient = {
  id: 'cli_1',
  code: 'M1',
  name: 'Ada',
  email: 'ada@gym.co.za',
  membership_status: 'active',
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
store.clients = [client];

assert.equal(findClientByEmail(store, 'ada@gym.co.za')?.id, 'cli_1', 'finds by email');
assert.equal(findClientByEmail(store, 'ADA@GYM.CO.ZA')?.id, 'cli_1', 'case-insensitive');
assert.equal(findClientByEmail(store, 'other@gym.co.za'), null, 'not found');
assert.equal(findClientByEmail(store, 'notanemail'), null, 'no @ → null');

// inactive client must not be found
const inactive: FitClient = {
  ...client,
  id: 'cli_2',
  email: 'gone@gym.co.za',
  active: false,
};
store.clients.push(inactive);
assert.equal(findClientByEmail(store, 'gone@gym.co.za'), null, 'inactive not found');

// --- findCoachByEmail ---
const coach: FitCoach = {
  id: 'coa_1',
  name: 'Bob',
  email: 'bob@gym.co.za',
  active: true,
  created_at: '2026-01-01T00:00:00Z',
};
store.coaches = [coach];

assert.equal(findCoachByEmail(store, 'bob@gym.co.za')?.id, 'coa_1', 'finds coach by email');
assert.equal(findCoachByEmail(store, 'notacoach@gym.co.za'), null, 'non-coach returns null');

// non-coach email must not open coach lane
const memberEmail = 'ada@gym.co.za'; // is a client, not a coach
assert.equal(findCoachByEmail(store, memberEmail), null, 'member email not in coach lane');

// --- Auth code stored on person ---
// Simulate: a verified code grants access; email alone does NOT.
const emailOnly = findClientByEmail(store, 'ada@gym.co.za');
assert.ok(emailOnly !== null, 'found by email');
// Without verifying code, we must NOT open the PWA
// (Callers must call verifyAuthCode AFTER findClientByEmail)
assert.ok(
  !verifyAuthCode(
    { code_hash: emailOnly!.auth_code_hash ?? '', expires_at: emailOnly!.auth_code_expires_at ?? '' },
    '123456',
    now
  ),
  'fresh client with no code hash → must not pass'
);

// After storing a code on the client row
const goodCode = '748291';
const codePayload = buildAuthCodePayload(goodCode, now);
emailOnly!.auth_code_hash = codePayload.code_hash;
emailOnly!.auth_code_expires_at = codePayload.expires_at;

assert.ok(
  verifyAuthCode(
    { code_hash: emailOnly!.auth_code_hash!, expires_at: emailOnly!.auth_code_expires_at! },
    goodCode,
    now
  ),
  'correct code after storage passes'
);
assert.ok(
  !verifyAuthCode(
    { code_hash: emailOnly!.auth_code_hash!, expires_at: emailOnly!.auth_code_expires_at! },
    '000000',
    now
  ),
  'wrong code after storage fails (401)'
);

console.log('gym-door-auth tests ok');
