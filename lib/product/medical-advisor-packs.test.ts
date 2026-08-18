/**
 * Run: npx --yes tsx lib/product/medical-advisor-packs.test.ts
 */
import assert from 'node:assert/strict';
import {
  appModulesUnlockedByPack,
  enabledModulesMapFromPacks,
  getIndustryPack,
} from './architecture';
import { getIndustry } from './business-catalogue';

const medicalPack = getIndustryPack('medical_practice');
assert.ok(medicalPack, 'medical_practice pack must exist');
assert.ok(appModulesUnlockedByPack(medicalPack).includes('medicalgraph'));

const psychPack = getIndustryPack('psychiatry');
assert.ok(psychPack, 'psychiatry pack must exist');
assert.ok(appModulesUnlockedByPack(psychPack).includes('psychiatrygraph'));

const allModuleIds = [
  'home',
  'my-business',
  'guide',
  'people',
  'customers',
  'accounting',
  'suppliers',
  'operations',
  'inventory',
  'quality',
  'medicalgraph',
  'psychiatrygraph',
  'dentalgraph',
  'physiograph',
];
const medicalMap = enabledModulesMapFromPacks(
  ['medical_practice'],
  [],
  allModuleIds
);
assert.equal(medicalMap.medicalgraph, true);
assert.equal(medicalMap.people, true);
assert.equal(medicalMap.customers, true);
assert.equal(medicalMap.accounting, true);
assert.equal(medicalMap.dentalgraph, false);
assert.equal(medicalMap.psychiatrygraph, false);

const aliasMap = enabledModulesMapFromPacks(['medical'], [], allModuleIds);
assert.equal(aliasMap.medicalgraph, true);

const psychMap = enabledModulesMapFromPacks(['psychiatry'], [], allModuleIds);
assert.equal(psychMap.psychiatrygraph, true);
assert.equal(psychMap.medicalgraph, false);

const medicalIndustry = getIndustry('medical_private');
assert.ok(medicalIndustry);
assert.deepEqual(medicalIndustry.packIds, ['medical_practice']);

const psychIndustry = getIndustry('psychiatry_private');
assert.ok(psychIndustry);
assert.deepEqual(psychIndustry.packIds, ['psychiatry']);

console.log('medical-advisor-packs.test.ts ok');
