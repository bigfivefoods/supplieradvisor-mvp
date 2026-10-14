/**
 * Read-only layout for a CRM customer or SRM supplier profile.
 * Every section is always present. Blank fields stay visible as empty states.
 * Nothing here writes to the database.
 */
import { formatMoney } from '@/lib/customers/types';
import type { CustomerRecord } from '@/lib/customers/types';
import { mergePortalDocSlots } from '@/lib/portals/portal-documents';
import { srmPortalDocuments } from '@/lib/suppliers/book-profile';
import {
  otifefBand,
  trustBand,
  type SrmSupplierRecord,
  type SupplierOtifefRow,
} from '@/lib/suppliers/types';
import { externalWalletLabel } from '@/lib/business/company-wallet';

export const EMPTY_FIELD = 'Not on file';

export type DossierKind = 'customer' | 'supplier';

export type DossierChip = {
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral' | 'brand';
};

export type DossierStat = {
  label: string;
  value: string;
};

export type DossierFact = {
  label: string;
  value: string | null;
  href?: string | null;
};

export type DossierPerson = {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
};

export type DossierLine = {
  id: string;
  kind: 'quote' | 'order' | 'invoice' | 'purchase_order';
  number: string;
  status: string;
  amountLabel: string;
  when: string | null;
  href: string | null;
};

export type DossierDoc = {
  id: string;
  name: string;
  state: 'on_file' | 'missing';
  href: string | null;
};

export type DossierEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string | null;
};

export type DossierSection = {
  id:
    | 'identity'
    | 'contacts'
    | 'addresses'
    | 'registration'
    | 'commercial'
    | 'credit'
    | 'ledger'
    | 'documents'
    | 'scorecard'
    | 'activity'
    | 'notes';
  title: string;
  empty: string;
  facts: DossierFact[];
  people: DossierPerson[];
  lines: DossierLine[];
  docs: DossierDoc[];
  events: DossierEvent[];
  tags: string[];
  note: string | null;
};

export type ProfileDossier = {
  kind: DossierKind;
  title: string;
  legalName: string | null;
  eyebrow: string;
  logoUrl: string | null;
  chips: DossierChip[];
  stats: DossierStat[];
  sections: DossierSection[];
  fullHref: string;
  fullLabel: string;
};

export type CustomerDossierInput = {
  lines?: DossierLine[];
  openAr?: number | null;
  activity?: DossierEvent[];
  ledgerState?: 'ready' | 'loading' | 'error';
  books?: { role?: string | null; ar?: string | null; ap?: string | null };
};

export type SupplierDossierInput = {
  lines?: DossierLine[];
  vault?: DossierDoc[];
  scorecard?: Partial<SupplierOtifefRow> | null;
  activity?: DossierEvent[];
  ledgerState?: 'ready' | 'loading' | 'error';
  books?: { role?: string | null; ar?: string | null; ap?: string | null };
};

const CUSTOMER_SECTIONS = [
  'identity',
  'contacts',
  'addresses',
  'registration',
  'commercial',
  'credit',
  'ledger',
  'documents',
  'activity',
  'notes',
] as const;

const SUPPLIER_SECTIONS = [
  'identity',
  'contacts',
  'addresses',
  'registration',
  'commercial',
  'credit',
  'ledger',
  'documents',
  'scorecard',
  'activity',
  'notes',
] as const;

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function text(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  return value ? value : null;
}

function day(raw: unknown): string | null {
  const value = text(raw);
  if (!value) return null;
  return value.slice(0, 10);
}

export function telHref(phone: string | null | undefined): string | null {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const compact = raw.replace(/[^\d+]/g, '');
  return compact.length >= 6 ? `tel:${compact}` : null;
}

export function mailHref(email: string | null | undefined): string | null {
  const raw = String(email || '').trim();
  if (!raw.includes('@') || raw.includes(' ')) return null;
  return `mailto:${raw}`;
}

function webHref(url: string | null | undefined): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function metaString(meta: unknown, keys: string[]): string | null {
  const root = asRecord(meta);
  const book = asRecord(root.book_profile);
  for (const key of keys) {
    const value = text(root[key]) || text(book[key]);
    if (value) return value;
  }
  return null;
}

function tagsFrom(meta: unknown, direct?: string[] | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: unknown) => {
    const label = text(value);
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };
  for (const tag of direct || []) push(tag);
  const raw = asRecord(meta).tags;
  if (Array.isArray(raw)) raw.forEach(push);
  return out;
}

function peopleFromMetadata(meta: unknown): DossierPerson[] {
  const raw = asRecord(meta).contacts ?? asRecord(meta).people;
  if (!Array.isArray(raw)) return [];
  const people: DossierPerson[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const name = text(row.name || row.contact_name);
    const email = text(row.email);
    const phone = text(row.phone);
    const role = text(row.role || row.job_title || row.title);
    if (!name && !email && !phone) return;
    people.push({
      id: `extra-${index}`,
      name,
      role,
      email,
      phone,
    });
  });
  return people;
}

function sameContact(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function money(amount: number | null | undefined, currency?: string | null): string | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return formatMoney(Number(amount), currency || 'ZAR');
}

function fact(label: string, value: string | null, href?: string | null): DossierFact {
  return { label, value, href: value ? href || null : null };
}

function section(
  id: DossierSection['id'],
  title: string,
  empty: string,
  patch: Partial<DossierSection> = {}
): DossierSection {
  return {
    id,
    title,
    empty,
    facts: patch.facts || [],
    people: patch.people || [],
    lines: patch.lines || [],
    docs: patch.docs || [],
    events: patch.events || [],
    tags: patch.tags || [],
    note: patch.note ?? null,
  };
}

function heldCustomer(c: CustomerRecord): boolean {
  return (
    String(c.notes || '').toLowerCase().includes('[credit hold]') ||
    String(c.status || '').toLowerCase() === 'credit_hold' ||
    String(c.status || '').toLowerCase() === 'on_hold'
  );
}

function chipTone(status: string | null | undefined): DossierChip['tone'] {
  const s = String(status || '').toLowerCase();
  if (['active', 'preferred', 'accepted', 'verified'].includes(s)) return 'good';
  if (['prospect', 'invited'].includes(s)) return 'brand';
  if (['on_hold', 'credit_hold', 'suspended', 'blocked'].includes(s)) return 'bad';
  if (['inactive', 'archived', 'declined', 'expired'].includes(s)) return 'neutral';
  return 'neutral';
}

function labelize(raw: string | null | undefined, fallback: string): string {
  const value = text(raw);
  if (!value) return fallback;
  return value.replace(/_/g, ' ');
}

function complianceDocs(row: Record<string, unknown>): DossierDoc[] {
  return mergePortalDocSlots({ profileRow: row, metadata: row.metadata }).map((doc) => ({
    id: doc.field,
    name: doc.name,
    state: doc.url ? 'on_file' : 'missing',
    href: doc.url,
  }));
}

function ledgerEmpty(kind: DossierKind, state: 'ready' | 'loading' | 'error'): string {
  if (state === 'loading') {
    return kind === 'customer'
      ? 'Loading quotes, orders, and invoices…'
      : 'Loading purchase orders…';
  }
  if (state === 'error') {
    return 'Recent documents could not be loaded. The rest of this record is still here.';
  }
  return kind === 'customer'
    ? 'No quotes, orders, or invoices on this record yet.'
    : 'No purchase orders on this record yet.';
}

export function customerLedgerLines(input: {
  quotes?: unknown[];
  orders?: unknown[];
  invoices?: unknown[];
  customerId?: number | null;
}): DossierLine[] {
  const href = input.customerId
    ? {
        quote: `/dashboard/customers/quotes?customerId=${input.customerId}`,
        order: `/dashboard/customers/orders?customerId=${input.customerId}`,
        invoice: `/dashboard/customers/invoices?customerId=${input.customerId}`,
      }
    : { quote: '/dashboard/customers/quotes', order: '/dashboard/customers/orders', invoice: '/dashboard/customers/invoices' };

  const map = (
    rows: unknown[] | undefined,
    kind: 'quote' | 'order' | 'invoice',
    numberKey: string
  ): DossierLine[] =>
    (rows || []).map((row, index) => {
      const rec = asRecord(row);
      const number =
        text(rec[numberKey]) ||
        text(rec.number) ||
        text(rec.enquiry_number) ||
        `${kind} ${index + 1}`;
      const total = Number(rec.total_amount ?? rec.total);
      return {
        id: `${kind}-${text(rec.id) || index}`,
        kind,
        number,
        status: labelize(text(rec.status), 'open'),
        amountLabel: Number.isFinite(total)
          ? formatMoney(total, text(rec.currency) || 'ZAR')
          : EMPTY_FIELD,
        when: day(rec.created_at || rec.due_date || rec.due),
        href: href[kind],
      };
    });

  return [
    ...map(input.quotes, 'quote', 'quote_number'),
    ...map(input.orders, 'order', 'order_number'),
    ...map(input.invoices, 'invoice', 'invoice_number'),
  ];
}

export function supplierLedgerLines(
  rows: unknown[] | undefined,
  supplierId: number
): DossierLine[] {
  return (rows || [])
    .filter((row) => {
      const rec = asRecord(row);
      const meta = asRecord(rec.metadata);
      const id = Number(rec.supplier_id || meta.srm_supplier_id || 0);
      return id === supplierId;
    })
    .map((row, index) => {
      const rec = asRecord(row);
      const total = Number(rec.total_amount ?? rec.total);
      return {
        id: `po-${text(rec.id) || index}`,
        kind: 'purchase_order' as const,
        number: text(rec.po_number) || text(rec.number) || `PO ${index + 1}`,
        status: labelize(text(rec.status), 'draft'),
        amountLabel: Number.isFinite(total)
          ? formatMoney(total, text(rec.currency) || 'ZAR')
          : EMPTY_FIELD,
        when: day(rec.created_at),
        href: `/dashboard/suppliers/po?supplierId=${supplierId}`,
      };
    });
}

export function customerDossier(
  customer: CustomerRecord,
  extras: CustomerDossierInput = {}
): ProfileDossier {
  const meta = customer.metadata;
  const bee = metaString(meta, ['bee_level', 'bbbee_level', 'bee']);
  const held = heldCustomer(customer);
  const currency = text(customer.currency) || 'ZAR';
  const limit =
    customer.credit_limit != null && Number(customer.credit_limit) > 0
      ? Number(customer.credit_limit)
      : null;
  const openAr = extras.openAr == null ? null : Number(extras.openAr);
  const available =
    limit != null && openAr != null && Number.isFinite(openAr) ? limit - openAr : null;
  const primary: DossierPerson = {
    id: 'primary',
    name: text(customer.contact_name),
    role: text(customer.job_title),
    email: text(customer.email),
    phone: text(customer.phone),
  };
  const extrasPeople = peopleFromMetadata(meta).filter(
    (person) =>
      !sameContact(person.email, primary.email) && !sameContact(person.name, primary.name)
  );
  const people = [primary, ...extrasPeople];
  const ledgerState = extras.ledgerState || 'ready';
  const docs = complianceDocs(customer as unknown as Record<string, unknown>);
  const place = [text(customer.city), text(customer.country)].filter(Boolean).join(', ');

  const sections: DossierSection[] = [
    section('identity', 'Identity', 'No identity fields on this record.', {
      facts: [
        fact('Trading name', text(customer.trading_name)),
        fact('Legal name', text(customer.legal_name)),
        fact('Type', text(customer.customer_type)),
        fact('Industry', text(customer.industry)),
        fact('Website', text(customer.website), webHref(customer.website)),
        fact('Source', text(customer.source)),
        fact('Owner', text(customer.owner_name)),
        fact(
          'Rating',
          customer.rating != null && Number(customer.rating) > 0
            ? Number(customer.rating).toFixed(1)
            : null
        ),
        fact('Opened', day(customer.created_at)),
        fact('Updated', day(customer.updated_at)),
        fact('Invite', text(customer.invite_status) ? labelize(customer.invite_status, '') : null),
        fact('Invited email', text(customer.invited_email), mailHref(customer.invited_email)),
      ],
    }),
    section('contacts', 'Contact people', 'No contact people on file.', { people }),
    section('addresses', 'Addresses', 'No addresses on file.', {
      facts: [
        fact('Billing', text(customer.billing_address)),
        fact('Shipping', text(customer.shipping_address)),
        fact('City', text(customer.city)),
        fact('Province', text(customer.province) || text(customer.region)),
        fact('Postal code', text(customer.postal_code)),
        fact('Country', text(customer.country)),
        fact('Continent', text(customer.continent)),
      ],
    }),
    section('registration', 'Registration, tax, and B-BBEE', 'No registration details on file.', {
      facts: [
        fact('VAT number', text(customer.vat_number)),
        fact('Registration number', text(customer.registration_number)),
        fact('B-BBEE level', bee),
        fact('Tax reference', metaString(meta, ['tax_number', 'tax_reference'])),
      ],
    }),
    section('commercial', 'Commercial terms', 'No commercial terms on file.', {
      facts: [
        fact('Payment terms', text(customer.payment_terms)),
        fact('Currency', text(customer.currency)),
        fact('Books role', text(extras.books?.role)),
        fact('Accounts receivable', text(extras.books?.ar)),
        fact('Accounts payable', text(extras.books?.ap)),
      ],
    }),
    section('credit', 'Credit and balances', 'No credit position on file.', {
      facts: [
        fact('Credit limit', money(limit, currency)),
        fact('Open balance', openAr == null ? null : money(openAr, currency)),
        fact('Available', available == null ? null : money(available, currency)),
        fact('Credit hold', held ? 'Yes' : 'No'),
      ],
    }),
    section('ledger', 'Quotes, orders, and invoices', ledgerEmpty('customer', ledgerState), {
      lines: extras.lines || [],
    }),
    section('documents', 'Documents and compliance', 'No compliance documents on file.', {
      docs,
    }),
    section('activity', 'Activity', 'No activity on this record yet.', {
      events: extras.activity || [],
    }),
    section('notes', 'Notes and tags', 'No notes or tags on this record.', {
      note: text(customer.notes),
      tags: tagsFrom(meta),
    }),
  ];

  return {
    kind: 'customer',
    title: text(customer.trading_name) || 'Customer',
    legalName: text(customer.legal_name),
    eyebrow: 'Customer profile',
    logoUrl: text(customer.logo_url),
    chips: [
      { label: labelize(customer.status, 'Active'), tone: chipTone(customer.status) },
      {
        label: labelize(customer.invite_status, 'Not invited'),
        tone: chipTone(customer.invite_status),
      },
      ...(held ? [{ label: 'Credit hold', tone: 'bad' as const }] : []),
    ],
    stats: [
      { label: 'Terms', value: text(customer.payment_terms) || EMPTY_FIELD },
      { label: 'Credit', value: money(limit, currency) || EMPTY_FIELD },
      { label: 'Place', value: place || EMPTY_FIELD },
    ],
    sections: sections.filter((item) =>
      (CUSTOMER_SECTIONS as readonly string[]).includes(item.id)
    ),
    fullHref: `/dashboard/customers/360?id=${customer.id}`,
    fullLabel: 'Open Customer 360',
  };
}

export function supplierDossier(
  supplier: SrmSupplierRecord,
  extras: SupplierDossierInput = {}
): ProfileDossier {
  const meta = supplier.metadata;
  const bee = text(supplier.bee_level) || metaString(meta, ['bee_level', 'bbbee_level']);
  const primary: DossierPerson = {
    id: 'primary',
    name: text(supplier.contact_name),
    role: text(supplier.job_title),
    email: text(supplier.email),
    phone: text(supplier.phone),
  };
  const people = [
    primary,
    ...peopleFromMetadata(meta).filter(
      (person) =>
        !sameContact(person.email, primary.email) && !sameContact(person.name, primary.name)
    ),
  ];
  const ledgerState = extras.ledgerState || 'ready';
  const pack = srmPortalDocuments(supplier).map((doc) => ({
    id: doc.field,
    name: doc.name,
    state: doc.url ? ('on_file' as const) : ('missing' as const),
    href: doc.url,
  }));
  const seen = new Set(pack.map((doc) => doc.id));
  const docs = [
    ...pack,
    ...(extras.vault || []).filter((doc) => !seen.has(doc.id)),
  ];
  const score = extras.scorecard;
  const otifef = score?.overall ?? supplier.otifef_pct;
  const band = otifefBand(Number(otifef || 0));
  const trust = trustBand(Number(supplier.trust_score || 0));
  const place = [text(supplier.city), text(supplier.country)].filter(Boolean).join(', ');
  const certs = (supplier.certifications || []).map((item) => text(item)).filter(Boolean) as string[];

  const sections: DossierSection[] = [
    section('identity', 'Identity', 'No identity fields on this record.', {
      facts: [
        fact('Trading name', text(supplier.trading_name)),
        fact('Legal name', text(supplier.legal_name)),
        fact('Industry', text(supplier.industry)),
        fact('Sub-industry', text(supplier.sub_industry)),
        fact('Category', text(supplier.category)),
        fact('Website', text(supplier.website), webHref(supplier.website)),
        fact('Owner', text(supplier.owner_name)),
        fact('Verified', supplier.verified ? 'Yes' : 'No'),
        fact('Opened', day(supplier.created_at)),
        fact('Updated', day(supplier.updated_at)),
        fact('Invite', text(supplier.invite_status) ? labelize(supplier.invite_status, '') : null),
        fact('Wallet', externalWalletLabel(supplier)),
        fact('On-chain', day(supplier.onchain_registered_at)),
      ],
    }),
    section('contacts', 'Contact people', 'No contact people on file.', { people }),
    section('addresses', 'Addresses', 'No addresses on file.', {
      facts: [
        fact('Street', text(supplier.address)),
        fact('City', text(supplier.city)),
        fact('Province', text(supplier.province) || text(supplier.region)),
        fact('Postal code', text(supplier.postal_code)),
        fact('Country', text(supplier.country)),
        fact('Continent', text(supplier.continent)),
      ],
    }),
    section('registration', 'Registration, tax, and B-BBEE', 'No registration details on file.', {
      facts: [
        fact('VAT number', text(supplier.vat_number)),
        fact('Registration number', text(supplier.registration_number)),
        fact('B-BBEE level', bee),
        fact('Certifications', certs.length ? certs.join(', ') : null),
      ],
    }),
    section('commercial', 'Commercial terms', 'No commercial terms on file.', {
      facts: [
        fact('Payment terms', text(supplier.payment_terms)),
        fact('Books role', text(extras.books?.role)),
        fact('Accounts receivable', text(extras.books?.ar)),
        fact('Accounts payable', text(extras.books?.ap)),
      ],
    }),
    section('credit', 'Credit and balances', 'No credit facility is stored on a supplier record.', {
      facts: [
        fact('Credit limit', null),
        fact('Open balance', null),
        fact('Payment terms', text(supplier.payment_terms)),
      ],
    }),
    section('ledger', 'Purchase orders', ledgerEmpty('supplier', ledgerState), {
      lines: extras.lines || [],
    }),
    section('documents', 'Documents and compliance', 'No compliance documents on file.', {
      docs,
    }),
    section('scorecard', 'OTIFEF and trust', 'No scorecard on this supplier yet.', {
      facts: [
        fact('OTIFEF', otifef == null ? null : `${Number(otifef).toFixed(0)}%`),
        fact('Band', otifef == null ? null : band.label),
        fact('On time', score?.ot_percent == null ? null : `${Number(score.ot_percent).toFixed(0)}%`),
        fact('In full', score?.if_percent == null ? null : `${Number(score.if_percent).toFixed(0)}%`),
        fact(
          'Error free',
          score?.ef_percent == null ? null : `${Number(score.ef_percent).toFixed(0)}%`
        ),
        fact(
          'Purchase orders scored',
          score?.total_pos == null ? null : String(score.total_pos)
        ),
        fact(
          'Trust',
          supplier.trust_score == null ? null : `${Number(supplier.trust_score).toFixed(0)} · ${trust.label}`
        ),
        fact(
          'Rating',
          supplier.rating_avg == null
            ? null
            : `${Number(supplier.rating_avg).toFixed(1)} (${Number(supplier.rating_count || 0)})`
        ),
      ],
    }),
    section('activity', 'Activity', 'No activity on this record yet.', {
      events: extras.activity || [],
    }),
    section('notes', 'Notes and tags', 'No notes or tags on this record.', {
      note: text(supplier.notes),
      tags: tagsFrom(meta, supplier.tags),
    }),
  ];

  return {
    kind: 'supplier',
    title: text(supplier.trading_name) || 'Supplier',
    legalName: text(supplier.legal_name),
    eyebrow: 'Supplier profile',
    logoUrl: text(supplier.logo_url),
    chips: [
      { label: labelize(supplier.status, 'Prospect'), tone: chipTone(supplier.status) },
      {
        label: labelize(supplier.invite_status, 'Not invited'),
        tone: chipTone(supplier.invite_status),
      },
      ...(supplier.verified ? [{ label: 'Verified', tone: 'good' as const }] : []),
      ...(supplier.connection_suspended
        ? [{ label: 'Suspended', tone: 'bad' as const }]
        : []),
    ],
    stats: [
      {
        label: 'OTIFEF',
        value: otifef == null ? EMPTY_FIELD : `${Number(otifef).toFixed(0)}%`,
      },
      {
        label: 'Trust',
        value:
          supplier.trust_score == null ? EMPTY_FIELD : Number(supplier.trust_score).toFixed(0),
      },
      { label: 'Place', value: place || EMPTY_FIELD },
    ],
    sections: sections.filter((item) =>
      (SUPPLIER_SECTIONS as readonly string[]).includes(item.id)
    ),
    fullHref: '/dashboard/suppliers/performance',
    fullLabel: 'Open scorecard',
  };
}

export function dossierSection(
  dossier: ProfileDossier,
  id: DossierSection['id']
): DossierSection | undefined {
  return dossier.sections.find((item) => item.id === id);
}
