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

export type BusinessWorkspaceSummary = {
  has_business: boolean;
  business_count: number;
};

export async function loadBusinessWorkspaceSummary(
  userId: string
): Promise<BusinessWorkspaceSummary> {
  const canonical = getCanonicalUserId(userId);
  if (!canonical) return { has_business: false, business_count: 0 };

  try {
    const supabase = getSupabaseServer();
    const variants = userIdMatchVariants(canonical);
    const { data, error } = await supabase
      .from('business_users')
      .select('profile_id')
      .in('user_id', variants)
      .eq('status', 'active')
      .limit(80);

    if (error) {
      return { has_business: false, business_count: 0 };
    }

    const ids = new Set<number>();
    for (const row of data || []) {
      const id = Number(row.profile_id);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
    return { has_business: ids.size > 0, business_count: ids.size };
  } catch {
    return { has_business: false, business_count: 0 };
  }
}
