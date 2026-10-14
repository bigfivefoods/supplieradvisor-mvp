/**
 * Run: npx --yes tsx lib/trades/customer-session.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  TRADE_SESSION_COOKIE,
  hashSecret,
  magicLink,
  newOtp,
  sessionCookieOptions,
} from './customer-session';

assert.equal(TRADE_SESSION_COOKIE, 'sa_trade_customer');
assert.equal(
  hashSecret('abc'),
  createHash('sha256').update('abc', 'utf8').digest('hex')
);
assert.notEqual(hashSecret('abc'), hashSecret('abd'));
const otp = newOtp();
assert.match(otp, /^\d{6}$/);
const cookie = sessionCookieOptions();
assert.equal(cookie.httpOnly, true);
assert.equal(cookie.path, '/');
assert.equal(
  magicLink('https://supplieradvisor.com', 'tg_demo', 'secret'),
  'https://supplieradvisor.com/customer/tradegraph/tg_demo?magic=secret'
);

console.log('customer-session.test.ts ok');
