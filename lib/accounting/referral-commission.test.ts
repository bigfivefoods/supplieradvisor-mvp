/**
 * Run: npx --yes tsx lib/accounting/referral-commission.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildReferralCommission,
  referralSalesBase,
  type ReferralAgreement,
  type ReferralInvoice,
} from './referral-commission';

const agreement: ReferralAgreement = {
  seller_profile_id: 102,
  seller_name: 'Big Five Foods',
  partner_profile_id: 134,
  partner_name: 'Restore Africa Foundation',
  rate_pct: 5,
  basis: 'ex_vat',
  earn_on: 'collected',
  status: 'active',
};

const palm: ReferralInvoice = {
  id: 13,
  seller_profile_id: 102,
  invoice_number: 'INV-13',
  customer_id: 33,
  customer_name: 'Palm Footwear',
  status: 'paid',
  issue_date: '2026-08-28',
  subtotal: 225000,
  total_amount: 258750,
  amount_paid: 258750,
  referral_partner_profile_id: null,
};

assert.equal(referralSalesBase(palm, 'ex_vat', 129375), 112500);
assert.equal(referralSalesBase(palm, 'incl_vat', 129375), 129375);

const collected = buildReferralCommission({
  from: '2026-09-01',
  to: '2026-09-30',
  agreements: [agreement],
  invoices: [palm],
  customers: [{ id: 33, referral_partner_profile_id: 134 }],
  payments: [
    { id: 1, invoice_id: 13, amount: 129375, paid_at: '2026-08-28T10:00:00.000Z' },
    { id: 2, invoice_id: 13, amount: 129375, paid_at: '2026-09-25T10:00:00.000Z' },
  ],
  redemptions: [
    {
      id: 9,
      seller_profile_id: 102,
      partner_profile_id: 134,
      amount: 1000,
      redeemed_on: '2026-09-26',
      method: 'paid',
      reference: 'EFT',
      notes: 'September draw',
    },
  ],
});

assert.equal(collected.length, 1);
assert.equal(collected[0].lines.length, 1);
assert.equal(collected[0].lines[0].sales_amount, 112500);
assert.equal(collected[0].lines[0].commission, 5625);
assert.equal(collected[0].period_redeemed, 1000);
assert.equal(collected[0].owing_at_end, 5625 * 2 - 1000);

const invoiced = buildReferralCommission({
  from: '2026-08-01',
  to: '2026-08-31',
  agreements: [{ ...agreement, earn_on: 'invoiced', basis: 'incl_vat' }],
  invoices: [
    palm,
    { ...palm, id: 99, status: 'void', invoice_number: 'INV-VOID' },
  ],
  customers: [{ id: 33, referral_partner_profile_id: 134 }],
  payments: [
    { id: 1, invoice_id: 13, amount: 129375, paid_at: '2026-08-28T10:00:00.000Z' },
  ],
  redemptions: [],
});
assert.equal(invoiced[0].lines.length, 1);
assert.equal(invoiced[0].lines[0].sales_amount, 258750);
assert.equal(invoiced[0].period_commission, 12937.5);

const override = buildReferralCommission({
  from: '2026-08-01',
  to: '2026-08-31',
  agreements: [{ ...agreement, earn_on: 'invoiced', rate_pct: 10, basis: 'ex_vat' }],
  invoices: [{ ...palm, referral_partner_profile_id: 134 }],
  customers: [{ id: 33, referral_partner_profile_id: 999 }],
  payments: [],
  redemptions: [],
});
assert.equal(override[0].lines.length, 1);
assert.equal(override[0].period_commission, 22500);

const fallback = buildReferralCommission({
  from: '2026-08-01',
  to: '2026-08-31',
  agreements: [agreement],
  invoices: [{ ...palm, amount_paid: 115, total_amount: 115, subtotal: 100 }],
  customers: [{ id: 33, referral_partner_profile_id: 134 }],
  payments: [],
  redemptions: [],
});
assert.equal(fallback[0].lines.length, 1);
assert.equal(fallback[0].lines[0].sales_amount, 100);
assert.equal(fallback[0].lines[0].commission, 5);
assert.equal(fallback[0].lines[0].key, 'bal-13');

const paused = buildReferralCommission({
  from: '2026-08-01',
  to: '2026-08-31',
  agreements: [{ ...agreement, status: 'paused', earn_on: 'invoiced' }],
  invoices: [palm],
  customers: [{ id: 33, referral_partner_profile_id: 134 }],
  payments: [],
  redemptions: [],
});
assert.equal(paused[0].status, 'paused');
assert.equal(paused[0].period_commission, 11250);

console.log('referral-commission.test.ts ok');
