/**
 * Diary lock, banned fields, and the SAST date line.
 * Run: npx --yes tsx lib/construction/brief113-diary.test.ts
 */
import assert from 'node:assert/strict';
import { reduceDiary } from './diary-model';
import { sastToday } from './format';
import { applyConstructionAction } from './actions';
import { emptyConstructiongraphStore } from './constructiongraph';

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
const photo = reduceDiary(started.diary, [{ ...draft, progress_note: 'data:image/png;base64,aaaa' }]);
assert.equal(photo.ok, false);

const store = emptyConstructiongraphStore();
store.diary = signed.ok ? signed.diary : [];
const route = applyConstructionAction(store, { action: 'merge', store: { diary: [{ ...store.diary[0], progress_note: 'Nope' }] } }, 'site_manager');
assert.equal(route.ok, false);

console.log('brief113-diary.test.ts ok');
