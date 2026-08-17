/**
 * One company week: Advisor sessions, People leave, supplier deliveries.
 */

export type CalendarSource =
  | 'gym'
  | 'clinic'
  | 'hire'
  | 'leave'
  | 'delivery'
  | 'recall';

export type CompanyCalendarEvent = {
  id: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  source: CalendarSource;
  module?: string;
  href?: string;
  person_name?: string | null;
  status?: string | null;
};

export function inRange(date: string, from: string, to: string): boolean {
  const d = String(date || '').slice(0, 10);
  return d >= from && d <= to;
}

export function overlayCompanyCalendar(opts: {
  from: string;
  to: string;
  gym?: {
    sessions: Array<{
      id: string;
      date: string;
      start_time?: string;
      end_time?: string | null;
      status?: string;
      coach_id?: string | null;
      class_type_id?: string;
      session_kind?: string;
    }>;
    coaches?: Array<{ id: string; name: string }>;
    class_types?: Array<{ id: string; name: string }>;
  };
  clinics?: Array<{
    module: string;
    appointments: Array<{
      id: string;
      date: string;
      start_time?: string;
      end_time?: string | null;
      status?: string;
      practitioner_id?: string | null;
      appointment_kind?: string;
      service_id?: string;
    }>;
    staff?: Array<{ id: string; name: string }>;
    services?: Array<{ id: string; name: string }>;
  }>;
  hire?: {
    bookings: Array<{
      id: string;
      start_date?: string | null;
      end_date?: string | null;
      item_title?: string;
      customer_name?: string;
      status?: string;
    }>;
  };
  leave?: Array<{
    id?: string | number;
    employee_id: number;
    start_date: string;
    end_date: string;
    status: string;
    reason?: string | null;
    person_name?: string;
  }>;
  deliveries?: Array<{
    id: string | number;
    due_date?: string | null;
    expected_date?: string | null;
    supplier_name?: string | null;
    po_number?: string | null;
    status?: string | null;
  }>;
  recalls?: Array<{
    id: string;
    due_date: string;
    name?: string;
    module?: string;
  }>;
}): CompanyCalendarEvent[] {
  const out: CompanyCalendarEvent[] = [];
  const { from, to } = opts;

  if (opts.gym) {
    const coaches = new Map((opts.gym.coaches || []).map((c) => [c.id, c.name]));
    const types = new Map((opts.gym.class_types || []).map((c) => [c.id, c.name]));
    for (const s of opts.gym.sessions) {
      if (s.status === 'cancelled') continue;
      if (!inRange(s.date, from, to)) continue;
      const kind = s.session_kind === 'coach_personal' ? 'Own time' : types.get(s.class_type_id || '') || 'Class';
      out.push({
        id: `gym:${s.id}`,
        date: s.date,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        title: kind,
        source: 'gym',
        module: 'fitgraph',
        href: '/dashboard/fitgraph/calendar',
        person_name: s.coach_id ? coaches.get(s.coach_id) || null : null,
        status: s.status || 'scheduled',
      });
    }
  }

  for (const clinic of opts.clinics || []) {
    const staff = new Map((clinic.staff || []).map((p) => [p.id, p.name]));
    const svcs = new Map((clinic.services || []).map((s) => [s.id, s.name]));
    for (const a of clinic.appointments) {
      if (a.status === 'cancelled') continue;
      if (!inRange(a.date, from, to)) continue;
      const title =
        a.appointment_kind === 'personal'
          ? 'Own time / leave'
          : svcs.get(a.service_id || '') || 'Consult';
      out.push({
        id: `${clinic.module}:${a.id}`,
        date: a.date,
        start_time: a.start_time || null,
        end_time: a.end_time || null,
        title,
        source: 'clinic',
        module: clinic.module,
        href: `/dashboard/${clinic.module}/calendar`,
        person_name: a.practitioner_id ? staff.get(a.practitioner_id) || null : null,
        status: a.status || 'scheduled',
      });
    }
  }

  for (const b of opts.hire?.bookings || []) {
    const start = String(b.start_date || '').slice(0, 10);
    if (!start || !inRange(start, from, to)) continue;
    if (b.status === 'cancelled') continue;
    out.push({
      id: `hire:${b.id}`,
      date: start,
      title: b.item_title || 'Hire',
      source: 'hire',
      module: 'hiregraph',
      href: '/dashboard/hiregraph/calendar',
      person_name: b.customer_name || null,
      status: b.status || 'booked',
    });
  }

  for (const w of opts.leave || []) {
    if (String(w.status).toLowerCase() !== 'approved') continue;
    let d = w.start_date.slice(0, 10);
    const end = w.end_date.slice(0, 10);
    while (d <= end) {
      if (inRange(d, from, to)) {
        out.push({
          id: `leave:${w.id || w.employee_id}:${d}`,
          date: d,
          title: w.reason ? `Leave · ${w.reason}` : 'Staff leave',
          source: 'leave',
          href: '/dashboard/people/leave',
          person_name: w.person_name || null,
          status: 'approved',
        });
      }
      const next = new Date(`${d}T12:00:00`);
      next.setDate(next.getDate() + 1);
      d = next.toISOString().slice(0, 10);
    }
  }

  for (const po of opts.deliveries || []) {
    const due = String(po.expected_date || po.due_date || '').slice(0, 10);
    if (!due || !inRange(due, from, to)) continue;
    out.push({
      id: `po:${po.id}`,
      date: due,
      title: po.po_number ? `PO ${po.po_number}` : 'Supplier delivery',
      source: 'delivery',
      href: '/dashboard/suppliers',
      person_name: po.supplier_name || null,
      status: po.status || 'open',
    });
  }

  for (const r of opts.recalls || []) {
    if (!inRange(r.due_date, from, to)) continue;
    out.push({
      id: `recall:${r.id}`,
      date: r.due_date,
      title: r.name ? `Recall · ${r.name}` : 'Recall due',
      source: 'recall',
      module: r.module,
      href: r.module ? `/dashboard/${r.module}` : '/dashboard/customers/360',
    });
  }

  out.sort((a, b) =>
    `${a.date}${a.start_time || '99'}`.localeCompare(`${b.date}${b.start_time || '99'}`)
  );
  return out;
}

export function weekBounds(anchor = new Date()): { from: string; to: string } {
  const d = new Date(anchor.getTime());
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  const from = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}
