/**
 * Dual-life identity helpers.
 *
 * Same Privy login can be:
 *   - a business operator (business_users → company command center)
 *   - a consumer (platform_b2c_profiles → SA Member)
 *
 * selectedCompanyId is operator context only. It must never become
 * the personal wallet key.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';

export const PERSONAL_WORKSPACE_PATH = '/me';

export type BusinessWorkspaceCard = {
  id: number;
  name: string;
  role?: string | null;
};

export type BusinessWorkspaceSummary = {
  has_business: boolean;
  business_count: number;
  businesses: BusinessWorkspaceCard[];
};

const EMPTY: BusinessWorkspaceSummary = {
  has_business: false,
  business_count: 0,
  businesses: [],
};

export async function loadBusinessWorkspaceSummary(
  userId: string
): Promise<BusinessWorkspaceSummary> {
  const canonical = getCanonicalUserId(userId);
  if (!canonical) return EMPTY;

  try {
    const supabase = getSupabaseServer();
    const variants = userIdMatchVariants(canonical);
    const { data, error } = await supabase
      .from('business_users')
      .select('profile_id, role')
      .in('user_id', variants)
      .eq('status', 'active')
      .limit(80);

    if (error) {
      return EMPTY;
    }

    const byId = new Map<number, string | null>();
    for (const row of data || []) {
      const id = Number(row.profile_id);
      if (Number.isFinite(id) && id > 0) {
        byId.set(id, row.role ? String(row.role) : null);
      }
    }
    if (!byId.size) return EMPTY;

    const ids = Array.from(byId.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .in('id', ids);

    const nameById = new Map<number, string>();
    for (const p of profiles || []) {
      const id = Number(p.id);
      const name =
        String(p.trading_name || p.legal_name || '').trim() ||
        `Company ${id}`;
      nameById.set(id, name);
    }

    const businesses: BusinessWorkspaceCard[] = ids.map((id) => ({
      id,
      name: nameById.get(id) || `Company ${id}`,
      role: byId.get(id) || null,
    }));

    return {
      has_business: true,
      business_count: businesses.length,
      businesses,
    };
  } catch {
    return EMPTY;
  }
}

export function operatorCompanyIds(
  summary: BusinessWorkspaceSummary | null | undefined
): number[] {
  return (summary?.businesses || [])
    .map((b) => Number(b.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function isOperatorCompany(
  summary: BusinessWorkspaceSummary | null | undefined,
  companyId: number
): boolean {
  return operatorCompanyIds(summary).includes(Number(companyId));
}
