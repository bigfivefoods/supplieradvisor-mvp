/**
 * Run: npx --yes tsx lib/fitness/session-times.test.ts
 */
import assert from 'node:assert/strict';
import {
  durationFromStartEnd,
  endFromStartDuration,
  normalizeSessionKind,
  patchFormForSessionKind,
  resolveSessionTimes,
  sessionKindFromRecord,
} from './session-times';

assert.equal(durationFromStartEnd('06:00', '07:00'), 60);
assert.equal(durationFromStartEnd('06:00', '06:45'), 45);
assert.equal(durationFromStartEnd('22:00', '00:30'), 150);
assert.equal(endFromStartDuration('06:00', 90), '07:30');

const r = resolveSessionTimes({
  start_time: '09:00',
  end_time: '10:30',
});
assert.equal(r.duration_min, 90);
assert.equal(r.end_time, '10:30');

const r2 = resolveSessionTimes({
  start_time: '09:00',
  duration_min: 45,
});
assert.equal(r2.end_time, '09:45');

assert.equal(normalizeSessionKind('pt'), 'private_pt');
assert.equal(normalizeSessionKind('self'), 'coach_personal');
assert.equal(normalizeSessionKind(''), 'class');

assert.equal(sessionKindFromRecord({ class_code: 'SYS_PT' }), 'private_pt');
assert.equal(
  sessionKindFromRecord({ class_code: 'SYS_COACH_TIME' }),
  'coach_personal'
);
assert.equal(
  sessionKindFromRecord({ session_kind: 'class', class_code: 'SYS_PT' }),
  'class'
);

const patched = patchFormForSessionKind(
  {
    session_kind: 'class',
    class_type_id: 'cls_hiit',
    start_time: '09:00',
    end_time: '09:45',
    public: true,
    capacity: '20',
  },
  'coach_personal',
  [
    { id: 'cls_hiit', code: 'HIIT' },
    { id: 'cls_pt', code: 'SYS_PT' },
    { id: 'cls_self', code: 'SYS_COACH_TIME' },
  ]
);
assert.equal(patched.session_kind, 'coach_personal');
assert.equal(patched.class_type_id, 'cls_self');
assert.equal(patched.end_time, '10:00');
assert.equal(patched.public, false);
assert.equal(patched.capacity, '0');

console.log('session-times ok');
