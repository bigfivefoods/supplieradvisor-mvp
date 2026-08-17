/**
 * Run: npx --yes tsx lib/clinic/appointment-kind.test.ts
 */
import assert from 'node:assert/strict';
import {
  SYS_PERSONAL_CODE,
  appointmentKindLabel,
  appointmentKindOf,
  applyAppointmentKindRules,
  assertAppointmentBookable,
  clinicAppointmentSaveFields,
  consultServices,
  ensureSystemPersonalService,
  normalizeAppointmentKind,
  patchFormForAppointmentKind,
  personalReasonOrNull,
} from './appointment-kind';

assert.equal(normalizeAppointmentKind('leave'), 'personal');
assert.equal(normalizeAppointmentKind('consult'), 'consult');
assert.equal(personalReasonOrNull(null), null);
assert.equal(personalReasonOrNull(''), null);
assert.equal(personalReasonOrNull('leave'), 'leave');
assert.equal(personalReasonOrNull('unknown'), 'personal');
assert.equal(appointmentKindLabel('personal', 'leave'), 'Leave');
assert.equal(appointmentKindLabel('consult'), 'Appointment');

const services = ensureSystemPersonalService([]);
assert.equal(services[0].code, SYS_PERSONAL_CODE);
assert.equal(consultServices(services).length, 0);

const portalServices: Array<{
  id: string;
  code?: string;
  name: string;
  capacity?: number | null;
}> = [{ id: 'svc_1', name: 'Consult' }];
const withPersonal = ensureSystemPersonalService(portalServices);
assert.equal(withPersonal.some((s) => s.code === SYS_PERSONAL_CODE), true);
assert.equal(ensureSystemPersonalService(withPersonal).length, withPersonal.length);

const personal = applyAppointmentKindRules(
  {
    appointment_kind: 'personal',
    personal_reason: 'leave',
    start_time: '08:00',
    end_time: '17:00',
    public: true,
    service_id: 'svc_other',
  },
  services
);
assert.equal(personal.appointment_kind, 'personal');
assert.equal(personal.public, false);
assert.equal(personal.service_id, services[0].id);
assert.equal(personal.duration_min, 540);

const upsertShaped = applyAppointmentKindRules(
  {
    id: 'apt_1',
    date: '2026-08-17',
    status: 'scheduled' as const,
    created_at: '2026-08-17T00:00:00.000Z',
    service_id: 'svc_other',
    start_time: '09:00',
    personal_reason: 'leave',
  },
  services,
  'personal'
);
const asAppointment: {
  id: string;
  date: string;
  status: 'scheduled';
  created_at: string;
} = upsertShaped;
assert.equal(asAppointment.id, 'apt_1');
assert.equal(asAppointment.date, '2026-08-17');
assert.equal(asAppointment.status, 'scheduled');
assert.equal(asAppointment.created_at, '2026-08-17T00:00:00.000Z');

assert.equal(
  appointmentKindOf({ service_id: services[0].id }, services),
  'personal'
);

const patched = patchFormForAppointmentKind(
  {
    appointment_kind: 'consult',
    service_id: 'svc_1',
    start_time: '09:00',
    duration_min: '45',
    public: true,
  },
  'personal',
  services
);
assert.equal(patched.appointment_kind, 'personal');
assert.equal(patched.public, false);
assert.equal(patched.service_id, services[0].id);

const save = clinicAppointmentSaveFields({
  kind: 'personal',
  reason: 'admin',
  start_time: '12:00',
  end_time: '13:30',
  service_id: '',
  public: true,
  notes: 'paperwork',
  services,
});
assert.equal(save.duration_min, 90);
assert.equal(save.public, false);

assert.throws(
  () => assertAppointmentBookable({ appointment_kind: 'personal' }, services),
  /cannot be booked/
);

console.log('appointment-kind.test.ts ok');
