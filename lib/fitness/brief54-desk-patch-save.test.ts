/**
 * Brief 54 — desk CRUD saves should patch only the touched fitgraph keys.
 * Run: npx --yes tsx lib/fitness/brief54-desk-patch-save.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const routeTs = fs.readFileSync(
  path.join(root, 'app/api/fitness/fitgraph/route.ts'),
  'utf8'
);

assert.match(routeTs, /export function deskUpsertPatchKeys\(entity: Entity\)/);
assert.match(
  routeTs,
  /case 'membership_plans':\s*return \['membership_plans', 'class_types'\];/s
);
assert.match(
  routeTs,
  /case 'subscriptions':\s*return \['subscriptions', 'clients'\];/s
);
assert.match(
  routeTs,
  /case 'sessions':\s*return \['sessions', 'bookings'\];/s
);
assert.match(
  routeTs,
  /case 'bookings':\s*return \['bookings', 'pt_packs'\];/s
);
console.log('✓ upsert patch-key map keeps desk saves keyed');

assert.match(routeTs, /export function deskDeletePatchKeys\(entity: Entity\)/);
assert.match(
  routeTs,
  /case 'sessions':\s*return \['sessions', 'bookings', 'removed_ids'\];/s
);
assert.match(
  routeTs,
  /case 'programmes':\s*return \['programmes', 'sessions', 'programme_enrollments'\];/s
);
assert.match(
  routeTs,
  /case 'leaderboard_activities':\s*return \['leaderboard_activities', 'leaderboard_assignments'\];/s
);
console.log('✓ delete patch-key map keeps dependent desk arrays keyed');

assert.match(
  routeTs,
  /const patchKeys = deskDeletePatchKeys\(entity\);\s*if \(patchKeys\) \{\s*await saveDeskPatch\(companyId, meta, store, patchKeys\);\s*\} else \{\s*await saveStore\(companyId, meta, store\);\s*\}/s
);
assert.match(
  routeTs,
  /const patchKeys = deskUpsertPatchKeys\(entity\);\s*if \(patchKeys\) \{\s*await saveDeskPatch\(companyId, meta, store, patchKeys\);\s*\} else \{\s*await saveStore\(companyId, meta, store\);\s*\}/s
);
console.log('✓ generic desk CRUD path now uses saveDeskPatch before saveStore fallback');

assert.match(
  routeTs,
  /if \(action === 'save_calendar_sessions'\)[\s\S]*await savePatch\(companyId, meta, \{ sessions: store\.sessions, bookings: store\.bookings \}\);/s
);
assert.match(
  routeTs,
  /if \(action === 'schedule_class'\)[\s\S]*await savePatch\(companyId, meta, \{ sessions: store\.sessions, bookings: store\.bookings \}\);/s
);
assert.match(
  routeTs,
  /if \(action === 'mark_attendance_bulk'\)[\s\S]*await savePatch\(companyId, meta, \{ bookings: store\.bookings \}\);/s
);
console.log('✓ calendar savePatch paths remain in place');
