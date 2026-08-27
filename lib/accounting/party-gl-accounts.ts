/**
 * Named customer AR and supplier AP leaves so bank allocation can
 * pick a party instead of dumping receipts into 4100 Sales.
 *
 * 1130 / 2110 stay posting leaves (invoice-gl requires that). Party
 * accounts live in 1181+ and 2181+ and never convert those controls
 * into headers.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { invalidateAccountingReads } from '@/lib/accounting/read-cache';
import { ttlGet, ttlSet } from '@/lib/system/memory-ttl';
import type { CoaAccount } from '@/lib/accounting/types';

export const PARTY_AR_CODE_START = 1181;
export const PARTY_AP_CODE_START = 2181;
export const PARTY_AR_PREFIX = 'AR — ';
export const PARTY_AP_PREFIX = 'AP — ';

const SKIP_STATUS = new Set([
  'inactive',
  'archived',
  'closed',
  'deleted',
  'void',
]);

/** Wallet / PWA members are CRM rows, not trade parties for bank allocation. */
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
};

export type PartyGlCreate = {
  code: string;
  name: string;
  account_type: 'asset' | 'liability';
  subtype: 'receivable' | 'payable';
  normal_balance: 'debit' | 'credit';
  description: string;
  metadata: Record<string, unknown>;
  sort_order: number;
};

export type PartyGlLink = {
  table: 'customers' | 'srm_suppliers';
  id: number;
  kind: 'ar' | 'ap';
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
    .trim();
}

export function isCustomerAllocAccount(a: PartyCoaRow): boolean {
  if (a.is_header || a.is_active === false) return false;
  const code = String(a.code || '');
  if (CONTROL_AR.has(code)) return code === '1130';
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
  return /^AR\s+[—-]\s+/i.test(name) || /^AP\s+[—-]\s+/i.test(name);
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
  rows: PartyBookRow[]
): Map<string, { key: string; name: string; ids: number[] }> {
  const map = new Map<string, { key: string; name: string; ids: number[]; names: string[] }>();
  for (const row of rows) {
    if (!isTradeParty(row)) continue;
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
  kind: 'ar' | 'ap',
  key: string,
  displayName: string
): PartyCoaRow | null {
  const prefix = kind === 'ar' ? PARTY_AR_PREFIX : PARTY_AP_PREFIX;
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
      return normalizePartyKey(stripPartyPrefix(name)) === key;
    }) || null
  );
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
    collectParties(opts.customers || []),
    PARTY_AR_CODE_START,
    900
  );
  addKind(
    'srm_suppliers',
    'ap',
    collectParties(opts.suppliers || []),
    PARTY_AP_CODE_START,
    950
  );

  return { create, links };
}

export type AllocGlGroup = {
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
  const customers = live.filter((a) => isCustomerAllocAccount(a)).sort(sortByCode);
  const suppliers = live.filter((a) => isSupplierAllocAccount(a)).sort(sortByCode);
  const used = new Set([...customers, ...suppliers].map((a) => Number(a.id)));
  const incomeExpense = live
    .filter((a) => ['revenue', 'expense', 'cogs'].includes(String(a.account_type)))
    .filter((a) => !used.has(Number(a.id)))
    .sort(sortByCode);
  const other = live
    .filter((a) => !used.has(Number(a.id)))
    .filter((a) => !['revenue', 'expense', 'cogs'].includes(String(a.account_type)))
    .sort(sortByCode);
  return { customers, suppliers, incomeExpense, other };
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
  const pool = (coa || [])
    .filter((a) =>
      isIn ? isCustomerAllocAccount(a) && String(a.code) !== '1130' : isSupplierAllocAccount(a) && String(a.code) !== '2110'
    )
    .map((a) => ({
      account: a,
      needle: stripPartyPrefix(String(a.name || '')).toLowerCase(),
    }))
    .filter((x) => x.needle.length >= 3)
    .sort((a, b) => b.needle.length - a.needle.length);

  for (const hit of pool) {
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

export async function ensurePartyGlAccounts(
  profileId: number
): Promise<{ created: number; linked: number; warning?: string }> {
  if (!Number.isFinite(profileId) || profileId <= 0) {
    return { created: 0, linked: 0, warning: 'invalid profile' };
  }
  const supabase = getSupabaseServer();
  const [{ data: customers, error: cErr }, { data: suppliers, error: sErr }, { data: coa, error: aErr }] =
    await Promise.all([
      loadBookRows(supabase, 'customers', profileId, 'customer_type, source'),
      loadBookRows(supabase, 'srm_suppliers', profileId),
      supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type, subtype, is_header, is_active')
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
        subtype: row.subtype,
        is_active: true,
        is_system: false,
        is_header: false,
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
