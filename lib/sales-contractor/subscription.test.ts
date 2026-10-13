import assert from 'node:assert/strict';
import {
  applySalesContractorFreeTerm,
  computeSubscriptionInfo,
  isLifetimeSalesAccess,
} from './subscription';

const lifetime = computeSubscriptionInfo({
  subscription_status: 'active',
  subscription_starts_at: '2026-10-12T00:00:00.000Z',
  subscription_ends_at: '9999-12-31T00:00:00.000Z',
});
assert.equal(isLifetimeSalesAccess({ subscription_status: 'lifetime' }), true);
assert.equal(lifetime.isActive, true);
assert.equal(lifetime.lifetime, true);
assert.equal(lifetime.daysRemaining, null);

const paid = computeSubscriptionInfo({
  subscription_status: 'active',
  subscription_starts_at: '2026-10-01T00:00:00.000Z',
  subscription_ends_at: '2027-04-01T00:00:00.000Z',
});
assert.equal(paid.lifetime, false);
assert.equal(paid.isActive, true);
assert.ok((paid.daysRemaining || 0) > 0);

const none = computeSubscriptionInfo({ subscription_status: 'none' });
assert.equal(none.isActive, false);
assert.equal(none.lifetime, false);
assert.equal(none.complimentaryTerm, false);

const now = new Date('2026-10-13T12:00:00.000Z');
const free = applySalesContractorFreeTerm(none, '2026-09-13T12:00:00.000Z', now);
assert.equal(free.isActive, true);
assert.equal(free.complimentaryTerm, true);
assert.equal(free.lifetime, false);
assert.equal(free.endsAt?.slice(0, 10), '2027-03-13');
assert.ok((free.daysRemaining || 0) > 140);

const elapsed = applySalesContractorFreeTerm(none, '2026-03-01T12:00:00.000Z', now);
assert.equal(elapsed.isActive, false);
assert.equal(elapsed.complimentaryTerm, false);

const lifetimeKept = applySalesContractorFreeTerm(
  lifetime,
  '2026-10-01T00:00:00.000Z',
  now
);
assert.equal(lifetimeKept.lifetime, true);
assert.equal(lifetimeKept.complimentaryTerm, false);
assert.equal(lifetimeKept.isActive, true);

const paidKept = applySalesContractorFreeTerm(paid, '2026-09-01T00:00:00.000Z', now);
assert.equal(paidKept.complimentaryTerm, false);
assert.equal(paidKept.isActive, true);
assert.equal(paidKept.lifetime, false);

const expired = computeSubscriptionInfo({
  subscription_status: 'active',
  subscription_starts_at: '2026-01-01T00:00:00.000Z',
  subscription_ends_at: '2026-02-01T00:00:00.000Z',
});
const expiredKept = applySalesContractorFreeTerm(
  expired,
  '2026-09-01T00:00:00.000Z',
  now
);
assert.equal(expiredKept.isActive, false);
assert.equal(expiredKept.complimentaryTerm, false);

console.log('sales-contractor/subscription.test.ts ok');
