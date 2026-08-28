/**
 * Assemble a member / patient / hirer 360 from CRM + Advisor stores.
 */
import {
  classifyCrmCustomer,
  advisorRefTag,
  advisorKindAliases,
  advisorPartyCustomerType,
  type CoreCustomerKind,
} from './kinds';
import { emailsMatch, mergeIdentity, type IdentityLinks } from './identity';
import { memberDebitBankComplete } from '@/lib/fitness/member-debit-bank';

export type LooseInvoice = {
  id: number | string;
  invoice_number?: string | null;
  status?: string | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  due_date?: string | null;
  notes?: string | null;
  customer_id?: number | null;
};

export type LooseFamily = { id?: string; name: string };

export type LoosePerson = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  crm_customer_id?: number | null;
  platform_user_id?: string | null;
  hr_employee_id?: number | null;
  family?: LooseFamily[];
  membership_plan_id?: string | null;
  membership_status?: string | null;
  attended_count?: number;
  last_no_show_at?: string | null;
  debit_bank?: {
    account_holder?: string;
    bank_name?: string;
    account_number?: string;
    branch_code?: string;
    account_type?: string;
    debit_order_authorised?: boolean;
  } | null;
  active?: boolean;
};

export type LoosePlan = {
  id: string;
  name: string;
  price_zar?: number;
  billing?: string;
};

export type LooseSub = {
  id: string;
  client_id: string;
  plan_id: string;
  status: string;
  current_period_end?: string | null;
};

export type LooseSession = {
  id: string;
  date: string;
  start_time?: string;
  class_type_id?: string;
  status?: string;
};

export type LooseBooking = {
  id: string;
  session_id?: string;
  appointment_id?: string;
  client_id?: string;
  patient_id?: string;
  status: string;
  family_member_name?: string | null;
};

export type Customer360Membership = {
  plan_id: string;
  plan_name: string;
  status: string;
  price_zar: number;
  billing?: string;
  period_end?: string | null;
};

export type Customer360Visit = {
  date: string;
  time?: string;
  title: string;
  status: string;
  source: string;
};

export type Customer360 = {
  customer_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  logo_url?: string | null;
  kinds: CoreCustomerKind[];
  identity: IdentityLinks;
  memberships: Customer360Membership[];
  debit_bank: {
    ready: boolean;
    bank_name?: string;
    masked?: string;
    authorised?: boolean;
  } | null;
  family: LooseFamily[];
  last_visit: Customer360Visit | null;
  next_session: Customer360Visit | null;
  invoices: Array<{
    id: string | number;
    number: string;
    status: string;
    total: number;
    paid: number;
    due?: string | null;
  }>;
  open_ar: number;
  events: Array<{ at: string; type: string; summary: string }>;
  advisor_hrefs: string[];
};

export function personMatchesCustomer(
  person: LoosePerson,
  customer: { id: number; email?: string | null; notes?: string | null },
  kind: string
): boolean {
  if (person.crm_customer_id && Number(person.crm_customer_id) === Number(customer.id)) {
    return true;
  }
  const notes = String(customer.notes || '');
  for (const alias of advisorKindAliases(kind)) {
    if (notes.includes(advisorRefTag(alias, person.id))) return true;
  }
  return emailsMatch(person.email, customer.email);
}

export type AdvisorCustomerPerson = {
  module: string;
  kind: string;
  person: LoosePerson;
};

export function collectAdvisorCustomerPeople(opts: {
  gymClients?: LoosePerson[] | null;
  clinics?: Array<{ module: string; patients?: LoosePerson[] | null }>;
  retailCustomers?: LoosePerson[] | null;
}): AdvisorCustomerPerson[] {
  const out: AdvisorCustomerPerson[] = [];
  for (const p of opts.gymClients || []) {
    if (!p?.id) continue;
    out.push({ module: 'fitgraph', kind: 'gym', person: p });
  }
  for (const clinic of opts.clinics || []) {
    const module = String(clinic.module || '');
    for (const p of clinic.patients || []) {
      if (!p?.id) continue;
      out.push({ module, kind: module, person: p });
    }
  }
  for (const p of opts.retailCustomers || []) {
    if (!p?.id) continue;
    out.push({ module: 'retailgraph', kind: 'retail', person: p });
  }
  return out;
}

export function syntheticCustomerId(module: string, personId: string): number {
  let h = 2166136261;
  const s = `${module}:${personId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = Math.abs(h) % 1_000_000_000;
  return n === 0 ? -1 : -n;
}

export function unsyncedAdvisorCustomerPeople(
  people: AdvisorCustomerPerson[],
  customers: Array<{ id: number; email?: string | null; notes?: string | null }>
): AdvisorCustomerPerson[] {
  return people.filter(
    (row) =>
      !row.person.crm_customer_id &&
      !customers.some((c) => personMatchesCustomer(row.person, c, row.kind))
  );
}

/** CRM-shaped row so unsynced gym/clinic people still assemble in Customer 360. */
export function syntheticCustomerFromPerson(row: AdvisorCustomerPerson): {
  id: number;
  trading_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  notes: string;
  customer_type: string;
} {
  return {
    id: syntheticCustomerId(row.module, row.person.id),
    trading_name: row.person.name || 'Customer',
    email: row.person.email || null,
    phone: row.person.phone || null,
    source: 'advisor_member',
    notes: advisorKindAliases(row.kind)
      .map((alias) => advisorRefTag(alias, row.person.id))
      .join('\n'),
    customer_type: advisorPartyCustomerType(row.kind),
  };
}

export function assembleLeftoverAdvisor360(
  leftover: AdvisorCustomerPerson[],
  opts: Omit<Parameters<typeof assembleCustomer360>[0], 'customer'>
): Customer360[] {
  return leftover.map((row) =>
    assembleCustomer360({
      ...opts,
      customer: syntheticCustomerFromPerson(row),
    })
  );
}

function maskAcct(raw?: string): string | undefined {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length < 4) return d || undefined;
  return `•••• ${d.slice(-4)}`;
}

function classNameOf(
  session: LooseSession,
  classTypes?: Array<{ id: string; name: string }>
): string {
  const hit = (classTypes || []).find((c) => c.id === session.class_type_id);
  return hit?.name || 'Class';
}

export function assembleCustomer360(opts: {
  customer: {
    id: number;
    trading_name: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    notes?: string | null;
    customer_type?: string | null;
    linked_profile_id?: number | null;
    logo_url?: string | null;
  };
  invoices?: LooseInvoice[];
  gym?: {
    clients: LoosePerson[];
    subscriptions: LooseSub[];
    plans: LoosePlan[];
    sessions: LooseSession[];
    bookings: LooseBooking[];
    class_types?: Array<{ id: string; name: string }>;
  } | null;
  clinics?: Array<{
    module: string;
    patients: LoosePerson[];
    appointments: LooseSession[];
    bookings: LooseBooking[];
    services?: Array<{ id: string; name: string }>;
  }>;
  hire?: {
    bookings: Array<{
      crm_customer_id?: number | null;
      customer_name?: string;
      item_title?: string;
      start_date?: string | null;
      status?: string;
    }>;
  } | null;
  retail?: {
    customers: LoosePerson[];
  } | null;
  events?: Array<{ at: string; type: string; person_id?: string | null; meta?: Record<string, unknown> }>;
  today?: string;
}): Customer360 {
  const c = opts.customer;
  const kinds = new Set<CoreCustomerKind>([classifyCrmCustomer(c)]);
  const identity = mergeIdentity({
    crm_customer_id: c.id,
    email: c.email,
  });
  const memberships: Customer360Membership[] = [];
  const family: LooseFamily[] = [];
  const visits: Customer360Visit[] = [];
  const hrefs: string[] = [];
  let debit: Customer360['debit_bank'] = null;
  const today = opts.today || new Date().toISOString().slice(0, 10);

  if (opts.gym) {
    const client = opts.gym.clients.find((p) =>
      personMatchesCustomer(p, c, 'fitgraph')
    );
    if (client) {
      kinds.add('gym_member');
      hrefs.push('/dashboard/fitgraph/clients');
      Object.assign(
        identity,
        mergeIdentity(identity, {
          platform_user_id: client.platform_user_id,
          advisor_person_id: client.id,
          advisor_module: 'fitgraph',
          crm_customer_id: client.crm_customer_id || c.id,
        })
      );
      if (client.family?.length) family.push(...client.family);
      if (client.debit_bank) {
        debit = {
          ready: memberDebitBankComplete(client as never),
          bank_name: client.debit_bank.bank_name,
          masked: maskAcct(client.debit_bank.account_number),
          authorised: client.debit_bank.debit_order_authorised === true,
        };
      }
      const subs = opts.gym.subscriptions.filter(
        (s) => s.client_id === client.id && s.status !== 'cancelled'
      );
      for (const s of subs) {
        const plan = opts.gym.plans.find((p) => p.id === s.plan_id);
        memberships.push({
          plan_id: s.plan_id,
          plan_name: plan?.name || s.plan_id,
          status: s.status,
          price_zar: Number(plan?.price_zar || 0),
          billing: plan?.billing,
          period_end: s.current_period_end || null,
        });
      }
      if (!subs.length && client.membership_plan_id) {
        const plan = opts.gym.plans.find((p) => p.id === client.membership_plan_id);
        memberships.push({
          plan_id: client.membership_plan_id,
          plan_name: plan?.name || client.membership_plan_id,
          status: client.membership_status || 'active',
          price_zar: Number(plan?.price_zar || 0),
          billing: plan?.billing,
        });
      }
      for (const b of opts.gym.bookings) {
        if (b.client_id !== client.id) continue;
        if (b.status === 'cancelled') continue;
        const session = opts.gym.sessions.find((s) => s.id === b.session_id);
        if (!session) continue;
        visits.push({
          date: session.date,
          time: session.start_time,
          title: classNameOf(session, opts.gym.class_types),
          status: b.status,
          source: 'fitgraph',
        });
      }
    }
  }

  for (const clinic of opts.clinics || []) {
    const patient = clinic.patients.find((p) =>
      personMatchesCustomer(p, c, clinic.module)
    );
    if (!patient) continue;
    kinds.add('clinic_patient');
    hrefs.push(`/dashboard/${clinic.module}/patients`);
    Object.assign(
      identity,
      mergeIdentity(identity, {
        platform_user_id: patient.platform_user_id,
        advisor_person_id: patient.id,
        advisor_module: clinic.module,
        crm_customer_id: patient.crm_customer_id || c.id,
      })
    );
    if (patient.family?.length) family.push(...patient.family);
    for (const b of clinic.bookings) {
      if (b.patient_id !== patient.id) continue;
      if (b.status === 'cancelled') continue;
      const appt = clinic.appointments.find((s) => s.id === b.appointment_id);
      if (!appt) continue;
      const svc = (clinic.services || []).find((s) => s.id === appt.class_type_id);
      visits.push({
        date: appt.date,
        time: appt.start_time,
        title: svc?.name || 'Consult',
        status: b.status,
        source: clinic.module,
      });
    }
  }

  if (opts.hire) {
    const mine = opts.hire.bookings.filter(
      (b) => Number(b.crm_customer_id) === Number(c.id)
    );
    if (mine.length) {
      kinds.add('hire_customer');
      hrefs.push('/dashboard/hiregraph/bookings');
      for (const b of mine) {
        if (!b.start_date) continue;
        visits.push({
          date: String(b.start_date).slice(0, 10),
          title: b.item_title || 'Hire',
          status: b.status || 'booked',
          source: 'hiregraph',
        });
      }
    }
  }

  if (opts.retail) {
    const shopper = opts.retail.customers.find((p) =>
      personMatchesCustomer(p, c, 'retailgraph')
    );
    if (shopper) {
      kinds.add('retail_customer');
      hrefs.push('/dashboard/retailgraph/customers');
      Object.assign(
        identity,
        mergeIdentity(identity, {
          advisor_person_id: shopper.id,
          advisor_module: 'retailgraph',
          crm_customer_id: shopper.crm_customer_id || c.id,
        })
      );
    }
  }

  const invoices = (opts.invoices || [])
    .filter(
      (inv) => !inv.customer_id || Number(inv.customer_id) === Number(c.id)
    )
    .map((inv) => ({
      id: inv.id,
      number: String(inv.invoice_number || inv.id),
      status: String(inv.status || 'sent'),
      total: Number(inv.total_amount || 0),
      paid: Number(inv.amount_paid || 0),
      due: inv.due_date || null,
    }));

  const open_ar = invoices
    .filter((i) => !['paid', 'void', 'cancelled', 'draft'].includes(i.status))
    .reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);

  visits.sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  const last_visit =
    [...visits].reverse().find((v) => v.date <= today && v.status !== 'cancelled') ||
    null;
  const next_session =
    visits.find(
      (v) =>
        v.date >= today &&
        !['cancelled', 'no_show', 'attended'].includes(v.status)
    ) || null;

  const events = (opts.events || [])
    .filter((e) => {
      if (identity.advisor_person_id && e.person_id === identity.advisor_person_id) {
        return true;
      }
      return false;
    })
    .slice(0, 12)
    .map((e) => ({
      at: e.at,
      type: e.type,
      summary: e.type.replace(/\./g, ' '),
    }));

  if (
    kinds.size > 1 &&
    kinds.has('trade') &&
    (kinds.has('gym_member') ||
      kinds.has('clinic_patient') ||
      kinds.has('hire_customer') ||
      kinds.has('retail_customer'))
  ) {
    kinds.delete('trade');
  }

  return {
    customer_id: c.id,
    name: c.trading_name,
    email: c.email || null,
    phone: c.phone || null,
    logo_url: c.logo_url || null,
    kinds: [...kinds],
    identity,
    memberships,
    debit_bank: debit,
    family,
    last_visit,
    next_session,
    invoices,
    open_ar,
    events,
    advisor_hrefs: [...new Set(hrefs)],
  };
}

export function summarizeCustomerKinds(
  rows: Array<{ kinds: CoreCustomerKind[] }>
): Record<string, number> {
  const out: Record<string, number> = {
    trade: 0,
    gym_member: 0,
    clinic_patient: 0,
    hire_customer: 0,
    retail_customer: 0,
  };
  for (const r of rows) {
    for (const k of r.kinds) out[k] = (out[k] || 0) + 1;
  }
  return out;
}

