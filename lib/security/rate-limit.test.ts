/**
 * Run: npx --yes tsx lib/security/rate-limit.test.ts
 */
import assert from 'node:assert/strict';
import { rateLimit } from './rate-limit';

const a = rateLimit({ key: 'rl-test-a', limit: 2, windowMs: 60_000 });
assert.equal(a.ok, true);
const b = rateLimit({ key: 'rl-test-a', limit: 2, windowMs: 60_000 });
assert.equal(b.ok, true);
const c = rateLimit({ key: 'rl-test-a', limit: 2, windowMs: 60_000 });
assert.equal(c.ok, false);
assert.ok(c.retryAfterSec >= 1);

const other = rateLimit({ key: 'rl-test-b', limit: 2, windowMs: 60_000 });
assert.equal(other.ok, true);

console.log('rate-limit.test.ts ok');
