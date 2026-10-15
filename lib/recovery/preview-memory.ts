import { harbourBatches, HARBOUR_AGENCY, HARBOUR_CREDITORS, HARBOUR_TEAM, HARBOUR_TODAY } from './harbour-seed';
import { fileSha256, parseBookCsv, suggestMapping, validateBook } from './import-book';
import { capabilitiesFor } from './roles';
import type { AllocationLabel, ProductType, RecoverBookStats, RecoverDeskPayload, RecoverRole } from './types';

export type MemoryContact = {
  kind: string;
  value: string;
  source: string;
  quality: string;
  do_not_contact: boolean;
  s129_delivery_method: string | null;
};

export type MemoryAccount = {
  id: string;
  ref: string;
  creditor_id: string;
  creditor_name: string;
  debtor_name: string;
  id_masked: string;
  balance_cents: number;
  principal_cents: number;
  interest_cents: number;
  fees_cents: number;
  costs_cents: number;
  adjustment_cents: number;
  original_cents: number;
  state: 'active' | 'recalled';
  flags: { key: string; reason: string }[];
  assignee: string | null;
  assignee_name: string | null;
  placed_at: string;
  batch_id: string;
  creditor_account_ref: string;
  contacts: MemoryContact[];
  notes: { at: string; text: string }[];
  events: { type: string; at: string; label: string }[];
  nca_regulated: boolean;
  product_type: string;
};

export type MemoryBatch = {
  id: string;
  creditor_id: string;
  creditor_name: string;
  file_name: string;
  file_sha256: string;
  status: 'imported' | 'rolled_back' | 'validating' | 'rejected';
  created: number;
  skipped: number;
  errors: { row: number; field: string; code: string }[];
  account_ids: string[];
};

export type MemoryExtraCreditor = { id: string; name: string; reg_no: string };
export type MemoryExtraMandate = {
  id: string;
  creditor_id: string;
  creditor_name: string;
  product_type: string;
  nca_regulated: boolean;
  status: string;
};

export type MemoryBook = {
  accounts: MemoryAccount[];
  batches: MemoryBatch[];
  next: number;
  extraCreditors?: MemoryExtraCreditor[];
  extraMandates?: MemoryExtraMandate[];
};

const TEAM_NAME: Record<string, string> = Object.fromEntries(HARBOUR_TEAM.map((row) => [row.key, row.name]));

export function harbourMemory(): MemoryBook {
  const accounts: MemoryAccount[] = [];
  const batches: MemoryBatch[] = [];
  let next = 1;
  for (const batch of harbourBatches()) {
    const batchId = `batch-${batch.key}`;
    const creditor = HARBOUR_CREDITORS.find((row) => row.key === batch.creditor_key) || HARBOUR_CREDITORS[0];
    const ids: string[] = [];
    batch.rows.forEach((row, index) => {
      const owner = HARBOUR_CREDITORS[(accounts.length) % HARBOUR_CREDITORS.length];
      const id = `acct-${batch.key}-${index}`;
      ids.push(id);
      const balance = row.principal_cents + row.interest_cents + row.fees_cents + row.costs_cents;
      accounts.push({
        id,
        ref: `RC-${String(next).padStart(6, '0')}`,
        creditor_id: owner.key,
        creditor_name: owner.name,
        debtor_name: row.display_name,
        id_masked: '••••••',
        balance_cents: balance,
        principal_cents: row.principal_cents,
        interest_cents: row.interest_cents,
        fees_cents: row.fees_cents,
        costs_cents: row.costs_cents,
        adjustment_cents: 0,
        original_cents: row.original_cents,
        state: 'active',
        flags: row.flag ? [{ key: row.flag, reason: 'Recorded on the demo book.' }] : [],
        assignee: row.assignee,
        assignee_name: row.assignee ? TEAM_NAME[row.assignee] : null,
        placed_at: `${batch.placed_on}T08:00:00.000Z`,
        batch_id: batchId,
        creditor_account_ref: row.creditor_account_ref,
        contacts: row.contacts.map((contact) => ({
          kind: contact.kind,
          value: contact.value,
          source: contact.source,
          quality: contact.quality,
          do_not_contact: contact.do_not_contact,
          s129_delivery_method: contact.s129_delivery_method,
        })),
        notes: [],
        events: [{ type: 'import', at: batch.placed_on, label: 'Imported' }],
        nca_regulated: owner.nca_regulated,
        product_type: owner.product_type,
      });
      next += 1;
    });
    batches.push({
      id: batchId,
      creditor_id: creditor.key,
      creditor_name: creditor.name,
      file_name: batch.file_name,
      file_sha256: batch.key.padEnd(64, '0'),
      status: 'imported',
      created: ids.length,
      skipped: 0,
      errors: [],
      account_ids: ids,
    });
  }
  return { accounts, batches, next };
}

export function rememberPreviewCreditor(book: MemoryBook, name: string, regNo: string): MemoryBook {
  const id = `extra-creditor-${book.next}`;
  return {
    ...book,
    next: book.next + 1,
    extraCreditors: [...(book.extraCreditors || []), { id, name, reg_no: regNo }],
  };
}

export function rememberPreviewMandate(
  book: MemoryBook,
  input: { creditor_id: string; creditor_name: string; product_type: string; nca_regulated: boolean }
): MemoryBook {
  const id = `extra-mandate-${book.next}`;
  return {
    ...book,
    next: book.next + 1,
    extraMandates: [
      ...(book.extraMandates || []),
      { id, ...input, status: 'draft' },
    ],
  };
}

export function emptyMemory(): MemoryBook {
  return { accounts: [], batches: [], next: 1 };
}

const HARBOUR_SESSION = 'recover-harbour-book';

export function readHarbourSession(): MemoryBook | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(HARBOUR_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemoryBook;
    if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.batches) || typeof parsed.next !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHarbourSession(book: MemoryBook) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(HARBOUR_SESSION, JSON.stringify(book));
}

export function clearHarbourSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(HARBOUR_SESSION);
}

export function bookStats(book: MemoryBook, role: RecoverRole): RecoverBookStats {
  const rows = visibleAccounts(book, role);
  const active = rows.filter((row) => row.state === 'active');
  return {
    placedCount: role === 'viewer' ? book.accounts.length : rows.length,
    placedBalanceCents: active.reduce((sum, row) => sum + row.balance_cents, 0),
    assignedCount: book.accounts.filter((row) => row.assignee).length,
    unassignedCount: book.accounts.filter((row) => !row.assignee && row.state === 'active').length,
    imported: book.batches.some((batch) => batch.status === 'imported'),
  };
}

export function visibleAccounts(book: MemoryBook, role: RecoverRole): MemoryAccount[] {
  if (role === 'viewer' || role === 'none') return [];
  if (role === 'agent') return book.accounts.filter((row) => row.assignee === 'pieter');
  if (role === 'finance' || role === 'compliance') {
    return book.accounts.map((row) => ({ ...row, contacts: [] }));
  }
  return book.accounts;
}

export function harbourDesk(role: RecoverRole, book: MemoryBook): RecoverDeskPayload {
  const caps = capabilitiesFor(role);
  const agent = role === 'agent';
  return {
    ready: true,
    workspace: {
      id: 'harbour-ws',
      company_id: 1,
      display_name: HARBOUR_AGENCY.display_name,
      operator_type: 'agency',
      programme_types: ['recovery'],
      trust_mode: 'trust',
      cfdc_registration_no: agent ? '' : HARBOUR_AGENCY.cfdc_registration_no,
      cfdc_expiry: '2027-06-15',
      vat_registered: false,
      vat_rate_bps: null,
      real_data_enabled: false,
      real_data_confirmed_by: null,
      real_data_confirmed_at: null,
      block_unregistered_assignment: true,
    },
    role,
    capabilities: caps,
    counts: agent
      ? { creditors: null, mandates: null, staff: null }
      : { creditors: HARBOUR_CREDITORS.length, mandates: HARBOUR_CREDITORS.length, staff: HARBOUR_TEAM.length },
    creditors: agent
      ? []
      : [
          ...HARBOUR_CREDITORS.map((row) => ({
          id: row.key,
          name: row.name,
          reg_no: row.reg_no,
          vat_no: row.vat_no,
          remittance_terms: row.remittance_terms,
          portal_enabled: false,
          status: 'active',
          customer_id: null,
          mandate_count: 1,
          account_count: book.accounts.filter((account) => account.creditor_id === row.key).length,
        })),
          ...(book.extraCreditors || []).map((row) => ({
            id: row.id,
            name: row.name,
            reg_no: row.reg_no,
            vat_no: '',
            remittance_terms: 'monthly' as const,
            portal_enabled: false,
            status: 'active',
            customer_id: null,
            mandate_count: (book.extraMandates || []).filter((item) => item.creditor_id === row.id).length,
            account_count: 0,
          })),
        ],
    mandates: agent || role === 'none'
      ? []
      : ([
          ...HARBOUR_CREDITORS.map((row) => ({
          id: `mandate-${row.key}`,
          creditor_id: row.key,
          creditor_name: row.name,
          programme_type: 'recovery' as const,
          product_type: row.product_type,
          nca_regulated: row.nca_regulated,
          processing_role: 'operator' as const,
          status: 'active',
          commission_model: { kind: row.commission_kind },
          allocation_order: ['costs', 'interest', 'fees', 'principal'],
          agreement_reference: row.agreement_reference,
          signed_on: row.signed_on,
        })),
          ...(book.extraMandates || []).map((row) => ({
            id: row.id,
            creditor_id: row.creditor_id,
            creditor_name: row.creditor_name,
            programme_type: 'recovery' as const,
            product_type: row.product_type as ProductType,
            nca_regulated: row.nca_regulated,
            processing_role: 'operator' as const,
            status: row.status,
            commission_model: { kind: 'flat_per_account' as const },
            allocation_order: ['costs', 'interest', 'fees', 'principal'] as AllocationLabel[],
          })),
        ] as RecoverDeskPayload['mandates']),
    staff: agent
      ? []
      : HARBOUR_TEAM.map((row) => ({
          id: row.key,
          email: row.email,
          role: row.role,
          status: 'active' as const,
          team_id: row.team,
          cfdc_registration_no: row.role === 'collector' ? 'DEMO-0000' : '',
          registration_status: 'recorded',
          monthly_target_cents: null,
          user_id: null,
          registration_expires_on: row.key === 'ryan' ? '2020-01-01' : '2027-06-15',
        })),
    self: agent
      ? {
          id: 'pieter',
          email: 'pieter.joubert@demo.example',
          role: 'collector',
          status: 'active',
          team_id: 'floor',
          cfdc_registration_no: 'DEMO-0000',
          registration_status: 'recorded',
          monthly_target_cents: null,
          user_id: null,
          registration_expires_on: '2027-06-15',
        }
      : null,
    book: bookStats(book, role),
  };
}

export async function commitPreviewCsv(
  book: MemoryBook,
  text: string,
  creditorId: string
): Promise<{ book: MemoryBook; code: 'imported' | 'already_imported' | 'invalid'; created: number; errors: { row: number; field: string; code: string }[] }> {
  const parsed = parseBookCsv(text);
  if (!parsed.ok) return { book, code: 'invalid', created: 0, errors: [{ row: 0, field: 'file', code: parsed.code }] };
  const sha = await fileSha256(text);
  if (book.batches.some((batch) => batch.file_sha256 === sha && batch.status === 'imported')) {
    return { book, code: 'already_imported', created: 0, errors: [] };
  }
  const mapping = suggestMapping(parsed.headers);
  const validated = validateBook(parsed, mapping, {
    today: HARBOUR_TODAY,
    existingRefs: book.accounts.filter((row) => row.creditor_id === creditorId).map((row) => row.creditor_account_ref),
  });
  const creditor = HARBOUR_CREDITORS.find((row) => row.key === creditorId) || HARBOUR_CREDITORS[0];
  const batchId = `batch-${sha.slice(0, 8)}`;
  let next = book.next;
  const created: MemoryAccount[] = validated.rows.map((row) => {
    const account: MemoryAccount = {
      id: `acct-${next}`,
      ref: `RC-${String(next).padStart(6, '0')}`,
      creditor_id: creditor.key,
      creditor_name: creditor.name,
      debtor_name: row.display_name,
      id_masked: '••••••',
      balance_cents: row.principal_cents + row.interest_cents + row.fees_cents + row.costs_cents,
      principal_cents: row.principal_cents,
      interest_cents: row.interest_cents,
      fees_cents: row.fees_cents,
      costs_cents: row.costs_cents,
      adjustment_cents: 0,
      original_cents: row.original_cents,
      state: 'active',
      flags: [],
      assignee: null,
      assignee_name: null,
      placed_at: `${HARBOUR_TODAY}T08:00:00.000Z`,
      batch_id: batchId,
      creditor_account_ref: row.creditor_account_ref,
      contacts: row.contacts,
      notes: [],
      events: [{ type: 'import', at: HARBOUR_TODAY, label: 'Imported' }],
      nca_regulated: creditor.nca_regulated,
      product_type: creditor.product_type,
    };
    next += 1;
    return account;
  });
  return {
    book: {
      ...book,
      accounts: [...book.accounts, ...created],
      batches: [
        ...book.batches,
        {
          id: batchId,
          creditor_id: creditor.key,
          creditor_name: creditor.name,
          file_name: 'upload.csv',
          file_sha256: sha,
          status: 'imported',
          created: created.length,
          skipped: validated.summary.already_placed,
          errors: validated.errors,
          account_ids: created.map((row) => row.id),
        },
      ],
      next,
    },
    code: 'imported',
    created: created.length,
    errors: validated.errors,
  };
}

export function rollbackPreview(book: MemoryBook, batchId: string): { book: MemoryBook; code: 'rolled_back' | 'rollback_refused' } {
  const batch = book.batches.find((row) => row.id === batchId);
  if (!batch || batch.status !== 'imported') return { book, code: 'rollback_refused' };
  const rows = book.accounts.filter((row) => batch.account_ids.includes(row.id));
  const blocked = rows.some((row) => row.notes.length > 0 || row.assignee || row.flags.length > 0 || row.events.length !== 1);
  if (blocked) return { book, code: 'rollback_refused' };
  return {
    book: {
      ...book,
      accounts: book.accounts.filter((row) => !batch.account_ids.includes(row.id)),
      batches: book.batches.map((row) => (row.id === batchId ? { ...row, status: 'rolled_back' as const } : row)),
    },
    code: 'rolled_back',
  };
}

export const SAMPLE_CSV = [
  'account number,debtor name,principal,phone,email',
  'DEMO-900,Sample Debtor,1234.56,0100000099,sample.debtor@demo.example',
  'DEMO-900,Sample Debtor,10.00,0100000099,sample.debtor@demo.example',
  'DEMO-901,Other Debtor,not-money,abc,bad',
].join('\n');
