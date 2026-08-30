import { getSupabaseServer } from '@/lib/supabase/server-client';
import { bookRoleFromMeta } from '@/lib/accounting/party-roles';
import {
  customerBookPartyGate,
  supplierBookPartyGate,
  twinHintFor,
  indexBookTwins,
} from '@/lib/portals/supplier-portal-party';

export async function assertSupplierPortalParty(
  companyId: number,
  supplierId: number | null | undefined
): Promise<
  | {
      ok: true;
      srm: Record<string, unknown>;
      linkedProfileId: number | null;
    }
  | {
      ok: false;
      error: string;
      status: number;
      reason: 'missing' | 'blocked' | 'customer_only' | 'not_supplier';
    }
> {
  const id = Number(supplierId);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      error: 'Pick a supplier on your books',
      status: 400,
      reason: 'missing',
    };
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('srm_suppliers')
    .select('id, profile_id, trading_name, linked_profile_id, status, metadata')
    .eq('id', id)
    .eq('profile_id', companyId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message, status: 500, reason: 'missing' };
  }
  const gate = supplierBookPartyGate(data);
  if (!gate.ok) {
    return {
      ok: false,
      error: gate.error,
      status: gate.reason === 'missing' ? 404 : 403,
      reason: gate.reason,
    };
  }
  if (bookRoleFromMeta((data as { metadata?: unknown }).metadata) == null) {
    const { data: crm } = await supabase
      .from('customers')
      .select('id, linked_profile_id, email, trading_name, legal_name, metadata')
      .eq('profile_id', companyId)
      .limit(400);
    const twin = twinHintFor(
      data as {
        linked_profile_id?: unknown;
        email?: unknown;
        trading_name?: unknown;
        legal_name?: unknown;
      },
      indexBookTwins(crm || [])
    );
    if (twin?.exists) {
      return {
        ok: false,
        error:
          'Customer only — set book role to Supplier or Both before issuing a supplier portal',
        status: 403,
        reason: 'customer_only',
      };
    }
  }
  const linked = Number((data as { linked_profile_id?: unknown }).linked_profile_id);
  return {
    ok: true,
    srm: data as Record<string, unknown>,
    linkedProfileId: Number.isFinite(linked) && linked > 0 ? linked : null,
  };
}

export async function assertCustomerPortalParty(
  companyId: number,
  customerId: number | null | undefined
): Promise<
  | {
      ok: true;
      customer: Record<string, unknown>;
      linkedProfileId: number | null;
    }
  | {
      ok: false;
      error: string;
      status: number;
      reason: 'missing' | 'blocked' | 'supplier_only' | 'not_customer';
    }
> {
  const id = Number(customerId);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      error: 'Pick a customer on your books',
      status: 400,
      reason: 'missing',
    };
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customers')
    .select('id, profile_id, trading_name, linked_profile_id, status, metadata')
    .eq('id', id)
    .eq('profile_id', companyId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message, status: 500, reason: 'missing' };
  }
  const gate = customerBookPartyGate(data);
  if (!gate.ok) {
    return {
      ok: false,
      error: gate.error,
      status: gate.reason === 'missing' ? 404 : 403,
      reason: gate.reason,
    };
  }
  if (bookRoleFromMeta((data as { metadata?: unknown }).metadata) == null) {
    const { data: srm } = await supabase
      .from('srm_suppliers')
      .select('id, linked_profile_id, email, trading_name, legal_name, metadata')
      .eq('profile_id', companyId)
      .limit(400);
    const twin = twinHintFor(
      data as {
        linked_profile_id?: unknown;
        email?: unknown;
        trading_name?: unknown;
        legal_name?: unknown;
      },
      indexBookTwins(srm || [])
    );
    if (twin?.exists) {
      return {
        ok: false,
        error:
          'Supplier only — set book role to Customer or Both before issuing a customer portal',
        status: 403,
        reason: 'supplier_only',
      };
    }
  }
  const linked = Number((data as { linked_profile_id?: unknown }).linked_profile_id);
  return {
    ok: true,
    customer: data as Record<string, unknown>,
    linkedProfileId: Number.isFinite(linked) && linked > 0 ? linked : null,
  };
}
