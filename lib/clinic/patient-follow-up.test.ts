/**
 * Run: npx --yes tsx lib/clinic/patient-follow-up.test.ts
 */
import assert from 'node:assert/strict';
import {
  dueFollowUps,
  followUpsAsAdvice,
  patientFacingFollowUps,
  upsertPatientFollowUp,
} from './patient-follow-up';

let list = upsertPatientFollowUp([], {
  advice: 'Ice 15 minutes, 3× today',
  remind_on: '2026-08-20',
  title: 'After your filling',
  author_name: 'Dr A',
});
assert.equal(list.length, 1);
assert.equal(list[0].status, 'scheduled');

list = upsertPatientFollowUp(list, {
  id: list[0].id,
  advice: list[0].advice,
  status: 'sent',
  sent_at: '2026-08-20T08:00:00Z',
});
assert.equal(list[0].status, 'sent');

const facing = patientFacingFollowUps([
  ...list,
  {
    id: 'x',
    remind_on: '2026-08-21',
    advice: 'gone',
    status: 'cancelled',
    created_at: '2026-08-01',
  },
]);
assert.equal(facing.length, 1);

const advice = followUpsAsAdvice(list);
assert.ok(advice[0].body.includes('Ice'));

const due = dueFollowUps(
  [
    {
      id: 'p1',
      follow_ups: [
        {
          id: 'a',
          remind_on: '2026-08-18',
          advice: 'Check the site',
          status: 'scheduled',
          created_at: '2026-08-10',
          next_appointment_id: null,
        },
        {
          id: 'b',
          remind_on: '2026-08-30',
          advice: 'Later',
          status: 'scheduled',
          created_at: '2026-08-10',
        },
      ],
    },
  ],
  '2026-08-18'
);
assert.equal(due.length, 1);
assert.equal(due[0].follow_up.id, 'a');

console.log('patient-follow-up ok');
