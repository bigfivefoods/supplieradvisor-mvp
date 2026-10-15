/**
 * FleetAdvisor® reminder planner and email copy.
 * Run: npx --yes tsx lib/fleet/brief115-reminders.test.ts
 */
import assert from 'node:assert/strict';
import { logKey, planReminders, visibleReminderLog } from './reminders';
import { reminderMessage } from './reminders-email';
import type { FleetCompliance, FleetReminder, FleetVehicle } from './types';

const banned = /\b(legal|compliant|certified)\b/i;

function rule(patch: Partial<FleetReminder> = {}): FleetReminder {
  return {
    id: 'rule',
    company_id: 1,
    scope_kind: 'vehicle',
    kind: 'licence_disc',
    thresholds_days: [30, 14, 7, 0],
    channels: ['email'],
    recipient_member_ids: ['member-1'],
    enabled: true,
    archived_at: null,
    updated_at: '2026-06-01T00:00:00.000Z',
    ...patch,
  };
}

function disc(expires: string, patch: Partial<FleetCompliance> = {}): FleetCompliance {
  return {
    id: 'disc',
    company_id: 1,
    subject_kind: 'vehicle',
    subject_id: 'v1',
    kind: 'licence_disc',
    reference: '',
    issued_on: '2026-01-01',
    expires_on: expires,
    detail: {},
    status_note: '',
    archived_at: null,
    updated_at: '2026-06-01T00:00:00.000Z',
    ...patch,
  };
}

const vehicle: FleetVehicle = {
  id: 'v1',
  company_id: 1,
  reg_no: 'SAMPLE 01',
  kind: 'rigid',
  ownership: 'owned',
  make: '',
  model: '',
  year: null,
  vin: '',
  gvm_kg: null,
  tare_kg: null,
  payload_kg: null,
  fuel_type: '',
  tank_litres: null,
  odometer_km: null,
  odometer_at: null,
  status: 'active',
  depot_label: '',
  tracker_fitted: false,
  tracker_provider: '',
  notes: '',
  archived_at: null,
  updated_at: '2026-06-01T00:00:00.000Z',
};

function plan(now: string, items: FleetCompliance[], rules: FleetReminder[], logKeys: string[] = [], members = [{ id: 'member-1' }]) {
  return planReminders({
    items,
    rules,
    vehicles: [vehicle],
    drivers: [],
    members,
    logKeys,
    now,
    workspace: { real_data_enabled: true },
  });
}

const near = plan('2026-06-10T22:30:00.000Z', [disc('2026-06-15')], [rule()]);
assert.equal(near.due.length, 1);
assert.equal(near.due[0].thresholdDays, 7);
assert.ok(near.superseded.some((row) => row.thresholdDays === 14));
assert.ok(near.superseded.some((row) => row.thresholdDays === 30));
assert.equal(near.due.filter((row) => row.itemId === 'disc').length, 1);

const missed = plan('2026-06-20T00:00:00.000Z', [disc('2026-06-15')], [rule()]);
assert.deepEqual(missed.due.map((row) => row.thresholdDays), [0]);
assert.ok(missed.skipped.some((row) => row.code === 'skipped_superseded'));

const once = plan('2026-06-15T22:00:00.000Z', [disc('2026-06-15')], [rule()], [logKey('disc', '2026-06-15', 0, 'email', 'member-1')]);
assert.equal(once.due.length, 0);

const renewed = plan('2026-07-01T00:00:00.000Z', [disc('2027-06-01')], [rule()], [logKey('disc', '2026-06-15', 0, 'email', 'member-1')]);
assert.equal(renewed.due.length, 0);

const archived = plan('2026-06-10T00:00:00.000Z', [disc('2026-06-15', { archived_at: '2026-06-01' })], [rule()]);
assert.equal(archived.due.length, 0);
assert.ok(archived.skipped.some((row) => row.code === 'skipped_subject'));

const sold = plan('2026-06-10T00:00:00.000Z', [disc('2026-06-15')], [rule()]);
const soldVehicle = planReminders({
  items: [disc('2026-06-15')],
  rules: [rule()],
  vehicles: [{ ...vehicle, status: 'sold' }],
  drivers: [],
  members: [{ id: 'member-1' }],
  logKeys: [],
  now: '2026-06-10T00:00:00.000Z',
  workspace: {},
});
assert.equal(soldVehicle.due.length, 0);
assert.ok(sold.due.length === 1);

const specific = plan(
  '2026-06-10T00:00:00.000Z',
  [disc('2026-06-15')],
  [rule({ id: 'all', kind: null, scope_kind: 'all' }), rule({ id: 'kind', thresholds_days: [7, 0] })]
);
assert.equal(specific.due[0].ruleId, 'kind');

const left = plan('2026-06-10T00:00:00.000Z', [disc('2026-06-15')], [rule()], [], []);
assert.equal(left.due.length, 0);
assert.ok(left.skipped.some((row) => row.code === 'recipient_left'));

const message = reminderMessage({
  kindLabel: 'Licence disc',
  subjectLabel: 'SAMPLE 01',
  expiresOn: '2027-03-12',
  daysLeft: 7,
  appOrigin: 'https://example.test',
});
assert.match(message.subject, /FleetAdvisor®/);
assert.match(message.text, /SAMPLE 01/);
assert.equal(message.text.includes('token='), false);
assert.equal(message.html.includes('token='), false);
assert.equal(/\b\d{13}\b/.test(message.text), false);
assert.equal(banned.test(message.subject + message.text + message.html), false);
assert.match(message.text, /\/dashboard\/fleetgraph\/compliance/);
assert.match(message.text, /\/dashboard\/fleetgraph\/settings/);

const duplicateLog = visibleReminderLog([
  { id: 'a', status: 'skipped_superseded', item_id: 'item', expires_on: '2026-07-01', threshold_days: 30, channel: 'email', recipient_key: 'm', at: '1' },
  { id: 'b', status: 'skipped_superseded', item_id: 'item', expires_on: '2026-07-01', threshold_days: 30, channel: 'email', recipient_key: 'm', at: '2' },
  { id: 'c', status: 'sent', item_id: 'item', expires_on: '2026-07-01', threshold_days: 14, channel: 'email', recipient_key: 'm', at: '3' },
]);
assert.equal(duplicateLog.length, 2);
assert.equal(duplicateLog[0].id, 'a');
assert.equal(duplicateLog[1].id, 'c');
const page = duplicateLog.slice(0, 50);
assert.equal(page.length, 2);

console.log('brief115-reminders.test.ts ok');
