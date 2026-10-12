import assert from 'node:assert/strict';
import { googleConfigured, openSecret, outlookConfigured, readCalendarState, sealSecret, signCalendarState } from './calendar-secrets';

process.env.SALES_DIARY_FEED_SECRET = 'calendar-sync-test-secret';
delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
delete process.env.MICROSOFT_CALENDAR_CLIENT_ID;
delete process.env.MICROSOFT_CALENDAR_CLIENT_SECRET;

const plain = 'refresh-token-not-for-logs';
const sealed = sealSecret(plain);
assert.equal(openSecret(sealed), plain);
assert.equal(sealed.includes(plain), false);
assert.equal(openSecret('v1.aaaa.bbbb.cccc'), null);
assert.equal(openSecret(sealed.slice(0, -3) + 'xxx'), null);

const state = signCalendarState({ companyId: 102, userId: 'user-1', provider: 'google' });
const read = readCalendarState(state);
assert.equal(read?.companyId, 102);
assert.equal(read?.userId, 'user-1');
assert.equal(read?.provider, 'google');
assert.equal(readCalendarState(state.slice(0, -4) + 'xxxx'), null);
assert.equal(readCalendarState('c1.not-json.sig'), null);

const now = Date.now;
try {
  Date.now = () => 1_700_000_000_000;
  const expiring = signCalendarState({ companyId: 102, userId: 'user-1', provider: 'outlook' });
  Date.now = () => 1_700_000_000_000 + 11 * 60 * 1000;
  assert.equal(readCalendarState(expiring), null);
  Date.now = () => 1_700_000_000_000 + 5 * 60 * 1000;
  assert.equal(readCalendarState(expiring)?.provider, 'outlook');
} finally {
  Date.now = now;
}

assert.equal(googleConfigured(), false);
assert.equal(outlookConfigured(), false);
process.env.GOOGLE_CALENDAR_CLIENT_ID = 'id';
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret';
assert.equal(googleConfigured(), true);

console.log('calendar-secrets tests ok');
