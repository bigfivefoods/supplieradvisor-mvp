/**
 * Run: npx --yes tsx lib/fitness/session-kind.test.ts
 */
import assert from 'node:assert/strict';
import {
  applySessionKindRules,
  createSessionsFromTemplate,
  emptyFitgraphStore,
  ensureSystemClassTypes,
  sessionKindOf,
} from './fitgraph';

const store = emptyFitgraphStore();
ensureSystemClassTypes(store);
const coachId = 'coh_1';
store.coaches.push({
  id: coachId,
  code: 'C1',
  name: 'Ada',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
});

const personal = createSessionsFromTemplate(store, {
  class_type_id: '',
  session_kind: 'coach_personal',
  coach_id: coachId,
  date: '2026-08-17',
  start_time: '07:00',
  end_time: '08:15',
  notes: 'Own lifting',
  public: true,
});
assert.equal(personal.length, 1);
assert.equal(personal[0].session_kind, 'coach_personal');
assert.equal(personal[0].public, false);
assert.equal(personal[0].capacity, 0);
assert.equal(personal[0].start_time, '07:00');
assert.equal(personal[0].end_time, '08:15');
assert.equal(personal[0].duration_min, 75);
assert.equal(sessionKindOf(store, personal[0]), 'coach_personal');

const pt = createSessionsFromTemplate(store, {
  class_type_id: '',
  session_kind: 'private_pt',
  coach_id: coachId,
  date: '2026-08-17',
  start_time: '09:00',
  end_time: '10:00',
  public: true,
});
assert.equal(pt[0].session_kind, 'private_pt');
assert.equal(pt[0].public, false);
assert.equal(pt[0].capacity, 1);
assert.equal(applySessionKindRules('class', { public: true, capacity: 18 }).public, true);

console.log('session-kind create ok');
