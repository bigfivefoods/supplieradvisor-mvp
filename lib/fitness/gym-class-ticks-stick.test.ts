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
assert.match(table, /d\.member && !planIds.length/);
assert.match(table, /if \(!selectedPlanIds\(merged\)\.length\) return;/);
assert.match(table, /status: live\[0\]\?\.status \|\| 'active'/);
assert.match(table, /status: 'active'/);
assert.match(
  table,
  /d\.status === 'cancelled' \|\| d\.status === 'expired'/
);
assert.match(
  table,
  /toast\.error\(classSubscribe \? 'Select a class' : 'Select a plan'\)/
);
assert.match(table, /toggleInactive[\s\S]*void save\(c, merged\)/);

const alloc = readFileSync(resolve('lib/fitness/class-allocate.ts'), 'utf8');
assert.match(alloc, /explicitPlanIds/);
assert.match(alloc, /if \(!explicitPlanIds\)/);

const persist = readFileSync(
  resolve('lib/fitness/vuka-class-catalog.ts'),
  'utf8'
);
assert.match(persist, /applyCatalog !== false/);
const route = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
const getHandler = route.slice(
  route.indexOf('export async function GET'),
  route.indexOf('export async function POST')
);
assert.match(getHandler, /applyCatalog:\s*false/);
const roster = readFileSync(resolve('lib/fitness/vuka-roster.ts'), 'utf8');
assert.match(roster, /if \(clientHasLiveClass\(store, client\.id\)\) continue;/);

console.log('gym-class-ticks-stick.test.ts ok');
