/**
 * Run: npx --yes tsx lib/recovery/brief111-roles.test.ts
 */
import assert from 'node:assert/strict';
import { deskResponseBody, projectDesk } from './project';
import {
  capabilitiesFor,
  queueNavLabel,
  recoverSectionVisible,
  resolveRecoverRole,
} from './roles';
import type { RecoverLoad } from './project';

const staff = (role: string, status = 'active') => ({ role, status });

assert.equal(resolveRecoverRole('owner', staff('collector')), 'owner');
assert.equal(resolveRecoverRole('owner', null), 'owner');
assert.equal(resolveRecoverRole('admin', null), 'manager');
assert.equal(resolveRecoverRole('admin', staff('collector')), 'agent');
assert.equal(resolveRecoverRole('finance', null), 'finance');
assert.equal(resolveRecoverRole('finance', staff('compliance')), 'compliance');
assert.equal(resolveRecoverRole('operations', null), 'viewer');
assert.equal(resolveRecoverRole('operations', staff('manager')), 'manager');
assert.equal(resolveRecoverRole('admin', staff('manager')), 'manager');
assert.equal(resolveRecoverRole('member', staff('manager')), 'viewer');
assert.equal(resolveRecoverRole('viewer', staff('manager')), 'viewer');
assert.equal(resolveRecoverRole('finance', staff('manager')), 'finance');
assert.equal(resolveRecoverRole('member', null), 'viewer');
assert.equal(resolveRecoverRole('member', staff('collector')), 'agent');
assert.equal(resolveRecoverRole('member', staff('finance_view')), 'finance');
assert.equal(resolveRecoverRole('viewer', null), 'viewer');
assert.equal(resolveRecoverRole('viewer', staff('collector', 'inactive')), 'viewer');
assert.equal(resolveRecoverRole('sales', staff('collector')), 'none');
assert.equal(resolveRecoverRole('sales_contractor', staff('manager')), 'none');

const owner = capabilitiesFor('owner');
assert.equal(owner.canSetRealData, true);
assert.equal(owner.canSeeTrust, true);
assert.equal(owner.canManageStaff, true);
assert.equal(owner.canSeeAllQueues, true);

const manager = capabilitiesFor('manager');
assert.equal(manager.canSetRealData, false);
assert.equal(manager.canSeeTrust, true);
assert.equal(manager.canManageStaff, true);
assert.equal(manager.canEditSettings, true);

const finance = capabilitiesFor('finance');
assert.equal(finance.canSeeTrust, true);
assert.equal(finance.canManageStaff, false);
assert.equal(finance.canEditSettings, false);
assert.equal(finance.canSetRealData, false);

const agent = capabilitiesFor('agent');
assert.equal(agent.canManageStaff, false);
assert.equal(agent.canSeeTrust, false);
assert.equal(agent.canSeeAllQueues, false);
assert.equal(agent.canEditSettings, false);

assert.equal(queueNavLabel('owner'), 'All queues');
assert.equal(queueNavLabel('manager'), 'All queues');
assert.equal(queueNavLabel('agent'), 'My queue');
assert.equal(queueNavLabel('finance'), 'Queue');

assert.equal(recoverSectionVisible('agent', 'Overview'), true);
assert.equal(recoverSectionVisible('agent', 'Work'), true);
assert.equal(recoverSectionVisible('agent', 'Place'), false);
assert.equal(recoverSectionVisible('agent', 'Setup'), false);
assert.equal(recoverSectionVisible('none', 'Overview'), false);
assert.equal(recoverSectionVisible('manager', 'Setup'), true);

const load: RecoverLoad = {
  ready: true,
  workspace: {
    id: 'ws',
    company_id: 1,
    display_name: 'Desk',
    operator_type: 'agency',
    programme_types: ['recovery'],
    trust_mode: 'direct',
    cfdc_registration_no: 'hidden',
    cfdc_expiry: '2030-01-01',
    vat_registered: true,
    vat_rate_bps: 1500,
    real_data_enabled: false,
    real_data_confirmed_by: 'owner',
    real_data_confirmed_at: '2030-01-01',
  },
  creditors: [
    {
      id: 'c',
      name: 'Book',
      reg_no: '',
      vat_no: '',
      remittance_terms: 'monthly',
      portal_enabled: false,
      status: 'active',
      customer_id: null,
    },
  ],
  mandates: [
    {
      id: 'm',
      creditor_id: 'c',
      creditor_name: 'Book',
      programme_type: 'recovery',
      product_type: 'trade',
      nca_regulated: false,
      processing_role: 'operator',
      status: 'draft',
    },
  ],
  staff: [
    {
      id: 's1',
      email: 'agent@example.com',
      role: 'collector',
      status: 'active',
      team_id: null,
      cfdc_registration_no: '',
      registration_status: '',
      monthly_target_cents: null,
      user_id: null,
    },
    {
      id: 's2',
      email: 'lead@example.com',
      role: 'manager',
      status: 'active',
      team_id: null,
      cfdc_registration_no: '',
      registration_status: '',
      monthly_target_cents: null,
      user_id: null,
    },
  ],
  self: {
    id: 's1',
    email: 'agent@example.com',
    role: 'collector',
    status: 'active',
    team_id: null,
    cfdc_registration_no: '',
    registration_status: '',
    monthly_target_cents: null,
    user_id: null,
  },
};

const projected = projectDesk('agent', load);
assert.equal(projected.counts.creditors, null);
assert.equal(projected.counts.staff, null);
assert.deepEqual(projected.creditors, []);
assert.deepEqual(projected.mandates, []);
assert.deepEqual(projected.staff, []);
assert.equal(projected.workspace?.cfdc_registration_no, '');
assert.equal(projected.workspace?.trust_mode, 'direct');

const managerView = projectDesk('manager', load);
assert.equal(managerView.counts.creditors, 1);
assert.equal(managerView.staff.length, 2);

const hiddenTrust = deskResponseBody(projectDesk('manager', load), false);
assert.equal(hiddenTrust.workspace && 'trust_mode' in hiddenTrust.workspace, false);
const shownTrust = deskResponseBody(projectDesk('finance', load), true);
assert.equal(shownTrust.workspace?.trust_mode, 'direct');
const agentBody = deskResponseBody(projectDesk('agent', load), false);
assert.equal(agentBody.workspace && 'trust_mode' in agentBody.workspace, false);

console.log('brief111-roles.test.ts ok');
