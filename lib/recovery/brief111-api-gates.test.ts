/**
 * Run: npx --yes tsx lib/recovery/brief111-api-gates.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicApiPath } from '@/lib/auth/public-paths';
import { isMigrationPending } from './recovergraph-db';
import { validateRecoverOp } from './validate';

const route = readFileSync(resolve('app/api/recovery/recovergraph/route.ts'), 'utf8');
const gate = route.indexOf('requireCompanyPermission');
const load = route.indexOf('loadRecoverDesk');
const apply = route.indexOf('applyRecoverOp');
assert.ok(gate >= 0 && load > gate && apply > gate);
const getFn = route.slice(route.indexOf('export async function GET'));
const postFn = getFn.slice(getFn.indexOf('export async function POST'));
assert.ok(getFn.indexOf('companyRecovergraphEnabled') < getFn.indexOf('loadRecoverDesk'));
assert.ok(postFn.indexOf('companyRecovergraphEnabled') < postFn.indexOf('loadRecoverDesk'));
assert.match(route, /canRecoveryTrust\(gate\.role, 'view'\)/);
assert.match(route, /canRecoveryTrust\(gate\.role, 'write'\)/);
assert.ok(postFn.indexOf('canWriteTrust') < postFn.indexOf('validateRecoverOp'));
const db = readFileSync(resolve('lib/recovery/recovergraph-db.ts'), 'utf8');
assert.match(db, /rpc\('recover_desk_commit'/);
assert.match(db, /isModuleEnabled/);
assert.match(db, /'init_workspace'/);
assert.match(db, /'upsert_staff'/);
assert.match(db, /'deactivate_staff'/);
assert.doesNotMatch(db, /from\('recover_audit_log'\)/);
assert.doesNotMatch(db, /isMigrationPending\(row\.error\)\) return false/);
assert.match(db, /if \(isMigrationPending\(row\.error\)\) throw new MigrationPendingError\(\)/);
assert.match(route, /Cache-Control': 'private, no-store'/);
assert.doesNotMatch(route, /body\.companyId/);
assert.doesNotMatch(route, /searchParams/);
assert.doesNotMatch(route, /\.delete\(\)[\s\S]{0,80}\.insert\(/);
assert.equal(isPublicApiPath('/api/recovery/recovergraph'), false);

const allow = readFileSync(resolve('scripts/route-auth-allowlist.json'), 'utf8');
assert.doesNotMatch(allow, /\/api\/recovery/);

const blocked = validateRecoverOp(
  { op: 'update_workspace', display_name: 'Desk', trust_mode: 'direct' },
  { canWriteTrust: false }
);
assert.equal(blocked.ok, true);
if (blocked.ok && blocked.value.op === 'update_workspace') {
  assert.equal(blocked.value.display_name, 'Desk');
  assert.equal('trust_mode' in blocked.value, false);
}
const allowed = validateRecoverOp(
  { op: 'update_workspace', trust_mode: 'direct' },
  { canWriteTrust: true }
);
assert.equal(allowed.ok, true);
if (allowed.ok && allowed.value.op === 'update_workspace') {
  assert.equal(allowed.value.trust_mode, 'direct');
}

assert.equal(
  isMigrationPending({ code: '42501', message: 'permission denied for table profiles' }),
  false
);
assert.equal(
  isMigrationPending({ code: '42703', message: 'column metadata does not exist' }),
  false
);
assert.equal(
  isMigrationPending({
    code: '42P01',
    message: 'relation "public.recover_workspaces" does not exist',
  }),
  true
);
assert.equal(
  isMigrationPending({
    code: 'PGRST202',
    message: 'Could not find the function public.recover_desk_commit in the schema cache',
  }),
  true
);

console.log('brief111-api-gates.test.ts ok');
