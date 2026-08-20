/**
 * Run: npx --yes tsx lib/fitness/gym-grow-share.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  gymJoinMemberPath,
  gymTrialClassPath,
  isComplimentaryClassInvite,
  listGrowShareClasses,
  stampShareCodesForGrow,
} from './gym-grow-share';

assert.equal(
  gymJoinMemberPath('fg_1_abc', 'group').includes('kind=group'),
  true
);
assert.equal(
  gymJoinMemberPath('fg_1_abc', 'private').includes('kind=private'),
  true
);
assert.equal(gymJoinMemberPath('fg_1_abc', 'both').includes('kind=both'), true);
assert.equal(gymTrialClassPath('tok', 's_hello').includes('trial=1'), true);

assert.equal(
  isComplimentaryClassInvite({ trial: true, share_code: 's_1' }),
  true
);
assert.equal(
  isComplimentaryClassInvite({ complimentary: true, share_code: 's_1' }),
  true
);
assert.equal(isComplimentaryClassInvite({ trial: true }), false);
assert.equal(
  isComplimentaryClassInvite({ trial: '1', share_code: 's_1' }),
  true
);

const store = emptyFitgraphStore();
store.class_types.push({
  id: 'cls_1',
  code: 'BOOT',
  name: 'Bootcamp',
  category: 'HIIT',
  default_duration_min: 45,
  capacity: 20,
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
});
store.sessions.push({
  id: 'ses_1',
  class_type_id: 'cls_1',
  date: '2026-08-25',
  start_time: '17:30',
  duration_min: 45,
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00.000Z',
});
assert.equal(store.sessions[0].share_code, undefined);
assert.equal(stampShareCodesForGrow(store, { from: '2026-08-20', days: 14 }), true);
assert.ok(store.sessions[0].share_code);
const classes = listGrowShareClasses(store, { from: '2026-08-20', days: 14 });
assert.equal(classes.length, 1);
assert.equal(classes[0].class_name, 'Bootcamp');
assert.equal(stampShareCodesForGrow(store, { from: '2026-08-20', days: 14 }), false);

console.log('gym-grow-share.test.ts ok');
