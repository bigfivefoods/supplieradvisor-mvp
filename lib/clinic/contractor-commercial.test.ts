/**
 * Run: npx --yes tsx lib/clinic/contractor-commercial.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyContractorPaymentOption,
  computeContractorTake,
  draftFromContractorCommercial,
  emptyContractorCommercialDraft,
  formatContractorCommercialLine,
  formatContractorTake,
  mergeContractorCommercialFromRecord,
  recordFromContractorCommercialDraft,
  snapshotContractorCommercial,
  summariseContractorCommercial,
  validateContractorCommercialDraft,
} from './contractor-commercial';

const share = computeContractorTake({
  contractor_payment_option: 'revenue_share',
  charge_out_zar: 1200,
  contractor_share_pct: 40,
  rate_basis: 'per_session',
  charge_out_basis: 'per_session',
});
assert.ok(share);
assert.equal(share.contractorPay, 480);
assert.equal(share.practiceKeep, 720);
assert.equal(share.comparable, true);
assert.match(formatContractorTake(share), /R720/);

const split = computeContractorTake({
  contractor_payment_option: 'session_split',
  rate_zar: 200,
  charge_out_zar: 1000,
  contractor_share_pct: 10,
  rate_basis: 'per_session',
  charge_out_basis: 'per_session',
});
assert.ok(split);
assert.equal(split.contractorPay, 300);
assert.equal(split.practiceKeep, 700);

const session = computeContractorTake({
  contractor_payment_option: 'per_session_eft',
  rate_zar: 750,
  charge_out_zar: 1200,
  rate_basis: 'per_session',
  charge_out_basis: 'per_session',
});
assert.ok(session);
assert.equal(session.practiceKeep, 450);
assert.equal(session.comparable, true);

const mixed = computeContractorTake({
  contractor_payment_option: 'monthly_invoice',
  rate_zar: 12000,
  charge_out_zar: 850,
  rate_basis: 'monthly',
  charge_out_basis: 'per_session',
});
assert.ok(mixed);
assert.equal(mixed.comparable, false);

assert.equal(computeContractorTake({ rate_zar: 500 }), null);

const applied = applyContractorPaymentOption(
  emptyContractorCommercialDraft({ rate_zar: '750' }),
  'package_block'
);
assert.equal(applied.contractor_payment_option, 'package_block');
assert.equal(applied.contractor_payment_method, 'invoice');
assert.equal(applied.rate_basis, 'package');
assert.equal(applied.charge_out_basis, 'package');
assert.equal(applied.rate_zar, '750');

const rec = recordFromContractorCommercialDraft(
  draftFromContractorCommercial({
    rate_zar: 750,
    rate_basis: 'per_session',
    contractor_payment_option: 'per_session_eft',
    contractor_payment_method: 'eft',
    charge_out_zar: 1200,
    charge_out_basis: 'per_session',
    rate_note: 'incl. rooms',
  })
);
assert.equal(rec.rate_zar, 750);
assert.equal(rec.charge_out_zar, 1200);
assert.equal(rec.contractor_payment_option, 'per_session_eft');

assert.equal(
  validateContractorCommercialDraft(
    emptyContractorCommercialDraft({ rate_zar: 'abc' })
  ),
  'Contractor rate must be a number (ZAR)'
);
assert.equal(
  validateContractorCommercialDraft(
    emptyContractorCommercialDraft({ contractor_share_pct: '120' })
  ),
  'Contractor share must be between 0 and 100'
);
assert.equal(
  validateContractorCommercialDraft(emptyContractorCommercialDraft()),
  null
);

const merged = mergeContractorCommercialFromRecord(
  { charge_out_zar: 900, contractor_payment_option: 'weekly_invoice' },
  { charge_out_zar: 1500, contractor_share_pct: '' }
);
assert.equal(merged.charge_out_zar, 1500);
assert.equal(merged.contractor_payment_option, 'weekly_invoice');
assert.equal(merged.contractor_share_pct, null);

const snap = snapshotContractorCommercial({
  rate_zar: 700,
  rate_basis: 'per_session',
  contractor_payment_option: 'per_session_eft',
  charge_out_zar: 1100,
});
assert.equal(snap.charge_out_zar, 1100);
assert.equal(snap.contractor_payment_option, 'per_session_eft');

const summary = summariseContractorCommercial([
  {
    engagement: 'contractor',
    active: true,
    rate_zar: 750,
    charge_out_zar: 1200,
    rate_basis: 'per_session',
    charge_out_basis: 'per_session',
    contractor_payment_option: 'per_session_eft',
  },
  {
    engagement: 'employed',
    active: true,
    rate_zar: 20000,
    charge_out_zar: 1200,
  },
]);
assert.equal(summary.contractors, 1);
assert.equal(summary.withTake, 1);
assert.equal(summary.avgKeep, 450);

const line = formatContractorCommercialLine({
  contractor_payment_option: 'per_session_eft',
  contractor_payment_method: 'eft',
  rate_zar: 750,
  rate_basis: 'per_session',
  charge_out_zar: 1200,
  charge_out_basis: 'per_session',
});
assert.match(line, /Per session/);
assert.match(line, /Charge-out/);
assert.match(line, /Practice keeps/);

console.log('contractor-commercial tests ok');
