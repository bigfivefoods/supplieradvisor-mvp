/**
 * One role matrix for the desk and the staff payload.
 * Run: npx --yes tsx lib/construction/brief113-roles.test.ts
 */
import assert from 'node:assert/strict';
import { sampleConstructionStore } from './sample-book';
import {
  capabilitiesForCompanyRole,
  guardRoleMerge,
  resolveConstructionRole,
  storeForRole,
} from './roles';

assert.equal(resolveConstructionRole('owner'), 'owner');
assert.equal(resolveConstructionRole('admin'), 'owner');
assert.equal(resolveConstructionRole('member'), 'site_manager');
assert.equal(resolveConstructionRole('operations'), 'site_manager');
assert.equal(resolveConstructionRole('finance'), 'office');
assert.equal(resolveConstructionRole('viewer'), 'viewer');
assert.equal(resolveConstructionRole('sales'), 'viewer');
assert.equal(resolveConstructionRole('sales_contractor'), 'none');

const owner = capabilitiesForCompanyRole('owner');
assert.equal(owner.canSeeMoney, true);
assert.equal(owner.canManagePortals, true);
const site = capabilitiesForCompanyRole('member');
assert.equal(site.canSeeMoney, false);
assert.equal(site.canEditProgramme, true);
assert.equal(site.canApproveVariations, false);
assert.equal(site.canManagePortals, false);
const office = capabilitiesForCompanyRole('finance');
assert.equal(office.canCertify, true);
assert.equal(office.canEditProjects, false);
assert.equal(office.canManagePortals, false);
const viewer = capabilitiesForCompanyRole('viewer');
assert.equal(viewer.canSeeMoney, true);
assert.equal(viewer.canSeeCostsAndBoq, false);
assert.equal(viewer.canEditProgramme, false);
assert.equal(capabilitiesForCompanyRole('sales_contractor').canSeeAllProjects, false);

const book = sampleConstructionStore('2026-10-15');
assert.equal(storeForRole(book, 'owner'), book);
assert.equal(storeForRole(book, 'office'), book);
const hidden = storeForRole(book, 'site_manager');
const viewerStore = storeForRole(book, 'viewer');
function keySet(payload: unknown) {
  const keys = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        keys.add(key);
        walk(child);
      }
    }
  };
  walk(JSON.parse(JSON.stringify(payload)));
  return keys;
}
for (const payload of [hidden, viewerStore]) {
  const keys = keySet(payload);
  for (const banned of ['costs', 'payments', 'certificates', 'actual_amount', 'contract_value', 'total']) {
    assert.equal(keys.has(banned), false, banned);
  }
}
const siteKeys = keySet(hidden);
assert.equal(siteKeys.has('rate'), false);
assert.equal(siteKeys.has('amount'), false);
assert.equal('payments' in hidden, false);
assert.ok(hidden.variations.every((row) => row.amount == null));
assert.equal(guardRoleMerge('site_manager', { payments: [{ id: 'x' }] }).ok, false);
assert.equal(guardRoleMerge('site_manager', { subcontractors: [{ id: 'x', contract_value: 1 }] }).ok, false);
assert.equal(guardRoleMerge('office', { programme: [{ id: 'x', activity: 'A' }] }).ok, false);
assert.equal(guardRoleMerge('viewer', { diary: [] }).ok, false);
assert.equal(guardRoleMerge('site_manager', { diary: [{ id: 'd', site_id: 's', date: '2026-10-15' }] }).ok, true);

console.log('brief113-roles.test.ts ok');
