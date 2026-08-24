/**
 * Run: npx --yes tsx lib/portals/trade-portal-people.test.ts
 */
import assert from 'node:assert/strict';
import {
  mergePortalPeople,
  parsePortalPersonKey,
  portalPersonKey,
  publicPeopleView,
} from './trade-portal-people';
import type { PortalPersonPublic, TradePortalViewer } from './trade-portal';

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
assert.equal(pub[0].side, 'guest');
assert.equal(
  Object.prototype.hasOwnProperty.call(pub[0], 'token'),
  false
);

assert.equal(portalPersonKey({ id: 12, side: 'host' }), 'host:12');
assert.equal(portalPersonKey({ id: 99, side: 'guest' }), 'guest:99');
assert.deepEqual(parsePortalPersonKey('host:12'), { side: 'host', id: 12 });
assert.equal(parsePortalPersonKey('12'), null);

const merged = mergePortalPeople(
  [
    {
      id: 7,
      name: 'Craig',
      email: 'craig@bigfivefoods.com',
      job_title: 'Owner',
      last_seen_at: null,
      you: false,
      side: 'host',
    },
  ] as PortalPersonPublic[],
  [
    pub[0],
    {
      id: 8,
      name: 'Craig guest',
      email: 'craig@bigfivefoods.com',
      job_title: null,
      last_seen_at: null,
      you: false,
      side: 'guest',
    },
  ]
);
assert.equal(merged.length, 2);
assert.equal(merged[0].name, 'Craig');
assert.equal(merged[0].side, 'host');
assert.equal(merged[1].name, 'Ada');

console.log('trade-portal-people.test.ts ok');
