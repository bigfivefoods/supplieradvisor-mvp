/**
 * Run: npx --yes tsx lib/core-os/core-os.test.ts
 */
import assert from 'node:assert/strict';
import {
  classifyCrmCustomer,
  advisorRefTag,
  assembleCustomer360,
  toWorkforceEmploymentType,
  resolveWorkforceEmployment,
  assemblePeople360,
  leaveBlocksAssignment,
  windowsFromHrRequests,
  staffOnLeave,
  buildDebitOrderLines,
  debitOrderCsv,
  matchDebitToBankLine,
  recurringInvoiceDrafts,
  splitInclusiveVat,
  overlayCompanyCalendar,
  weekBounds,
  collectSharedSkuDrafts,
  sharedSkuKey,
  findLinkedProduct,
  crmActivityFromEvent,
  intelligenceFromEvents,
  mixInbox,
  reconcileIdentityClusters,
  emailsMatch,
} from './index';
import type { AdvisorEvent } from '@/lib/services/advisor-events';

// 1. Customers 360
assert.equal(
  classifyCrmCustomer({
    source: 'advisor_member',
    notes: advisorRefTag('fitgraph', 'cli_1'),
  }),
  'gym_member'
);
assert.equal(
  classifyCrmCustomer({ notes: advisorRefTag('physiograph', 'pat_1') }),
  'clinic_patient'
);
assert.equal(classifyCrmCustomer({ source: 'website' }), 'trade');

const c360 = assembleCustomer360({
  customer: {
    id: 9,
    trading_name: 'Ann Vuka',
    email: 'ann@example.com',
    notes: advisorRefTag('fitgraph', 'cli_1'),
    source: 'advisor_member',
  },
  invoices: [
    {
      id: 1,
      invoice_number: 'INV-1',
      status: 'sent',
      total_amount: 910,
      amount_paid: 0,
      customer_id: 9,
    },
  ],
  gym: {
    clients: [
      {
        id: 'cli_1',
        name: 'Ann Vuka',
        email: 'ann@example.com',
        crm_customer_id: 9,
        membership_plan_id: 'pln_1',
        debit_bank: {
          account_holder: 'Ann Vuka',
          bank_name: 'FNB',
          account_number: '1234567890',
          branch_code: '250655',
          account_type: 'cheque',
          debit_order_authorised: true,
        },
        family: [{ id: 'f1', name: 'Kid Vuka' }],
      },
    ],
    subscriptions: [
      {
        id: 'sub_1',
        client_id: 'cli_1',
        plan_id: 'pln_1',
        status: 'active',
        current_period_end: '2026-09-01',
      },
    ],
    plans: [{ id: 'pln_1', name: '5am FSF', price_zar: 910, billing: 'monthly' }],
    sessions: [
      { id: 'ses_1', date: '2026-08-10', start_time: '05:00', class_type_id: 'ct1' },
      { id: 'ses_2', date: '2026-08-20', start_time: '05:00', class_type_id: 'ct1' },
    ],
    bookings: [
      { id: 'b1', session_id: 'ses_1', client_id: 'cli_1', status: 'attended' },
      { id: 'b2', session_id: 'ses_2', client_id: 'cli_1', status: 'booked' },
    ],
    class_types: [{ id: 'ct1', name: 'Functional Strength' }],
  },
  today: '2026-08-17',
});
assert.ok(c360.kinds.includes('gym_member'));
assert.equal(c360.memberships[0].plan_name, '5am FSF');
assert.equal(c360.debit_bank?.ready, true);
assert.equal(c360.family[0].name, 'Kid Vuka');
assert.equal(c360.last_visit?.title, 'Functional Strength');
assert.equal(c360.next_session?.date, '2026-08-20');
assert.equal(c360.open_ar, 910);
assert.equal(c360.identity.crm_customer_id, 9);

// 2. People workforce + leave
assert.equal(toWorkforceEmploymentType('contractor'), 'contract');
assert.equal(toWorkforceEmploymentType('full_time'), 'full_time');
assert.equal(resolveWorkforceEmployment('fitgraph_coach', null), 'contract');
assert.equal(resolveWorkforceEmployment('fieldgraph_gang', null), null);

const leave = windowsFromHrRequests(
  [
    {
      id: 3,
      employee_id: 12,
      start_date: '2026-08-17',
      end_date: '2026-08-19',
      status: 'approved',
      reason: 'Annual',
      leave_type_code: 'ANNUAL',
    },
  ],
  [{ id: 12, metadata: { service_person_id: 'coh_1', service_module: 'fitgraph' } }]
);
assert.equal(leave[0].person_id, 'coh_1');
const blocked = leaveBlocksAssignment(leave, 'coh_1', '2026-08-18', 12);
assert.equal(blocked.blocked, true);
assert.equal(leaveBlocksAssignment(leave, 'coh_1', '2026-08-20', 12).blocked, false);
assert.ok(staffOnLeave(leave, { date: '2026-08-17', personId: 'coh_1' }));

const p360 = assemblePeople360({
  employee: {
    id: 12,
    full_name: 'Coach Lee',
    employment_type: 'contract',
    hourly_rate: 250,
    metadata: {
      service_module: 'fitgraph',
      service_person_id: 'coh_1',
      service_source_label: 'GymAdvisor coach',
    },
  },
  staff: { id: 'coh_1', name: 'Coach Lee', rate_zar: 250, rate_basis: 'per_class' },
  leave,
  today: '2026-08-18',
});
assert.equal(p360.workforce, 'contractor');
assert.equal(p360.on_leave, true);
assert.equal(p360.diary_href, '/dashboard/fitgraph/calendar');

// 3. Finance VAT + debit + recurring
const vat = splitInclusiveVat(910);
assert.equal(vat.inclusive, 910);
assert.ok(Math.abs(vat.exclusive + vat.vat - 910) < 0.02);
assert.ok(vat.vat > 100);

const debit = buildDebitOrderLines({
  companySlug: 'VUKA',
  period: '202608',
  members: [
    {
      id: 'cli_1',
      code: 'A1',
      name: 'Ann',
      crm_customer_id: 9,
      debit_bank: {
        account_holder: 'Ann Vuka',
        bank_name: 'FNB',
        account_number: '1234567890',
        branch_code: '250655',
        account_type: 'cheque',
        debit_order_authorised: true,
      },
    },
  ],
  subscriptions: [
    { client_id: 'cli_1', plan_id: 'pln_1', status: 'active' },
  ],
  plans: [{ id: 'pln_1', name: '5am FSF', price_zar: 910 }],
});
assert.equal(debit.length, 1);
assert.equal(debit[0].amount_zar, 910);
assert.ok(debit[0].reference.includes('VUKA'));
const csv = debitOrderCsv(debit, '2026-08-25');
assert.ok(csv.includes('AccountHolder'));
assert.ok(csv.includes('Ann Vuka'));
assert.ok(matchDebitToBankLine(`EFT ${debit[0].reference}`, debit));

const drafts = recurringInvoiceDrafts({
  members: [{ id: 'cli_1', name: 'Ann', crm_customer_id: 9 }],
  subscriptions: [{ client_id: 'cli_1', plan_id: 'pln_1', status: 'active' }],
  plans: [{ id: 'pln_1', name: '5am FSF', price_zar: 910 }],
  existingInvoiceNotes: [],
  periodKey: '2026-08',
});
assert.equal(drafts.length, 1);
assert.equal(drafts[0].already_invoiced, false);
assert.equal(drafts[0].amount_incl, 910);

// 4. Company calendar
const week = weekBounds(new Date('2026-08-17T12:00:00Z'));
assert.ok(week.from <= '2026-08-17');
assert.ok(week.to >= '2026-08-17');
const cal = overlayCompanyCalendar({
  from: '2026-08-17',
  to: '2026-08-23',
  gym: {
    sessions: [
      {
        id: 's1',
        date: '2026-08-17',
        start_time: '05:00',
        class_type_id: 'ct1',
        coach_id: 'coh_1',
      },
    ],
    coaches: [{ id: 'coh_1', name: 'Lee' }],
    class_types: [{ id: 'ct1', name: 'FSF' }],
  },
  leave: [
    {
      id: 3,
      employee_id: 12,
      start_date: '2026-08-18',
      end_date: '2026-08-18',
      status: 'approved',
      reason: 'Annual',
      person_name: 'Lee',
    },
  ],
  deliveries: [
    { id: 8, due_date: '2026-08-19', po_number: 'PO-8', status: 'sent' },
  ],
});
assert.equal(cal.filter((e) => e.source === 'gym').length, 1);
assert.equal(cal.filter((e) => e.source === 'leave').length, 1);
assert.equal(cal.filter((e) => e.source === 'delivery').length, 1);

// 5. Shared SKUs
const skus = collectSharedSkuDrafts({
  gymShop: [{ id: 'pln_1', name: '5am FSF', price_zar: 910, code: 'FSF', kind: 'membership' }],
  retail: [{ id: 'sku_1', name: 'Shake', sku: 'SHK-1', price_zar: 45 }],
  hire: [{ id: 'hir_1', title: 'Castle', sku: 'HIR-1', rate_zar: 800 }],
});
assert.equal(skus.length, 3);
assert.equal(skus[0].track_stock, false);
assert.equal(skus[1].track_stock, true);
const key = sharedSkuKey('retail', 'sku_1');
assert.equal(
  findLinkedProduct(
    [{ id: 4, sku: 'SHK-1', name: 'Shake', metadata: { shared_sku_key: key } }],
    skus[1]
  )?.id,
  4
);

// 6. Identity
assert.ok(emailsMatch('Ann@X.com', 'ann@x.com'));
const clusters = reconcileIdentityClusters([
  { kind: 'customer', id: '9', name: 'Ann', email: 'ann@x.com', crm_customer_id: 9 },
  { kind: 'advisor', id: 'cli_1', name: 'Ann', email: 'ann@x.com', crm_customer_id: 9 },
  { kind: 'employee', id: '12', name: 'Lee', email: 'lee@x.com', hr_employee_id: 12 },
]);
assert.equal(clusters.length, 1);
assert.equal(clusters[0].length, 2);

// 7. Event bus
const ev: AdvisorEvent = {
  id: 'e1',
  at: new Date().toISOString(),
  module: 'fitgraph',
  company_id: 1,
  type: 'attendance.marked',
  person_id: 'cli_1',
};
const act = crmActivityFromEvent(ev);
assert.ok(act);
assert.equal(act!.action, 'advisor.attendance.marked');
const pulse = intelligenceFromEvents([ev], { debitMissing: 4, debitReady: 12 });
assert.ok(pulse.some((i) => i.id === 'advisor-attendance'));
assert.ok(pulse.some((i) => i.id === 'advisor-debit-gap'));
const inbox = mixInbox({
  trade: [{ id: 't1', channel: 'trade', title: 'PO', at: '2026-08-01', href: '/t' }],
  care: [{ id: 'c1', channel: 'care', title: 'Class', at: '2026-08-10', href: '/c' }],
  filter: 'care',
});
assert.equal(inbox.length, 1);
assert.equal(inbox[0].id, 'c1');

console.log('core-os.test.ts ok');
