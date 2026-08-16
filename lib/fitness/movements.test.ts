/**
 * Run: npx --yes tsx lib/fitness/movements.test.ts
 */
import assert from 'node:assert/strict';
import {
  hydrateProgramme,
  memberFacingProgramme,
  normalizeProgrammeKind,
  parseProgrammeItems,
  resolveProgrammeForSession,
  upsertMovement,
  upsertProgramme,
  videoEmbedSrc,
} from './movements';

assert.equal(normalizeProgrammeKind('self'), 'personal_pt');
assert.equal(normalizeProgrammeKind('both'), 'both');

const yt = videoEmbedSrc('https://youtu.be/dQw4w9WgXcQ');
assert.equal(yt?.iframe, true);
assert.ok(yt?.src.includes('youtube.com/embed/dQw4w9WgXcQ'));

const items = parseProgrammeItems([
  { movement_id: 'mov_1', sets: 3, reps: '8-10', rest_sec: 60 },
  { movement_id: '', sets: 1 },
]);
assert.equal(items.length, 1);
assert.equal(items[0].sets, 3);

const movements = [
  upsertMovement(
    [],
    { id: 'mov_1', name: 'Goblet squat', image_url: 'https://img/s.jpg' },
    '2026-08-16T00:00:00.000Z',
    () => 'x'
  ),
];
const list: ReturnType<typeof upsertProgramme>[] = [];
const prg = upsertProgramme(
  list,
  {
    id: 'prg_1',
    name: 'Strength A',
    kind: 'class',
    class_type_ids: ['cls_hiit'],
    items: [{ movement_id: 'mov_1', sets: 4, reps: '6' }],
  },
  '2026-08-16T00:00:00.000Z',
  () => 'x'
);
const hydrated = hydrateProgramme(prg, movements);
assert.equal(hydrated.items[0].movement?.name, 'Goblet squat');

const hit = resolveProgrammeForSession(list, {
  id: 'ses_1',
  class_type_id: 'cls_hiit',
  session_kind: 'class',
});
assert.equal(hit?.id, 'prg_1');

const personal = upsertProgramme(
  list,
  {
    id: 'prg_me',
    name: 'Coach lift',
    kind: 'personal_pt',
    coach_id: 'coh_1',
    personal_for_coach: true,
    items: [],
  },
  '2026-08-16T00:00:00.000Z',
  () => 'x'
);
const me = resolveProgrammeForSession(list, {
  id: 'ses_self',
  coach_id: 'coh_1',
  session_kind: 'coach_personal',
});
assert.equal(me?.id, 'prg_me');
assert.equal(memberFacingProgramme(hydrateProgramme(personal, [])), null);

console.log('movements ok');
