/**
 * Run: npx --yes tsx lib/security/email-filter.test.ts
 */
import assert from 'node:assert/strict';
import { isSafeFilterEmail, safeFilterEmails } from './email-filter';

assert.equal(isSafeFilterEmail('ada@example.com'), true);
assert.equal(isSafeFilterEmail('Ada@Example.COM'), true);
assert.equal(isSafeFilterEmail('a@b'), false);
assert.equal(isSafeFilterEmail('x,id.eq.1@x.com'), false);
assert.equal(isSafeFilterEmail('a%b@x.com'), false);
assert.equal(isSafeFilterEmail('a_b@x.com'), true);
assert.equal(isSafeFilterEmail(''), false);

const list = safeFilterEmails([
  'Ada@example.com',
  'ada@example.com',
  'bad,or@x.com',
  'ok@gym.co.za',
]);
assert.deepEqual(list, ['ada@example.com', 'ok@gym.co.za']);

console.log('email-filter tests ok');
