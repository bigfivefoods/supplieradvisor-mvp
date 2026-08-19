/**
 * Run: npx --yes tsx lib/clinic/medical-aid-claims.test.ts
 */
import assert from 'node:assert/strict';
import {
  validateIcd10,
  validateMedicalAidClaim,
  validateTariffCode,
} from './medical-aid-claim-validate';
import { submitToMedicalAidSwitch } from './medical-aid-switch';
import {
  applyEraToClaim,
  createClaimFromVisit,
  unclaimedAttendedVisits,
} from './medical-aid-claims';
import type { MedicalAidClaim } from './patient-medical';

assert.equal(validateIcd10('J06.9'), true);
assert.equal(validateIcd10('M54.5'), true);
assert.equal(validateIcd10('ZZ'), false);
assert.equal(validateTariffCode('0190'), true);
assert.equal(validateTariffCode('abc'), false);

const claim: MedicalAidClaim = {
  id: 'c1',
  status: 'ready',
  service_date: '2026-08-19',
  amount_zar: 850,
  tariff_code: '0190',
  diagnosis_code: 'J06.9',
  created_at: '2026-08-19T10:00:00.000Z',
  updated_at: '2026-08-19T10:00:00.000Z',
};

const bad = validateMedicalAidClaim({
  claim,
  medical: { medical_aid: {} },
  billing: {},
});
assert.equal(bad.ok, false);
assert.ok(bad.errors.some((e) => /PCNS/i.test(e)));
assert.ok(bad.errors.some((e) => /membership/i.test(e)));

const good = validateMedicalAidClaim({
  claim,
  medical: {
    id_number: '8001015009087',
    medical_aid: {
      scheme_name: 'Discovery Health',
      membership_number: '123456789',
    },
  },
  billing: { pcns_number: '1234567' },
});
assert.equal(good.ok, true, good.errors.join('; '));

void (async () => {
const switched = await submitToMedicalAidSwitch({
  claim,
  medical: {
    medical_aid: {
      scheme_name: 'Discovery Health',
      membership_number: '123456789',
    },
  },
  billing: { pcns_number: '1234567' },
  patientName: 'Ada',
  switch: { provider: 'medikredit', mode: 'sandbox' },
});
assert.equal(switched.ok, true);
assert.match(String(switched.tracking_number), /^MK-/);
assert.equal(switched.status, 'accepted');

const store = {
  patients: [
    {
      id: 'p1',
      name: 'Ada',
      code: 'P-1',
      medical: {
        medical_aid: {
          scheme_name: 'Discovery Health',
          membership_number: '123456789',
        },
        claims: [],
      },
    },
  ],
  services: [{ id: 's1', name: 'Consult', price_zar: 850, code: '0190' }],
  appointments: [
    {
      id: 'a1',
      service_id: 's1',
      practitioner_id: 'pr1',
      date: '2026-08-19',
      start_time: '09:00',
    },
  ],
  bookings: [{ id: 'b1', appointment_id: 'a1', patient_id: 'p1', status: 'attended' }],
  practitioners: [{ id: 'pr1', name: 'Dr Jones' }],
  settings: { pcns_number: '1234567' },
};

const visits = unclaimedAttendedVisits(store);
assert.equal(visits.length, 1);
assert.equal(visits[0].tariff_code, '0190');
const drafted = createClaimFromVisit(store, visits[0]);
const draftedClaim = drafted.patients[0].medical?.claims?.[0];
assert.ok(draftedClaim);
assert.equal(draftedClaim?.tariff_code, '0190');

const withClaim = {
  ...store,
  patients: drafted.patients,
};
const era = applyEraToClaim(withClaim, draftedClaim!.id, {
  amount_paid: 700,
  reference: 'ERA-1',
});
assert.equal(era.claim.status, 'partial');
assert.equal(era.claim.scheme_portion, 700);
assert.equal(era.claim.patient_portion, 150);

console.log('medical-aid-claims.test.ts ok');
})();
