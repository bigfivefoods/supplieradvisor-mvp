/**
 * Resolve / ensure school_profiles row for a company workspace (NSNP schools).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEntityKind } from '@/lib/entities/entity-kinds';
import { defaultMemberTypeForEntity } from '@/lib/entities/programme-hierarchy';

export async function getOrCreateSchoolProfile(
  supabase: SupabaseClient,
  companyId: number,
  opts?: { schoolName?: string | null; memberType?: string | null }
): Promise<{ school: Record<string, unknown> | null; error?: string }> {
  const { data: existing, error: e1 } = await supabase
    .from('school_profiles')
    .select('*')
    .eq('profile_id', companyId)
    .maybeSingle();

  if (e1 && /does not exist|schema cache/i.test(e1.message)) {
    return {
      school: null,
      error:
        'Schools tables missing — run migration 20260726_schools_nsnp_module.sql',
    };
  }
  if (existing) return { school: existing as Record<string, unknown> };

  // Pull company name + type from profiles
  let schoolName = opts?.schoolName || 'My School';
  let memberType = opts?.memberType || 'school';
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('trading_name, legal_name, org_type, business_type')
      .eq('id', companyId)
      .maybeSingle();
    if (prof) {
      schoolName =
        String(prof.trading_name || prof.legal_name || schoolName).trim() ||
        schoolName;
      const entity = resolveEntityKind(
        String(prof.org_type || prof.business_type || '')
      );
      const def = defaultMemberTypeForEntity(entity.id);
      if (def) memberType = def;
    }
  } catch {
    /* soft */
  }

  const insert: Record<string, unknown> = {
    profile_id: companyId,
    school_name: schoolName,
    member_type: memberType,
    has_on_site_kitchen: true,
    feeding_lunch: true,
    status: 'active',
  };

  const { data: created, error: e2 } = await supabase
    .from('school_profiles')
    .insert(insert)
    .select('*')
    .single();

  if (e2) {
    // race: re-fetch
    const { data: again } = await supabase
      .from('school_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();
    if (again) return { school: again as Record<string, unknown> };
    return { school: null, error: e2.message };
  }

  // Soft: mark org_type on profile
  try {
    await supabase
      .from('profiles')
      .update({ org_type: 'school' })
      .eq('id', companyId);
  } catch {
    /* soft */
  }

  // Soft: try create kitchen warehouse
  let kitchenWarehouseId: number | null = null;
  try {
    const kitchenLabel = 'Kitchen';
    const { data: wh } = await supabase
      .from('warehouses')
      .insert({
        profile_id: companyId,
        name: `${schoolName} ${kitchenLabel}`,
        code: 'NSNP-KITCHEN',
        warehouse_type: 'kitchen',
        is_active: true,
        metadata: {
          nsnp: true,
          school_kitchen: true,
          member_type: memberType,
        },
      })
      .select('id')
      .single();
    if (wh?.id) {
      kitchenWarehouseId = Number(wh.id);
      await supabase
        .from('school_profiles')
        .update({ kitchen_warehouse_id: kitchenWarehouseId })
        .eq('id', created.id);
      (created as Record<string, unknown>).kitchen_warehouse_id =
        kitchenWarehouseId;
    }
  } catch {
    /* warehouses may lack columns — soft */
  }

  return { school: created as Record<string, unknown> };
}

export async function refreshSchoolCounts(
  supabase: SupabaseClient,
  schoolProfileId: number,
  companyId: number
): Promise<void> {
  try {
    const [learners, verified, eligible, staff] = await Promise.all([
      supabase
        .from('school_learners')
        .select('id', { count: 'exact', head: true })
        .eq('school_profile_id', schoolProfileId)
        .eq('status', 'active'),
      supabase
        .from('school_learners')
        .select('id', { count: 'exact', head: true })
        .eq('school_profile_id', schoolProfileId)
        .eq('status', 'active')
        .in('verification_status', ['school_verified', 'attested']),
      supabase
        .from('school_learners')
        .select('id', { count: 'exact', head: true })
        .eq('school_profile_id', schoolProfileId)
        .eq('status', 'active')
        .eq('nsnp_eligible', true),
      supabase
        .from('school_staff')
        .select('id', { count: 'exact', head: true })
        .eq('school_profile_id', schoolProfileId)
        .eq('status', 'active'),
    ]);
    await supabase
      .from('school_profiles')
      .update({
        learner_count_enrolled: learners.count || 0,
        learner_count_verified: verified.count || 0,
        learner_count_nsnp_eligible: eligible.count || 0,
        staff_count: staff.count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schoolProfileId)
      .eq('profile_id', companyId);
  } catch {
    /* soft */
  }
}
