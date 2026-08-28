/**
 * Per-company mapping: which CoA parent new customers (AR) and
 * suppliers (AP) nest under. Stored on accounting_settings.metadata
 * so a company can change it without a migration.
 *
 * Defaults: 1180 Customers, 2180 Suppliers.
 * IFRS: AR parent must be an asset; AP parent must be a liability.
 */
import type { CoaAccount } from '@/lib/accounting/types';

export const DEFAULT_AR_PARENT_CODE = '1180';
export const DEFAULT_AR_PARENT_NAME = 'Customers';
export const DEFAULT_AP_PARENT_CODE = '2180';
export const DEFAULT_AP_PARENT_NAME = 'Suppliers';

export type PartyLedgerStored = {
  ar_parent_account_id: number | null;
  ar_parent_code: string;
  member_ar_parent_account_id: number | null;
  /** Null / blank = same as customers (AR). */
  member_ar_parent_code: string | null;
  ap_parent_account_id: number | null;
  ap_parent_code: string;
  contractor_ap_parent_account_id: number | null;
  /** Null / blank = same as suppliers (AP). */
  contractor_ap_parent_code: string | null;
};

export type PartyLedgerParent = {
  id: number | null;
  code: string;
  name: string;
};

export type PartyLedgerParents = {
  ar: PartyLedgerParent;
  members: PartyLedgerParent;
  ap: PartyLedgerParent;
  contractors: PartyLedgerParent;
};

export const DEFAULT_PARTY_LEDGER: PartyLedgerStored = {
  ar_parent_account_id: null,
  ar_parent_code: DEFAULT_AR_PARENT_CODE,
  member_ar_parent_account_id: null,
  member_ar_parent_code: null,
  ap_parent_account_id: null,
  ap_parent_code: DEFAULT_AP_PARENT_CODE,
  contractor_ap_parent_account_id: null,
  contractor_ap_parent_code: null,
};

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function cleanCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/[^0-9A-Za-z-]/g, '')
    .slice(0, 16);
}

function cleanId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function blankToNull(code: string | null | undefined): string | null {
  const c = String(code || '').trim();
  return c ? c : null;
}

export function parsePartyLedgerStored(meta: unknown): PartyLedgerStored {
  const root = asRecord(meta);
  const raw = asRecord(root.party_ledger);
  const arCode = cleanCode(raw.ar_parent_code) || DEFAULT_AR_PARENT_CODE;
  const apCode = cleanCode(raw.ap_parent_code) || DEFAULT_AP_PARENT_CODE;
  return {
    ar_parent_account_id: cleanId(raw.ar_parent_account_id),
    ar_parent_code: arCode,
    member_ar_parent_account_id: cleanId(raw.member_ar_parent_account_id),
    member_ar_parent_code: blankToNull(cleanCode(raw.member_ar_parent_code)),
    ap_parent_account_id: cleanId(raw.ap_parent_account_id),
    ap_parent_code: apCode,
    contractor_ap_parent_account_id: cleanId(raw.contractor_ap_parent_account_id),
    contractor_ap_parent_code: blankToNull(cleanCode(raw.contractor_ap_parent_code)),
  };
}

export function eligibleArParent(a: {
  code?: string | null;
  account_type?: string | null;
  subtype?: string | null;
  is_active?: boolean | null;
}): boolean {
  if (a.is_active === false) return false;
  if (String(a.account_type || '').toLowerCase() !== 'asset') return false;
  const sub = String(a.subtype || '').toLowerCase();
  if (['contra_asset', 'bank', 'cash', 'inventory', 'tax'].includes(sub)) {
    return false;
  }
  const code = String(a.code || '');
  if (code === '1135' || code === '1110' || code === '1120' || code === '1140' || code === '1150') {
    return false;
  }
  return true;
}

export function eligibleApParent(a: {
  code?: string | null;
  account_type?: string | null;
  subtype?: string | null;
  is_active?: boolean | null;
}): boolean {
  if (a.is_active === false) return false;
  if (String(a.account_type || '').toLowerCase() !== 'liability') return false;
  const sub = String(a.subtype || '').toLowerCase();
  if (sub === 'tax') return false;
  const code = String(a.code || '');
  if (code === '2120') return false;
  return true;
}

function findCoa(
  coa: Array<{
    id?: number;
    code?: string | null;
    name?: string | null;
    is_active?: boolean | null;
  }>,
  id: number | null,
  code: string
) {
  if (id) {
    const byId = coa.find((a) => Number(a.id) === id && a.is_active !== false);
    if (byId) return byId;
  }
  const want = String(code || '').trim();
  if (!want) return null;
  return coa.find((a) => String(a.code) === want && a.is_active !== false) || null;
}

function parentFrom(
  coa: CoaAccount[],
  id: number | null,
  code: string,
  fallbackName: string
): PartyLedgerParent {
  const hit = findCoa(coa, id, code);
  return {
    id: hit?.id ? Number(hit.id) : null,
    code: hit?.code ? String(hit.code) : code,
    name: hit?.name ? String(hit.name) : fallbackName,
  };
}

export function resolvePartyLedgerParents(
  stored: PartyLedgerStored | null | undefined,
  coa: CoaAccount[]
): PartyLedgerParents {
  const s = stored || DEFAULT_PARTY_LEDGER;
  const ar = parentFrom(
    coa,
    s.ar_parent_account_id,
    s.ar_parent_code || DEFAULT_AR_PARENT_CODE,
    DEFAULT_AR_PARENT_NAME
  );
  const memberCode = s.member_ar_parent_code || ar.code;
  const members =
    !s.member_ar_parent_code && !s.member_ar_parent_account_id
      ? ar
      : parentFrom(
          coa,
          s.member_ar_parent_account_id,
          memberCode,
          DEFAULT_AR_PARENT_NAME
        );
  const ap = parentFrom(
    coa,
    s.ap_parent_account_id,
    s.ap_parent_code || DEFAULT_AP_PARENT_CODE,
    DEFAULT_AP_PARENT_NAME
  );
  const contractorCode = s.contractor_ap_parent_code || ap.code;
  const contractors =
    !s.contractor_ap_parent_code && !s.contractor_ap_parent_account_id
      ? ap
      : parentFrom(
          coa,
          s.contractor_ap_parent_account_id,
          contractorCode,
          DEFAULT_AP_PARENT_NAME
        );
  return { ar, members, ap, contractors };
}

export function partyLedgerValidationError(
  stored: PartyLedgerStored,
  coa: CoaAccount[]
): string | null {
  const resolved = resolvePartyLedgerParents(stored, coa);
  const check = (
    parent: PartyLedgerParent,
    kind: 'ar' | 'ap',
    allowMissingDefault: string
  ): string | null => {
    const row = findCoa(coa, parent.id, parent.code);
    if (!row) {
      if (parent.code === allowMissingDefault) return null;
      return `CoA account ${parent.code} was not found. Create it on the chart, then pick it here.`;
    }
    if (kind === 'ar' && !eligibleArParent(row)) {
      return `${parent.code} · ${parent.name} is not an asset receivable. AR must sit under current assets (IAS 1), not income.`;
    }
    if (kind === 'ap' && !eligibleApParent(row)) {
      return `${parent.code} · ${parent.name} is not a liability payable. AP must sit under current liabilities (IAS 1).`;
    }
    return null;
  };
  return (
    check(resolved.ar, 'ar', DEFAULT_AR_PARENT_CODE) ||
    check(resolved.members, 'ar', DEFAULT_AR_PARENT_CODE) ||
    check(resolved.ap, 'ap', DEFAULT_AP_PARENT_CODE) ||
    check(resolved.contractors, 'ap', DEFAULT_AP_PARENT_CODE)
  );
}

export function mergePartyLedgerMetadata(
  prevMeta: unknown,
  stored: PartyLedgerStored
): Record<string, unknown> {
  const meta = { ...asRecord(prevMeta) };
  meta.party_ledger = stored;
  return meta;
}

export function storedFromPatch(
  raw: Record<string, unknown>,
  coa: CoaAccount[]
): PartyLedgerStored {
  const base = parsePartyLedgerStored({ party_ledger: raw });
  const fill = (
    id: number | null,
    code: string
  ): { id: number | null; code: string } => {
    const hit = findCoa(coa, id, code);
    if (hit) {
      return {
        id: hit.id ? Number(hit.id) : id,
        code: hit.code ? String(hit.code) : code,
      };
    }
    return { id, code };
  };
  const ar = fill(base.ar_parent_account_id, base.ar_parent_code);
  const ap = fill(base.ap_parent_account_id, base.ap_parent_code);
  const memberCode = base.member_ar_parent_code;
  const contractorCode = base.contractor_ap_parent_code;
  const members = memberCode
    ? fill(base.member_ar_parent_account_id, memberCode)
    : { id: null, code: null as string | null };
  const contractors = contractorCode
    ? fill(base.contractor_ap_parent_account_id, contractorCode)
    : { id: null, code: null as string | null };
  return {
    ar_parent_account_id: ar.id,
    ar_parent_code: ar.code || DEFAULT_AR_PARENT_CODE,
    member_ar_parent_account_id: members.id,
    member_ar_parent_code: members.code,
    ap_parent_account_id: ap.id,
    ap_parent_code: ap.code || DEFAULT_AP_PARENT_CODE,
    contractor_ap_parent_account_id: contractors.id,
    contractor_ap_parent_code: contractors.code,
  };
}
