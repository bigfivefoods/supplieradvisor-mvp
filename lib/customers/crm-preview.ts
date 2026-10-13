/**
 * Client-only sample book for an empty CRM walkthrough.
 * Negative ids never match a saved row. Nothing here is written to the database.
 */
import { buildCrmDesk, crmDeskCounts, crmToday, addCrmDays } from '@/lib/customers/crm-desk';
import type { CustomerRecord, LeadRecord, OpportunityRecord } from '@/lib/customers/types';
import { horizonScheduleEvents, type CrmTask, type DealHorizon } from '@/lib/sales/crm-tasks';
import type { Customer360 } from '@/lib/core-os/customer-360';

export const CRM_SAMPLE_FLAG = 'sa-crm-sample-book';

export function isCrmPreviewId(id: number | null | undefined): boolean {
  return typeof id === 'number' && Number.isFinite(id) && id < 0;
}

export type CrmTimelineItem = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone: 'brand' | 'neutral' | 'good' | 'warn';
};

export function customerActivity(input: {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  notes?: string | null;
  invite_status?: string | null;
  contact_name?: string | null;
  city?: string | null;
}): CrmTimelineItem[] {
  const items: CrmTimelineItem[] = [];
  if (input.created_at) {
    items.push({
      id: 'opened',
      at: input.created_at.slice(0, 10),
      title: 'Opened on the book',
      detail: `${input.name} joined the SupplierAdvisor® customer book`,
      tone: 'brand',
    });
  }
  if (input.contact_name) {
    items.push({
      id: 'contact',
      at: (input.updated_at || input.created_at || '').slice(0, 10) || '—',
      title: 'Primary contact',
      detail: input.contact_name + (input.city ? ` · ${input.city}` : ''),
      tone: 'neutral',
    });
  }
  const invite = (input.invite_status || '').toLowerCase();
  if (invite && invite !== 'not_invited') {
    items.push({
      id: 'invite',
      at: (input.updated_at || '').slice(0, 10) || '—',
      title: invite === 'accepted' ? 'Connected on the platform' : 'Invite ' + invite.replace(/_/g, ' '),
      detail:
        invite === 'accepted'
          ? 'Buyer can read shared documents on SupplierAdvisor®'
          : 'Platform invite is ' + invite.replace(/_/g, ' '),
      tone: invite === 'accepted' ? 'good' : invite === 'suspended' ? 'warn' : 'brand',
    });
  }
  const note = String(input.notes || '').trim();
  if (note) {
    items.push({
      id: 'note',
      at: (input.updated_at || input.created_at || '').slice(0, 10) || '—',
      title: 'Note',
      detail: note,
      tone: 'neutral',
    });
  }
  return items;
}

export function sortCrmRows<T>(rows: T[], pick: (row: T) => string, dir: 'asc' | 'desc' = 'asc'): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const cmp = pick(a).localeCompare(pick(b), undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
  return copy;
}

export type CrmPreviewBook = {
  today: string;
  summary: {
    customers: number;
    customersActive: number;
    leads: number;
    leadsOpen: number;
    opportunities: number;
    opportunitiesOpen: number;
    pipelineValue: number;
    weightedPipeline: number;
    wonValue: number;
    wonCount: number;
    overdueFollowups: number;
    invitePending: number;
    inviteAccepted: number;
    inviteSuspended: number;
  };
  desk: ReturnType<typeof buildCrmDesk>;
  customers: CustomerRecord[];
  leads: LeadRecord[];
  opportunities: OpportunityRecord[];
  tasks: CrmTask[];
  horizon: DealHorizon[];
  rows360: Customer360[];
  counts360: Record<string, number>;
};

export function crmPreviewBook(today = crmToday()): CrmPreviewBook {
  const ago = (days: number) => addCrmDays(today, -days);
  const ahead = (days: number) => addCrmDays(today, days);

  const customers: CustomerRecord[] = [
    {
      id: -1,
      trading_name: 'Harbour & Co',
      legal_name: 'Harbour and Company (Pty) Ltd',
      contact_name: 'Thandi Nkosi',
      email: 'thandi@harbourandco.example',
      phone: '+27 21 555 0142',
      status: 'active',
      customer_type: 'business',
      city: 'Cape Town',
      country: 'South Africa',
      industry: 'Food service',
      currency: 'ZAR',
      payment_terms: 'Net 30',
      credit_limit: 250000,
      vat_number: '4900000000',
      billing_address: '14 Jetty Street, V&A Waterfront',
      invite_status: 'accepted',
      notes: 'Prefers Tuesday delivery. Ask about the Super-Cube® leadership offsite in November.',
      created_at: ago(40),
      updated_at: ago(1),
    },
    {
      id: -2,
      trading_name: 'Limekiln Quarry',
      legal_name: 'Limekiln Aggregates',
      contact_name: 'Piet Botha',
      email: 'piet@limekiln.example',
      phone: '+27 12 555 0190',
      status: 'prospect',
      customer_type: 'business',
      city: 'Pretoria',
      country: 'South Africa',
      industry: 'Quarry',
      currency: 'ZAR',
      payment_terms: 'Net 14',
      invite_status: 'invited',
      notes: 'PPE and blasting accessories. Waiting on the site induction date.',
      created_at: ago(12),
      updated_at: ago(2),
    },
    {
      id: -3,
      trading_name: 'Noordhoek Clinic',
      contact_name: 'Dr Lerato Molefe',
      email: 'lerato@noordhoekclinic.example',
      phone: '+27 21 555 0177',
      status: 'active',
      customer_type: 'business',
      city: 'Cape Town',
      country: 'South Africa',
      industry: 'Clinical',
      currency: 'ZAR',
      payment_terms: 'Due on receipt',
      invite_status: 'not_invited',
      notes: 'Consumables every second Thursday.',
      created_at: ago(20),
      updated_at: today,
    },
    {
      id: -4,
      trading_name: 'Kaya Retail',
      contact_name: 'Sam Pillay',
      email: 'sam@kayaretail.example',
      phone: '+27 31 555 0118',
      status: 'on_hold',
      customer_type: 'business',
      city: 'Durban',
      country: 'South Africa',
      industry: 'Retail',
      currency: 'ZAR',
      payment_terms: 'Net 30',
      invite_status: 'suspended',
      notes: 'Credit hold until the March statement clears.',
      created_at: ago(60),
      updated_at: ago(6),
    },
  ];

  const leads: LeadRecord[] = [
    {
      id: -11,
      name: 'Amina Jacobs',
      company_name: 'Harbour & Co',
      email: 'amina@harbourandco.example',
      phone: '+27 21 555 0148',
      status: 'working',
      source: 'Referral',
      priority: 'high',
      value_estimate: 180000,
      currency: 'ZAR',
      score: 78,
      owner_name: 'Craig Muller',
      next_action: 'Confirm the tasting menu',
      next_action_date: ago(2),
      product_interest: 'Coastal hampers',
      city: 'Cape Town',
      notes: 'Referred by Thandi.',
    },
    {
      id: -12,
      name: 'Piet Botha',
      company_name: 'Limekiln Quarry',
      email: 'piet@limekiln.example',
      status: 'new',
      source: 'Trade show',
      priority: 'medium',
      value_estimate: 96000,
      currency: 'ZAR',
      score: 46,
      owner_name: 'Craig Muller',
      next_action: 'Send the PPE schedule',
      next_action_date: ahead(3),
      product_interest: 'PPE',
      city: 'Pretoria',
    },
    {
      id: -13,
      name: 'School feeding co-op',
      company_name: 'Peninsula Kitchens',
      email: 'orders@peninsulakitchens.example',
      status: 'qualified',
      source: 'Partner',
      priority: 'urgent',
      value_estimate: 420000,
      currency: 'ZAR',
      score: 88,
      owner_name: 'Craig Muller',
      next_action: 'Walk the kitchen',
      next_action_date: ahead(1),
      product_interest: 'NSNP staples',
      city: 'Cape Town',
    },
  ];

  const opportunities: OpportunityRecord[] = [
    {
      id: -21,
      name: 'Harbour annual supply',
      company_name: 'Harbour & Co',
      contact_name: 'Thandi Nkosi',
      customer_id: -1,
      stage: 'proposal',
      amount: 480000,
      currency: 'ZAR',
      probability: 60,
      weighted_amount: 288000,
      expected_close_date: ahead(6),
      next_step: 'Walk the revised quote',
      next_step_date: ahead(2),
      owner_name: 'Craig Muller',
      open_date: ago(18),
      opportunity_type: 'renewal',
    },
    {
      id: -22,
      name: 'Quarry PPE programme',
      company_name: 'Limekiln Quarry',
      contact_name: 'Piet Botha',
      customer_id: -2,
      stage: 'qualification',
      amount: 120000,
      currency: 'ZAR',
      probability: 20,
      weighted_amount: 24000,
      expected_close_date: ahead(12),
      next_step: 'Site induction',
      owner_name: 'Craig Muller',
      open_date: ago(9),
      opportunity_type: 'new_business',
    },
    {
      id: -23,
      name: 'Clinic consumables',
      company_name: 'Noordhoek Clinic',
      contact_name: 'Dr Lerato Molefe',
      customer_id: -3,
      stage: 'negotiation',
      amount: 86000,
      currency: 'ZAR',
      probability: 80,
      weighted_amount: 68800,
      expected_close_date: ago(1),
      next_step: 'Agree standing order',
      owner_name: 'Craig Muller',
      open_date: ago(15),
      opportunity_type: 'new_business',
    },
    {
      id: -24,
      name: 'Retail floor reset',
      company_name: 'Kaya Retail',
      contact_name: 'Sam Pillay',
      customer_id: -4,
      stage: 'prospecting',
      amount: 54000,
      currency: 'ZAR',
      probability: 10,
      weighted_amount: 5400,
      expected_close_date: ahead(20),
      next_step: 'Clear the credit hold',
      owner_name: 'Craig Muller',
      open_date: ago(4),
      opportunity_type: 'upsell',
    },
    {
      id: -25,
      name: 'Waterfront catering',
      company_name: 'Harbour & Co',
      contact_name: 'Thandi Nkosi',
      customer_id: -1,
      stage: 'closed_won',
      amount: 210000,
      currency: 'ZAR',
      probability: 95,
      weighted_amount: 199500,
      expected_close_date: ago(8),
      actual_close_date: ago(6),
      owner_name: 'Craig Muller',
      open_date: ago(30),
      opportunity_type: 'new_business',
    },
  ];

  const tasks: CrmTask[] = [
    {
      id: -31,
      profile_id: 91001,
      customer_id: -1,
      opportunity_id: -21,
      title: 'Call Thandi about the revised quote',
      notes: 'She wants the hamper line split out.',
      kind: 'call',
      status: 'open',
      due_on: ago(1),
      due_time: '09:30',
      assignee_user_id: 'demo-craig',
      assignee_name: 'Craig Muller',
      created_by: null,
      completed_at: null,
    },
    {
      id: -32,
      profile_id: 91001,
      customer_id: -2,
      opportunity_id: -22,
      title: 'Quarry site induction',
      notes: null,
      kind: 'meeting',
      status: 'open',
      due_on: ahead(3),
      due_time: '11:00',
      assignee_user_id: 'demo-craig',
      assignee_name: 'Craig Muller',
      created_by: null,
      completed_at: null,
    },
    {
      id: -33,
      profile_id: 91001,
      customer_id: -3,
      opportunity_id: -23,
      title: 'Send the standing-order draft',
      notes: null,
      kind: 'email',
      status: 'open',
      due_on: today,
      due_time: '15:00',
      assignee_user_id: 'demo-craig',
      assignee_name: 'Craig Muller',
      created_by: null,
      completed_at: null,
    },
  ];

  const counts = crmDeskCounts(leads, opportunities, today);
  const openLeads = leads.filter((l) => !['converted', 'unqualified', 'recycled'].includes(String(l.status))).length;
  const desk = buildCrmDesk({
    leads,
    opportunities,
    tasks,
    today,
  });

  const horizon: DealHorizon[] = opportunities.map((o) => ({
    id: o.id,
    name: o.name,
    customer_id: o.customer_id ?? null,
    company_name: o.company_name ?? null,
    stage: o.stage ?? null,
    expected_close_date: o.expected_close_date ?? null,
    next_step: o.next_step ?? null,
    next_step_date: o.next_step_date ?? null,
    owner_name: o.owner_name ?? null,
    sales_rep_user_id: null,
  }));

  const rows360: Customer360[] = customers.map((c) => ({
    customer_id: c.id,
    name: c.trading_name,
    email: c.email || null,
    phone: c.phone || null,
    party: 'business',
    customer_type: c.customer_type || 'business',
    kinds: c.id === -3 ? ['clinic_patient', 'trade'] : c.id === -4 ? ['retail_customer'] : ['trade'],
    identity: {
      crm_customer_id: c.id,
      email: c.email || null,
    },
    memberships:
      c.id === -3
        ? [
            {
              plan_id: 'consult',
              plan_name: 'Practice retainer',
              status: 'active',
              price_zar: 4200,
              period_end: ahead(18),
            },
          ]
        : [],
    debit_bank: c.id === -3 ? { ready: true, bank_name: 'FNB', masked: '•••• 4412', authorised: true } : null,
    family: [],
    last_visit:
      c.id === -3
        ? { date: ago(5), title: 'Consumables check', status: 'done', source: 'clinic' }
        : null,
    next_session:
      c.id === -1
        ? { date: ahead(2), title: 'Quote walkthrough', status: 'booked', source: 'diary' }
        : null,
    invoices:
      c.id === -1
        ? [
            { id: 'inv-1', number: 'INV-1042', status: 'open', total: 86400, paid: 0, due: ahead(10) },
            { id: 'inv-2', number: 'INV-0991', status: 'paid', total: 210000, paid: 210000, due: ago(6) },
          ]
        : c.id === -4
          ? [{ id: 'inv-4', number: 'INV-1008', status: 'overdue', total: 18600, paid: 0, due: ago(12) }]
          : [],
    open_ar: c.id === -1 ? 86400 : c.id === -4 ? 18600 : 0,
    events: [
      {
        at: ago(1),
        type: 'note',
        summary: c.notes || 'Account reviewed',
      },
      {
        at: c.created_at || ago(20),
        type: 'opened',
        summary: 'Added to the SupplierAdvisor® customer book',
      },
    ],
    advisor_hrefs: [],
  }));

  const counts360: Record<string, number> = {
    all: rows360.length,
    trade: rows360.filter((r) => r.kinds.includes('trade')).length,
    gym_member: 0,
    clinic_patient: rows360.filter((r) => r.kinds.includes('clinic_patient')).length,
    hire_customer: 0,
    retail_customer: rows360.filter((r) => r.kinds.includes('retail_customer')).length,
  };

  return {
    today,
    summary: {
      customers: customers.length,
      customersActive: customers.filter((c) => c.status === 'active').length,
      leads: leads.length,
      leadsOpen: openLeads,
      opportunities: opportunities.length,
      opportunitiesOpen: counts.opportunitiesOpen,
      pipelineValue: counts.pipelineValue,
      weightedPipeline: counts.weightedPipeline,
      wonValue: counts.wonValue,
      wonCount: counts.wonCount,
      overdueFollowups: counts.overdueFollowups,
      invitePending: customers.filter((c) => c.invite_status === 'invited').length,
      inviteAccepted: customers.filter((c) => c.invite_status === 'accepted').length,
      inviteSuspended: customers.filter((c) => c.invite_status === 'suspended').length,
    },
    desk,
    customers,
    leads,
    opportunities,
    tasks,
    horizon,
    rows360,
    counts360,
  };
}

/** Answers CRM GETs with the sample book. Returns null for anything else. */
export function crmPreviewJson(url: string): unknown | null {
  let path = url;
  let params = new URLSearchParams();
  try {
    const parsed = new URL(url, 'http://preview.local');
    path = parsed.pathname;
    params = parsed.searchParams;
  } catch {
    return null;
  }
  if (!path.startsWith('/api/')) return null;
  const book = crmPreviewBook();
  if (path.startsWith('/api/customers/summary')) {
    return { summary: book.summary, desk: book.desk };
  }
  if (path.startsWith('/api/customers/leads')) return { leads: book.leads };
  if (path.startsWith('/api/customers/opportunities')) {
    return { opportunities: book.opportunities, group: null };
  }
  if (path === '/api/customers') {
    const id = Number(params.get('id') || 0);
    if (id) {
      const found = book.customers.find((c) => c.id === id);
      return { success: true, customers: found ? [found] : [], book: Boolean(found) };
    }
    return { success: true, customers: book.customers, book: false };
  }
  if (path.startsWith('/api/accounting/parties')) return { parties: [] };
  if (path.startsWith('/api/business/team') || path.startsWith('/api/sales/team-members')) {
    return { members: [{ user_id: 'demo-craig', name: 'Craig Muller', email: 'craig@example.com' }] };
  }
  if (path.startsWith('/api/core/customer-360')) {
    return { rows: book.rows360, counts: book.counts360 };
  }
  if (path.startsWith('/api/sales/tasks')) {
    return {
      tasks: book.tasks,
      horizon: horizonScheduleEvents(book.horizon),
      apple: [],
      feed: null,
    };
  }
  if (path.startsWith('/api/audit/activity')) return { success: true, events: [] };
  return { success: true };
}
