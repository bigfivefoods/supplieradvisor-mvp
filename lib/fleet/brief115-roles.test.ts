/**
 * FleetAdvisor® role gates for compliance, reminders and import.
 * Run: npx --yes tsx lib/fleet/brief115-roles.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAM_ROLE_OPTIONS } from '../business/permissions';
import { emptyFleetBook } from './empty-book';
import { applyFleetOp } from './ops';
import { allowedOpsForRole, capabilitiesFor, resolveFleetRole, viewForRole } from './roles';

for (const option of TEAM_ROLE_OPTIONS) {
  const role = resolveFleetRole(option.value);
  const caps = capabilitiesFor(role);
  assert.equal(caps.canManageReminders, role === 'owner' || role === 'manager', option.value);
  assert.equal(caps.canImportShip, role === 'owner', option.value);
  assert.equal(caps.canImportCsv, role === 'owner' || role === 'manager', option.value);
  assert.equal(caps.canExportCompliance, role === 'owner' || role === 'manager' || role === 'office', option.value);
  assert.equal(caps.canManageTrailers, role === 'owner' || role === 'manager' || role === 'dispatcher', option.value);
}

assert.ok(allowedOpsForRole('dispatcher').includes('compliance.bulk_upsert'));
assert.ok(allowedOpsForRole('dispatcher').includes('trailer.link'));
assert.equal(allowedOpsForRole('dispatcher').includes('import.commit'), false);
assert.equal(allowedOpsForRole('dispatcher').includes('reminder.upsert'), false);
assert.equal(allowedOpsForRole('office').length, 0);
assert.equal(allowedOpsForRole('viewer').length, 0);
assert.ok(allowedOpsForRole('manager').includes('import.dry_run'));
assert.equal(allowedOpsForRole('manager').includes('real_data.confirm'), false);

const book = emptyFleetBook(1, '2026-06-01T00:00:00.000Z');
book.reminders = [
  {
    id: 'rule',
    company_id: 1,
    scope_kind: 'all',
    kind: null,
    thresholds_days: [30, 0],
    channels: ['email'],
    recipient_member_ids: ['sentinel-recipient'],
    enabled: false,
    archived_at: null,
    updated_at: '2026-06-01T00:00:00.000Z',
  },
];
book.reminder_log = [
  {
    id: 'log',
    company_id: 1,
    rule_id: 'rule',
    item_id: 'item',
    subject_kind: 'vehicle',
    subject_id: 'v',
    expires_on: '2026-07-01',
    threshold_days: 30,
    channel: 'email',
    recipient_key: 'sentinel-log',
    status: 'sent',
    error_code: null,
    at: '2026-06-01T00:00:00.000Z',
  },
];

for (const role of ['dispatcher', 'office', 'viewer', 'none'] as const) {
  const view = JSON.stringify(viewForRole(book, role));
  assert.equal(view.includes('sentinel-recipient'), false, role);
  assert.equal(view.includes('sentinel-log'), false, role);
  assert.equal(view.includes('reminder_log'), false, role);
}
const ownerView = JSON.stringify(viewForRole(book, 'owner'));
assert.equal(ownerView.includes('sentinel-recipient'), true);
assert.equal(ownerView.includes('sentinel-log'), true);

const ctx = { role: 'dispatcher' as const, actorId: 'd', now: '2026-06-01T00:00:00.000Z', companyId: 1, enforceRealData: true };
for (const op of ['import.dry_run', 'import.commit', 'reminder.upsert'] as const) {
  const outcome = applyFleetOp(book, { op, payload: { kind: 'vehicles_csv' } }, ctx);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.status, 403);
}

const route = readFileSync('app/api/fleet/fleetgraph/route.ts', 'utf8');
assert.ok(route.includes('viewForRole'));
assert.ok(route.includes('allowedOpsForRole'));
const exportRoute = readFileSync('app/api/fleet/fleetgraph/compliance/export/route.ts', 'utf8');
assert.ok(exportRoute.includes('canExportCompliance'));

console.log('brief115-roles.test.ts ok');
