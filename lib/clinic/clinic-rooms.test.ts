/**
 * Run: npx --yes tsx lib/clinic/clinic-rooms.test.ts
 */
import assert from 'node:assert/strict';
import {
  clinicRoomNames,
  mergeClinicRoomNames,
  normalizeClinicRooms,
  removeClinicRoom,
  upsertClinicRoom,
} from './clinic-rooms';

const fromStrings = normalizeClinicRooms(['Surgery 1', 'Bay A', 'Surgery 1']);
assert.equal(fromStrings.length, 2);
assert.deepEqual(clinicRoomNames(fromStrings), ['Surgery 1', 'Bay A']);

const fromMix = normalizeClinicRooms([
  {
    id: 'r1',
    name: 'Consult 1',
    notes: 'Window',
    practitioner_ids: ['p1'],
    asset_ids: [12, '12', 0, 'x'],
  },
  'Consult 2',
]);
assert.equal(fromMix[0].practitioner_ids?.[0], 'p1');
assert.deepEqual(fromMix[0].asset_ids, [12]);
assert.equal(fromMix[1].name, 'Consult 2');

const merged = mergeClinicRoomNames(fromMix, ['Consult 1', 'New room']);
assert.equal(merged.length, 2);
assert.equal(merged[0].notes, 'Window');
assert.deepEqual(merged[0].asset_ids, [12]);
assert.equal(merged[1].name, 'New room');

const added = upsertClinicRoom(fromMix, { name: 'Surgery 2', notes: 'Bay' });
assert.equal(added.created, true);
assert.equal(added.room.name, 'Surgery 2');
assert.equal(added.rooms.length, 3);
const updated = upsertClinicRoom(added.rooms, {
  id: added.room.id,
  name: 'Surgery 2',
  notes: 'Updated',
});
assert.equal(updated.created, false);
assert.equal(updated.room.notes, 'Updated');
assert.equal(removeClinicRoom(updated.rooms, added.room.id).length, 2);

console.log('clinic-rooms.test.ts ok');
