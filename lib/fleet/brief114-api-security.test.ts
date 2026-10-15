/**
 * FleetAdvisor® staff route guards.
 * Run: npx --yes tsx lib/fleet/brief114-api-security.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { isFleetSchemaMissing } from './fleetgraph-db';

const route = readFileSync('app/api/fleet/fleetgraph/route.ts', 'utf8');
assert.ok(route.includes('requireCompanyPermission'));
assert.ok(route.includes("headers.get('x-fleet-company')"));
assert.equal(route.includes('searchParams'), false);
assert.equal(route.includes('body.companyId'), false);
assert.equal(route.includes('body.company_id'), false);
assert.equal(route.includes('payload.company_id'), false);
assert.equal(route.includes('.delete('), false);
assert.match(route, /Cache-Control': 'private, no-store'/);
assert.equal(/select |insert into|pg_|stack/i.test(route), false);
assert.equal(existsSync('app/api/public/fleetgraph'), false);
assert.equal(existsSync('app/api/cron/fleetgraph'), false);
assert.equal(existsSync('app/api/fleet/storage'), false);
assert.equal(existsSync('app/api/fleet/fleetgraph/storage'), false);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

for (const file of [...walk('components/fleet'), ...walk('app/dashboard/fleetgraph'), ...walk('app/preview/fleetgraph')]) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes("'use client'") && !src.includes('"use client"')) continue;
  assert.equal(src.includes('getSupabase'), false, file);
  assert.equal(src.includes('SUPABASE_SERVICE_ROLE_KEY'), false, file);
  assert.equal(src.includes('fleetgraph-db'), false, file);
}

assert.equal(isFleetSchemaMissing({ code: '42P01', message: 'relation does not exist' }), true);
assert.equal(isFleetSchemaMissing({ code: '42P01', message: 'relation "public.fg_vehicles" does not exist' }), true);
assert.equal(isFleetSchemaMissing({ code: '42P01', message: 'relation "public.profiles" does not exist' }), false);
assert.equal(isFleetSchemaMissing({ code: 'PGRST205', message: 'schema cache' }), true);
assert.equal(isFleetSchemaMissing({ code: 'PGRST205', message: "Could not find the table 'public.fg_vehicles' in the schema cache" }), true);
assert.equal(isFleetSchemaMissing({ code: '42883', message: 'undefined function' }), true);
assert.equal(isFleetSchemaMissing({ code: '42883', message: 'function public.fg_commit_diff(bigint, jsonb) does not exist' }), true);
assert.equal(isFleetSchemaMissing({ code: 'PGRST202', message: 'could not find the function' }), true);
assert.equal(
  isFleetSchemaMissing({ code: 'PGRST202', message: 'Could not find the function public.fg_commit_diff(p_company_id, p_diff) in the schema cache' }),
  true
);
assert.ok(route.indexOf('applyFleetOp') < route.indexOf('nextJobNumber'));
assert.equal(route.includes('if (needsNumber || needsCustomer)'), false);
assert.equal(isFleetSchemaMissing({ code: '23505', message: 'duplicate key' }), false);
assert.equal(isFleetSchemaMissing(null), false);

const db = readFileSync('lib/fleet/fleetgraph-db.ts', 'utf8');
assert.equal(db.includes("from('fg_audit_log').delete"), false);
assert.equal(db.includes("from('fg_cost_entries').delete"), false);
assert.equal(db.includes("from('fg_odometer_readings').delete"), false);
assert.equal(db.includes("from('fg_position_events')"), false);
assert.equal(db.includes("from('fg_audit_log')"), false);
assert.match(db, /fg_commit_diff/);
assert.match(db, /ready: false, reason: 'migration_pending'/);
assert.match(db, /ready: false, reason: 'error'/);

console.log('brief114-api-security.test.ts ok');
