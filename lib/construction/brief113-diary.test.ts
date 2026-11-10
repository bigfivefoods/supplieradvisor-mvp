/**
 * Diary lock, banned fields, and the SAST date line.
 * Run: npx --yes tsx lib/construction/brief113-diary.test.ts
 */
import assert from 'node:assert/strict';
import { reduceDiary, withDiaryAddendum } from './diary-model';
import { sastToday } from './format';
import { applyConstructionAction } from './actions';
import {
  emptyConstructiongraphStore,
  readConstructiongraphFromMetadata,
  writeConstructiongraphToMetadata,
} from './constructiongraph';
import { applyStaffConstructionAction } from './staff-book';

assert.equal(sastToday(new Date('2026-10-15T22:00:00Z')), '2026-10-16');
assert.equal(sastToday(new Date('2026-10-15T21:59:00Z')), '2026-10-15');

const draft = { id: 'd1', site_id: 's1', date: '2026-10-15', progress_note: 'Poured', author_name: 'Site' };
const started = reduceDiary([], [draft]);
assert.equal(started.ok, true);
if (!started.ok) throw new Error('start');
const signed = reduceDiary(started.diary, [{ ...draft, signed_off_at: '2026-10-15T16:00:00+02:00', signed_off_by: 'Site' }]);
assert.equal(signed.ok, true);
if (!signed.ok) throw new Error('sign');
const edited = reduceDiary(signed.diary, [{ ...signed.diary[0]!, progress_note: 'Changed' }]);
assert.equal(edited.ok, false);
const addendum = reduceDiary(signed.diary, [{ ...signed.diary[0]!, addenda: [{ at: '2026-10-15T18:00:00+02:00', note: 'Rain after sign-off', author_name: 'Site' }] }]);
assert.equal(addendum.ok, true);
if (!addendum.ok) throw new Error('addendum');
assert.equal(addendum.diary[0]?.progress_note, 'Poured');
assert.equal(addendum.diary[0]?.signed_off_at, '2026-10-15T16:00:00+02:00');
assert.equal(addendum.diary[0]?.addenda?.[0]?.text, 'Rain after sign-off');
assert.equal(addendum.diary[0]?.addenda?.[0]?.by, 'Site');
const rewritten = reduceDiary(addendum.diary, [{
  ...addendum.diary[0]!,
  addenda: [{ ...addendum.diary[0]!.addenda![0]!, text: 'Changed the record' }],
}]);
assert.equal(rewritten.ok, false);
const dropped = reduceDiary(addendum.diary, [{ ...addendum.diary[0]!, addenda: [] }]);
assert.equal(dropped.ok, false);
const appended = reduceDiary(addendum.diary, [withDiaryAddendum(addendum.diary[0]!, {
  at: '2026-10-15T19:00:00+02:00',
  by: 'Site',
  text: 'Pump arrived',
})]);
assert.equal(appended.ok, true);
if (!appended.ok) throw new Error('append');
assert.equal(appended.diary[0]?.progress_note, 'Poured');
assert.equal(appended.diary[0]?.addenda?.length, 2);
assert.equal(appended.diary[0]?.addenda?.[0]?.text, 'Rain after sign-off');
const nameless = reduceDiary(addendum.diary, [withDiaryAddendum(addendum.diary[0]!, {
  at: '2026-10-15T19:00:00+02:00',
  by: '',
  text: 'No name',
})]);
assert.equal(nameless.ok, false);
const photo = reduceDiary(started.diary, [{ ...draft, progress_note: 'data:image/png;base64,aaaa' }]);
assert.equal(photo.ok, false);

const store = emptyConstructiongraphStore();
store.diary = signed.diary;
const route = applyConstructionAction(store, { action: 'merge', store: { diary: [{ ...store.diary[0], progress_note: 'Nope' }] } }, 'site_manager');
assert.equal(route.ok, false);
const removed = applyConstructionAction(store, { action: 'delete_row', collection: 'diary', id: 'd1' }, 'site_manager');
assert.equal(removed.ok, false);
const office = applyConstructionAction(store, {
  action: 'merge',
  store: { diary: [withDiaryAddendum(store.diary[0]!, { at: '2026-10-15T19:00:00+02:00', by: 'Office', text: 'Late note' })] },
}, 'office');
assert.equal(office.ok, false);

const meta = writeConstructiongraphToMetadata({}, { ...emptyConstructiongraphStore(), diary: signed.diary });
const staffEdit = applyStaffConstructionAction({
  meta,
  action: 'merge',
  actorId: 'user_1',
  actorName: 'Ada Site',
  moduleRole: 'site_manager',
  patch: { diary: [{ ...signed.diary[0]!, progress_note: 'Nope' }] },
});
assert.equal('error' in staffEdit, true);
const staffAdd = applyStaffConstructionAction({
  meta,
  action: 'merge',
  actorId: 'user_1',
  actorName: 'Ada Site',
  moduleRole: 'site_manager',
  patch: {
    diary: [withDiaryAddendum(signed.diary[0]!, {
      at: '2026-10-15T18:00:00+02:00',
      by: 'Spoofed',
      text: 'Rain after sign-off',
    })],
  },
});
assert.equal('error' in staffAdd, false);
if ('error' in staffAdd) throw new Error('staff add');
assert.equal(staffAdd.value.store.diary[0]?.progress_note, 'Poured');
assert.equal(staffAdd.value.store.diary[0]?.addenda?.[0]?.by, 'Ada Site');
assert.equal(staffAdd.value.store.diary[0]?.addenda?.[0]?.text, 'Rain after sign-off');
const roundTrip = readConstructiongraphFromMetadata(staffAdd.metadata);
assert.equal(roundTrip.diary[0]?.addenda?.[0]?.text, 'Rain after sign-off');
assert.equal(roundTrip.diary[0]?.progress_note, 'Poured');

console.log('brief113-diary.test.ts ok');
