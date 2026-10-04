/**
 * Brief 55 — clinic patient AR/desk code stamping.
 * Run: npx --yes tsx lib/clinic/brief55-patient-ar-stamp.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routeFiles = [
  'app/api/clinic/physiograph/route.ts',
  'app/api/clinic/medicalgraph/route.ts',
  'app/api/clinic/psychiatrygraph/route.ts',
  'app/api/clinic/vetgraph/route.ts',
  'app/api/dental/dentalgraph/route.ts',
];

for (const file of routeFiles) {
  const src = readFileSync(resolve(file), 'utf8');
  assert.match(src, /action === 'backfill_patient_crm'/, `${file} backfill action`);
  assert.match(src, /attachCrmToAdvisorPerson\([\s\S]*?applyAdvisorPersonCodeFromAr\(/, `${file} stamps patient code after CRM attach`);
}

const crm = readFileSync(resolve('lib/b2c/member-account-ar.ts'), 'utf8');
assert.match(crm, /companyId !== 102 && isAdvisorFeeKind/, 'profile 102 skips 4400 stamping');

console.log('brief55-patient-ar-stamp.test.ts ok');
