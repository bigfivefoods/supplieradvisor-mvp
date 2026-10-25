/**
 * stripe 16 to 23. The app does not construct a client here.
 * Run: npx --yes tsx lib/payments/stripe-major.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';

const version = JSON.parse(
  readFileSync(new URL('../../node_modules/stripe/package.json', import.meta.url), 'utf8')
).version as string;

assert.equal(typeof Stripe, 'function');
assert.match(version, /^23\./);
assert.equal(process.env.STRIPE_SECRET_KEY, undefined);
assert.equal(process.env.STRIPE_SECRET, undefined);

console.log('stripe-major.test.ts ok', version);
