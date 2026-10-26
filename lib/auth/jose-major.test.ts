/**
 * jose 5 to 6. Does not call Privy and does not verify a real token.
 * Run: npx --yes tsx lib/auth/jose-major.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { emailsFromJwtPayload, verifyPrivyAccessToken } from './verify-privy';

const version = JSON.parse(
  readFileSync(new URL('../../node_modules/jose/package.json', import.meta.url), 'utf8')
).version as string;

assert.match(version, /^6\./);
assert.equal(typeof jwtVerify, 'function');
assert.equal(typeof createRemoteJWKSet, 'function');
assert.deepEqual(
  emailsFromJwtPayload({
    email: 'Person@Example.com',
    linked_accounts: [{ type: 'email', address: 'other@example.com' }],
  }),
  ['person@example.com', 'other@example.com']
);

verifyPrivyAccessToken('too-short').then((missing) => {
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, 'NO_TOKEN');
  console.log('jose-major.test.ts ok', version);
});
