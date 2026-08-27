/**
 * Run: npx --yes tsx lib/business/member-modules.test.ts
 */
import assert from 'node:assert/strict';
import {
  effectiveModulesForMember,
  extractAllowedModules,
  hasCustomModuleAccess,
  mergeAllowedModulesIntoPermissions,
  parseMemberPermissions,
} from './member-modules';

const slim = {
  allowed_modules: { customers: true, accounting: true },
};

assert.equal(hasCustomModuleAccess(slim), true);
assert.equal(hasCustomModuleAccess({}), false);
assert.equal(hasCustomModuleAccess([]), false);
assert.equal(hasCustomModuleAccess({ allowed_modules: {} }), true);

const extracted = extractAllowedModules(slim);
assert.ok(extracted);
assert.equal(extracted!.customers, true);
assert.equal(extracted!.accounting, true);
assert.equal(
  extracted!.suppliers,
  undefined,
  'unchecked core hubs must stay off — do not default them on'
);
assert.equal(extracted!.inventory, undefined);
assert.equal(extracted!.people, undefined);

const fromArray = parseMemberPermissions([]);
assert.deepEqual(fromArray, {});

const mergedFromArray = mergeAllowedModulesIntoPermissions([], {
  customers: true,
  suppliers: false,
  accounting: true,
});
assert.deepEqual(mergedFromArray.allowed_modules, {
  customers: true,
  accounting: true,
});

const inherit = mergeAllowedModulesIntoPermissions(slim, null);
assert.equal('allowed_modules' in inherit, false);

const none = mergeAllowedModulesIntoPermissions(slim, {
  customers: false,
  accounting: false,
});
assert.deepEqual(none.allowed_modules, {});
assert.equal(hasCustomModuleAccess(none), true);

const keepsSidebar = mergeAllowedModulesIntoPermissions(
  { sidebar_module_order: ['home', 'customers'], allowed_modules: { network: true } },
  { customers: true }
);
assert.deepEqual(keepsSidebar.sidebar_module_order, ['home', 'customers']);
assert.deepEqual(keepsSidebar.allowed_modules, { customers: true });

const company = {
  home: true,
  'my-business': true,
  guide: true,
  customers: true,
  suppliers: true,
  accounting: true,
  inventory: true,
  people: true,
};

const restricted = effectiveModulesForMember({
  companyEnabled: company,
  permissions: slim,
  role: 'finance',
});
assert.equal(restricted.customers, true);
assert.equal(restricted.accounting, true);
assert.equal(restricted.home, true);
assert.equal(restricted.suppliers, false, 'not on the allow-list');
assert.equal(restricted.inventory, false);
assert.equal(restricted.people, false);

const owner = effectiveModulesForMember({
  companyEnabled: company,
  permissions: slim,
  role: 'owner',
});
assert.equal(owner.suppliers, true, 'owners always inherit company modules');
assert.equal(owner.inventory, true);

const inheritAll = effectiveModulesForMember({
  companyEnabled: company,
  permissions: {},
  role: 'member',
});
assert.equal(inheritAll.suppliers, true);
assert.equal(inheritAll.inventory, true);

console.log('member-modules.test.ts ok');
