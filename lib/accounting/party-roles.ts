/**
 * Customers you sell to (AR) vs suppliers you buy from (AP).
 * Same legal firm can be both — two books, two GL leaves, never netted
 * (IAS 1 / IAS 32 offsetting).
 */
import {
  isHyphenSubAccountCode,
  isMemberArAccountCode,
  isSupplierApAccountCode,
  normalizePartyKey,
  partyDisplayName,
} from '@/lib/accounting/party-gl-accounts';
import type { CoaAccount } from '@/lib/accounting/types';

export type PartyBookRole = 'customer' | 'supplier' | 'both';

export function parsePartyBookRole(raw: unknown): PartyBookRole | null {
  const r = String(raw || '').toLowerCase().trim();
  if (r === 'customer' || r === 'supplier' || r === 'both') return r;
  return null;
}

export function bookRoleFromMeta(meta: unknown): PartyBookRole | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  return parsePartyBookRole((meta as { party_book_role?: unknown }).party_book_role);
}

export type PartyRoleInput = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  linked_profile_id?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type PartyRoleRow = {
  key: string;
  name: string;
  role: PartyBookRole;
  customer_id: number | null;
  supplier_id: number | null;
  ar_account_code: string | null;
  ap_account_code: string | null;
  customer_status: string | null;
  supplier_status: string | null;
  explicit_role?: PartyBookRole | null;
};

export type CoaPartyKind =
  | 'customer_ar'
  | 'member_ar'
  | 'supplier_ap'
  | 'control_ar'
  | 'control_ap'
  | null;

export function glCodeFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const code = String(
    (meta as { gl_account_code?: unknown }).gl_account_code || ''
  ).trim();
  return code || null;
}

function emailKey(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

function partyKey(row: PartyRoleInput): string {
  const linked = Number(row.linked_profile_id || 0);
  if (linked > 0) return `linked:${linked}`;
  const email = emailKey(row.email);
  if (email.includes('@')) return `email:${email}`;
  const name = normalizePartyKey(partyDisplayName(row));
  return name ? `name:${name}` : `id:${row.id}`;
}

export function assemblePartyRoles(
  customers: PartyRoleInput[],
  suppliers: PartyRoleInput[]
): PartyRoleRow[] {
  const map = new Map<string, PartyRoleRow>();
  const alias = new Map<string, string>();

  const take = (
    key: string,
    name: string,
    patch: Partial<PartyRoleRow>
  ) => {
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        key,
        name,
        role:
          patch.explicit_role ||
          (patch.customer_id ? 'customer' : 'supplier'),
        customer_id: patch.customer_id ?? null,
        supplier_id: patch.supplier_id ?? null,
        ar_account_code: patch.ar_account_code ?? null,
        ap_account_code: patch.ap_account_code ?? null,
        customer_status: patch.customer_status ?? null,
        supplier_status: patch.supplier_status ?? null,
        explicit_role: patch.explicit_role ?? null,
      });
      const nk = `name:${normalizePartyKey(name)}`;
      if (nk.length > 8 && !alias.has(nk)) alias.set(nk, key);
      return;
    }
    if (patch.customer_id) {
      cur.customer_id = patch.customer_id;
      cur.ar_account_code = patch.ar_account_code || cur.ar_account_code;
      cur.customer_status = patch.customer_status || cur.customer_status;
      if (!cur.name) cur.name = name;
    }
    if (patch.supplier_id) {
      cur.supplier_id = patch.supplier_id;
      cur.ap_account_code = patch.ap_account_code || cur.ap_account_code;
      cur.supplier_status = patch.supplier_status || cur.supplier_status;
      if (!cur.name) cur.name = name;
    }
    if (patch.explicit_role) cur.explicit_role = patch.explicit_role;
    cur.role =
      cur.explicit_role ||
      (cur.customer_id && cur.supplier_id
        ? 'both'
        : cur.customer_id
          ? 'customer'
          : 'supplier');
  };

  const resolveKey = (row: PartyRoleInput, name: string): string => {
    const direct = partyKey(row);
    if (map.has(direct)) return direct;
    const nk = `name:${normalizePartyKey(name)}`;
    return alias.get(nk) || direct;
  };

  for (const row of customers || []) {
    if (!row?.id) continue;
    const name = partyDisplayName(row);
    if (!name) continue;
    take(partyKey(row), name, {
      customer_id: Number(row.id),
      ar_account_code: glCodeFromMeta(row.metadata),
      customer_status: row.status || null,
      explicit_role: bookRoleFromMeta(row.metadata),
    });
  }
  for (const row of suppliers || []) {
    if (!row?.id) continue;
    const name = partyDisplayName(row);
    if (!name) continue;
    take(resolveKey(row, name), name, {
      supplier_id: Number(row.id),
      ap_account_code: glCodeFromMeta(row.metadata),
      supplier_status: row.status || null,
      explicit_role: bookRoleFromMeta(row.metadata),
    });
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function classifyCoaParty(a: {
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
  subtype?: string | null;
  is_header?: boolean | null;
}): CoaPartyKind {
  const code = String(a.code || '');
  const name = String(a.name || '');
  const type = String(a.account_type || '').toLowerCase();
  const sub = String(a.subtype || '').toLowerCase();
  if (code === '1130') return 'control_ar';
  if (code === '2110') return 'control_ap';
  if (a.is_header) {
    if (code === '1180' || /members|patients|^customers$/i.test(name)) {
      return 'customer_ar';
    }
    if (code === '2180' || /supplier|contractor|payable/i.test(name)) {
      return 'supplier_ap';
    }
    return null;
  }
  if (isMemberArAccountCode(code)) return 'customer_ar';
  if (isSupplierApAccountCode(code)) return 'supplier_ap';
  if (/^AR\s+[—-]\s+/i.test(name)) return 'customer_ar';
  if (/^AP\s+[—-]\s+/i.test(name)) return 'supplier_ap';
  if (isHyphenSubAccountCode(code)) {
    if (type === 'liability' || sub === 'payable') return 'supplier_ap';
    if (type === 'asset' || sub === 'receivable') return 'customer_ar';
  }
  if (sub === 'receivable' && code !== '1135') return 'customer_ar';
  if (sub === 'payable' && code !== '2110') return 'supplier_ap';
  return null;
}

export function coaPartyLabel(kind: CoaPartyKind): string | null {
  switch (kind) {
    case 'customer_ar':
    case 'member_ar':
      return 'customer-ar';
    case 'supplier_ap':
      return 'supplier-ap';
    case 'control_ar':
      return 'AR control';
    case 'control_ap':
      return 'AP control';
    default:
      return null;
  }
}

export function isCustomerCoaKind(kind: CoaPartyKind): boolean {
  return kind === 'customer_ar' || kind === 'member_ar' || kind === 'control_ar';
}

export function isSupplierCoaKind(kind: CoaPartyKind): boolean {
  return kind === 'supplier_ap' || kind === 'control_ap';
}

export function partyRoleLabel(role: PartyBookRole): string {
  if (role === 'both') return 'Customer and supplier';
  if (role === 'supplier') return 'Supplier · you buy';
  return 'Customer · you sell';
}
