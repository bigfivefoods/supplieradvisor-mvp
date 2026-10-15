import type { RecoverCreditor, RecoverDeskPayload, RecoverMandate, RecoverStaff } from './types';

export type SampleAccount = {
  ref: string;
  holder: string;
  creditor: string;
  action: string;
  stage: string;
  amount: string;
  clock: string;
};

export type SampleAttention = {
  title: string;
  detail: string;
  stage: string;
};

export type SamplePromise = {
  when: string;
  who: string;
  amount: string;
  note: string;
};

export type RecoverIllustration = {
  placed: string;
  recovered: string;
  trust: string;
  clocks: string;
  accounts: SampleAccount[];
  attention: SampleAttention[];
  promises: SamplePromise[];
};

const WORKSPACE = {
  id: '11111111-1111-4111-8111-111111111111',
  company_id: 1,
  display_name: 'Illustration company',
  operator_type: 'agency' as const,
  programme_types: ['recovery' as const],
  trust_mode: 'trust' as const,
  cfdc_registration_no: 'NCR-sample 4412',
  cfdc_expiry: '2027-03-31',
  vat_registered: true,
  vat_rate_bps: 1500,
  real_data_enabled: false,
  real_data_confirmed_by: null,
  real_data_confirmed_at: null,
};

const CREDITORS: RecoverCreditor[] = [
  {
    id: '22222222-2222-4222-8222-222222222221',
    name: 'Northline Credit',
    reg_no: 'NCR-sample 4412',
    vat_no: '',
    remittance_terms: 'monthly',
    portal_enabled: false,
    status: 'Sample book',
    customer_id: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Meridian Finance',
    reg_no: 'NCR-sample 2280',
    vat_no: '',
    remittance_terms: 'on_receipt',
    portal_enabled: false,
    status: 'Sample draft',
    customer_id: null,
  },
];

const MANDATES: RecoverMandate[] = [
  {
    id: '33333333-3333-4333-8333-333333333331',
    creditor_id: CREDITORS[0].id,
    creditor_name: 'Northline Credit',
    programme_type: 'recovery',
    product_type: 'trade',
    nca_regulated: false,
    processing_role: 'operator',
    status: 'Current',
  },
  {
    id: '33333333-3333-4333-8333-333333333332',
    creditor_id: CREDITORS[1].id,
    creditor_name: 'Meridian Finance',
    programme_type: 'recovery',
    product_type: 'other',
    nca_regulated: false,
    processing_role: 'operator',
    status: 'Draft',
  },
];

const STAFF: RecoverStaff[] = [
  {
    id: '44444444-4444-4444-8444-444444444441',
    email: 'amahle.nkosi@example.com',
    role: 'collector',
    status: 'active',
    team_id: null,
    cfdc_registration_no: '',
    registration_status: 'Sample',
    monthly_target_cents: 15000000,
    user_id: null,
  },
  {
    id: '44444444-4444-4444-8444-444444444442',
    email: 'johan.pretorius@example.com',
    role: 'compliance',
    status: 'active',
    team_id: null,
    cfdc_registration_no: '',
    registration_status: 'Sample',
    monthly_target_cents: null,
    user_id: null,
  },
];

export const SAMPLE_ACCOUNTS: SampleAccount[] = [
  {
    ref: 'RA-20418',
    holder: 'Cedar Retail',
    creditor: 'Northline Credit',
    action: 'Call the account holder',
    stage: 'Arrangement',
    amount: 'R 18 450.00',
    clock: '2 days',
  },
  {
    ref: 'RA-20441',
    holder: 'Pebble Stores',
    creditor: 'Meridian Finance',
    action: 'Confirm the promise',
    stage: 'Promise',
    amount: 'R 6 280.50',
    clock: '5 days',
  },
  {
    ref: 'RA-19802',
    holder: 'Oak Lane Grocer',
    creditor: 'Northline Credit',
    action: 'Send the statement',
    stage: 'New',
    amount: 'R 42 910.00',
    clock: '12 days',
  },
];

export const SAMPLE_ILLUSTRATION: RecoverIllustration = {
  placed: 'R 1 240 600.00',
  recovered: 'R 186 400.00',
  trust: 'R 94 250.00',
  clocks: '6',
  accounts: SAMPLE_ACCOUNTS,
  attention: [
    { title: 'Cedar Retail', detail: 'Promise due in 2 days · RA-20418', stage: 'Arrangement' },
    { title: 'Pebble Stores', detail: 'Waiting on a confirmation · RA-20441', stage: 'Promise' },
    { title: 'Oak Lane Grocer', detail: 'Statement not sent · RA-19802', stage: 'New' },
  ],
  promises: [
    { when: '2 Apr', who: 'Cedar Retail', amount: 'R 1 500.00', note: 'Arrangement started' },
    { when: '2 May', who: 'Cedar Retail', amount: 'R 1 500.00', note: 'Next illustrated receipt' },
    { when: '9 May', who: 'Pebble Stores', amount: 'R 800.00', note: 'Promise to pay' },
  ],
};

const OWNER_CAPS = {
  canSeeAllQueues: true,
  canEditSettings: true,
  canSeeTrust: true,
  canManageStaff: true,
  canSetRealData: true,
};

const AGENT_CAPS = {
  canSeeAllQueues: false,
  canEditSettings: false,
  canSeeTrust: false,
  canManageStaff: false,
  canSetRealData: false,
};

export function sampleDesk(role: 'owner' | 'agent'): RecoverDeskPayload {
  const agent = role === 'agent';
  return {
    ready: true,
    workspace: WORKSPACE,
    role: agent ? 'agent' : 'owner',
    capabilities: agent ? AGENT_CAPS : OWNER_CAPS,
    counts: {
      creditors: CREDITORS.length,
      mandates: MANDATES.length,
      staff: STAFF.length,
    },
    creditors: agent ? [] : CREDITORS,
    mandates: agent ? [] : MANDATES,
    staff: agent ? [] : STAFF,
    self: agent ? STAFF[0] : null,
  };
}
