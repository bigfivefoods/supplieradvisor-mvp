/**
 * Run: npx --yes tsx lib/portals/portal-actor.test.ts
 */
import assert from 'node:assert/strict';
import {
  attachPortalActor,
  guestOnlyActionMessage,
  hostDisplayName,
  isGuestOnlyPortalAction,
  portalActionStamp,
} from './portal-actor';
import type { PublicPortalPayload } from './trade-portal';

assert.equal(isGuestOnlyPortalAction('profile'), true);
assert.equal(isGuestOnlyPortalAction('po_create'), true);
assert.equal(isGuestOnlyPortalAction('rate'), true);
assert.equal(isGuestOnlyPortalAction('task_add'), false);
assert.equal(isGuestOnlyPortalAction('message'), false);

assert.match(guestOnlyActionMessage('profile', 'customer'), /customer/);
assert.match(guestOnlyActionMessage('po_create', 'customer'), /your company credentials/);

const hostStamp = portalActionStamp(
  { userId: 'did:privy:craig', name: 'Craig' },
  { id: 99, name: 'Boxer buyer' }
);
assert.equal(hostStamp.isHost, true);
assert.equal(hostStamp.name, 'Craig');
assert.equal(hostStamp.createdBy, 'host:did:privy:craig');
assert.equal(hostStamp.messageAuthor, 'host');
assert.notEqual(hostStamp.noteTag, 'Boxer buyer');

const guestStamp = portalActionStamp(null, { id: 99, name: 'Boxer buyer' });
assert.equal(guestStamp.isHost, false);
assert.equal(guestStamp.createdBy, 'portal:99');
assert.equal(guestStamp.messageAuthor, 'guest');
assert.equal(guestStamp.noteTag, 'Boxer buyer');

const base = {
  kind: 'customer',
  paused: false,
  brochure: false,
  host: { id: 1, name: 'Big Five Foods' },
  welcome: '',
  title: 'Customer portal',
  viewer: { name: 'Boxer buyer', email: 'buyer@boxer.test', job_title: 'Buyer' },
  accountLabel: 'Boxer',
  quotes: [],
  orders: [],
  invoices: [],
  purchase_orders: [],
  documents: [],
  joinPath: '/login',
  moneyHint: null,
  kpis: {
    quotes: 0,
    orders: 0,
    invoices_open: 0,
    due: null,
    currency: 'ZAR',
    people: 1,
  },
  people: [
    {
      id: 7,
      name: 'Craig',
      email: 'craig@bigfivefoods.com',
      job_title: 'Owner',
      last_seen_at: null,
      you: false,
      side: 'host',
    },
    {
      id: 99,
      name: 'Boxer buyer',
      email: 'buyer@boxer.test',
      job_title: 'Buyer',
      last_seen_at: null,
      you: true,
      side: 'guest',
    },
  ],
} as unknown as PublicPortalPayload;

const asHost = attachPortalActor(base, {
  name: 'Craig',
  email: 'craig@bigfivefoods.com',
  memberId: 7,
});
assert.equal(asHost.actor?.role, 'host');
assert.equal(asHost.actor?.name, 'Craig');
assert.equal(asHost.people[0].you, true);
assert.equal(asHost.people[1].you, false);

const asGuest = attachPortalActor(base, null);
assert.equal(asGuest.actor?.role, 'guest');
assert.equal(asGuest.actor?.name, 'Boxer buyer');
assert.equal(asGuest.people[0].you, false);
assert.equal(asGuest.people[1].you, true);

assert.equal(
  hostDisplayName({
    memberName: 'Craig',
    companyName: 'Big Five Foods',
  }),
  'Craig'
);
assert.equal(
  hostDisplayName({
    memberName: '',
    contactName: 'Craig Parry',
    companyName: 'Big Five Foods',
  }),
  'Craig Parry'
);
assert.equal(
  hostDisplayName({
    memberEmail: 'craig@bigfivefoods.com',
    companyName: '',
  }),
  'craig'
);

console.log('portal-actor.test.ts ok');
