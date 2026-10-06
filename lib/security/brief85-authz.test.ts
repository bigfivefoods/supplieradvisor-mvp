/**
 * Brief 85 — authz regression scan for client identity trust and paid verify routes.
 * Run: npx --yes tsx lib/security/brief85-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(path: string): string {
  return readFileSync(resolve(path), 'utf8');
}

const gateChecks = [
  'app/api/verify-now/route.ts',
  'app/api/containers/contractors/verify/route.ts',
  'app/api/containers/contractor-invite/accept/route.ts',
  'app/api/projects/route.ts',
  'app/api/sustainability/targets/route.ts',
  'app/api/business/settings/route.ts',
  'app/api/sales/agreement/route.ts',
  'app/api/sales/subscription/route.ts',
];

for (const path of gateChecks) {
  const text = src(path);
  const gateIdx = Math.min(
    ...['requireCompanyAccess', 'requireCompanyPermission', 'requireCompanyRoles', 'requireVerifiedUser']
      .map((token) => text.indexOf(token))
      .filter((idx) => idx >= 0)
  );
  const supabaseIdx = text.indexOf('const supabase = getSupabaseServer');
  assert.ok(gateIdx >= 0, `${path} must include an auth gate`);
  assert.ok(supabaseIdx === -1 || gateIdx < supabaseIdx, `${path} must gate before getSupabaseServer`);
}

const verifyNow = src('app/api/verify-now/route.ts');
const verifyNowSaCall = verifyNow.indexOf('const vn = await callVerifyNowSaid');
const verifyNowCipcCall = verifyNow.indexOf('const vn = await callVerifyNowCipcCompany');
const verifyNowGateIndex = verifyNow.indexOf('requireVerifiedUser');
assert.ok(verifyNowGateIndex >= 0, 'verify-now must include requireVerifiedUser');
if (verifyNowSaCall >= 0) {
  assert.ok(verifyNowGateIndex < verifyNowSaCall, 'verify-now must gate before VerifyNow SA check');
}
if (verifyNowCipcCall >= 0) {
  assert.ok(verifyNowGateIndex < verifyNowCipcCall, 'verify-now must gate before VerifyNow CIPC check');
}
for (const banned of ['assertCompanyMember(body.privyUserId', 'assertCompanyPermission(body.privyUserId']) {
  assert.ok(!verifyNow.includes(banned), 'verify-now must not trust client privyUserId');
}

const contractorVerify = src('app/api/containers/contractors/verify/route.ts');
const contractorVerifyCall = contractorVerify.indexOf('const vn = await callVerifyNowSaid');
const contractorVerifyGateIndex = contractorVerify.indexOf('requireVerifiedUser');
assert.ok(contractorVerifyGateIndex >= 0, 'contractor verify must include requireVerifiedUser');
if (contractorVerifyCall >= 0) {
  assert.ok(contractorVerifyGateIndex < contractorVerifyCall, 'contractor verify must gate before VerifyNow call');
}
assert.ok(contractorVerify.includes(".eq('profile_id', companyId)"), 'contractor verify must scope lookup by profile_id');
for (const banned of ['assertCompanyMember(body.privyUserId', 'assertCompanyPermission(body.privyUserId']) {
  assert.ok(!contractorVerify.includes(banned), 'contractor verify must not trust client identity');
}

const contractorInvite = src('app/api/containers/contractor-invite/accept/route.ts');
assert.ok(contractorInvite.includes('const userId = auth.userId;'), 'contractor invite accept must use verified token userId');
assert.ok(!contractorInvite.includes('body.privyUserId'), 'contractor invite accept must not trust client privyUserId');

const businessSettings = src('app/api/business/settings/route.ts');
for (const banned of ['assertCompanyPermission(body.privyUserId', 'getCompanyMembership(body.privyUserId']) {
  assert.ok(!businessSettings.includes(banned), 'business settings must not trust client identity');
}

const agreement = src('app/api/sales/agreement/route.ts');
assert.ok(!agreement.includes('assertSalesPortalAccess(body.privyUserId'), 'sales agreement must not trust client identity');

const subscription = src('app/api/sales/subscription/route.ts');
assert.ok(!subscription.includes('assertSalesPortalAccess(body.privyUserId'), 'sales subscription must not trust client identity');

const driver = src('app/api/inventory/transfers/driver/route.ts');
assert.ok(driver.includes(".eq('public_token', clean)"), 'driver transfer lookup must only accept public_token');
assert.ok(!driver.includes('transfer_number'), 'driver transfer lookup must not fall back to transfer_number');

console.log('✓ Brief 85 authz assertions passed');
