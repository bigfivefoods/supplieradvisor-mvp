/**
 * Run: npx --yes tsx lib/clinic/hydrate-clinic-store.test.ts
 */
import assert from 'node:assert/strict';
import { copyStoredClinicArrays } from './hydrate-clinic-store';
import {
  emptyPhysiographStore,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from './physiograph';
import { readMedicalgraphFromMetadata } from './medicalgraph';

const copied = copyStoredClinicArrays(
  { patients: [], visit_notes: [], settings: {} },
  {
    patients: [{ id: 'p1' }],
    visit_notes: [{ id: 'vn1', body: 'hello' }],
    waitlist_queue: [{ id: 'w1' }],
  }
);
assert.equal(copied.patients.length, 1);
assert.equal(copied.visit_notes.length, 1);
assert.equal((copied as { waitlist_queue?: unknown[] }).waitlist_queue?.length, 1);

const empty = emptyPhysiographStore();
assert.ok(Array.isArray(empty.visit_notes));
assert.ok(Array.isArray(empty.treatment_plans));
assert.ok(Array.isArray(empty.waitlist_queue));

const written = writePhysiographToMetadata(
  {},
  {
    ...emptyPhysiographStore(),
    visit_notes: [
      {
        id: 'vn_1',
        person_id: 'pat_1',
        body: 'Knee tracking improved',
        private: true,
        created_at: '2026-08-19T10:00:00.000Z',
        updated_at: '2026-08-19T10:00:00.000Z',
        appointment_id: 'apt_1',
        booking_id: 'bk_1',
      },
    ],
    patients: [
      {
        id: 'pat_1',
        code: 'P1',
        name: 'Ada',
        medical: {
          scripts: [
            {
              id: 'rx_1',
              medication: 'Quad sets',
              kind: 'rehab',
              status: 'active',
            },
          ],
        },
      },
    ],
  } as ReturnType<typeof emptyPhysiographStore>
);

const roundTrip = readPhysiographFromMetadata(written);
assert.equal(roundTrip.visit_notes?.length, 1);
assert.equal(roundTrip.visit_notes?.[0].body, 'Knee tracking improved');
assert.equal(roundTrip.patients[0].medical?.scripts?.[0].kind, 'rehab');

const medical = readMedicalgraphFromMetadata({
  medicalgraph: {
    patients: [],
    visit_notes: [{ id: 'n1', person_id: 'p', body: 'SOAP', private: true }],
  },
});
assert.equal(medical.visit_notes?.length, 1);

console.log('hydrate-clinic-store.test.ts ok');
