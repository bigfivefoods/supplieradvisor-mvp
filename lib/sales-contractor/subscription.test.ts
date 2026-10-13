import assert from 'node:assert/strict';
import { computeSubscriptionInfo, isLifetimeSalesAccess } from './subscription';

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

console.log('sales-contractor/subscription.test.ts ok');
