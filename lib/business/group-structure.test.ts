/**
 * Run: npx --yes tsx lib/business/group-structure.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildGroupStructureTrees,
  childRoleLabel,
} from './group-structure';

assert.equal(
  childRoleLabel(
    { role_label: 'Holding company', link_type: 'holding' },
    'Subsidiary',
    'Holding company'
  ),
  'Subsidiary'
);
assert.equal(
  childRoleLabel(
    { role_label: 'OpCo', link_type: 'holding' },
    'Subsidiary',
    'Holding company'
  ),
  'OpCo'
);
assert.equal(
  childRoleLabel({ role_label: null, link_type: 'holding' }, 'Subsidiary', 'Holding company'),
  'Subsidiary'
);

const trees = buildGroupStructureTrees(5748, 'Big Five Group', [
  {
    parent_id: 5748,
    parent_name: 'Big Five Group',
    child_id: 102,
    child_name: 'Big Five Foods',
    link_type: 'holding',
    ownership_pct: 100,
    role_label: 'Holding company',
    status: 'active',
    link_id: 8,
  },
]);

assert.equal(trees.length, 1);
assert.equal(trees[0].root.id, 5748);
assert.equal(trees[0].root.subtitle, null);
assert.equal(trees[0].root.children.length, 1);
assert.equal(trees[0].root.children[0].id, 102);
assert.equal(trees[0].root.children[0].name, 'Big Five Foods');
assert.equal(trees[0].root.children[0].subtitle, null);
assert.equal(trees[0].root.children[0].role_label, null);
assert.equal(trees[0].root.children[0].ownership_pct, 100);

const fromFoods = buildGroupStructureTrees(102, 'Big Five Foods', [
  {
    parent_id: 5748,
    parent_name: 'Big Five Group',
    child_id: 102,
    child_name: 'Big Five Foods',
    link_type: 'holding',
    ownership_pct: 100,
    role_label: 'Holding company',
    status: 'active',
    link_id: 8,
  },
]);
assert.equal(fromFoods[0].root.id, 5748);
assert.equal(fromFoods[0].root.children[0].id, 102);
assert.equal(fromFoods[0].root.children[0].isSelf, true);
assert.equal(fromFoods[0].root.children[0].subtitle, null);

console.log('group-structure.test.ts ok');
