/**
 * Run: npx --yes tsx lib/clinic/practice-referral.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildPracticeReferralSnapshot,
  writeInboundReferral,
  readInboundReferrals,
} from './practice-referral';
import { writeMedicalgraphToMetadata } from './medicalgraph';

const meta = writeMedicalgraphToMetadata(
  {},
  {
    practitioners: [
      {
        id: 'pr1',
        name: 'Dr Ada',
        email: '',
        disciplines: [],
        active: true,
        created_at: '2026-01-01',
      },
    ],
    patients: [
      {
        id: 'p1',
        code: 'P1',
        name: 'Pat',
        email: 'pat@example.com',
        phone: '082',
        status: 'active',
        created_at: '2026-01-01',
        clinical: { injury_status: 'recovering', injury_areas: ['Knee'] },
        medical: { allergies: 'Penicillin', scripts: [] },
      },
    ],
    services: [{ id: 's1', name: 'GP consult', code: 'GP', price_zar: 0 }],
    packages: [],
    appointments: [
      {
        id: 'a1',
        service_id: 's1',
        practitioner_id: 'pr1',
        date: '2026-08-01',
        start_time: '09:00',
        status: 'completed',
        created_at: '2026-08-01',
      },
    ],
    bookings: [
      {
        id: 'b1',
        appointment_id: 'a1',
        patient_id: 'p1',
        status: 'attended',
        booked_at: '2026-08-01',
      },
    ],
    threads: [],
    appointment_feedback: [],
    announcements: [],
    desk_notices: [],
    record_shares: [],
    settings: {
      enabled: true,
      public_token: 't',
      brand_name: 'CityCare',
      contact_email: 'desk@city.care',
      contact_phone: '011',
      practice_number: 'MP-1',
      allow_public_booking: true,
      show_practitioners: true,
      show_pricing: true,
    },
  } as never
);

const snap = buildPracticeReferralSnapshot({
  companyName: 'CityCare Inc',
  kind: 'medical',
  meta,
  patientId: 'p1',
  scopes: ['summary', 'practice_info', 'visit_history'],
  referralReason: 'Knee pain — please assess',
  referringPractitionerName: 'Dr Ada',
});
assert.ok(snap);
assert.equal(snap!.brand, 'CityCare');
assert.equal(snap!.medical?.allergies, 'Penicillin');
assert.equal(snap!.practice?.contact_email, 'desk@city.care');
assert.equal(snap!.practice?.referring_practitioner, 'Dr Ada');
assert.equal(snap!.visits?.[0].service_name, 'GP consult');
assert.equal(snap!.referral_reason, 'Knee pain — please assess');

const slim = buildPracticeReferralSnapshot({
  companyName: 'CityCare Inc',
  kind: 'medical',
  meta,
  patientId: 'p1',
  scopes: ['practice_info'],
});
assert.ok(slim?.practice);
assert.equal(slim!.medical, undefined);
assert.equal(slim!.visits, undefined);

const next = writeInboundReferral(
  {},
  {
    id: 'ref1',
    from_company_id: 1,
    from_company_name: 'CityCare',
    from_kind: 'medical',
    from_ref_id: 'p1',
    to_kind: 'physio',
    patient_name: 'Pat',
    scopes: ['summary'],
    status: 'active',
    created_at: '2026-08-19',
    snapshot: snap!,
  }
);
assert.equal(readInboundReferrals(next).length, 1);

console.log('practice-referral.test.ts ok');
