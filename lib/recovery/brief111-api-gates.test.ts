/**
 * Run: npx --yes tsx lib/recovery/brief111-api-gates.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicApiPath } from '@/lib/auth/public-paths';

const route = readFileSync(resolve('app/api/recovery/recovergraph/route.ts'), 'utf8');
const gate = route.indexOf('requireCompanyPermission');
const load = route.indexOf('loadRecoverDesk');
const apply = route.indexOf('applyRecoverOp');
assert.ok(gate >= 0 && load > gate && apply > gate);
assert.match(route, /Cache-Control': 'private, no-store'/);
assert.doesNotMatch(route, /body\.companyId/);
assert.doesNotMatch(route, /searchParams/);
assert.doesNotMatch(route, /\.delete\(\)[\s\S]{0,80}\.insert\(/);
assert.equal(isPublicApiPath('/api/recovery/recovergraph'), false);

const allow = readFileSync(resolve('scripts/route-auth-allowlist.json'), 'utf8');
assert.doesNotMatch(allow, /\/api\/recovery/);

console.log('brief111-api-gates.test.ts ok');
