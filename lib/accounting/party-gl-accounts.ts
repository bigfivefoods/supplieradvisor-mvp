/**
 * Named customer AR and supplier AP leaves so bank allocation can
 * pick a party instead of dumping receipts into 4100 Sales.
 *
 * 1130 / 2110 stay posting leaves (invoice-gl requires that). Trade
 * parties live in 1181+ / 2181+. Gym/clinic/retail people nest under
 * 4400 Members & patients as AR sub-accounts 4400-0000001 …
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { invalidateAccountingReads } from '@/lib/accounting/read-cache';
import { ttlGet, ttlSet } from '@/lib/system/memory-ttl';
import type { CoaAccount } from '@/lib/accounting/types';

export const PARTY_AR_CODE_START = 1181;
export const PARTY_AP_CODE_START = 2181;
export const PARTY_AR_PREFIX = 'AR — ';
export const PARTY_AP_PREFIX = 'AP — ';
/** Header under 4000 Revenue. Each person is 4400-0000001 … (their AR number). */
export const MEMBER_AR_HEADER_CODE = '4400';
export const MEMBER_AR_HEADER_NAME = 'Members & patients';
export const MEMBER_AR_CODE_PAD = 7;
export const MEMBER_REV_HEADER_CODE = MEMBER_AR_HEADER_CODE;
export const MEMBER_REV_HEADER_NAME = MEMBER_AR_HEADER_NAME;
export const MEMBER_REV_PREFIX = 'Member — ';

/** Stable AR sub-account under 4400, e.g. customer 1 → 4400-0000001. */
export function memberArAccountCode(customerId: number): string {
  const n = Math.abs(Math.trunc(Number(customerId) || 0));
  if (!(n > 0)) return '';
  return `${MEMBER_AR_HEADER_CODE}-${String(n).padStart(MEMBER_AR_CODE_PAD, '0')}`;
}

export function parseMemberArCustomerId(code: string): number | null {
  const m = /^4400-(\d+)$/.exec(String(code || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isMemberArAccountCode(code?: string | null): boolean {
  return parseMemberArCustomerId(String(code || '')) != null;
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

/** Gym members / clinic patients / shoppers — named revenue under Members & patients. */
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
  if (/^4400-\d+$/.test(code)) return true;
  if (String(a.subtype || '').toLowerCase() === 'receivable') return true;
  return /^AR\s+[—-]\s+/i.test(String(a.name || ''));
}

export function isSupplierAllocAccount(a: PartyCoaRow): boolean {
  if (a.is_header || a.is_active === false) return false;
  const code = String(a.code || '');
  if (CONTROL_AP.has(code)) return code === '2110';
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

function pickDisplayName(names: string[]): string {
  const cleaned = names.map((n) => n.replace(/\s+/g, ' ').trim()).filter(Boolean);
  cleaned.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return cleaned[0] || '';
}

function collectParties(
  rows: PartyBookRow[],
  keep: (row: PartyBookRow) => boolean
): Map<string, { key: string; name: string; ids: number[] }> {
  const map = new Map<string, { key: string; name: string; ids: number[]; names: string[] }>();
  for (const row of rows) {
    if (!keep(row)) continue;
    const display = partyDisplayName(row);
    if (!display) continue;
    const key = normalizePartyKey(display);
    if (!key) continue;
    const cur = map.get(key);
    if (cur) {
      cur.ids.push(Number(row.id));
      cur.names.push(display);
    } else {
      map.set(key, {
        key,
        name: display,
        ids: [Number(row.id)],
        names: [display],
      });
    }
  }
  const out = new Map<string, { key: string; name: string; ids: number[] }>();
  for (const [key, cur] of map) {
    out.set(key, { key, name: pickDisplayName(cur.names), ids: cur.ids });
  }
  return out;
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

function findMemberArHeader(coa: PartyCoaRow[]): PartyCoaRow | null {
  return (
    coa.find(
      (a) =>
        a.is_header &&
        a.is_active !== false &&
        String(a.code) === MEMBER_AR_HEADER_CODE
    ) ||
    coa.find(
      (a) =>
        a.is_header &&
        a.is_active !== false &&
        String(a.name) === MEMBER_AR_HEADER_NAME
    ) ||
    null
  );
}

function collectAdvisorAccounts(
  rows: PartyBookRow[]
): Array<{ id: number; name: string; code: string }> {
  const out: Array<{ id: number; name: string; code: string }> = [];
  for (const row of rows) {
    if (!isAdvisorParty(row)) continue;
    const name = partyDisplayName(row);
    const code = memberArAccountCode(Number(row.id));
    if (!name || !code) continue;
    out.push({ id: Number(row.id), name, code });
  }
  out.sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
  return out;
}

export function planPartyGlAccounts(opts: {
  customers: PartyBookRow[];
  suppliers: PartyBookRow[];
  coa: PartyCoaRow[];
}): { create: PartyGlCreate[]; links: PartyGlLink[] } {
  const usedCodes = new Set(
    (opts.coa || []).map((a) => String(a.code || '').trim()).filter(Boolean)
  );
  const create: PartyGlCreate[] = [];
  const links: PartyGlLink[] = [];

  const addKind = (
    table: 'customers' | 'srm_suppliers',
    kind: 'ar' | 'ap',
    parties: Map<string, { key: string; name: string; ids: number[] }>,
    start: number,
    sortBase: number
  ) => {
    const prefix = kind === 'ar' ? PARTY_AR_PREFIX : PARTY_AP_PREFIX;
    let i = 0;
    const sorted = [...parties.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const party of sorted) {
      const existing = findExistingPartyAccount(
        [...(opts.coa || []), ...create.map((c, idx) => ({
          id: -1 - idx,
          code: c.code,
          name: c.name,
        }))],
        kind,
        party.key,
        party.name
      );
      let code = existing?.code || '';
      let accountId = existing && existing.id > 0 ? Number(existing.id) : null;
      if (!existing) {
        code = nextFreeCode(usedCodes, start);
        usedCodes.add(code);
        create.push({
          code,
          name: `${prefix}${party.name}`,
          account_type: kind === 'ar' ? 'asset' : 'liability',
          subtype: kind === 'ar' ? 'receivable' : 'payable',
          normal_balance: kind === 'ar' ? 'debit' : 'credit',
          description:
            kind === 'ar'
              ? `Customer receivable — allocate bank receipts here (not 4100 Sales) if this is already invoiced.`
              : `Supplier payable — allocate bank payments here when settling a bill.`,
          metadata: {
            party_kind: kind === 'ar' ? 'customer' : 'supplier',
            party_key: party.key,
            party_ids: party.ids,
          },
          sort_order: sortBase + i,
        });
        i += 1;
      }
      for (const id of party.ids) {
        links.push({
          table,
          id,
          kind,
          key: party.key,
          name: `${prefix}${party.name}`,
          code,
          accountId,
        });
      }
    }
  };

  addKind(
    'customers',
    'ar',
    collectParties(opts.customers || [], isTradeParty),
    PARTY_AR_CODE_START,
    900
  );
  addKind(
    'srm_suppliers',
    'ap',
    collectParties(opts.suppliers || [], isTradeParty),
    PARTY_AP_CODE_START,
    950
  );

  const advisors = collectAdvisorAccounts(opts.customers || []);
  if (advisors.length) {
    const plannedAsCoa: PartyCoaRow[] = [
      ...(opts.coa || []),
      ...create.map((c, idx) => ({
        id: -1 - idx,
        code: c.code,
        name: c.name,
        is_header: c.is_header || false,
        account_type: c.account_type,
      })),
    ];
    let header = findMemberArHeader(plannedAsCoa);
    let headerCode = header?.code || MEMBER_AR_HEADER_CODE;
    if (!header) {
      headerCode = usedCodes.has(MEMBER_AR_HEADER_CODE)
        ? nextFreeCode(usedCodes, Number(MEMBER_AR_HEADER_CODE))
        : MEMBER_AR_HEADER_CODE;
      usedCodes.add(headerCode);
      create.push({
        code: headerCode,
        name: MEMBER_AR_HEADER_NAME,
        account_type: 'revenue',
        subtype: 'header',
        normal_balance: 'credit',
        description:
          'AR sub-accounts for gym members, clinic patients and retail shoppers. Each person is 4400-0000001 …',
        metadata: { party_kind: 'member_ar_header' },
        sort_order: 840,
        is_header: true,
        parent_code: usedCodes.has('4000') ? '4000' : null,
      });
    }
    let i = 0;
    for (const party of advisors) {
      const existing =
        [...(opts.coa || []), ...create.map((c, idx) => ({
          id: -1 - idx,
          code: c.code,
          name: c.name,
          is_header: c.is_header || false,
        }))].find(
          (a) =>
            !a.is_header &&
            a.is_active !== false &&
            String(a.code) === party.code
        ) || null;
      let code = existing?.code || party.code;
      let accountId = existing && existing.id > 0 ? Number(existing.id) : null;
      if (!existing) {
        if (usedCodes.has(code)) {
          continue;
        }
        usedCodes.add(code);
        create.push({
          code,
          name: party.name,
          account_type: 'asset',
          subtype: 'receivable',
          normal_balance: 'debit',
          description: `AR account ${code} — ${party.name}. Bank receipts for this person post here (not 4100 Sales) when already invoiced.`,
          metadata: {
            party_kind: 'member_ar',
            party_key: party.code,
            party_ids: [party.id],
            ar_account_number: code,
          },
          sort_order: 841 + i,
          parent_code: headerCode,
        });
        i += 1;
      }
      links.push({
        table: 'customers',
        id: party.id,
        kind: 'ar',
        key: party.code,
        name: party.name,
        code,
        accountId,
      });
    }
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
  const members = live.filter((a) => isMemberArAccountCode(String(a.code || ''))).sort(sortByCode);
  const customers = live
    .filter((a) => isCustomerAllocAccount(a) && !isMemberArAccountCode(String(a.code || '')))
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
    if (code.startsWith('4400-') && desc.includes(code)) {
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

/** Create/link one 4400-0000001 leaf for this CRM person. Safe to call on every add. */
export async function ensureMemberArLeaf(opts: {
  profileId: number;
  customerId: number;
  name: string;
}): Promise<{ code: string; accountId: number } | null> {
  const code = memberArAccountCode(opts.customerId);
  const name = partyDisplayName({ trading_name: opts.name }) || 'Member';
  if (!code || !Number.isFinite(opts.profileId) || opts.profileId <= 0) return null;
  const supabase = getSupabaseServer();
  const { data: existing } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .eq('profile_id', opts.profileId)
    .eq('code', code)
    .maybeSingle();
  let accountId = existing?.id ? Number(existing.id) : 0;

  let headerId: number | null = null;
  const { data: header } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .eq('profile_id', opts.profileId)
    .eq('code', MEMBER_AR_HEADER_CODE)
    .maybeSingle();
  if (header?.id) {
    headerId = Number(header.id);
  } else {
    const { data: rev } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('profile_id', opts.profileId)
      .eq('code', '4000')
      .maybeSingle();
    const ins = await supabase
      .from('chart_of_accounts')
      .insert({
        profile_id: opts.profileId,
        code: MEMBER_AR_HEADER_CODE,
        name: MEMBER_AR_HEADER_NAME,
        account_type: 'revenue',
        is_header: true,
        is_active: true,
        is_system: false,
        normal_balance: 'credit',
        parent_id: rev?.id ? Number(rev.id) : null,
        currency: 'ZAR',
        sort_order: 840,
        description:
          'AR sub-ledger for members, clients and patients. Each person is 4400-0000001 …',
        metadata: { party_kind: 'member_ar_header' },
      })
      .select('id')
      .maybeSingle();
    if (ins.data?.id) headerId = Number(ins.data.id);
    if (ins.error && /duplicate|unique/i.test(ins.error.message || '')) {
      const { data: again } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('profile_id', opts.profileId)
        .eq('code', MEMBER_AR_HEADER_CODE)
        .maybeSingle();
      if (again?.id) headerId = Number(again.id);
    }
  }

  if (!accountId) {
    const ins = await supabase
      .from('chart_of_accounts')
      .insert({
        profile_id: opts.profileId,
        code,
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
        description: `AR account ${code} — ${name}. Receipts for this person post here when invoiced.`,
        metadata: {
          party_kind: 'member_ar',
          party_ids: [opts.customerId],
          ar_account_number: code,
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

  const { data: book } = await supabase
    .from('customers')
    .select('metadata')
    .eq('id', opts.customerId)
    .eq('profile_id', opts.profileId)
    .maybeSingle();
  const meta = asRecord(book?.metadata);
  if (
    Number(meta.gl_account_id) !== accountId ||
    String(meta.gl_account_code || '') !== code
  ) {
    await supabase
      .from('customers')
      .update({
        metadata: {
          ...meta,
          gl_account_id: accountId,
          gl_account_code: code,
          gl_account_name: name,
          gl_account_kind: 'ar',
          ar_account_number: code,
        },
      })
      .eq('id', opts.customerId)
      .eq('profile_id', opts.profileId);
  }
  invalidateAccountingReads(opts.profileId);
  return { code, accountId };
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
  const supabase = getSupabaseServer();
  const [{ data: customers, error: cErr }, { data: suppliers, error: sErr }, { data: coa, error: aErr }] =
    await Promise.all([
      loadBookRows(supabase, 'customers', profileId, 'customer_type, source, notes'),
      loadBookRows(supabase, 'srm_suppliers', profileId),
      supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type, subtype, is_header, is_active, parent_id')
        .eq('profile_id', profileId),
    ]);
  if (cErr && /schema cache|does not exist/i.test(cErr.message || '')) {
    return { created: 0, linked: 0, warning: cErr.message };
  }
  if (aErr) return { created: 0, linked: 0, warning: aErr.message };

  const plan = planPartyGlAccounts({
    customers: (customers || []) as PartyBookRow[],
    suppliers: ((sErr ? [] : suppliers) || []) as PartyBookRow[],
    coa: (coa || []) as PartyCoaRow[],
  });

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
    const { error } = await supabase
      .from(link.table)
      .update({
        metadata: {
          ...meta,
          gl_account_id: accountId,
          gl_account_code: link.code,
          gl_account_name: link.name,
          gl_account_kind: link.kind,
        },
      })
      .eq('id', link.id)
      .eq('profile_id', profileId);
    if (!error) linked += 1;
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
    if (opts.kind === 'ar') {
      const code = memberArAccountCode(partyId);
      if (code) {
        const { data: byCode } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('profile_id', opts.profileId)
          .eq('code', code)
          .maybeSingle();
        if (byCode?.id) return Number(byCode.id);
        const leaf = await ensureMemberArLeaf({
          profileId: opts.profileId,
          customerId: partyId,
          name: partyDisplayName({
            trading_name: data?.trading_name,
            legal_name: data?.legal_name,
          }),
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
