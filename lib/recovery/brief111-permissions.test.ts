/**
 * Run: npx --yes tsx lib/recovery/brief111-permissions.test.ts
 */
import assert from 'node:assert/strict';
import {
  ROLE_PERMISSIONS,
  SIDEBAR_MODULE_RESOURCE,
  resourceForPath,
} from '@/lib/business/permissions';

const matrix: Record<string, { recovery: string; recovery_trust: string }> = {
  owner: { recovery: 'admin', recovery_trust: 'admin' },
  admin: { recovery: 'write', recovery_trust: 'view' },
  finance: { recovery: 'view', recovery_trust: 'write' },
  operations: { recovery: 'write', recovery_trust: 'none' },
  member: { recovery: 'view', recovery_trust: 'none' },
  viewer: { recovery: 'view', recovery_trust: 'none' },
  sales: { recovery: 'none', recovery_trust: 'none' },
  sales_contractor: { recovery: 'none', recovery_trust: 'none' },
};

for (const [role, expect] of Object.entries(matrix)) {
  const row = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  assert.equal(row.recovery, expect.recovery, `${role} recovery`);
  assert.equal(row.recovery_trust, expect.recovery_trust, `${role} recovery_trust`);
}

assert.equal(SIDEBAR_MODULE_RESOURCE.recovergraph, 'recovery');
assert.equal(resourceForPath('/dashboard/recovergraph'), 'recovery');
assert.equal(resourceForPath('/dashboard/recovergraph/queue'), 'recovery');
assert.equal(resourceForPath('/dashboard/recovergraph/settings/team'), 'recovery');
assert.equal(resourceForPath('/dashboard/recovergraph/trust'), 'recovery_trust');
assert.equal(resourceForPath('/dashboard/recovergraph/trust/ledger'), 'recovery_trust');

console.log('brief111-permissions.test.ts ok');
