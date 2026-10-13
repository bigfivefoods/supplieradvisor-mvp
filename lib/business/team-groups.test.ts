/**
 * Run: npx --yes tsx lib/business/team-groups.test.ts
 */
import assert from 'node:assert/strict';
import { groupTeamMembersByRole } from './team-groups';

const groups = groupTeamMembersByRole([
  { role: 'sales_contractor', name: 'Pam Oosthuizen' },
  { role: 'member', name: 'Zane' },
  { role: 'owner', name: 'Craig' },
  { role: 'sales', name: 'Bo' },
  { role: 'field sales', name: 'Asha' },
  { role: 'CEO', name: 'Nia' },
  { role: 'member', name: 'Amy' },
]);

assert.deepEqual(
  groups.map((g) => g.role),
  ['owner', 'member', 'sales', 'sales_contractor']
);
assert.deepEqual(
  groups.find((g) => g.role === 'owner')?.members.map((m) => m.name),
  ['Craig', 'Nia']
);
assert.deepEqual(
  groups.find((g) => g.role === 'member')?.members.map((m) => m.name),
  ['Amy', 'Zane']
);
assert.deepEqual(
  groups.find((g) => g.role === 'sales_contractor')?.members.map((m) => m.name),
  ['Asha', 'Pam Oosthuizen']
);
assert.equal(groups.some((g) => g.role === 'admin'), false);
assert.equal(groups.find((g) => g.role === 'sales_contractor')?.label, 'Sales contractor');

console.log('team-groups.test.ts ok');
