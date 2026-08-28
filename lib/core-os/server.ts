/**
 * Load Core OS views from company metadata + Supabase.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadWalletCompany } from '@/lib/b2c/load-company';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { gymShopCatalog } from '@/lib/fitness/gym-shop';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';
import { readHiregraphFromMetadata } from '@/lib/hire/hiregraph';
import { readRetailgraphFromMetadata } from '@/lib/retail/retailgraph';
import { readAdvisorEvents } from '@/lib/services/advisor-events';
import { memberDebitBankComplete } from '@/lib/fitness/member-debit-bank';
import {
  assembleCustomer360,
  assembleLeftoverAdvisor360,
  collectAdvisorCustomerPeople,
  unsyncedAdvisorCustomerPeople,
  type Customer360,
  type LoosePerson,
} from './customer-360';
import { classifyCrmCustomer, customerKindMatches } from './kinds';
import {
  assemblePeople360,
  sessionPayLines,
  unsyncedAdvisorStaff,
  type People360,
} from './people';
import {
  windowsFromHrRequests,
  readLeaveBlocksFromMeta,
  type LeaveWindow,
} from './leave';
import {
  buildDebitOrderLines,
  debitOrderCsv,
  publicDebitLine,
  recurringInvoiceDrafts,
  splitInclusiveVat,
} from './finance';
import { overlayCompanyCalendar, weekBounds } from './calendar';
import {
  collectSharedSkuDrafts,
  findLinkedProduct,
  sharedSkuKey,
} from './sku';
import { intelligenceFromEvents } from './events';
import { reconcileIdentityClusters, type ReconcileRow } from './identity';

export async function loadCompanyMeta(companyId: number) {
  const company = await loadWalletCompany(companyId);
  return {
    name: company?.name || `Company #${companyId}`,
    meta: company?.meta || {},
  };
}

function clinicPatients(
  rows: Array<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    crm_customer_id?: number | null;
    platform_user_id?: string | null;
    family?: LoosePerson['family'];
  }>
): LoosePerson[] {
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email ?? null,
    phone: p.phone ?? null,
    crm_customer_id: p.crm_customer_id ?? null,
    platform_user_id: p.platform_user_id ?? null,
    family: p.family,
  }));
}

export function advisorStoresFromMeta(meta: Record<string, unknown>) {
  return {
    gym: readFitgraphFromMetadata(meta),
    physio: readPhysiographFromMetadata(meta),
    dental: readDentalgraphFromMetadata(meta),
    medical: readMedicalgraphFromMetadata(meta),
    psychiatry: readPsychiatrygraphFromMetadata(meta),
    vet: readVetgraphFromMetadata(meta),
    hire: readHiregraphFromMetadata(meta),
    retail: readRetailgraphFromMetadata(meta),
    events: readAdvisorEvents(meta),
  };
}

/** Same module rows the desks use (company_module_stores via RPC), not only wallet overlay. */
async function loadAdvisorStoresFor360(companyId: number) {
  const { name, meta } = await loadCompanyMeta(companyId);
  const stores = advisorStoresFromMeta(meta);
  try {
    const { loadAdvisorModuleStore } = await import(
      '@/lib/business/company-data'
    );
    const { loadFitgraphMerged } = await import('@/lib/fitness/fitgraph-io');
    const [gym, physio, dental, medical, psychiatry, vet, hire, retail] =
      await Promise.all([
        loadFitgraphMerged(companyId).catch(() => null),
        loadAdvisorModuleStore(
          companyId,
          'physiograph',
          readPhysiographFromMetadata
        ).catch(() => null),
        loadAdvisorModuleStore(
          companyId,
          'dentalgraph',
          readDentalgraphFromMetadata
        ).catch(() => null),
        loadAdvisorModuleStore(
          companyId,
          'medicalgraph',
          readMedicalgraphFromMetadata
        ).catch(() => null),
        loadAdvisorModuleStore(
          companyId,
          'psychiatrygraph',
          readPsychiatrygraphFromMetadata
        ).catch(() => null),
        loadAdvisorModuleStore(
          companyId,
          'vetgraph',
          readVetgraphFromMetadata
        ).catch(() => null),
        loadAdvisorModuleStore(
          companyId,
          'hiregraph',
          readHiregraphFromMetadata
        ).catch(() => null),
        loadAdvisorModuleStore(
          companyId,
          'retailgraph',
          readRetailgraphFromMetadata
        ).catch(() => null),
      ]);
    if (gym?.store) stores.gym = gym.store;
    if (physio?.store) stores.physio = physio.store;
    if (dental?.store) stores.dental = dental.store;
    if (medical?.store) stores.medical = medical.store;
    if (psychiatry?.store) stores.psychiatry = psychiatry.store;
    if (vet?.store) stores.vet = vet.store;
    if (hire?.store) stores.hire = hire.store;
    if (retail?.store) stores.retail = retail.store;
  } catch (err) {
    console.warn('[customer-360] module stores', err);
  }
  return { name, meta, stores };
}

async function loadCustomersAndInvoices(companyId: number) {
  const supabase = getSupabaseServer();
  const [{ data: customers }, { data: crmInvoices }, { data: glInvoices }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('*')
        .eq('profile_id', companyId)
        .order('trading_name')
        .limit(2000),
      supabase
        .from('customer_invoices')
        .select(
          'id, invoice_number, status, total_amount, amount_paid, due_date, notes, customer_id'
        )
        .eq('profile_id', companyId)
        .order('id', { ascending: false })
        .limit(400),
      supabase
        .from('invoices')
        .select(
          'id, invoice_number, status, total_amount, amount_paid, due_date, notes, customer_id, direction'
        )
        .eq('profile_id', companyId)
        .eq('direction', 'receivable')
        .order('id', { ascending: false })
        .limit(400),
    ]);
  const invoices = [
    ...(crmInvoices || []),
    ...(glInvoices || []).filter(
      (g) =>
        !(crmInvoices || []).some(
          (c) => String(c.invoice_number) === String(g.invoice_number)
        )
    ),
  ];
  return { customers: customers || [], invoices };
}

export async function loadCustomer360Bundle(
  companyId: number,
  opts?: { customerId?: number; kind?: string }
): Promise<{
  rows: Customer360[];
  counts: Record<string, number>;
  events: ReturnType<typeof readAdvisorEvents>;
}> {
  const { name: _n, meta, stores } = await loadAdvisorStoresFor360(companyId);
  let { customers, invoices } = await loadCustomersAndInvoices(companyId);
  const people = collectAdvisorCustomerPeople({
    gymClients: stores.gym.clients || [],
    clinics: [
      { module: 'physiograph', patients: stores.physio.patients || [] },
      { module: 'dentalgraph', patients: stores.dental.patients || [] },
      { module: 'medicalgraph', patients: stores.medical.patients || [] },
      { module: 'psychiatrygraph', patients: stores.psychiatry.patients || [] },
      { module: 'vetgraph', patients: stores.vet.patients || [] },
    ],
    retailCustomers: (stores.retail.customers || []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      crm_customer_id: c.crm_customer_id ?? null,
    })),
  });
  const customerRefs = () =>
    customers.map((c) => ({
      id: Number(c.id),
      email: c.email ? String(c.email) : null,
      notes: c.notes ? String(c.notes) : null,
    }));
  const missing = unsyncedAdvisorCustomerPeople(people, customerRefs());
  if (missing.length) {
    try {
      const { ensureAdvisorCrmCustomer } = await import(
        '@/lib/b2c/member-account-ar'
      );
      const deadline = Date.now() + 2500;
      let created = 0;
      for (const row of missing) {
        if (created >= 40 || Date.now() > deadline) break;
        const crm = await ensureAdvisorCrmCustomer({
          companyId,
          name: row.person.name,
          email: row.person.email || null,
          phone: row.person.phone || null,
          kind: row.kind,
          refId: row.person.id,
          skipPartyGl: true,
        });
        if (crm?.id) {
          row.person.crm_customer_id = crm.id;
          created += 1;
        }
      }
      if (created) {
        const { ensurePartyGlAccountsSafe } = await import(
          '@/lib/accounting/party-gl-accounts'
        );
        await ensurePartyGlAccountsSafe(companyId);
        const reloaded = await loadCustomersAndInvoices(companyId);
        customers = reloaded.customers;
        invoices = reloaded.invoices;
      }
    } catch (err) {
      console.warn('[customer-360] CRM backfill', err);
    }
  }
  const clinics = [
    {
      module: 'physiograph',
      patients: clinicPatients(stores.physio.patients || []),
      appointments: (stores.physio.appointments || []).map((a) => ({
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        class_type_id: a.service_id,
        status: a.status,
      })),
      bookings: (stores.physio.bookings || []).map((b) => ({
        id: b.id,
        appointment_id: b.appointment_id,
        patient_id: b.patient_id,
        status: b.status,
      })),
      services: (stores.physio.services || []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    },
    {
      module: 'dentalgraph',
      patients: clinicPatients(stores.dental.patients || []),
      appointments: (stores.dental.appointments || []).map((a) => ({
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        class_type_id: a.service_id,
        status: a.status,
      })),
      bookings: (stores.dental.bookings || []).map((b) => ({
        id: b.id,
        appointment_id: b.appointment_id,
        patient_id: b.patient_id,
        status: b.status,
      })),
      services: (stores.dental.services || []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    },
    {
      module: 'medicalgraph',
      patients: clinicPatients(stores.medical.patients || []),
      appointments: (stores.medical.appointments || []).map((a) => ({
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        class_type_id: a.service_id,
        status: a.status,
      })),
      bookings: (stores.medical.bookings || []).map((b) => ({
        id: b.id,
        appointment_id: b.appointment_id,
        patient_id: b.patient_id,
        status: b.status,
      })),
      services: (stores.medical.services || []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    },
    {
      module: 'psychiatrygraph',
      patients: clinicPatients(stores.psychiatry.patients || []),
      appointments: (stores.psychiatry.appointments || []).map((a) => ({
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        class_type_id: a.service_id,
        status: a.status,
      })),
      bookings: (stores.psychiatry.bookings || []).map((b) => ({
        id: b.id,
        appointment_id: b.appointment_id,
        patient_id: b.patient_id,
        status: b.status,
      })),
      services: (stores.psychiatry.services || []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    },
    {
      module: 'vetgraph',
      patients: clinicPatients(stores.vet.patients || []),
      appointments: (stores.vet.appointments || []).map((a) => ({
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        class_type_id: a.service_id,
        status: a.status,
      })),
      bookings: (stores.vet.bookings || []).map((b) => ({
        id: b.id,
        appointment_id: b.appointment_id,
        patient_id: b.patient_id,
        status: b.status,
      })),
      services: (stores.vet.services || []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    },
  ];

  let list = customers;
  if (opts?.customerId) {
    list = list.filter((c) => Number(c.id) === Number(opts.customerId));
  }

  const gymBundle = {
    clients: stores.gym.clients || [],
    subscriptions: stores.gym.subscriptions || [],
    plans: stores.gym.membership_plans || [],
    sessions: stores.gym.sessions || [],
    bookings: stores.gym.bookings || [],
    class_types: stores.gym.class_types || [],
  };
  const assembleOpts = {
    invoices,
    gym: gymBundle,
    clinics,
    hire: { bookings: stores.hire.bookings || [] },
    retail: {
      customers: (stores.retail.customers || []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        crm_customer_id: c.crm_customer_id ?? null,
      })),
    },
    events: stores.events,
  };

  const rows: Customer360[] = list.map((c) =>
    assembleCustomer360({
      customer: {
        id: Number(c.id),
        trading_name: String(c.trading_name || c.contact_name || 'Customer'),
        email: c.email,
        phone: c.phone,
        source: c.source,
        notes: c.notes,
        customer_type: c.customer_type,
        linked_profile_id: c.linked_profile_id,
        logo_url: (c as { logo_url?: string | null }).logo_url || null,
      },
      ...assembleOpts,
    })
  );

  if (!opts?.customerId) {
    rows.push(
      ...assembleLeftoverAdvisor360(
        unsyncedAdvisorCustomerPeople(people, customerRefs()),
        assembleOpts
      )
    );
  }

  const filtered = opts?.kind
    ? rows.filter((r) => r.kinds.some((k) => customerKindMatches(k, opts.kind!)))
    : rows;

  const counts: Record<string, number> = {
    all: rows.length,
    trade: 0,
    gym_member: 0,
    clinic_patient: 0,
    hire_customer: 0,
    retail_customer: 0,
  };
  for (const r of rows) {
    for (const k of r.kinds) counts[k] = (counts[k] || 0) + 1;
  }

  return { rows: filtered, counts, events: stores.events };
}

export async function loadPeople360Bundle(companyId: number): Promise<{
  rows: People360[];
  unsynced: Array<{ id: string; name: string; module: string; email?: string | null }>;
  pay: ReturnType<typeof sessionPayLines>;
  leave: LeaveWindow[];
}> {
  const supabase = getSupabaseServer();
  const { meta } = await loadCompanyMeta(companyId);
  const stores = advisorStoresFromMeta(meta);
  const [{ data: employees }, { data: leaveRows }] = await Promise.all([
    supabase
      .from('employees')
      .select('*')
      .eq('profile_id', companyId)
      .limit(400),
    supabase
      .from('hr_leave_requests')
      .select('*')
      .eq('profile_id', companyId)
      .limit(300),
  ]);
  const emps = employees || [];
  const leave = [
    ...windowsFromHrRequests(leaveRows || [], emps),
    ...readLeaveBlocksFromMeta(meta),
  ];
  const rows = emps.map((e) => {
    const metaE =
      e.metadata && typeof e.metadata === 'object'
        ? (e.metadata as Record<string, unknown>)
        : {};
    const module = metaE.service_module ? String(metaE.service_module) : null;
    const personId = metaE.service_person_id
      ? String(metaE.service_person_id)
      : null;
    let staff = null;
    if (module === 'fitgraph' && personId) {
      staff = (stores.gym.coaches || []).find((c) => c.id === personId) || null;
    }
    return assemblePeople360({
      employee: {
        id: Number(e.id),
        full_name: String(e.full_name || ''),
        email: e.email,
        employment_type: e.employment_type,
        hourly_rate: e.hourly_rate,
        metadata: metaE,
      },
      staff,
      module,
      leave,
    });
  });

  const staffAll = [
    ...(stores.gym.coaches || []).map((c) => ({
      ...c,
      module: 'fitgraph',
      email: c.email || null,
    })),
    ...(stores.physio.practitioners || []).map((c) => ({
      ...c,
      module: 'physiograph',
      email: c.email || null,
    })),
    ...(stores.dental.staff || []).map((c) => ({
      ...c,
      module: 'dentalgraph',
      email: c.email || null,
    })),
    ...(stores.medical.practitioners || []).map((c) => ({
      ...c,
      module: 'medicalgraph',
      email: c.email || null,
    })),
    ...(stores.psychiatry.practitioners || []).map((c) => ({
      ...c,
      module: 'psychiatrygraph',
      email: c.email || null,
    })),
    ...(stores.vet.practitioners || []).map((c) => ({
      ...c,
      module: 'vetgraph',
      email: c.email || null,
    })),
  ];
  const unsynced = unsyncedAdvisorStaff(staffAll, emps).map((s) => ({
    id: s.id,
    name: s.name,
    module: s.module,
    email: s.email || null,
  }));

  const from = new Date();
  from.setDate(1);
  const to = new Date();
  const pay = sessionPayLines({
    staff: staffAll,
    sessions: [
      ...(stores.gym.sessions || []).map((s) => ({
        id: s.id,
        coach_id: s.coach_id,
        date: s.date,
        status: s.status,
        duration_min: s.duration_min,
      })),
      ...(stores.physio.appointments || []).map((a) => ({
        id: a.id,
        practitioner_id: a.practitioner_id,
        date: a.date,
        status: a.status,
        duration_min: a.duration_min,
      })),
    ],
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });

  return { rows, unsynced, pay, leave };
}

export async function loadCompanyCalendarBundle(
  companyId: number,
  from?: string,
  to?: string
) {
  const bounds = from && to ? { from, to } : weekBounds();
  const supabase = getSupabaseServer();
  const { meta } = await loadCompanyMeta(companyId);
  const stores = advisorStoresFromMeta(meta);
  const [{ data: leaveRows }, { data: employees }, { data: pos }] =
    await Promise.all([
      supabase
        .from('hr_leave_requests')
        .select('*')
        .eq('profile_id', companyId)
        .eq('status', 'approved')
        .limit(200),
      supabase
        .from('employees')
        .select('id, full_name, metadata')
        .eq('profile_id', companyId)
        .limit(400),
      supabase
        .from('purchase_orders')
        .select('id, po_number, status, created_at')
        .eq('buyer_profile_id', companyId)
        .limit(80),
    ]);
  const empName = new Map(
    (employees || []).map((e) => [Number(e.id), String(e.full_name || '')])
  );
  const events = overlayCompanyCalendar({
    from: bounds.from,
    to: bounds.to,
    gym: {
      sessions: stores.gym.sessions || [],
      coaches: stores.gym.coaches || [],
      class_types: stores.gym.class_types || [],
    },
    clinics: [
      {
        module: 'physiograph',
        appointments: stores.physio.appointments || [],
        staff: stores.physio.practitioners || [],
        services: stores.physio.services || [],
      },
      {
        module: 'dentalgraph',
        appointments: (stores.dental.appointments || []).map((a) => ({
          ...a,
          practitioner_id: a.staff_id,
        })),
        staff: stores.dental.staff || [],
        services: stores.dental.services || [],
      },
      {
        module: 'medicalgraph',
        appointments: stores.medical.appointments || [],
        staff: stores.medical.practitioners || [],
        services: stores.medical.services || [],
      },
      {
        module: 'psychiatrygraph',
        appointments: stores.psychiatry.appointments || [],
        staff: stores.psychiatry.practitioners || [],
        services: stores.psychiatry.services || [],
      },
      {
        module: 'vetgraph',
        appointments: stores.vet.appointments || [],
        staff: stores.vet.practitioners || [],
        services: stores.vet.services || [],
      },
    ],
    hire: { bookings: stores.hire.bookings || [] },
    leave: (leaveRows || []).map((r) => ({
      id: r.id,
      employee_id: Number(r.employee_id),
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
      reason: r.reason,
      person_name: empName.get(Number(r.employee_id)),
    })),
    deliveries: (pos || []).map((p) => ({
      id: p.id,
      due_date: p.created_at ? String(p.created_at).slice(0, 10) : null,
      expected_date: p.created_at ? String(p.created_at).slice(0, 10) : null,
      supplier_name: null,
      po_number: p.po_number,
      status: p.status,
    })),
  });
  return { ...bounds, events };
}

export async function loadDebitBatchBundle(companyId: number) {
  const { name, meta } = await loadCompanyMeta(companyId);
  const stores = advisorStoresFromMeta(meta);
  const clients = stores.gym.clients || [];
  const lines = buildDebitOrderLines({
    companySlug: name,
    members: clients,
    subscriptions: stores.gym.subscriptions || [],
    plans: stores.gym.membership_plans || [],
  });
  const missing = clients.filter(
    (c) =>
      c.active !== false &&
      (stores.gym.subscriptions || []).some(
        (s) => s.client_id === c.id && s.status === 'active'
      ) &&
      !memberDebitBankComplete(c)
  );
  const actionDate = new Date().toISOString().slice(0, 10);
  return {
    lines: lines.map(publicDebitLine),
    raw_lines: lines,
    csv: debitOrderCsv(lines, actionDate),
    action_date: actionDate,
    ready: lines.length,
    missing: missing.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email || null,
    })),
    vat_sample: lines[0] ? splitInclusiveVat(lines[0].amount_zar) : null,
  };
}

export async function loadSharedSkuBundle(companyId: number) {
  const supabase = getSupabaseServer();
  const { meta } = await loadCompanyMeta(companyId);
  const stores = advisorStoresFromMeta(meta);
  let gym = stores.gym;
  try {
    const { loadAdvisorModuleStore } = await import(
      '@/lib/business/company-data'
    );
    const loaded = await loadAdvisorModuleStore(
      companyId,
      'fitgraph',
      readFitgraphFromMetadata
    );
    if ((loaded.store.membership_plans || []).length) {
      gym = loaded.store;
    }
  } catch {
    /* metadata fallback */
  }
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, sell_price, category, metadata')
    .eq('profile_id', companyId)
    .limit(500);
  const drafts = collectSharedSkuDrafts({
    gymShop: gymShopCatalog(gym),
    retail: stores.retail.skus || [],
    hire: (stores.hire.items || []).map((i) => ({
      id: i.id,
      title: i.title,
      sku: i.code,
      rate_zar: i.rate_zar,
    })),
  });
  const list = (products || []) as Array<{
    id: number;
    name: string;
    sku?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  return {
    drafts: drafts.map((d) => ({
      ...d,
      key: sharedSkuKey(d.source, d.source_id),
      linked: findLinkedProduct(list, d),
    })),
    products: list,
  };
}

export async function loadIdentityBundle(companyId: number) {
  const supabase = getSupabaseServer();
  const { meta } = await loadCompanyMeta(companyId);
  const stores = advisorStoresFromMeta(meta);
  const [{ data: customers }, { data: employees }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, trading_name, email')
      .eq('profile_id', companyId)
      .limit(400),
    supabase
      .from('employees')
      .select('id, full_name, email, metadata')
      .eq('profile_id', companyId)
      .limit(400),
  ]);
  const rows: ReconcileRow[] = [
    ...(customers || []).map((c) => ({
      kind: 'customer' as const,
      id: String(c.id),
      name: String(c.trading_name || ''),
      email: c.email,
      crm_customer_id: Number(c.id),
    })),
    ...(employees || []).map((e) => ({
      kind: 'employee' as const,
      id: String(e.id),
      name: String(e.full_name || ''),
      email: e.email,
      hr_employee_id: Number(e.id),
    })),
    ...(stores.gym.clients || []).map((c) => ({
      kind: 'advisor' as const,
      id: c.id,
      name: c.name,
      email: c.email,
      platform_user_id: c.platform_user_id,
      crm_customer_id: c.crm_customer_id ?? null,
    })),
  ];
  return { clusters: reconcileIdentityClusters(rows), rows: rows.length };
}

export async function loadAdvisorInsights(companyId: number) {
  const { meta } = await loadCompanyMeta(companyId);
  const stores = advisorStoresFromMeta(meta);
  const clients = stores.gym.clients || [];
  const debitReady = clients.filter((c) => memberDebitBankComplete(c)).length;
  const debitMissing = clients.filter(
    (c) =>
      c.active !== false &&
      (stores.gym.subscriptions || []).some(
        (s) => s.client_id === c.id && s.status === 'active'
      ) &&
      !memberDebitBankComplete(c)
  ).length;
  return intelligenceFromEvents(stores.events, { debitReady, debitMissing });
}

export { classifyCrmCustomer };
