/**
 * Run: npx --yes tsx lib/recovery/brief116-api-security.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFeatureResult } from './recovergraph-db';
import { validateDeskExtra } from './validate';
import { isPublicApiPath } from '@/lib/auth/public-paths';

const routes = [
  'app/api/recovery/recovergraph/accounts/route.ts',
  'app/api/recovery/recovergraph/creditors/route.ts',
  'app/api/recovery/recovergraph/import/route.ts',
];
for (const file of routes) {
  const text = readFileSync(resolve(file), 'utf8');
  const gate = text.indexOf('requireCompanyPermission');
  const db = Math.min(
    ...['loadRecoverDesk', 'loadAccountsForAgent', 'listBookAccounts', 'supabase.rpc', 'getSupabaseServer']
      .map((token) => {
        const at = text.indexOf(token);
        return at === -1 ? Number.MAX_SAFE_INTEGER : at;
      })
  );
  assert.ok(gate >= 0 && gate < db, file);
  assert.match(text, /Cache-Control': 'private, no-store'/);
  assert.doesNotMatch(text, /body\.companyId|searchParams\.get\('companyId'\)/);
  assert.doesNotMatch(text, /\.delete\(\)[\s\S]{0,80}\.insert\(/);
  assert.doesNotMatch(text, /console\./);
  assert.doesNotMatch(text, /from 'resend'|from 'twilio'|paystack|verifynow/i);
  assert.doesNotMatch(text, /fetch\(/);
}

const reveal = readFileSync(resolve('lib/recovery/book-db.ts'), 'utf8');
const revealAt = reveal.indexOf('export async function revealAccountId');
const slice = reveal.slice(revealAt, revealAt + 1800);
assert.ok(slice.indexOf("p_action: 'account.reveal_id'") < slice.indexOf('decryptId'));

const personal = readFileSync(resolve('app/api/recovery/recovergraph/import/route.ts'), 'utf8');
assert.ok(personal.indexOf('assertRealDataAllowed') < personal.indexOf("rpc('recover_import_commit'"));
assert.ok(personal.indexOf('assertDemoBookAllowed') < personal.indexOf("rpc('recover_load_demo_book'"));
assert.match(personal, /2_500_000/);
assert.equal(existsSync(resolve('app/api/public/recovergraph')), false);
assert.equal(isPublicApiPath('/api/recovery/recovergraph/accounts'), false);
assert.equal(isPublicApiPath('/api/recovery/recovergraph/import'), false);
assert.equal(isPublicApiPath('/api/recovery/recovergraph/creditors'), false);

for (const code of ['PGRST205', 'PGRST202', '42P01', '42883']) {
  const result = readFeatureResult({ code, message: 'relation public.recover_accounts does not exist' }, 'accounts');
  assert.deepEqual(result, { ready: false, reason: 'migration_pending', feature: 'accounts' });
}
const desk = readFileSync(resolve('lib/recovery/recovergraph-db.ts'), 'utf8');
const load = desk.slice(desk.indexOf('export async function loadRecoverDesk'), desk.indexOf('export async function companyRecovergraphEnabled'));
assert.equal(load.includes('recover_accounts'), false);

const deskRoute = readFileSync(resolve('app/api/recovery/recovergraph/route.ts'), 'utf8');
const post = deskRoute.slice(deskRoute.indexOf('export async function POST'));
assert.ok(post.indexOf('validateRecoverOp') < post.indexOf('validateDeskExtra'));
assert.ok(post.indexOf('allowedBookOps') < post.indexOf('commitBook'));
assert.ok(post.indexOf('canManageStaff') < post.indexOf('setStaffExpiry'));
assert.ok(post.indexOf("role !== 'owner'") < post.indexOf('bulkAssignAccounts'));
assert.match(post, /creditor\.upsert/);
assert.match(post, /mandate\.upsert/);
assert.match(readFileSync(resolve('app/api/recovery/recovergraph/import/route.ts'), 'utf8'), /export async function GET/);
const badCreditor = validateDeskExtra({ op: 'creditor.upsert', name: '' });
assert.equal(badCreditor.ok, false);
const badAssign = validateDeskExtra({ op: 'account.bulk_assign', ids: [], staff_id: '' });
assert.equal(badAssign.ok, false);
const viewerAssign = validateDeskExtra({
  op: 'account.bulk_assign',
  ids: ['11111111-1111-4111-8111-111111111111'],
  staff_id: '22222222-2222-4222-8222-222222222222',
});
assert.equal(viewerAssign.ok, true);

console.log('brief116-api-security.test.ts ok');
