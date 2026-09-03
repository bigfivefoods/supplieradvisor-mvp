/**
 * Clients desk class ticks are the source of truth — unselected classes
 * must not come back from a stale membership_plan_id.
 * Run: npx --yes tsx lib/fitness/gym-class-ticks-stick.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const table = readFileSync(
  resolve('components/fitness/MemberAllocateTable.tsx'),
  'utf8'
);
assert.match(table, /void save\(c, merged\)/);
assert.match(table, /const onClass = planIds.length > 0;/);
assert.doesNotMatch(
  table,
  /planIds.length > 0\s*\n\s*\? planIds\s*\n\s*: c\.membership_plan_id/
);
assert.match(table, /d\.member && !planIds.length && !classSubscribe/);

const alloc = readFileSync(resolve('lib/fitness/class-allocate.ts'), 'utf8');
assert.match(alloc, /explicitPlanIds/);
assert.match(alloc, /if \(!explicitPlanIds\)/);

console.log('gym-class-ticks-stick.test.ts ok');
