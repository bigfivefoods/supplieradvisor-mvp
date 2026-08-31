/**
 * Brief 38 — stamp every gym client onto CRM + padded CoA UID.
 * Run: npx --yes tsx lib/fitness/brief38-crm-stamp.test.ts
 *
 * Mock planner only — do not hit live 110.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  memberArAccountCode,
  memberRevAccountCode,
} from '../accounting/party-gl-accounts';
import {
  applyCrmStampOnPerson,
  needsGymCrmStamp,
  planAdvisorCrmLink,
} from '../b2c/member-account-ar';
import { omitClientRosterFields } from './client-roster-fields';

assert.equal(memberArAccountCode(77), '1180-0000077');
assert.equal(memberRevAccountCode(77), '4400-0000077');
assert.equal(memberArAccountCode(1), '1180-0000001');
assert.notEqual(memberArAccountCode(1), '1180.1');
assert.notEqual(memberArAccountCode(1), '1180-000001');
assert.notEqual(memberRevAccountCode(77), '4100-0000077');

const adaEmailCustomers = [
  { id: 77, email: 'ada@test.com', trading_name: 'Ada Lovelace' },
];
const emailPlan = planAdvisorCrmLink({
  name: 'Ada',
  email: 'ada@test.com',
  customers: adaEmailCustomers,
});
assert.equal(emailPlan.action, 'link');
assert.equal(emailPlan.action === 'link' && emailPlan.id, 77);
const ada = {
  name: 'Ada',
  email: 'ada@test.com',
  crm_customer_id: null as number | null,
  ar_account_code: null as string | null,
};
applyCrmStampOnPerson(ada, 77);
assert.equal(ada.crm_customer_id, 77);
assert.equal(ada.ar_account_code, '1180-0000077');
assert.equal(emailPlan.action !== 'insert', true);

const blankAr = { crm_customer_id: null as number | null, ar_account_code: null as string | null };
applyCrmStampOnPerson(blankAr, 77, '');
assert.equal(blankAr.ar_account_code, '1180-0000077');

const twoAda = planAdvisorCrmLink({
  name: 'Ada',
  email: null,
  customers: [
    { id: 1, trading_name: 'Ada' },
    { id: 2, trading_name: 'Ada' },
  ],
});
assert.equal(twoAda.action, 'skip');
assert.notEqual(twoAda.action, 'insert');

const oneAda = planAdvisorCrmLink({
  name: 'Ada',
  email: null,
  customers: [{ id: 88, trading_name: 'Ada', contact_name: 'Ada' }],
});
assert.equal(oneAda.action, 'link');
assert.equal(oneAda.action === 'link' && oneAda.id, 88);
const named = { name: 'Ada', crm_customer_id: null as number | null, ar_account_code: null as string | null };
applyCrmStampOnPerson(named, 88);
assert.equal(named.crm_customer_id, 88);
assert.equal(named.ar_account_code, '1180-0000088');

const contactOnly = planAdvisorCrmLink({
  name: 'Ada',
  email: null,
  customers: [{ id: 91, trading_name: 'Other', contact_name: 'Ada' }],
});
assert.equal(contactOnly.action, 'link');
assert.equal(contactOnly.action === 'link' && contactOnly.id, 91);

const noHits = planAdvisorCrmLink({
  name: 'Ada',
  email: null,
  customers: [{ id: 9, trading_name: 'Ben' }],
});
assert.equal(noHits.action, 'skip');

const emailIsKey = planAdvisorCrmLink({
  name: 'Ada',
  email: 'new@test.com',
  customers: [{ id: 1, trading_name: 'Ada', email: 'other@test.com' }],
});
assert.equal(emailIsKey.action, 'insert');

assert.equal(needsGymCrmStamp({}), true);
assert.equal(needsGymCrmStamp({ crm_customer_id: 77 }), true);
assert.equal(
  needsGymCrmStamp({ crm_customer_id: 77, ar_account_code: '1180-77' }),
  true
);
assert.equal(
  needsGymCrmStamp({
    crm_customer_id: 77,
    ar_account_code: '1180-0000077',
  }),
  false
);

const stripped = omitClientRosterFields({
  id: 'cli_1',
  name: 'Ada',
  email: 'ada@test.com',
  membership_plan_id: 'plan_a',
  private_client: true,
  membership_status: 'active',
  agreed_rate_zar: 800,
  private_rate_zar: 650,
  active: false,
  notes: 'keep',
});
assert.equal(stripped.name, 'Ada');
assert.equal(stripped.notes, 'keep');
assert.equal('membership_plan_id' in stripped, false);
assert.equal('private_client' in stripped, false);
assert.equal('membership_status' in stripped, false);
assert.equal('agreed_rate_zar' in stripped, false);
assert.equal('private_rate_zar' in stripped, false);
assert.equal('active' in stripped, false);

const gymFit = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
assert.doesNotMatch(gymFit, /stamped\s*>=\s*80/);
assert.match(gymFit, /action === 'backfill_client_crm'/);
assert.match(gymFit, /action === 'import_clients'/);
assert.match(gymFit, /linked_existing/);
assert.match(gymFit, /omitClientRosterFields/);
const classBlock = gymFit.split("action === 'set_class_members'")[1] || '';
const beforeClassSave = classBlock.split('saveStore')[0] || '';
assert.match(beforeClassSave, /attachCrmToAdvisorPerson/);
const allocateBlock = gymFit.split("action === 'allocate_member'")[1] || '';
assert.match(allocateBlock, /attachCrmToAdvisorPerson/);
const importBlock = gymFit.split("action === 'import_clients'")[1] || '';
assert.match(importBlock.split("action === 'backfill_client_crm'")[0] || '', /attachCrmToAdvisorPerson/);
assert.doesNotMatch(
  importBlock.split("action === 'backfill_client_crm'")[0] || '',
  /stamped\s*>=\s*80/
);
assert.doesNotMatch(gymFit, /recodeLegacyIntegerPartyLeaves/);
assert.doesNotMatch(gymFit, /recodeMemberRevenueToPadded/);
assert.doesNotMatch(gymFit, /ensure_party:\s*true/);

const clientsPage = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
assert.match(clientsPage, /backfill_client_crm/);
assert.match(clientsPage, /crmBackfillOnce/);
assert.match(clientsPage, /gymCrmBackfillCompanyOnce/);
assert.match(clientsPage, /omitClientRosterFields/);

const ar = readFileSync(resolve('lib/b2c/member-account-ar.ts'), 'utf8');
assert.match(ar, /planAdvisorCrmLink/);
assert.match(ar, /ensureMemberArLeaf/);
assert.match(ar, /ensureMemberRevLeaf/);
assert.match(ar, /isAdvisorFeeKind/);
assert.doesNotMatch(ar, /recodeLegacyIntegerPartyLeaves/);
assert.doesNotMatch(ar, /recodeMemberRevenueToPadded/);
assert.doesNotMatch(ar, /4100-0000001/);

console.log('brief38-crm-stamp.test.ts ok');
