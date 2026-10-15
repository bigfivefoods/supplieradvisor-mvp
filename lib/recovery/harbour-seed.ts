import { fictionalInvalidSaId } from './sa-id';
import type { CommissionKind, ProductType, StaffRole, StopFlag } from './types';

export const HARBOUR_TODAY = '2026-06-15';
export const HARBOUR_BANNER = 'Demo data. No messages are sent.';

export const HARBOUR_AGENCY = {
  display_name: 'Harbour Recoveries (Pty) Ltd',
  operator_type: 'agency' as const,
  cfdc_registration_no: 'DEMO-0000',
  city: 'Cape Town',
  trust_label: 'Harbour Trust (demo)',
};

export const HARBOUR_TEAM = [
  { key: 'amahle', name: 'Amahle Dlamini', email: 'amahle.dlamini@demo.example', role: 'manager' as StaffRole, team: 'floor' },
  { key: 'pieter', name: 'Pieter Joubert', email: 'pieter.joubert@demo.example', role: 'collector' as StaffRole, team: 'floor' },
  { key: 'naledi', name: 'Naledi Mokoena', email: 'naledi.mokoena@demo.example', role: 'collector' as StaffRole, team: 'floor' },
  { key: 'ryan', name: 'Ryan Pillay', email: 'ryan.pillay@demo.example', role: 'collector' as StaffRole, team: 'floor' },
  { key: 'zanele', name: 'Zanele Khumalo', email: 'zanele.khumalo@demo.example', role: 'finance_view' as StaffRole, team: null },
  { key: 'imran', name: 'Imran Davids', email: 'imran.davids@demo.example', role: 'compliance' as StaffRole, team: null },
] as const;

type CreditorSeed = {
  key: string;
  name: string;
  reg_no: string;
  vat_no: string;
  remittance_terms: 'monthly' | 'weekly' | 'on_receipt';
  product_type: ProductType;
  nca_regulated: boolean;
  commission_kind: CommissionKind;
  agreement_reference: string;
  signed_on: string;
};

export const HARBOUR_CREDITORS: readonly CreditorSeed[] = [
  {
    key: 'lighthouse',
    name: 'Lighthouse Retail Finance',
    reg_no: '2014/000111/07',
    vat_no: '4000000001',
    remittance_terms: 'monthly',
    product_type: 'nca_credit',
    nca_regulated: true,
    commission_kind: 'pct_of_recovered',
    agreement_reference: 'LRF-DEMO-1',
    signed_on: '2025-11-01',
  },
  {
    key: 'signal',
    name: 'Signal Hill Fitness Club',
    reg_no: '2018/000222/07',
    vat_no: '4000000002',
    remittance_terms: 'monthly',
    product_type: 'trade',
    nca_regulated: false,
    commission_kind: 'pct_of_recovered',
    agreement_reference: 'SHF-DEMO-1',
    signed_on: '2025-12-01',
  },
  {
    key: 'bayside',
    name: 'Bayside Body Corporate',
    reg_no: 'SS-000/2009',
    vat_no: '',
    remittance_terms: 'monthly',
    product_type: 'levy',
    nca_regulated: false,
    commission_kind: 'tiered',
    agreement_reference: 'BBC-DEMO-1',
    signed_on: '2026-01-15',
  },
  {
    key: 'karoo',
    name: 'Karoo Student Housing',
    reg_no: '2016/000333/07',
    vat_no: '4000000003',
    remittance_terms: 'on_receipt',
    product_type: 'rent',
    nca_regulated: false,
    commission_kind: 'flat_plus_pct',
    agreement_reference: 'KSH-DEMO-1',
    signed_on: '2026-02-01',
  },
  {
    key: 'kelp',
    name: 'Kelp Coast Medical Practice',
    reg_no: '2019/000444/07',
    vat_no: '4000000004',
    remittance_terms: 'weekly',
    product_type: 'medical',
    nca_regulated: false,
    commission_kind: 'pct_of_recovered',
    agreement_reference: 'KCM-DEMO-1',
    signed_on: '2026-03-01',
  },
];

const GIVEN = ['Lerato', 'Thabo', 'Nomsa', 'Elsabe', 'Sipho', 'Ayesha', 'Karel', 'Anika', 'Bongani', 'Fatima', 'Hendrik', 'Imani', 'Jaco', 'Karabo', 'Lindi', 'Mandla', 'Nadia', 'Owen', 'Palesa', 'Quinton'];
const FAMILY = ['Mahlangu', 'Naidoo', 'Botha', 'Sithole', 'Abrahams', 'Coetzee', 'Dube', 'Ebrahim', 'Fortuin', 'Gumede'];

const FLAG_AT: Record<number, StopFlag> = {
  3: 'debt_review',
  7: 'deceased',
  11: 'insolvency',
  13: 'represented',
  17: 'dispute',
  19: 'do_not_contact',
};

export type HarbourContact = {
  kind: 'phone' | 'email' | 'address';
  value: string;
  source: 'import';
  quality: 'unknown';
  consent: { phone: false; email: false; whatsapp: false; sms: false };
  do_not_contact: boolean;
  s129_delivery_method: 'registered_mail' | 'hand_delivery' | null;
};

export type HarbourRow = {
  row_number: number;
  creditor_account_ref: string;
  display_name: string;
  kind: 'person';
  first_names: string;
  last_name: string;
  company_name: string;
  id_type: 'sa_id';
  id_plain: string;
  principal_cents: number;
  interest_cents: number;
  fees_cents: number;
  costs_cents: number;
  original_cents: number;
  default_date: string;
  contacts: HarbourContact[];
  flag: StopFlag | null;
  assignee: 'pieter' | 'naledi' | 'ryan' | null;
};

export type HarbourBatch = {
  key: string;
  creditor_key: string;
  file_name: string;
  placed_on: string;
  rows: HarbourRow[];
};

function phone(n: number): string {
  return `+2710000${String(1000 + (n % 8000)).slice(-4)}`;
}

function rowFor(index: number, creditor: CreditorSeed): HarbourRow {
  const twin = index === 21;
  const n = twin ? 0 : index;
  const first = GIVEN[n % GIVEN.length];
  const last = FAMILY[Math.floor(n / GIVEN.length) % FAMILY.length];
  const principal = 150000 + ((n * 17321) % 4000000);
  const interest = creditor.nca_regulated ? Math.round(principal * 0.04) : 0;
  const fees = (n % 5) * 2500;
  const costs = (n % 7) * 1500;
  const contacts: HarbourContact[] = [
    {
      kind: 'phone',
      value: phone(n),
      source: 'import',
      quality: 'unknown',
      consent: { phone: false, email: false, whatsapp: false, sms: false },
      do_not_contact: false,
      s129_delivery_method: null,
    },
    {
      kind: 'email',
      value: `debtor${String(n + 1).padStart(2, '0')}@demo.example`,
      source: 'import',
      quality: 'unknown',
      consent: { phone: false, email: false, whatsapp: false, sms: false },
      do_not_contact: false,
      s129_delivery_method: null,
    },
  ];
  if (creditor.nca_regulated && n % 4 === 0) {
    contacts.push({
      kind: 'address',
      value: `${10 + (n % 80)} Demo Quay, Cape Town`,
      source: 'import',
      quality: 'unknown',
      consent: { phone: false, email: false, whatsapp: false, sms: false },
      do_not_contact: false,
      s129_delivery_method: n % 8 === 0 ? 'hand_delivery' : 'registered_mail',
    });
  }
  const assignees = ['pieter', 'naledi', 'ryan', null] as const;
  return {
    row_number: (index % 20) + 2,
    creditor_account_ref: `${creditor.key.slice(0, 3).toUpperCase()}-${String(1000 + index)}`,
    display_name: `${first} ${last}`,
    kind: 'person',
    first_names: first,
    last_name: last,
    company_name: '',
    id_type: 'sa_id',
    id_plain: fictionalInvalidSaId(n + 1),
    principal_cents: principal,
    interest_cents: interest,
    fees_cents: fees,
    costs_cents: costs,
    original_cents: principal + interest,
    default_date: n % 2 === 0 ? '2025-11-02' : '2026-01-20',
    contacts,
    flag: FLAG_AT[n % 20] || null,
    assignee: assignees[n % 4],
  };
}

export function harbourBatches(): HarbourBatch[] {
  const months = [
    { key: 'apr', placed_on: '2026-04-15', file_name: 'harbour-apr.csv' },
    { key: 'may', placed_on: '2026-05-15', file_name: 'harbour-may.csv' },
    { key: 'jun', placed_on: '2026-06-01', file_name: 'harbour-jun.csv' },
  ];
  return months.map((month, batchIndex) => {
    const rows: HarbourRow[] = [];
    for (let i = 0; i < 20; i += 1) {
      const creditor = HARBOUR_CREDITORS[(batchIndex + i) % HARBOUR_CREDITORS.length];
      rows.push(rowFor(batchIndex * 20 + i, creditor));
    }
    return {
      key: month.key,
      creditor_key: HARBOUR_CREDITORS[batchIndex].key,
      file_name: month.file_name,
      placed_on: month.placed_on,
      rows,
    };
  });
}

export function harbourBookPayload() {
  return {
    creditors: HARBOUR_CREDITORS.map((row) => ({
      key: row.key,
      name: row.name,
      reg_no: row.reg_no,
      vat_no: row.vat_no,
      remittance_terms: row.remittance_terms,
    })),
    mandates: HARBOUR_CREDITORS.map((row) => ({
      key: row.key,
      creditor_key: row.key,
      product_type: row.product_type,
      nca_regulated: row.nca_regulated,
      processing_role: 'operator' as const,
      agreement_reference: row.agreement_reference,
      signed_on: row.signed_on,
      commission_model: { kind: row.commission_kind },
      allocation_order: ['costs', 'interest', 'fees', 'principal'],
    })),
    batches: harbourBatches().map((batch) => ({
      creditor_key: batch.creditor_key,
      mandate_key: batch.creditor_key,
      file_name: batch.file_name,
      rows: batch.rows.map((row) => ({
        creditor_account_ref: row.creditor_account_ref,
        display_name: row.display_name,
        kind: row.kind,
        first_names: row.first_names,
        last_name: row.last_name,
        id_type: row.id_type,
        principal_cents: row.principal_cents,
        interest_cents: row.interest_cents,
        fees_cents: row.fees_cents,
        costs_cents: row.costs_cents,
        original_cents: row.original_cents,
        default_date: row.default_date,
        contacts: row.contacts,
        row_number: row.row_number,
      })),
    })),
  };
}
