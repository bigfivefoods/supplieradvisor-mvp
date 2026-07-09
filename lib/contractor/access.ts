import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';

export type ContractorAccessOk = {
  ok: true;
  container: {
    id: number;
    contractor_id: number | null;
    profile_id: number | null;
    name?: string | null;
    container_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    photo_url?: string | null;
    status?: string | null;
  };
  contractor: {
    id: number;
    user_id?: string | null;
    email?: string | null;
    full_name?: string | null;
    portal_status?: string | null;
  };
};

export type ContractorAccessDenied = {
  ok: false;
  error: string;
  status: number;
};

/**
 * Assert a Privy user is the assigned, contract-accepted operator for a container.
 * Used by all contractor portal write/read APIs.
 */
export async function assertContractorContainerAccess(
  containerId: number,
  privyUserId: string | null | undefined,
  email?: string | null
): Promise<ContractorAccessOk | ContractorAccessDenied> {
  const userId = getCanonicalUserId(privyUserId);
  if (!userId || !Number.isFinite(containerId)) {
    return { ok: false, error: 'Authentication and container required', status: 400 };
  }

  const supabase = getSupabaseServer();
  const { data: container, error } = await supabase
    .from('containers')
    .select('id, contractor_id, profile_id, name, container_code, city, province, country, photo_url, status')
    .eq('id', containerId)
    .maybeSingle();

  if (error || !container) {
    return { ok: false, error: 'Container not found', status: 404 };
  }
  if (!container.contractor_id) {
    return { ok: false, error: 'No contractor is allocated to this container', status: 403 };
  }

  const { data: contractor } = await supabase
    .from('container_contractors')
    .select('id, user_id, email, full_name, portal_status, contract_accepted_at')
    .eq('id', container.contractor_id)
    .maybeSingle();

  if (!contractor) {
    return { ok: false, error: 'Contractor assignment not found', status: 403 };
  }

  const variants = userIdMatchVariants(userId);
  const emailNorm = email ? String(email).toLowerCase().trim() : null;
  const userMatch = contractor.user_id && variants.includes(String(contractor.user_id));
  const emailMatch =
    emailNorm &&
    contractor.email &&
    String(contractor.email).toLowerCase() === emailNorm &&
    !!contractor.contract_accepted_at;

  if (!userMatch && !emailMatch) {
    return { ok: false, error: 'You are not assigned to operate this container', status: 403 };
  }

  // Heal user_id link when accepted via email match
  if (!contractor.user_id && emailMatch) {
    await supabase
      .from('container_contractors')
      .update({ user_id: userId, portal_status: 'active', updated_at: new Date().toISOString() })
      .eq('id', contractor.id);
    contractor.user_id = userId;
  }

  return {
    ok: true,
    container,
    contractor: {
      id: contractor.id,
      user_id: contractor.user_id,
      email: contractor.email,
      full_name: contractor.full_name,
      portal_status: contractor.portal_status,
    },
  };
}

/** Load live metrics for one container (contractor-scoped). */
export async function getContainerOperatorMetrics(containerId: number, profileId: number | null) {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const [invRes, salesRes, ordersRes] = await Promise.all([
    supabase
      .from('container_inventory')
      .select('id, qty_on_hand, reorder_level')
      .eq('container_id', containerId),
    supabase
      .from('container_sales')
      .select('gross_amount, sale_date')
      .eq('container_id', containerId)
      .eq('sale_date', today),
    supabase
      .from('container_orders')
      .select('id, status')
      .eq('container_id', containerId)
      .in('status', ['draft', 'ordered', 'in_transit', 'pending']),
  ]);

  const items = invRes.data || [];
  const skuCount = items.length;
  const lowStock = items.filter(
    (i) => Number(i.qty_on_hand) <= Number(i.reorder_level ?? 0)
  ).length;
  const unitsOnHand = items.reduce((s, i) => s + Number(i.qty_on_hand || 0), 0);
  const salesToday = (salesRes.data || []).reduce(
    (s, row) => s + Number(row.gross_amount || 0),
    0
  );
  const openOrders = (ordersRes.data || []).length;

  return {
    containerId,
    profileId,
    skuCount,
    unitsOnHand,
    lowStock,
    salesToday,
    salesTodayCount: (salesRes.data || []).length,
    openOrders,
    asOf: new Date().toISOString(),
  };
}
