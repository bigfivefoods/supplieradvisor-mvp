/**
 * Run: npx --yes tsx lib/fitness/fitgraph-merge.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { mergeFitgraphStores, mergeRowsById } from './fitgraph-merge';

const rows = mergeRowsById(
  [
    { id: 'a', status: 'booked' },
    { id: 'b', status: 'booked' },
  ],
  [{ id: 'a', status: 'attended' }, { id: 'c', status: 'booked' }]
);
assert.equal(rows.length, 3);
assert.equal(rows.find((r) => r.id === 'a')?.status, 'attended');
assert.ok(rows.some((r) => r.id === 'b'));
assert.ok(rows.some((r) => r.id === 'c'));

const latest = emptyFitgraphStore();
latest.bookings.push({
  id: 'b1',
  session_id: 's1',
  client_id: 'c1',
  status: 'booked',
  booked_at: '2026-08-01',
});
latest.goals = [
  {
    id: 'g1',
    client_id: 'c1',
    title: 'Weight',
    category: 'physical',
    status: 'active',
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
];
latest.movements = [{ id: 'm1', name: 'Squat' } as never];

const incoming = emptyFitgraphStore();
incoming.bookings.push({
  id: 'b1',
  session_id: 's1',
  client_id: 'c1',
  status: 'attended',
  booked_at: '2026-08-01',
  rsvp: 'coming',
});
incoming.bookings.push({
  id: 'b2',
  session_id: 's1',
  client_id: 'c2',
  status: 'booked',
  booked_at: '2026-08-02',
});
incoming.settings = { ...incoming.settings, brand_name: 'VUKA' };

const merged = mergeFitgraphStores(latest, incoming);
assert.equal(merged.bookings.length, 2);
assert.equal(
  merged.bookings.find((b) => b.id === 'b1')?.status,
  'attended'
);
assert.equal(merged.goals?.length, 1);
assert.equal(merged.movements?.length, 1);
assert.equal(merged.settings?.brand_name, 'VUKA');

const latestStamp = emptyFitgraphStore();
latestStamp.bookings.push({
  id: 'b1',
  session_id: 's1',
  client_id: 'c1',
  status: 'attended',
  booked_at: '2026-08-01',
  updated_at: '2026-08-24T10:00:00Z',
});
const incomingStamp = emptyFitgraphStore();
incomingStamp.bookings.push({
  id: 'b1',
  session_id: 's1',
  client_id: 'c1',
  status: 'booked',
  booked_at: '2026-08-01',
  updated_at: '2026-08-24T09:00:00Z',
});
incomingStamp.bookings.push({
  id: 'b9',
  session_id: 's1',
  client_id: 'c1',
  status: 'booked',
  booked_at: '2026-08-01',
});
const stamped = mergeFitgraphStores(latestStamp, incomingStamp);
assert.equal(stamped.bookings.length, 1);
assert.equal(stamped.bookings[0].status, 'attended');

const noSettings = emptyFitgraphStore();
delete (noSettings as { settings?: unknown }).settings;
const withBrand = emptyFitgraphStore();
withBrand.settings = { ...withBrand.settings, brand_name: 'Desk', enabled: true };
const settingsMerged = mergeFitgraphStores(noSettings, withBrand);
assert.equal(settingsMerged.settings?.enabled, true);
assert.equal(settingsMerged.settings?.brand_name, 'Desk');
assert.equal(typeof settingsMerged.settings?.public_token, 'string');

const pwaLatest = emptyFitgraphStore();
pwaLatest.settings = {
  ...pwaLatest.settings,
  pwa_name: 'Old',
  pwa_background_color: '#0c4a6e',
};
const pwaIncoming = emptyFitgraphStore();
pwaIncoming.settings = {
  ...pwaIncoming.settings,
  pwa_name: 'VUKA Fitness',
  pwa_theme_color: '#e8e830',
  pwa_background_color: '#a3aaae',
};
const pwaMerged = mergeFitgraphStores(pwaLatest, pwaIncoming);
assert.equal(pwaMerged.settings?.pwa_name, 'VUKA Fitness');
assert.equal(pwaMerged.settings?.pwa_theme_color, '#e8e830');
assert.equal(pwaMerged.settings?.pwa_background_color, '#a3aaae');

console.log('fitgraph-merge.test.ts ok');
