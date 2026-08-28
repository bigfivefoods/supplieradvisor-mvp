/**
 * Named customer AR and supplier AP leaves so bank allocation can
 * pick a party instead of dumping receipts into 4100 Sales.
 *
 * IAS 1: assets and income are not the same class. IFRS 9: each trade
 * receivable / payable is a financial instrument. IFRS 15: income hits
 * 4100/4200/4400 when the performance obligation is satisfied.
 *
 * 1130 / 2110 stay posting control leaves (invoice-gl requires that).
 * Customers: 1180 header (current asset) + 1180-0000001 … (one leaf per customer).
 * Suppliers: 2180 header (current liability) + 2180-0000001 … (one leaf per supplier).
 * Legacy 1181+ / 2181+ integer leaves and 4400-* AR codes still parse.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { invalidateAccountingReads } from '@/lib/accounting/read-cache';
import { ttlGet, ttlSet } from '@/lib/system/memory-ttl';
import type { CoaAccount } from '@/lib/accounting/types';
import {
  DEFAULT_PARTY_LEDGER,
  parsePartyLedgerStored,
  resolvePartyLedgerParents,
  type PartyLedgerParents,
} from '@/lib/accounting/party-ledger-settings';

export const PARTY_AR_CODE_START = 1181;
export const PARTY_AP_CODE_START = 2181;
export const PARTY_AR_PREFIX = 'AR — ';
export const PARTY_AP_PREFIX = 'AP — ';

/** Current-asset header under 1100. Each customer is 1180-0000001 … */
export const MEMBER_AR_HEADER_CODE = '1180';
export const MEMBER_AR_HEADER_NAME = 'Customers';
export const CUSTOMER_AR_HEADER_CODE = MEMBER_AR_HEADER_CODE;
export const CUSTOMER_AR_HEADER_NAME = MEMBER_AR_HEADER_NAME;
/** Pre-IFRS nest under revenue — still accepted for bank match / metadata. */
export const MEMBER_AR_LEGACY_HEADER_CODE = '4400';
export const MEMBER_AR_CODE_PAD = 7;

/** IFRS 15 membership / care income — not a receivable. */
export const MEMBERSHIP_REVENUE_CODE = '4400';
export const MEMBERSHIP_REVENUE_NAME = 'Membership & care revenue';
export const MEMBER_REV_HEADER_CODE = MEMBERSHIP_REVENUE_CODE;
export const MEMBER_REV_HEADER_NAME = MEMBERSHIP_REVENUE_NAME;
export const MEMBER_REV_PREFIX = 'Member — ';

/** Current-liability header under 2100. Each supplier is 2180-0000001 … */
export const SUPPLIER_AP_HEADER_CODE = '2180';
export const SUPPLIER_AP_HEADER_NAME = 'Suppliers';

function paddedPartyCode(header: string, id: number): string {
  const n = Math.abs(Math.trunc(Number(id) || 0));
  if (!(n > 0)) return '';
  return `${header}-${String(n).padStart(MEMBER_AR_CODE_PAD, '0')}`;
}

function parsePaddedPartyId(code: string, headers: string[]): number | null {
  const want = headers.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const m = new RegExp(`^(?:${want})-(\\d+)$`).exec(String(code || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Stable AR sub-account, e.g. customer 1 under 1180 → 1180-0000001. */
export function memberArAccountCode(
  customerId: number,
  headerCode: string = MEMBER_AR_HEADER_CODE
): string {
  return paddedPartyCode(headerCode || MEMBER_AR_HEADER_CODE, customerId);
}

export function legacyMemberArAccountCode(customerId: number): string {
  return paddedPartyCode(MEMBER_AR_LEGACY_HEADER_CODE, customerId);
}

export function parseMemberArCustomerId(code: string): number | null {
  return parsePaddedPartyId(code, [
    MEMBER_AR_HEADER_CODE,
    MEMBER_AR_LEGACY_HEADER_CODE,
  ]);
}

export function isMemberArAccountCode(code?: string | null): boolean {
  return parseMemberArCustomerId(String(code || '')) != null;
}

/** Stable AP sub-account, e.g. supplier 8 under 2180 → 2180-0000008. */
export function supplierApAccountCode(
  supplierId: number,
  headerCode: string = SUPPLIER_AP_HEADER_CODE
): string {
  return paddedPartyCode(headerCode || SUPPLIER_AP_HEADER_CODE, supplierId);
}

export function parseHyphenSubAccount(
  code: string
): { header: string; id: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(String(code || '').trim());
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { header: m[1], id };
}

export function isHyphenSubAccountCode(code?: string | null): boolean {
  return parseHyphenSubAccount(String(code || '')) != null;
}

export function parseSupplierApSupplierId(code: string): number | null {
  const hyphen = parseHyphenSubAccount(code);
  if (!hyphen) return null;
  return hyphen.id;
}

export function isSupplierApAccountCode(code?: string | null): boolean {
  const hyphen = parseHyphenSubAccount(String(code || ''));
  return Boolean(hyphen && hyphen.header === SUPPLIER_AP_HEADER_CODE);
}

/**
 * IAS 1 tree: customer 1180-* under 1180; leftover 1181+ under 1130;
 * suppliers 2180-* / 2181+ under 2180. Never parent AR under 4400.
 */
export function statementParentForPartyLeaf(
  code: string,
  mappingParent?: string | null
): string {
  const c = String(code || '').trim();
  const hyphen = parseHyphenSubAccount(c);
  if (hyphen) {
    if (
      hyphen.header === MEMBER_AR_HEADER_CODE ||
      hyphen.header === MEMBER_AR_LEGACY_HEADER_CODE
    ) {
      return MEMBER_AR_HEADER_CODE;
    }
    if (hyphen.header === SUPPLIER_AP_HEADER_CODE) {
      return SUPPLIER_AP_HEADER_CODE;
    }
    if (hyphen.header === MEMBERSHIP_REVENUE_CODE) {
      return MEMBER_AR_HEADER_CODE;
    }
    return hyphen.header;
  }
  if (/^\d+$/.test(c)) {
    const n = Number(c);
    if (n >= 1181 && n < 2000) return '1130';
    if (n >= 2181 && n < 3000) return SUPPLIER_AP_HEADER_CODE;
  }
  const mapped = String(mappingParent || '').trim();
  if (mapped === MEMBERSHIP_REVENUE_CODE) return MEMBER_AR_HEADER_CODE;
  if (mapped) return mapped;
  return MEMBER_AR_HEADER_CODE;
}

export function isPartyStatementLeaf(code: string): boolean {
  const c = String(code || '').trim();
  if (isMemberArAccountCode(c) || isSupplierApAccountCode(c)) return true;
  if (isHyphenSubAccountCode(c)) return true;
  if (/^\d+$/.test(c)) {
    const n = Number(c);
    return (n >= 1181 && n < 2000) || (n >= 2181 && n < 3000);
  }
  return false;
}

const SKIP_STATUS = new Set([
  'inactive',
  'archived',
  'closed',
  'deleted',
  'void',
]);

/** Wallet / walk-in shoppers are not trade buyers. Gym/clinic people still
 *  get named AR via isAdvisorParty. */
const SKIP_CUSTOMER_TYPES = new Set([
  'consumer',
  'member',
  'patient',
  'walk_in',
]);
const SKIP_SOURCES = new Set([
  'sa_member_wallet',
  'member_app_qr',
  'advisor_member',
]);

const PARTY_GL_CACHE_MS = 120_000;
const partyGlCacheKey = (profileId: number) => `party-gl:${profileId}`;

const CONTROL_AR = new Set(['1130', '1135']);
const CONTROL_AP = new Set(['2110']);

export type PartyBookRow = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  name?: string | null;
  status?: string | null;
  customer_type?: string | null;
  source?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PartyCoaRow = {
  id: number;
  code: string;
  name: string;
  account_type?: string | null;
  subtype?: string | null;
  is_header?: boolean | null;
  is_active?: boolean | null;
  parent_id?: number | null;
};

export type PartyGlCreate = {
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'revenue';
  subtype: 'receivable' | 'payable' | 'service' | 'header';
  normal_balance: 'debit' | 'credit';
  description: string;
  metadata: Record<string, unknown>;
  sort_order: number;
  is_header?: boolean;
  parent_code?: string | null;
};

export type PartyGlLink = {
  table: 'customers' | 'srm_suppliers';
  id: number;
  kind: 'ar' | 'ap' | 'revenue';
  key: string;
  name: string;
  code: string;
  accountId: number | null;
};

export function normalizePartyKey(name: string): string {
  let s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  s = s.replace(
    /\b(pty|ltd|limited|limmited|npc|npo|cc|inc|incorporated|the)\b/g,
    ' '
  );
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s+group$/, '');
  return s;
}

export function partyDisplayName(row: {
  trading_name?: string | null;
  legal_name?: string | null;
  name?: string | null;
}): string {
  return String(row.trading_name || row.legal_name || row.name || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSkippedPartyStatus(status?: string | null): boolean {
  return SKIP_STATUS.has(String(status || '').trim().toLowerCase());
}

export function isTradeParty(row: PartyBookRow): boolean {
  if (!row?.id || isSkippedPartyStatus(row.status)) return false;
  if (SKIP_CUSTOMER_TYPES.has(String(row.customer_type || '').trim().toLowerCase())) {
    return false;
  }
  if (SKIP_SOURCES.has(String(row.source || '').trim().toLowerCase())) {
    return false;
  }
  return Boolean(partyDisplayName(row));
}

/** Gym members / clinic patients / shoppers — named AR under 1180. */
export function isAdvisorParty(row: PartyBookRow): boolean {
  if (!row?.id || isSkippedPartyStatus(row.status)) return false;
  if (!partyDisplayName(row)) return false;
  const source = String(row.source || '').trim().toLowerCase();
  if (source === 'advisor_member' || source.startsWith('advisor_')) return true;
  if (String(row.notes || '').includes('advisor_ref:')) return true;
  const t = String(row.customer_type || '').trim().toLowerCase();
  return t === 'member' || t === 'patient' || t === 'hirer';
}

/** New invoices post to the named party account when one exists. */
export function pickRecognitionControlAccount(
  partyAccountId: number | null | undefined,
  fallbackId: number | null | undefined
): number | null {
  const party = Number(partyAccountId || 0);
  if (party > 0) return party;
  const fallback = Number(fallbackId || 0);
  return fallback > 0 ? fallback : null;
}

/**
 * Settlement must hit the same AR/AP leaf the invoice was recognised to.
 * Old invoices without a stamp stay on 1130 / 2110.
 */
export function pickSettlementControlAccount(
  stampedId: number | null | undefined,
  fallbackId: number | null | undefined
): number | null {
  const stamped = Number(stampedId || 0);
  if (stamped > 0) return stamped;
  const fallback = Number(fallbackId || 0);
  return fallback > 0 ? fallback : null;
}

function stripPartyPrefix(name: string): string {
  return String(name || '')
    .replace(/^AR\s+[—-]\s+/i, '')
    .replace(/^AP\s+[—-]\s+/i, '')
    .replace(/^Member\s+[—-]\s+/i, '')
    .trim();
}

export function isCustomerAllocAccount(a: PartyCoaRow): boolean {
  if (a.is_header || a.is_active === false) return false;
  const code = String(a.code || '');
  if (CONTROL_AR.has(code)) return code === '1130';
  if (isMemberArAccountCode(code) || isHyphenSubAccountCode(code)) {
    if (String(a.subtype || '').toLowerCase() === 'payable') return false;
    if (String(a.account_type || '').toLowerCase() === 'liability') return false;
    return true;
  }
  if (String(a.subtype || '').toLowerCase() === 'receivable') return true;
  return /^AR\s+[—-]\s+/i.test(String(a.name || ''));
}

export function isSupplierAllocAccount(a: PartyCoaRow): boolean {
  if (a.is_header || a.is_active === false) return false;
  const code = String(a.code || '');
  if (CONTROL_AP.has(code)) return code === '2110';
  if (isSupplierApAccountCode(code) || isHyphenSubAccountCode(code)) {
    if (String(a.subtype || '').toLowerCase() === 'receivable') return false;
    if (String(a.account_type || '').toLowerCase() === 'asset') return false;
    return String(a.subtype || '').toLowerCase() === 'payable' ||
      String(a.account_type || '').toLowerCase() === 'liability' ||
      isSupplierApAccountCode(code);
  }
  if (String(a.subtype || '').toLowerCase() === 'payable') return true;
  return /^AP\s+[—-]\s+/i.test(String(a.name || ''));
}

export function isNamedPartyAccount(a: PartyCoaRow): boolean {
  const name = String(a.name || '');
  return (
    /^AR\s+[—-]\s+/i.test(name) ||
    /^AP\s+[—-]\s+/i.test(name) ||
    /^Member\s+[—-]\s+/i.test(name)
  );
}

export function nextFreeCode(used: Set<string>, start: number): string {
  let n = start;
  while (used.has(String(n))) n += 1;
  return String(n);
}

function findExistingPartyAccount(
  coa: PartyCoaRow[],
  kind: 'ar' | 'ap' | 'revenue',
  key: string,
  displayName: string
): PartyCoaRow | null {
  const prefix =
    kind === 'ar'
      ? PARTY_AR_PREFIX
      : kind === 'ap'
        ? PARTY_AP_PREFIX
        : MEMBER_REV_PREFIX;
  const want = `${prefix}${displayName}`;
  const byName = coa.find(
    (a) => !a.is_header && a.is_active !== false && String(a.name) === want
  );
  if (byName) return byName;
  return (
    coa.find((a) => {
      if (a.is_header || a.is_active === false) return false;
      const name = String(a.name || '');
      if (kind === 'ar' && !/^AR\s+[—-]\s+/i.test(name)) return false;
      if (kind === 'ap' && !/^AP\s+[—-]\s+/i.test(name)) return false;
      if (kind === 'revenue' && !/^Member\s+[—-]\s+/i.test(name)) return false;
      return normalizePartyKey(stripPartyPrefix(name)) === key;
    }) || null
  );
}

function findHeaderByCode(
  coa: PartyCoaRow[],
  code: string,
  name?: string
): PartyCoaRow | null {
  return (
    coa.find(
      (a) => a.is_active !== false && String(a.code) === code
    ) ||
    (name
      ? coa.find(
          (a) =>
            a.is_header &&
            a.is_active !== false &&
            String(a.name) === name
        )
      : null) ||
    null
  );
}

function asCoaView(
  coa: PartyCoaRow[],
  create: PartyGlCreate[]
): PartyCoaRow[] {
  return [
    ...coa,
    ...create.map((c, idx) => ({
      id: -1 - idx,
      code: c.code,
      name: c.name,
      is_header: c.is_header || false,
      is_active: true as boolean | null,
      account_type: c.account_type,
    })),
  ];
}

function linkedGlCode(row: PartyBookRow): string {
  return String(asRecord(row.metadata).gl_account_code || '').trim();
}

function isContractorSupplier(row: PartyBookRow): boolean {
  const notes = String(row.notes || '');
  if (notes.includes('advisor_ap:')) return true;
  const meta = asRecord(row.metadata);
  return meta.advisor_ap === true || String(meta.party_kind || '') === 'contractor';
}

type UniqueParty = {
  id: number;
  name: string;
  code: string;
  accountId: number | null;
  parentCode: string;
  kind: 'ar' | 'ap';
};

function pickExistingLeaf(
  coa: PartyCoaRow[],
  codes: string[]
): PartyCoaRow | null {
  for (const code of codes) {
    if (!code) continue;
    const hit = coa.find(
      (a) => !a.is_header && a.is_active !== false && String(a.code) === code
    );
    if (hit) return hit;
  }
  return null;
}

function collectUniqueCustomers(
  rows: PartyBookRow[],
  coa: PartyCoaRow[],
  arCode: string,
  memberCode: string
): UniqueParty[] {
  const out: UniqueParty[] = [];
  for (const row of rows) {
    if (!row?.id || isSkippedPartyStatus(row.status)) continue;
    const advisor = isAdvisorParty(row);
    const trade = isTradeParty(row);
    if (!advisor && !trade) continue;
    const name = partyDisplayName(row);
    const parentCode = advisor ? memberCode : arCode;
    const want = memberArAccountCode(Number(row.id), parentCode);
    const legacy = legacyMemberArAccountCode(Number(row.id));
    const classic = memberArAccountCode(Number(row.id), MEMBER_AR_HEADER_CODE);
    if (!name || !want) continue;
    const linked = linkedGlCode(row);
    const linkedId = Number(asRecord(row.metadata).gl_account_id || 0);
    const existingLinked =
      linked &&
      coa.find(
        (a) => !a.is_header && a.is_active !== false && String(a.code) === linked
      );
    const existingWant = pickExistingLeaf(coa, [want, classic, legacy]);
    const named =
      !advisor
        ? findExistingPartyAccount(
            coa,
            'ar',
            normalizePartyKey(name),
            name
          )
        : null;
    if (existingLinked) {
      out.push({
        id: Number(row.id),
        name,
        code: String(existingLinked.code),
        accountId:
          existingLinked.id > 0 ? Number(existingLinked.id) : linkedId || null,
        parentCode,
        kind: 'ar',
      });
    } else if (existingWant) {
      out.push({
        id: Number(row.id),
        name,
        code: String(existingWant.code),
        accountId: existingWant.id > 0 ? Number(existingWant.id) : null,
        parentCode,
        kind: 'ar',
      });
    } else if (named) {
      out.push({
        id: Number(row.id),
        name,
        code: String(named.code),
        accountId: named.id > 0 ? Number(named.id) : null,
        parentCode,
        kind: 'ar',
      });
    } else {
      out.push({
        id: Number(row.id),
        name,
        code: want,
        accountId: null,
        parentCode,
        kind: 'ar',
      });
    }
  }
  out.sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
  return out;
}

function collectUniqueSuppliers(
  rows: PartyBookRow[],
  coa: PartyCoaRow[],
  apCode: string,
  contractorCode: string
): UniqueParty[] {
  const out: UniqueParty[] = [];
  for (const row of rows) {
    if (!row?.id || isSkippedPartyStatus(row.status)) continue;
    const name = partyDisplayName(row);
    const parentCode = isContractorSupplier(row) ? contractorCode : apCode;
    const want = supplierApAccountCode(Number(row.id), parentCode);
    const classic = supplierApAccountCode(Number(row.id), SUPPLIER_AP_HEADER_CODE);
    if (!name || !want) continue;
    const linked = linkedGlCode(row);
    const linkedId = Number(asRecord(row.metadata).gl_account_id || 0);
    const existingLinked =
      linked &&
      coa.find(
        (a) => !a.is_header && a.is_active !== false && String(a.code) === linked
      );
    const existingWant = pickExistingLeaf(coa, [want, classic]);
    if (existingLinked) {
      out.push({
        id: Number(row.id),
        name,
        code: String(existingLinked.code),
        accountId:
          existingLinked.id > 0 ? Number(existingLinked.id) : linkedId || null,
        parentCode,
        kind: 'ap',
      });
    } else if (existingWant) {
      out.push({
        id: Number(row.id),
        name,
        code: String(existingWant.code),
        accountId: existingWant.id > 0 ? Number(existingWant.id) : null,
        parentCode,
        kind: 'ap',
      });
    } else {
      out.push({
        id: Number(row.id),
        name,
        code: want,
        accountId: null,
        parentCode,
        kind: 'ap',
      });
    }
  }
  out.sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
  return out;
}

export type PartyGlMapping = {
  arCode?: string;
  memberCode?: string;
  apCode?: string;
  contractorCode?: string;
};

export function planPartyGlAccounts(opts: {
  customers: PartyBookRow[];
  suppliers: PartyBookRow[];
  coa: PartyCoaRow[];
  mapping?: PartyGlMapping | null;
}): { create: PartyGlCreate[]; links: PartyGlLink[] } {
  const usedCodes = new Set(
    (opts.coa || []).map((a) => String(a.code || '').trim()).filter(Boolean)
  );
  const create: PartyGlCreate[] = [];
  const links: PartyGlLink[] = [];
  const arCode = opts.mapping?.arCode || MEMBER_AR_HEADER_CODE;
  const memberCode = opts.mapping?.memberCode || arCode;
  const apCode = opts.mapping?.apCode || SUPPLIER_AP_HEADER_CODE;
  const contractorCode = opts.mapping?.contractorCode || apCode;

  const ensureHeader = (optsH: {
    code: string;
    name: string;
    account_type: 'asset' | 'liability';
    normal_balance: 'debit' | 'credit';
    parentCode: string;
    sort: number;
    kind: string;
    description: string;
  }): string => {
    const existing = findHeaderByCode(
      asCoaView(opts.coa || [], create),
      optsH.code,
      optsH.name
    );
    if (existing) return String(existing.code);
    if (usedCodes.has(optsH.code)) return optsH.code;
    usedCodes.add(optsH.code);
    create.push({
      code: optsH.code,
      name: optsH.name,
      account_type: optsH.account_type,
      subtype: 'header',
      normal_balance: optsH.normal_balance,
      description: optsH.description,
      metadata: { party_kind: optsH.kind },
      sort_order: optsH.sort,
      is_header: true,
      parent_code: usedCodes.has(optsH.parentCode) ? optsH.parentCode : null,
    });
    return optsH.code;
  };

  const pushLeaves = (
    parties: UniqueParty[],
    table: 'customers' | 'srm_suppliers',
    account_type: 'asset' | 'liability',
    subtype: 'receivable' | 'payable',
    sortBase: number
  ) => {
    let i = 0;
    for (const party of parties) {
      const existing =
        asCoaView(opts.coa || [], create).find(
          (a) =>
            !a.is_header &&
            a.is_active !== false &&
            String(a.code) === party.code
        ) || null;
      let code = existing?.code || party.code;
      let accountId =
        existing && existing.id > 0
          ? Number(existing.id)
          : party.accountId;
      if (!existing && party.accountId == null) {
        if (usedCodes.has(code)) continue;
        usedCodes.add(code);
        create.push({
          code,
          name: `${account_type === 'asset' ? PARTY_AR_PREFIX : PARTY_AP_PREFIX}${party.name}`,
          account_type,
          subtype,
          normal_balance: account_type === 'asset' ? 'debit' : 'credit',
          description:
            account_type === 'asset'
              ? `AR account ${code} — ${party.name}. Bank receipts for this person post here when invoiced.`
              : `AP account ${code} — ${party.name}. Bank payments for this party post here when a bill is already recognised.`,
          metadata: {
            party_kind: account_type === 'asset' ? 'member_ar' : 'supplier_ap',
            party_key: party.code,
            party_ids: [party.id],
            ar_account_number: account_type === 'asset' ? code : undefined,
            ap_account_number: account_type === 'liability' ? code : undefined,
          },
          sort_order: sortBase + i,
          parent_code: statementParentForPartyLeaf(code, party.parentCode),
        });
        i += 1;
      }
      links.push({
        table,
        id: party.id,
        kind: party.kind,
        key: party.code,
        name: party.name,
        code,
        accountId,
      });
    }
  };

  const suppliers = collectUniqueSuppliers(
    opts.suppliers || [],
    opts.coa || [],
    apCode,
    contractorCode
  );
  if (suppliers.length) {
    const headers = [...new Set(suppliers.map((s) => s.parentCode))];
    for (const headerCode of headers) {
      const isDefault = headerCode === SUPPLIER_AP_HEADER_CODE;
      ensureHeader({
        code: headerCode,
        name: isDefault ? SUPPLIER_AP_HEADER_NAME : `Supplier payables (${headerCode})`,
        account_type: 'liability',
        normal_balance: 'credit',
        parentCode: '2100',
        sort: 850,
        kind: 'supplier_ap_header',
        description:
          'Supplier AP header. Each supplier is {parent}-0000001 … Employed staff stay on payroll (IAS 19).',
      });
    }
    pushLeaves(suppliers, 'srm_suppliers', 'liability', 'payable', 851);
  }

  const customers = collectUniqueCustomers(
    opts.customers || [],
    opts.coa || [],
    arCode,
    memberCode
  );
  if (customers.length) {
    const headers = [...new Set(customers.map((s) => s.parentCode))];
    for (const headerCode of headers) {
      const isDefault = headerCode === MEMBER_AR_HEADER_CODE;
      ensureHeader({
        code: headerCode,
        name: isDefault ? MEMBER_AR_HEADER_NAME : `Customer receivables (${headerCode})`,
        account_type: 'asset',
        normal_balance: 'debit',
        parentCode: '1100',
        sort: 840,
        kind: 'member_ar_header',
        description:
          'Customer AR header. Each customer is {parent}-0000001 … Income still posts to 4100/4200/4400 (IFRS 15).',
      });
    }
    pushLeaves(customers, 'customers', 'asset', 'receivable', 841);
  }

  return { create, links };
}

export type AllocGlGroup = {
  members: CoaAccount[];
  customers: CoaAccount[];
  suppliers: CoaAccount[];
  incomeExpense: CoaAccount[];
  other: CoaAccount[];
};

function sortByCode(a: CoaAccount, b: CoaAccount): number {
  return String(a.code || '').localeCompare(String(b.code || ''), undefined, {
    numeric: true,
  });
}

export function groupCoaForAllocation(accounts: CoaAccount[]): AllocGlGroup {
  const live = (accounts || []).filter((a) => !a.is_header && a.is_active !== false);
  const members = live
    .filter(
      (a) =>
        isHyphenSubAccountCode(String(a.code || '')) && isCustomerAllocAccount(a)
    )
    .sort(sortByCode);
  const customers = live
    .filter(
      (a) =>
        isCustomerAllocAccount(a) && !isHyphenSubAccountCode(String(a.code || ''))
    )
    .sort(sortByCode);
  const suppliers = live.filter((a) => isSupplierAllocAccount(a)).sort(sortByCode);
  const used = new Set(
    [...members, ...customers, ...suppliers].map((a) => Number(a.id))
  );
  const incomeExpense = live
    .filter((a) => ['revenue', 'expense', 'cogs'].includes(String(a.account_type)))
    .filter((a) => !used.has(Number(a.id)))
    .sort(sortByCode);
  const other = live
    .filter((a) => !used.has(Number(a.id)))
    .filter((a) => !['revenue', 'expense', 'cogs'].includes(String(a.account_type)))
    .sort(sortByCode);
  return { members, customers, suppliers, incomeExpense, other };
}

/** Prefer a named customer/supplier account when the bank narrative names them. */
export function suggestPartyGlForDescription(
  description: string,
  amount: number,
  coa: CoaAccount[]
): { id: number; label: string } | null {
  const desc = String(description || '').toLowerCase();
  if (!desc) return null;
  const isIn = amount > 0;
  const pool = (coa || []).filter((a) =>
    isIn
      ? isCustomerAllocAccount(a) && String(a.code) !== '1130'
      : isSupplierAllocAccount(a) && String(a.code) !== '2110'
  );

  for (const a of pool) {
    const code = String(a.code || '').toLowerCase();
    if (isHyphenSubAccountCode(code) && desc.includes(code)) {
      return { id: Number(a.id), label: `${a.code} · ${a.name}` };
    }
  }

  const named = pool
    .map((a) => ({
      account: a,
      needle: stripPartyPrefix(String(a.name || '')).toLowerCase(),
    }))
    .filter((x) => x.needle.length >= 3)
    .sort((a, b) => b.needle.length - a.needle.length);

  for (const hit of named) {
    if (desc.includes(hit.needle)) {
      return {
        id: Number(hit.account.id),
        label: `${hit.account.code} · ${hit.account.name}`,
      };
    }
  }
  return null;
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

async function loadBookRows(
  supabase: ReturnType<typeof getSupabaseServer>,
  table: 'customers' | 'srm_suppliers',
  profileId: number,
  extraCols?: string
): Promise<{ data: PartyBookRow[] | null; error: { message: string } | null }> {
  const base = 'id, trading_name, legal_name, status, metadata';
  const select = extraCols ? `${base}, ${extraCols}` : base;
  const first = await supabase
    .from(table)
    .select(select)
    .eq('profile_id', profileId);
  if (
    first.error &&
    extraCols &&
    /column|schema cache|does not exist/i.test(first.error.message || '')
  ) {
    const retry = await supabase
      .from(table)
      .select(base)
      .eq('profile_id', profileId);
    return {
      data: (retry.data || null) as PartyBookRow[] | null,
      error: retry.error,
    };
  }
  return {
    data: (first.data || null) as PartyBookRow[] | null,
    error: first.error,
  };
}

async function ensureHeaderRow(opts: {
  profileId: number;
  code: string;
  name: string;
  account_type: 'asset' | 'liability';
  normal_balance: 'debit' | 'credit';
  parentCode: string;
  sort: number;
  description: string;
  metadata: Record<string, unknown>;
}): Promise<number | null> {
  const supabase = getSupabaseServer();
  const { data: header } = await supabase
    .from('chart_of_accounts')
    .select('id, code, is_header, account_type, parent_id')
    .eq('profile_id', opts.profileId)
    .eq('code', opts.code)
    .maybeSingle();
  if (header?.id) {
    const patch: Record<string, unknown> = {};
    if (header.is_header !== true) patch.is_header = true;
    if (String(header.account_type) !== opts.account_type) {
      patch.account_type = opts.account_type;
    }
    if (!header.parent_id) {
      const { data: parent } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('profile_id', opts.profileId)
        .eq('code', opts.parentCode)
        .maybeSingle();
      if (parent?.id) patch.parent_id = Number(parent.id);
    }
    if (Object.keys(patch).length) {
      await supabase
        .from('chart_of_accounts')
        .update(patch)
        .eq('id', Number(header.id))
        .eq('profile_id', opts.profileId);
    }
    return Number(header.id);
  }

  const { data: parent } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('profile_id', opts.profileId)
    .eq('code', opts.parentCode)
    .maybeSingle();
  const ins = await supabase
    .from('chart_of_accounts')
    .insert({
      profile_id: opts.profileId,
      code: opts.code,
      name: opts.name,
      account_type: opts.account_type,
      is_header: true,
      is_active: true,
      is_system: false,
      normal_balance: opts.normal_balance,
      parent_id: parent?.id ? Number(parent.id) : null,
      currency: 'ZAR',
      sort_order: opts.sort,
      description: opts.description,
      metadata: opts.metadata,
    })
    .select('id')
    .maybeSingle();
  if (ins.data?.id) return Number(ins.data.id);
  if (ins.error && /duplicate|unique/i.test(ins.error.message || '')) {
    const { data: again } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('profile_id', opts.profileId)
      .eq('code', opts.code)
      .maybeSingle();
    if (again?.id) return Number(again.id);
  }
  return null;
}

async function stampBookGl(opts: {
  table: 'customers' | 'srm_suppliers';
  profileId: number;
  id: number;
  accountId: number;
  code: string;
  name: string;
  kind: 'ar' | 'ap';
}): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: book } = await supabase
    .from(opts.table)
    .select('metadata')
    .eq('id', opts.id)
    .eq('profile_id', opts.profileId)
    .maybeSingle();
  const meta = asRecord(book?.metadata);
  const numberKey = opts.kind === 'ar' ? 'ar_account_number' : 'ap_account_number';
  if (
    Number(meta.gl_account_id) === opts.accountId &&
    String(meta.gl_account_code || '') === opts.code
  ) {
    return;
  }
  await supabase
    .from(opts.table)
    .update({
      metadata: {
        ...meta,
        gl_account_id: opts.accountId,
        gl_account_code: opts.code,
        gl_account_name: opts.name,
        gl_account_kind: opts.kind,
        [numberKey]: opts.code,
      },
    })
    .eq('id', opts.id)
    .eq('profile_id', opts.profileId);
}

async function loadPartyParents(profileId: number): Promise<PartyLedgerParents> {
  try {
    const { getCachedSettings, getCachedCoa } = await import(
      '@/lib/accounting/read-cache'
    );
    const [settings, coa] = await Promise.all([
      getCachedSettings(profileId),
      getCachedCoa(profileId),
    ]);
    return resolvePartyLedgerParents(
      parsePartyLedgerStored(settings?.metadata),
      coa
    );
  } catch {
    return resolvePartyLedgerParents(DEFAULT_PARTY_LEDGER, []);
  }
}

/** Trade customer AR leaf under the company's customer (AR) parent. */
export async function ensureCustomerArLeaf(opts: {
  profileId: number;
  customerId: number;
  name: string;
}): Promise<{ code: string; accountId: number } | null> {
  const parents = await loadPartyParents(opts.profileId);
  return ensureMemberArLeaf({
    ...opts,
    headerCode: parents.ar.code,
  });
}

/** Create/link one unique AR leaf for this CRM person. Safe to call on every add. */
export async function ensureMemberArLeaf(opts: {
  profileId: number;
  customerId: number;
  name: string;
  headerCode?: string | null;
}): Promise<{ code: string; accountId: number } | null> {
  const parents = await loadPartyParents(opts.profileId);
  const headerCode =
    String(opts.headerCode || parents.members.code || MEMBER_AR_HEADER_CODE).trim() ||
    MEMBER_AR_HEADER_CODE;
  const want = memberArAccountCode(opts.customerId, headerCode);
  const legacy = legacyMemberArAccountCode(opts.customerId);
  const classic = memberArAccountCode(opts.customerId, MEMBER_AR_HEADER_CODE);
  const rawName = partyDisplayName({ trading_name: opts.name }) || 'Member';
  const name = /^AR\s+[—-]\s+/i.test(rawName)
    ? rawName
    : `${PARTY_AR_PREFIX}${rawName}`;
  if (!want || !Number.isFinite(opts.profileId) || opts.profileId <= 0) return null;
  const supabase = getSupabaseServer();
  const { data: existingRows } = await supabase
    .from('chart_of_accounts')
    .select('id, code, parent_id, account_type')
    .eq('profile_id', opts.profileId)
    .in('code', [...new Set([want, classic, legacy].filter(Boolean))]);
  const rows = (existingRows || []) as Array<{
    id: number;
    code: string;
    parent_id?: number | null;
    account_type?: string | null;
  }>;
  const modern = rows.find((r) => String(r.code) === want);
  const old = rows.find((r) => String(r.code) !== want);
  let accountId = modern?.id
    ? Number(modern.id)
    : old?.id
      ? Number(old.id)
      : 0;
  let code = modern?.code || (accountId && old ? String(old.code) : want);

  let headerId = parents.members.id;
  if (!headerId && headerCode === MEMBER_AR_HEADER_CODE) {
    headerId = await ensureHeaderRow({
      profileId: opts.profileId,
      code: MEMBER_AR_HEADER_CODE,
      name: MEMBER_AR_HEADER_NAME,
      account_type: 'asset',
      normal_balance: 'debit',
      parentCode: '1100',
      sort: 840,
      description:
        'Customer AR header. Each customer is 1180-0000001 … Income posts to 4100/4200/4400 (IFRS 15).',
      metadata: { party_kind: 'member_ar_header' },
    });
  } else if (!headerId) {
    const { data: parent } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('profile_id', opts.profileId)
      .eq('code', headerCode)
      .maybeSingle();
    if (parent?.id) headerId = Number(parent.id);
  }

  if (
    accountId &&
    code !== want &&
    !modern &&
    parseHyphenSubAccount(String(code))?.header === MEMBER_AR_LEGACY_HEADER_CODE &&
    headerCode === MEMBER_AR_HEADER_CODE
  ) {
    const recode = await supabase
      .from('chart_of_accounts')
      .update({
        code: want,
        name,
        account_type: 'asset',
        subtype: 'receivable',
        is_header: false,
        is_active: true,
        normal_balance: 'debit',
        parent_id: headerId,
        description: `AR account ${want} — ${name}. Receipts for this person post here when invoiced.`,
        metadata: {
          party_kind: 'member_ar',
          party_ids: [opts.customerId],
          ar_account_number: want,
        },
      })
      .eq('id', accountId)
      .eq('profile_id', opts.profileId)
      .select('id, code')
      .maybeSingle();
    if (recode.data?.code) code = String(recode.data.code);
    else if (recode.error && /duplicate|unique/i.test(recode.error.message || '')) {
      code = String(old?.code || code);
    } else {
      code = want;
    }
  }

  if (!accountId) {
    const ins = await supabase
      .from('chart_of_accounts')
      .insert({
        profile_id: opts.profileId,
        code: want,
        name,
        account_type: 'asset',
        subtype: 'receivable',
        is_header: false,
        is_active: true,
        is_system: false,
        normal_balance: 'debit',
        parent_id: headerId,
        currency: 'ZAR',
        sort_order: 841,
        description: `AR account ${want} — ${name}. Receipts for this person post here when invoiced.`,
        metadata: {
          party_kind: 'member_ar',
          party_ids: [opts.customerId],
          ar_account_number: want,
        },
      })
      .select('id, code')
      .maybeSingle();
    if (ins.data?.id) {
      accountId = Number(ins.data.id);
      code = String(ins.data.code || want);
    } else if (ins.error && /duplicate|unique/i.test(ins.error.message || '')) {
      const { data: again } = await supabase
        .from('chart_of_accounts')
        .select('id, code')
        .eq('profile_id', opts.profileId)
        .eq('code', want)
        .maybeSingle();
      if (again?.id) {
        accountId = Number(again.id);
        code = String(again.code || want);
      }
    }
  }
  if (!accountId) return null;

  await stampBookGl({
    table: 'customers',
    profileId: opts.profileId,
    id: opts.customerId,
    accountId,
    code,
    name,
    kind: 'ar',
  });
  invalidateAccountingReads(opts.profileId);
  return { code, accountId };
}

/** Create/link one unique AP leaf for this supplier / contractor. */
export async function ensureSupplierApLeaf(opts: {
  profileId: number;
  supplierId: number;
  name: string;
  headerCode?: string | null;
  contractor?: boolean;
}): Promise<{ code: string; accountId: number } | null> {
  const parents = await loadPartyParents(opts.profileId);
  const headerCode =
    String(
      opts.headerCode ||
        (opts.contractor ? parents.contractors.code : parents.ap.code) ||
        SUPPLIER_AP_HEADER_CODE
    ).trim() || SUPPLIER_AP_HEADER_CODE;
  const code = supplierApAccountCode(opts.supplierId, headerCode);
  const classic = supplierApAccountCode(opts.supplierId, SUPPLIER_AP_HEADER_CODE);
  const rawName = partyDisplayName({ trading_name: opts.name }) || 'Supplier';
  const name = /^AP\s+[—-]\s+/i.test(rawName)
    ? rawName
    : `${PARTY_AP_PREFIX}${rawName}`;
  if (!code || !Number.isFinite(opts.profileId) || opts.profileId <= 0) return null;
  const supabase = getSupabaseServer();
  const { data: existingRows } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .eq('profile_id', opts.profileId)
    .in('code', [...new Set([code, classic].filter(Boolean))]);
  const existing =
    (existingRows || []).find((r) => String(r.code) === code) ||
    (existingRows || [])[0] ||
    null;
  let accountId = existing?.id ? Number(existing.id) : 0;

  let headerId = opts.contractor ? parents.contractors.id : parents.ap.id;
  if (!headerId && headerCode === SUPPLIER_AP_HEADER_CODE) {
    headerId = await ensureHeaderRow({
      profileId: opts.profileId,
      code: SUPPLIER_AP_HEADER_CODE,
      name: SUPPLIER_AP_HEADER_NAME,
      account_type: 'liability',
      normal_balance: 'credit',
      parentCode: '2100',
      sort: 850,
      description:
        'Supplier AP header. Each supplier is 2180-0000001 …',
      metadata: { party_kind: 'supplier_ap_header' },
    });
  } else if (!headerId) {
    const { data: parent } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('profile_id', opts.profileId)
      .eq('code', headerCode)
      .maybeSingle();
    if (parent?.id) headerId = Number(parent.id);
  }

  if (!accountId) {
    const ins = await supabase
      .from('chart_of_accounts')
      .insert({
        profile_id: opts.profileId,
        code,
        name,
        account_type: 'liability',
        subtype: 'payable',
        is_header: false,
        is_active: true,
        is_system: false,
        normal_balance: 'credit',
        parent_id: headerId,
        currency: 'ZAR',
        sort_order: 851,
        description: `AP account ${code} — ${name}. Payments for this party post here when billed.`,
        metadata: {
          party_kind: 'supplier_ap',
          party_ids: [opts.supplierId],
          ap_account_number: code,
        },
      })
      .select('id, code')
      .maybeSingle();
    if (ins.data?.id) {
      accountId = Number(ins.data.id);
    } else if (ins.error && /duplicate|unique/i.test(ins.error.message || '')) {
      const { data: again } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('profile_id', opts.profileId)
        .eq('code', code)
        .maybeSingle();
      if (again?.id) accountId = Number(again.id);
    }
  }
  if (!accountId) return null;

  await stampBookGl({
    table: 'srm_suppliers',
    profileId: opts.profileId,
    id: opts.supplierId,
    accountId,
    code,
    name,
    kind: 'ap',
  });
  invalidateAccountingReads(opts.profileId);
  return { code, accountId };
}

async function recodeLegacyMemberArLeaves(profileId: number): Promise<number> {
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('profile_id', profileId)
    .like('code', '4400-%');
  const leaves = (rows || []).filter((r) => parseMemberArCustomerId(String(r.code)));
  if (!leaves.length) return 0;
  const headerId = await ensureHeaderRow({
    profileId,
    code: MEMBER_AR_HEADER_CODE,
    name: MEMBER_AR_HEADER_NAME,
    account_type: 'asset',
    normal_balance: 'debit',
    parentCode: '1100',
    sort: 840,
    description:
      'Customer AR header. Each customer is 1180-0000001 …',
    metadata: { party_kind: 'member_ar_header' },
  });
  let moved = 0;
  for (const leaf of leaves) {
    const customerId = parseMemberArCustomerId(String(leaf.code));
    if (!customerId) continue;
    const want = memberArAccountCode(customerId);
    if (!want || want === String(leaf.code)) continue;
    const recode = await supabase
      .from('chart_of_accounts')
      .update({
        code: want,
        account_type: 'asset',
        subtype: 'receivable',
        is_header: false,
        normal_balance: 'debit',
        parent_id: headerId,
      })
      .eq('id', Number(leaf.id))
      .eq('profile_id', profileId)
      .select('id')
      .maybeSingle();
    if (recode.error && /duplicate|unique/i.test(recode.error.message || '')) {
      continue;
    }
    if (recode.data?.id) {
      moved += 1;
      await stampBookGl({
        table: 'customers',
        profileId,
        id: customerId,
        accountId: Number(leaf.id),
        code: want,
        name: String(leaf.name || 'Member'),
        kind: 'ar',
      });
    }
  }
  return moved;
}

async function convertLegacyRevenueHeader(profileId: number): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: header } = await supabase
    .from('chart_of_accounts')
    .select('id, is_header, account_type, name')
    .eq('profile_id', profileId)
    .eq('code', MEMBER_AR_LEGACY_HEADER_CODE)
    .maybeSingle();
  if (!header?.id) return;
  const { data: children } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('profile_id', profileId)
    .eq('parent_id', Number(header.id))
    .limit(1);
  if (children?.length) return;
  const { data: rev } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('profile_id', profileId)
    .eq('code', '4000')
    .maybeSingle();
  await supabase
    .from('chart_of_accounts')
    .update({
      name: MEMBERSHIP_REVENUE_NAME,
      account_type: 'revenue',
      subtype: 'service',
      is_header: false,
      normal_balance: 'credit',
      parent_id: rev?.id ? Number(rev.id) : null,
      description:
        'IFRS 15 income from memberships, sessions and care. Receivables live under 1180, not here.',
    })
    .eq('id', Number(header.id))
    .eq('profile_id', profileId);
}

export async function ensurePartyGlAccounts(
  profileId: number
): Promise<{ created: number; linked: number; warning?: string }> {
  if (!Number.isFinite(profileId) || profileId <= 0) {
    return { created: 0, linked: 0, warning: 'invalid profile' };
  }
  try {
    const { syncAdvisorModulePeopleToCrm } = await import(
      '@/lib/b2c/advisor-crm-sync'
    );
    await syncAdvisorModulePeopleToCrm(profileId);
  } catch (err) {
    console.warn('[party-gl] advisor CRM sync', err);
  }
  try {
    const { syncAdvisorContractorsToSuppliers } = await import(
      '@/lib/b2c/advisor-ap-sync'
    );
    await syncAdvisorContractorsToSuppliers(profileId);
  } catch (err) {
    console.warn('[party-gl] advisor AP sync', err);
  }
  const supabase = getSupabaseServer();
  const [{ data: customers, error: cErr }, { data: suppliers, error: sErr }, { data: coa, error: aErr }] =
    await Promise.all([
      loadBookRows(supabase, 'customers', profileId, 'customer_type, source, notes'),
      loadBookRows(supabase, 'srm_suppliers', profileId, 'notes'),
      supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type, subtype, is_header, is_active, parent_id')
        .eq('profile_id', profileId),
    ]);
  if (cErr && /schema cache|does not exist/i.test(cErr.message || '')) {
    return { created: 0, linked: 0, warning: cErr.message };
  }
  if (aErr) return { created: 0, linked: 0, warning: aErr.message };

  let mapping: PartyGlMapping | null = null;
  try {
    const { getCachedSettings } = await import('@/lib/accounting/read-cache');
    const settings = await getCachedSettings(profileId);
    const parents = resolvePartyLedgerParents(
      parsePartyLedgerStored(settings?.metadata),
      (coa || []) as CoaAccount[]
    );
    mapping = {
      arCode: parents.ar.code,
      memberCode: parents.members.code,
      apCode: parents.ap.code,
      contractorCode: parents.contractors.code,
    };
  } catch {
    mapping = null;
  }

  const plan = planPartyGlAccounts({
    customers: (customers || []) as PartyBookRow[],
    suppliers: ((sErr ? [] : suppliers) || []) as PartyBookRow[],
    coa: (coa || []) as PartyCoaRow[],
    mapping,
  });

  for (const [code, parentCode] of [
    [MEMBER_AR_HEADER_CODE, '1100'],
    [SUPPLIER_AP_HEADER_CODE, '2100'],
  ] as const) {
    const row = (coa || []).find((a) => String(a.code) === code);
    const parent = (coa || []).find((a) => String(a.code) === parentCode);
    if (row?.id && parent?.id && !row.parent_id) {
      await supabase
        .from('chart_of_accounts')
        .update({ parent_id: Number(parent.id), is_header: true })
        .eq('id', Number(row.id))
        .eq('profile_id', profileId);
    }
  }

  const byCode = new Map<string, number>();
  for (const row of coa || []) {
    byCode.set(String(row.code), Number(row.id));
  }

  let created = 0;
  for (const row of plan.create) {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        profile_id: profileId,
        code: row.code,
        name: row.name,
        account_type: row.account_type,
        subtype: row.subtype === 'header' ? null : row.subtype,
        is_active: true,
        is_system: false,
        is_header: row.is_header === true,
        parent_id: row.parent_code
          ? byCode.get(row.parent_code) || null
          : null,
        normal_balance: row.normal_balance,
        description: row.description,
        currency: 'ZAR',
        sort_order: row.sort_order,
        metadata: row.metadata,
      })
      .select('id, code')
      .maybeSingle();
    if (error) {
      if (/duplicate|unique/i.test(error.message || '')) {
        const { data: existing } = await supabase
          .from('chart_of_accounts')
          .select('id, code')
          .eq('profile_id', profileId)
          .eq('code', row.code)
          .maybeSingle();
        if (existing?.id) byCode.set(String(existing.code), Number(existing.id));
        continue;
      }
      return { created, linked: 0, warning: error.message };
    }
    if (data?.id) {
      created += 1;
      byCode.set(String(data.code), Number(data.id));
    }
  }

  let linked = 0;
  for (const link of plan.links) {
    const accountId = link.accountId || byCode.get(link.code) || null;
    if (!accountId) continue;
    const book =
      link.table === 'customers'
        ? (customers || []).find((r) => Number(r.id) === link.id)
        : (suppliers || []).find((r) => Number(r.id) === link.id);
    const meta = asRecord(book?.metadata);
    if (Number(meta.gl_account_id) === accountId && String(meta.gl_account_code) === link.code) {
      continue;
    }
    const numberKey = link.kind === 'ap' ? 'ap_account_number' : 'ar_account_number';
    const { error } = await supabase
      .from(link.table)
      .update({
        metadata: {
          ...meta,
          gl_account_id: accountId,
          gl_account_code: link.code,
          gl_account_name: link.name,
          gl_account_kind: link.kind,
          [numberKey]: link.code,
        },
      })
      .eq('id', link.id)
      .eq('profile_id', profileId);
    if (!error) linked += 1;
  }

  try {
    const moved = await recodeLegacyMemberArLeaves(profileId);
    if (moved) created += moved;
    await convertLegacyRevenueHeader(profileId);
  } catch (err) {
    console.warn('[party-gl] legacy 4400 migrate', err);
  }

  try {
    const { data: tree } = await supabase
      .from('chart_of_accounts')
      .select('id, code, parent_id, is_header')
      .eq('profile_id', profileId);
    const ids = new Map<string, number>();
    for (const row of tree || []) {
      ids.set(String(row.code), Number(row.id));
    }
    for (const row of tree || []) {
      const code = String(row.code || '');
      let want: string | null = null;
      if (code === MEMBER_AR_HEADER_CODE) want = '1100';
      else if (code === SUPPLIER_AP_HEADER_CODE) want = '2100';
      else if (code === '1135') want = '1100';
      else if (isPartyStatementLeaf(code) && row.is_header !== true) {
        want = statementParentForPartyLeaf(code);
      }
      if (!want || want === code || want === MEMBERSHIP_REVENUE_CODE) continue;
      const pid = ids.get(want);
      if (!pid || Number(row.parent_id) === pid) continue;
      await supabase
        .from('chart_of_accounts')
        .update({ parent_id: pid })
        .eq('id', Number(row.id))
        .eq('profile_id', profileId);
    }
  } catch (err) {
    console.warn('[party-gl] statement parent backfill', err);
  }

  if (created || linked) invalidateAccountingReads(profileId);
  ttlSet(partyGlCacheKey(profileId), 1, PARTY_GL_CACHE_MS);
  return { created, linked };
}

/** Never throws — call after any customer or supplier create. */
export async function ensurePartyGlAccountsSafe(profileId: number): Promise<void> {
  try {
    await ensurePartyGlAccounts(profileId);
  } catch (err) {
    console.warn('[party-gl] ensure failed', profileId, err);
  }
}

/** Same as safe, but skip if this company was provisioned recently. */
export async function ensurePartyGlAccountsCached(profileId: number): Promise<void> {
  if (!Number.isFinite(profileId) || profileId <= 0) return;
  if (ttlGet(partyGlCacheKey(profileId))) return;
  ttlSet(partyGlCacheKey(profileId), 1, PARTY_GL_CACHE_MS);
  await ensurePartyGlAccountsSafe(profileId);
}

export async function resolvePartyControlAccountId(opts: {
  profileId: number;
  kind: 'ar' | 'ap';
  partyId?: number | null;
  counterpartyName?: string | null;
}): Promise<number | null> {
  await ensurePartyGlAccountsCached(opts.profileId);
  const supabase = getSupabaseServer();
  const table = opts.kind === 'ar' ? 'customers' : 'srm_suppliers';
  const partyId = Number(opts.partyId || 0);
  if (partyId > 0) {
    const { data } = await supabase
      .from(table)
      .select('metadata, trading_name, legal_name')
      .eq('id', partyId)
      .eq('profile_id', opts.profileId)
      .maybeSingle();
    const linked = Number(asRecord(data?.metadata).gl_account_id);
    if (linked > 0) return linked;
    const display = partyDisplayName({
      trading_name: data?.trading_name,
      legal_name: data?.legal_name,
    });
    if (opts.kind === 'ar') {
      for (const code of [memberArAccountCode(partyId), legacyMemberArAccountCode(partyId)]) {
        if (!code) continue;
        const { data: byCode } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('profile_id', opts.profileId)
          .eq('code', code)
          .maybeSingle();
        if (byCode?.id) return Number(byCode.id);
      }
      const leaf = await ensureMemberArLeaf({
        profileId: opts.profileId,
        customerId: partyId,
        name: display,
      });
      if (leaf?.accountId) return leaf.accountId;
    } else {
      const code = supplierApAccountCode(partyId);
      if (code) {
        const { data: byCode } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('profile_id', opts.profileId)
          .eq('code', code)
          .maybeSingle();
        if (byCode?.id) return Number(byCode.id);
        const leaf = await ensureSupplierApLeaf({
          profileId: opts.profileId,
          supplierId: partyId,
          name: display,
        });
        if (leaf?.accountId) return leaf.accountId;
      }
    }
  }

  const display = String(opts.counterpartyName || '').replace(/\s+/g, ' ').trim();
  if (!display) return null;
  const prefix = opts.kind === 'ar' ? PARTY_AR_PREFIX : PARTY_AP_PREFIX;
  const want = `${prefix}${display}`;
  const { data: exact } = await supabase
    .from('chart_of_accounts')
    .select('id, name')
    .eq('profile_id', opts.profileId)
    .eq('is_active', true)
    .eq('name', want)
    .maybeSingle();
  if (exact?.id) return Number(exact.id);

  const { data: named } = await supabase
    .from('chart_of_accounts')
    .select('id, name')
    .eq('profile_id', opts.profileId)
    .eq('is_active', true)
    .ilike('name', `${prefix}%`)
    .limit(400);
  const key = normalizePartyKey(display);
  const hit = (named || []).find(
    (a) => normalizePartyKey(stripPartyPrefix(String(a.name || ''))) === key
  );
  return hit?.id ? Number(hit.id) : null;
}
