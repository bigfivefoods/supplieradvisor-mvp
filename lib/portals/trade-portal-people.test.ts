/**
 * Run: npx --yes tsx lib/portals/trade-portal-people.test.ts
 */
import assert from 'node:assert/strict';
import { publicPeopleView } from './trade-portal-people';
import type { TradePortalViewer } from './trade-portal';

const people: TradePortalViewer[] = [
  {
    id: 1,
    portal_id: 9,
    profile_id: 2,
    name: 'Ada',
    email: 'ada@example.com',
    phone: null,
    job_title: 'Buyer',
    token: 'tv_secret_ada',
    customer_id: 44,
    supplier_id: null,
    status: 'active',
    last_seen_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 2,
    portal_id: 9,
    profile_id: 2,
    name: 'Ben',
    email: 'ben@example.com',
    phone: null,
    job_title: null,
    token: 'tv_secret_ben',
    customer_id: 44,
    supplier_id: null,
    status: 'revoked',
    last_seen_at: null,
  },
];

const pub = publicPeopleView(people, 1);
assert.equal(pub.length, 1);
assert.equal(pub[0].you, true);
assert.equal(pub[0].name, 'Ada');
assert.equal(
  Object.prototype.hasOwnProperty.call(pub[0], 'token'),
  false
);

console.log('trade-portal-people.test.ts ok');
