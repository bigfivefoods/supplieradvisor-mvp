/**
 * Set a party as customer / supplier / both and allocate 1180-* AR
 * and/or 2180-* AP. Relabel 1180 Customers and 2180 Suppliers on every
 * company CoA (including a one-shot pass across all tenants).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  CUSTOMER_AR_HEADER_NAME,
  MEMBER_AR_HEADER_CODE,
  SUPPLIER_AP_HEADER_CODE,
  SUPPLIER_AP_HEADER_NAME,
  ensureCustomerArLeaf,
  ensureMemberArLeaf,
  ensureSupplierApLeaf,
  memberArAccountCode,
  supplierApAccountCode,
} from '@/lib/accounting/party-gl-accounts';
import {
  bookRoleFromMeta,
  glCodeFromMeta,
  parsePartyBookRole,
  type PartyBookRole,
} from '@/lib/accounting/party-roles';
import { invalidateAccountingReads } from '@/lib/accounting/read-cache';

const CUSTOMER_HEADER_DESC =
  'Customer AR header. Each customer is a unique leaf 1180-0000001 … (scales to thousands). Statement presentation rolls into Trade and other receivables with 1130. Not a revenue account — income posts to 4100/4200/4400.';
const SUPPLIER_HEADER_DESC =
  'Supplier AP header. Each supplier is a unique leaf 2180-0000001 … (scales to thousands). Statement presentation rolls into Trade and other payables with 2110. Employed staff stay on 6100 (IAS 19).';

export function bookRoleNeedsAr(role: PartyBookRole): boolean {
  return role === 'customer' || role === 'both';
}

export function bookRoleNeedsAp(role: PartyBookRole): boolean {
  return role === 'supplier' || role === 'both';
}

export { parsePartyBookRole, bookRoleFromMeta };

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export async function relabelPartyCoaHeaders(
  profileId: number
): Promise<{ updated: number }> {
  if (!Number.isFinite(profileId) || profileId <= 0) {
    return { updated: 0 };
  }
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const ar = await supabase
    .from('chart_of_accounts')
    .update({
      name: CUSTOMER_AR_HEADER_NAME,
      is_header: true,
      account_type: 'asset',
      subtype: 'receivable',
      normal_balance: 'debit',
      description: CUSTOMER_HEADER_DESC,
      updated_at: now,
    })
    .eq('profile_id', profileId)
    .eq('code', MEMBER_AR_HEADER_CODE)
    .select('id');
  const ap = await supabase
    .from('chart_of_accounts')
    .update({
      name: SUPPLIER_AP_HEADER_NAME,
      is_header: true,
      account_type: 'liability',
      subtype: 'payable',
      normal_balance: 'credit',
      description: SUPPLIER_HEADER_DESC,
      updated_at: now,
    })
    .eq('profile_id', profileId)
    .eq('code', SUPPLIER_AP_HEADER_CODE)
    .select('id');
  const updated = (ar.data?.length || 0) + (ap.data?.length || 0);
  if (updated) invalidateAccountingReads(profileId);
  return { updated };
}

/** One UPDATE per header code — every company that has 1180 / 2180. */
export async function relabelPartyCoaHeadersAll(): Promise<{
  customers: number;
  suppliers: number;
}> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const ar = await supabase
    .from('chart_of_accounts')
    .update({
      name: CUSTOMER_AR_HEADER_NAME,
      is_header: true,
      account_type: 'asset',
      subtype: 'receivable',
      normal_balance: 'debit',
      description: CUSTOMER_HEADER_DESC,
      updated_at: now,
    })
    .eq('code', MEMBER_AR_HEADER_CODE)
    .select('id');
  const ap = await supabase
    .from('chart_of_accounts')
    .update({
      name: SUPPLIER_AP_HEADER_NAME,
      is_header: true,
      account_type: 'liability',
      subtype: 'payable',
      normal_balance: 'credit',
      description: SUPPLIER_HEADER_DESC,
      updated_at: now,
    })
    .eq('code', SUPPLIER_AP_HEADER_CODE)
    .select('id');
  return {
    customers: ar.data?.length || 0,
    suppliers: ap.data?.length || 0,
  };
}

let allRelabelStarted = false;
export async function relabelPartyCoaHeadersAllOnce(): Promise<void> {
  if (allRelabelStarted) return;
  allRelabelStarted = true;
  try {
    await relabelPartyCoaHeadersAll();
  } catch (err) {
    allRelabelStarted = false;
    console.warn('[party-book] relabel all', err);
  }
}

async function stampBookRole(
  table: 'customers' | 'srm_suppliers',
  profileId: number,
  id: number,
  prev: Record<string, unknown>,
  role: PartyBookRole,
  extra?: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const full = {
    metadata: {
      ...prev,
      party_book_role: role,
      ...(extra || {}),
    },
    updated_at: now,
  };
  let { error } = await supabase
    .from(table)
    .update(full)
    .eq('id', id)
    .eq('profile_id', profileId);
  if (error) {
    const retry = await supabase
      .from(table)
      .update({
        metadata: { ...prev, party_book_role: role },
        updated_at: now,
      })
      .eq('id', id)
      .eq('profile_id', profileId);
    error = retry.error;
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function setPartyLeafActive(opts: {
  profileId: number;
  codes: Array<string | null | undefined>;
  ids?: Array<number | null | undefined>;
  active: boolean;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const codes = [
    ...new Set(
      opts.codes.map((c) => String(c || '').trim()).filter((c) => c.length > 0)
    ),
  ];
  const ids = [
    ...new Set(
      (opts.ids || [])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (codes.length) {
    await supabase
      .from('chart_of_accounts')
      .update({ is_active: opts.active, updated_at: now })
      .eq('profile_id', opts.profileId)
      .in('code', codes);
  }
  for (const id of ids) {
    await supabase
      .from('chart_of_accounts')
      .update({ is_active: opts.active, updated_at: now })
      .eq('profile_id', opts.profileId)
      .eq('id', id);
  }
  if (codes.length || ids.length) invalidateAccountingReads(opts.profileId);
}

async function findCustomerTwin(
  profileId: number,
  from: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  const email = String(from.email || '').trim().toLowerCase();
  if (email.includes('@')) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('profile_id', profileId)
      .ilike('email', email)
      .limit(1);
    if (data?.[0]) return data[0] as Record<string, unknown>;
  }
  const name = String(from.trading_name || from.legal_name || '').trim();
  if (name) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('profile_id', profileId)
      .ilike('trading_name', name)
      .limit(1);
    if (data?.[0]) return data[0] as Record<string, unknown>;
  }
  return null;
}

async function findSupplierTwin(
  profileId: number,
  from: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  const email = String(from.email || '').trim().toLowerCase();
  if (email.includes('@')) {
    const { data } = await supabase
      .from('srm_suppliers')
      .select('*')
      .eq('profile_id', profileId)
      .ilike('email', email)
      .limit(1);
    if (data?.[0]) return data[0] as Record<string, unknown>;
  }
  const name = String(from.trading_name || from.legal_name || '').trim();
  if (name) {
    const { data } = await supabase
      .from('srm_suppliers')
      .select('*')
      .eq('profile_id', profileId)
      .ilike('trading_name', name)
      .limit(1);
    if (data?.[0]) return data[0] as Record<string, unknown>;
  }
  return null;
}

async function insertCustomerFrom(
  profileId: number,
  from: Record<string, unknown>,
  role: PartyBookRole
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  const payload: Record<string, unknown> = {
    profile_id: profileId,
    trading_name: from.trading_name || from.legal_name || 'Customer',
    legal_name: from.legal_name || null,
    email: from.email || null,
    phone: from.phone || null,
    contact_name: from.contact_name || null,
    city: from.city || null,
    country: from.country || null,
    vat_number: from.vat_number || null,
    registration_number: from.registration_number || null,
    status: 'active',
    customer_type: 'business',
    metadata: {
      party_book_role: role,
      source_supplier_id: from.id || null,
    },
    updated_at: new Date().toISOString(),
  };
  let { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error && /column|schema cache/i.test(error.message || '')) {
    const retry = await supabase
      .from('customers')
      .insert({
        profile_id: profileId,
        trading_name: payload.trading_name,
        email: payload.email,
        status: 'active',
      })
      .select('*')
      .maybeSingle();
    data = retry.data;
  }
  return (data as Record<string, unknown>) || null;
}

async function insertSupplierFrom(
  profileId: number,
  from: Record<string, unknown>,
  role: PartyBookRole
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  const payload: Record<string, unknown> = {
    profile_id: profileId,
    trading_name: from.trading_name || from.legal_name || 'Supplier',
    legal_name: from.legal_name || from.trading_name || null,
    email: from.email || null,
    phone: from.phone || null,
    contact_name: from.contact_name || null,
    city: from.city || null,
    country: from.country || 'South Africa',
    vat_number: from.vat_number || null,
    registration_number: from.registration_number || null,
    status: 'prospect',
    invite_status: 'not_invited',
    metadata: {
      party_book_role: role,
      source_customer_id: from.id || null,
    },
    updated_at: new Date().toISOString(),
  };
  let { data, error } = await supabase
    .from('srm_suppliers')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error && /column|schema cache/i.test(error.message || '')) {
    const retry = await supabase
      .from('srm_suppliers')
      .insert({
        profile_id: profileId,
        trading_name: payload.trading_name,
        email: payload.email,
        status: 'prospect',
      })
      .select('*')
      .maybeSingle();
    data = retry.data;
  }
  return (data as Record<string, unknown>) || null;
}

export async function applyPartyBookRole(opts: {
  profileId: number;
  role: PartyBookRole;
  customerId?: number | null;
  supplierId?: number | null;
}): Promise<{
  ok: boolean;
  role: PartyBookRole;
  customer_id: number | null;
  supplier_id: number | null;
  ar_account_code: string | null;
  ap_account_code: string | null;
  error?: string;
}> {
  const role = opts.role;
  const supabase = getSupabaseServer();
  let customer: Record<string, unknown> | null = null;
  let supplier: Record<string, unknown> | null = null;

  if (Number(opts.customerId || 0) > 0) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', Number(opts.customerId))
      .eq('profile_id', opts.profileId)
      .maybeSingle();
    customer = (data as Record<string, unknown>) || null;
  }
  if (Number(opts.supplierId || 0) > 0) {
    const { data } = await supabase
      .from('srm_suppliers')
      .select('*')
      .eq('id', Number(opts.supplierId))
      .eq('profile_id', opts.profileId)
      .maybeSingle();
    supplier = (data as Record<string, unknown>) || null;
  }
  if (!customer && !supplier) {
    return {
      ok: false,
      role,
      customer_id: null,
      supplier_id: null,
      ar_account_code: null,
      ap_account_code: null,
      error: 'Customer or supplier required',
    };
  }

  await relabelPartyCoaHeaders(opts.profileId);

  if (supplier && !customer) {
    customer = await findCustomerTwin(opts.profileId, supplier);
  }
  if (customer && !supplier) {
    supplier = await findSupplierTwin(opts.profileId, customer);
  }

  if (bookRoleNeedsAr(role) && !customer && supplier) {
    customer = await insertCustomerFrom(opts.profileId, supplier, role);
  }
  if (bookRoleNeedsAp(role) && !supplier && customer) {
    supplier = await insertSupplierFrom(opts.profileId, customer, role);
  }

  const customerId = customer?.id ? Number(customer.id) : null;
  const supplierId = supplier?.id ? Number(supplier.id) : null;
  let ar: string | null = customer ? glCodeFromMeta(customer.metadata) : null;
  let ap: string | null = supplier ? glCodeFromMeta(supplier.metadata) : null;

  const arCodes = [
    ar,
    customerId ? memberArAccountCode(customerId) : null,
    glCodeFromMeta(customer?.metadata),
  ];
  const apCodes = [
    ap,
    supplierId ? supplierApAccountCode(supplierId) : null,
    glCodeFromMeta(supplier?.metadata),
  ];
  const arId = Number(asMeta(customer?.metadata).gl_account_id);
  const apId = Number(asMeta(supplier?.metadata).gl_account_id);

  if (bookRoleNeedsAr(role) && customerId) {
    const name = String(customer?.trading_name || customer?.legal_name || 'Customer');
    const leaf =
      (await ensureCustomerArLeaf({
        profileId: opts.profileId,
        customerId,
        name,
      })) ||
      (await ensureMemberArLeaf({
        profileId: opts.profileId,
        customerId,
        name,
      }));
    if (leaf?.code) ar = leaf.code;
    await setPartyLeafActive({
      profileId: opts.profileId,
      codes: [...arCodes, leaf?.code],
      ids: [leaf?.accountId, arId],
      active: true,
    });
  } else if (customerId) {
    await setPartyLeafActive({
      profileId: opts.profileId,
      codes: arCodes,
      ids: [arId],
      active: false,
    });
    ar = null;
  }

  if (bookRoleNeedsAp(role) && supplierId) {
    const name = String(supplier?.trading_name || supplier?.legal_name || 'Supplier');
    const leaf = await ensureSupplierApLeaf({
      profileId: opts.profileId,
      supplierId,
      name,
    });
    if (leaf?.code) ap = leaf.code;
    await setPartyLeafActive({
      profileId: opts.profileId,
      codes: [...apCodes, leaf?.code],
      ids: [leaf?.accountId, apId],
      active: true,
    });
  } else if (supplierId) {
    await setPartyLeafActive({
      profileId: opts.profileId,
      codes: apCodes,
      ids: [apId],
      active: false,
    });
    ap = null;
  }

  if (customerId) {
    const stamped = await stampBookRole(
      'customers',
      opts.profileId,
      customerId,
      asMeta(customer?.metadata),
      role,
      supplierId ? { twin_supplier_id: supplierId } : undefined
    );
    if (!stamped.ok) {
      return {
        ok: false,
        role,
        customer_id: customerId,
        supplier_id: supplierId,
        ar_account_code: ar,
        ap_account_code: ap,
        error: stamped.error,
      };
    }
  }
  if (supplierId) {
    const stamped = await stampBookRole(
      'srm_suppliers',
      opts.profileId,
      supplierId,
      asMeta(supplier?.metadata),
      role,
      customerId ? { twin_customer_id: customerId } : undefined
    );
    if (!stamped.ok) {
      return {
        ok: false,
        role,
        customer_id: customerId,
        supplier_id: supplierId,
        ar_account_code: ar,
        ap_account_code: ap,
        error: stamped.error,
      };
    }
  }
  return {
    ok: true,
    role,
    customer_id: customerId,
    supplier_id: supplierId,
    ar_account_code: ar,
    ap_account_code: ap,
  };
}
