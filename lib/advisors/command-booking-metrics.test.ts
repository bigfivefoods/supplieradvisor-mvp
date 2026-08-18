/**
 * Run: npx --yes tsx lib/advisors/command-booking-metrics.test.ts
 */
import assert from 'node:assert/strict';
import {
  clinicCommandBookingMetrics,
  commandDateWindows,
  formatCommandZar,
  formatFillPct,
  gymCommandBookingMetrics,
  hireCommandBookingMetrics,
  retailCommandBookingMetrics,
} from './command-booking-metrics';

const TODAY = '2026-08-18'; // Tuesday
const w = commandDateWindows(TODAY);
assert.equal(w.today, '2026-08-18');
assert.equal(w.weekStart, '2026-08-17');
assert.equal(w.weekEnd, '2026-08-23');
assert.equal(w.monthStart, '2026-08-01');
assert.equal(w.monthEnd, '2026-08-31');

assert.equal(formatFillPct(null), '—');
assert.equal(formatFillPct(73), '73%');
assert.equal(formatFillPct(66.7), '66.7%');
assert.equal(formatCommandZar(48200), 'R48,200');

const clinic = clinicCommandBookingMetrics(
  {
    services: [
      { id: 'svc1', code: 'ASSESS', price_zar: 850 },
      { id: 'svc2', code: 'TX', price_zar: 650 },
      { id: 'svc_p', code: 'SYS_PERSONAL', price_zar: 0 },
    ],
    appointments: [
      { id: 'a1', date: TODAY, status: 'scheduled', service_id: 'svc1' },
      { id: 'a2', date: TODAY, status: 'scheduled', service_id: 'svc1' },
      { id: 'a3', date: TODAY, status: 'scheduled', service_id: 'svc2' },
      { id: 'a4', date: '2026-08-20', status: 'scheduled', service_id: 'svc2' },
      { id: 'a5', date: '2026-08-28', status: 'scheduled', service_id: 'svc1' },
      { id: 'a6', date: '2026-09-02', status: 'scheduled', service_id: 'svc1' },
      {
        id: 'a7',
        date: TODAY,
        status: 'scheduled',
        service_id: 'svc_p',
        appointment_kind: 'personal',
      },
      { id: 'a8', date: TODAY, status: 'cancelled', service_id: 'svc1' },
    ],
    bookings: [
      { appointment_id: 'a1', status: 'booked' },
      { appointment_id: 'a2', status: 'attended' },
      { appointment_id: 'a4', status: 'booked' },
      { appointment_id: 'a5', status: 'waitlist' },
      { appointment_id: 'a6', status: 'booked' },
      { appointment_id: 'a8', status: 'booked' },
    ],
  },
  TODAY
);

assert.equal(clinic.bookedToday, 2);
assert.equal(clinic.bookedWeek, 3);
assert.equal(clinic.bookedMonth, 3);
assert.equal(clinic.slotsToday, 3);
assert.equal(clinic.fillRateTodayPct, 66.7);
assert.equal(clinic.monthIncomeZar, 850 + 850 + 650);
assert.equal(clinic.monthPotentialZar, 850 + 850 + 650 + 650 + 850);

const gym = gymCommandBookingMetrics(
  {
    class_types: [{ id: 'ct1', code: 'BOOT', capacity: 10 }],
    membership_plans: [
      {
        id: 'p1',
        price_zar: 775,
        billing: 'monthly',
        series_ids: ['ser1'],
        active: true,
      },
      { id: 'p2', price_zar: 150, billing: 'drop_in', active: true },
    ],
    clients: [
      { id: 'c1', agreed_rate_zar: 775 },
      { id: 'c2', private_rate_zar: 2000, agreed_rate_zar: 475 },
    ],
    subscriptions: [
      { client_id: 'c1', plan_id: 'p1', status: 'active', charged_zar: 775 },
    ],
    sessions: [
      {
        id: 's1',
        date: TODAY,
        status: 'scheduled',
        class_type_id: 'ct1',
        series_id: 'ser1',
        capacity: 10,
        session_kind: 'class',
      },
      {
        id: 's2',
        date: TODAY,
        status: 'scheduled',
        class_type_id: 'ct1',
        session_kind: 'private_pt',
        capacity: 1,
      },
      {
        id: 's3',
        date: TODAY,
        status: 'scheduled',
        class_type_id: 'ct1',
        session_kind: 'coach_personal',
        capacity: 1,
      },
    ],
    bookings: [
      { session_id: 's1', client_id: 'c1', status: 'booked' },
      { session_id: 's1', client_id: 'c2', status: 'booked' },
      { session_id: 's1', client_id: 'g1', status: 'waitlist' },
      { session_id: 's2', client_id: 'c2', status: 'booked' },
      { session_id: 's3', client_id: 'c1', status: 'booked' },
    ],
  },
  TODAY
);

assert.equal(gym.bookedToday, 3);
assert.equal(gym.bookedWeek, 3);
assert.equal(gym.bookedMonth, 3);
assert.equal(gym.slotsToday, 11);
assert.equal(gym.fillRateTodayPct, 27.3);
assert.equal(gym.monthIncomeZar, 775 + 475 + 2000);

const hire = hireCommandBookingMetrics(
  {
    items: [
      { id: 'i1', status: 'listed', rate_zar: 500, rate_unit: 'day' },
      { id: 'i2', status: 'listed', rate_zar: 500, rate_unit: 'day' },
    ],
    bookings: [
      {
        item_id: 'i1',
        status: 'paid',
        start_date: '2026-08-18',
        end_date: '2026-08-20',
        rental_zar: 1500,
      },
      {
        item_id: 'i2',
        status: 'cancelled',
        start_date: '2026-08-18',
        end_date: '2026-08-19',
        rental_zar: 1000,
      },
    ],
  },
  TODAY
);

assert.equal(hire.bookedToday, 1);
assert.equal(hire.bookedWeek, 1);
assert.equal(hire.bookedMonth, 1);
assert.equal(hire.monthIncomeZar, 1500);
assert.ok((hire.fillRateMonthPct || 0) > 0);
assert.ok(hire.monthPotentialZar >= hire.monthIncomeZar);

const retail = retailCommandBookingMetrics(
  {
    sales: [
      { created_at: `${TODAY}T09:00:00`, status: 'paid', total_zar: 200 },
      { created_at: '2026-08-10T09:00:00', status: 'paid', total_zar: 80 },
      { created_at: `${TODAY}T10:00:00`, status: 'void', total_zar: 50 },
    ],
  },
  TODAY
);
assert.equal(retail.bookedToday, 1);
assert.equal(retail.bookedMonth, 2);
assert.equal(retail.monthIncomeZar, 280);

const emptyClinic = clinicCommandBookingMetrics({ appointments: [], bookings: [] }, TODAY);
assert.equal(emptyClinic.bookedToday, 0);
assert.equal(emptyClinic.fillRateMonthPct, null);
assert.equal(emptyClinic.monthIncomeZar, 0);

console.log('command-booking-metrics ok');
