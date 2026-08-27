/**
 * Run: npx --yes tsx lib/auth/emails-from-jwt.test.ts
 */
import assert from 'node:assert/strict';
import { emailsFromJwtPayload } from './verify-privy';

assert.deepEqual(emailsFromJwtPayload(null), []);
assert.deepEqual(
  emailsFromJwtPayload({ email: 'Owner@Example.com' } as never),
  ['owner@example.com']
);
assert.deepEqual(
  emailsFromJwtPayload({
    emails: ['a@example.com', 'not-an-email', 'B@Example.com'],
    linked_accounts: [
      { type: 'email', address: 'linked@example.com' },
      { type: 'wallet', address: '0xabc' },
      { email: 'acct@example.com' },
    ],
  } as never),
  ['a@example.com', 'b@example.com', 'linked@example.com', 'acct@example.com']
);

console.log('emails-from-jwt tests ok');
