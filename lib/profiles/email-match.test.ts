/**
 * Run: npx --yes tsx lib/profiles/email-match.test.ts
 * Fails if profile email lookups go back to a single casing or an ilike scan.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normaliseProfileEmail,
  profileEmailEqValues,
  profileEmailForWrite,
} from './email-match';

assert.equal(normaliseProfileEmail('  Desk@Example.Test '), 'desk@example.test');
assert.deepEqual(profileEmailEqValues('desk@example.test'), ['desk@example.test']);
assert.deepEqual(profileEmailEqValues(' Desk@Example.Test '), [
  'desk@example.test',
  'Desk@Example.Test',
]);
assert.equal(profileEmailForWrite(' Desk@Example.Test '), 'desk@example.test');
assert.equal(
  profileEmailForWrite(null, ' Desk@Example.Test '),
  'desk@example.test'
);
assert.equal(profileEmailForWrite('', '  '), null);

function src(path: string): string {
  return readFileSync(path, 'utf8');
}

const access = src('lib/customers/access.ts');
assert.equal(access.includes('profileEmailEqValues'), true);
assert.equal(access.includes(".in('email', values)"), true);
assert.equal(access.includes('.limit(5)'), true);
assert.equal(access.includes(".ilike('email'"), false);

const messaging = src('lib/messaging/service-to-company.ts');
assert.equal(messaging.includes('profileEmailEqValues'), true);
assert.equal(messaging.includes('.limit(20)'), true);
assert.equal(messaging.includes(".ilike('email'"), false);

const trade = src('app/api/public/portals/trade/act/route.ts');
assert.equal(trade.includes('profileEmailEqValues'), true);
assert.equal(trade.includes(".ilike('email'"), false);
assert.equal(trade.includes(".ilike('contact_email'"), false);
assert.equal(trade.includes(".limit(1)"), true);

const invite = src('app/api/invite-supplier/route.ts');
assert.equal(invite.includes('profileEmailEqValues'), true);
assert.equal(invite.includes('profileEmailForWrite'), true);
assert.equal(invite.includes(".ilike('email'"), false);

const claim = src('app/api/invites/claim/route.ts');
assert.equal(claim.includes('profileEmailForWrite(normalizedEmail, profile.email)'), true);
assert.equal(claim.includes('profileEmailForWrite(inviteEmail)'), true);

console.log('email-match.test.ts ok');
