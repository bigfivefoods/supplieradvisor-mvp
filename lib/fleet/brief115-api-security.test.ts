/**
 * FleetAdvisor® compliance route guards and per-feature readiness.
 * Run: npx --yes tsx lib/fleet/brief115-api-security.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { featureState } from './fleetgraph-db';

const files = [
  'app/api/fleet/fleetgraph/route.ts',
  'app/api/fleet/fleetgraph/compliance/export/route.ts',
  'app/api/fleet/fleetgraph/cron/reminders/route.ts',
];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  assert.equal(src.includes('body.company_id'), false, file);
  assert.equal(src.includes('payload.company_id'), false, file);
  assert.equal(src.includes('.delete('), false, file);
  assert.equal(/stack|insert into|select \*/i.test(src), false, file);
  if (file.endsWith('cron/reminders/route.ts')) assert.match(src, /Cache-Control': 'no-store'/);
  else assert.match(src, /private, no-store/);
}

const staff = readFileSync('app/api/fleet/fleetgraph/route.ts', 'utf8');
assert.ok(staff.indexOf('requireCompanyPermission') < staff.indexOf('loadFleetBook'));
assert.ok(staff.includes('1_048_576'));
const exportRoute = readFileSync('app/api/fleet/fleetgraph/compliance/export/route.ts', 'utf8');
assert.ok(exportRoute.indexOf('requireCompanyPermission') < exportRoute.indexOf('loadFleetBook'));
assert.match(exportRoute, /text\/csv/);
assert.match(exportRoute, /attachment/);

assert.equal(existsSync('app/api/public/fleetgraph'), false);

const codes = [
  { code: 'PGRST205', message: 'schema cache' },
  { code: 'PGRST202', message: 'could not find the function public.fg_commit_b' },
  { code: '42P01', message: 'relation "public.fg_reminders" does not exist' },
  { code: '42883', message: 'function public.fg_claim_reminder(bigint) does not exist' },
];
for (const error of codes) {
  let thrown = false;
  let state: { ready: boolean; reason?: string } = { ready: true };
  try {
    state = featureState(error);
  } catch {
    thrown = true;
  }
  assert.equal(thrown, false, error.code);
  assert.deepEqual(state, { ready: false, reason: 'migration_pending' });
}

const db = readFileSync('lib/fleet/fleetgraph-db.ts', 'utf8');
assert.ok(db.indexOf("'fg_workspaces'") < db.indexOf('loadBriefB'));
assert.equal(db.includes('if (reminders.error) return { ready: false'), false);
assert.match(db, /fg_commit_b/);
assert.match(db, /fg_import_commit/);
assert.match(db, /readiness: extra.readiness/);

console.log('brief115-api-security.test.ts ok');
