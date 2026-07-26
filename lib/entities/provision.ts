/**
 * Provision domain rows after entity registration (school / DBE / ISP).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  enabledModulesFromPreset,
  type EnabledModulesMap,
} from '@/lib/business/company-modules';
import {
  resolveEntityKind,
  type EntityDefinition,
} from '@/lib/entities/entity-kinds';

export async function provisionEntityWorkspace(
  supabase: SupabaseClient,
  opts: {
    profileId: number;
    businessType?: string | null;
    tradingName: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    province?: string | null;
    city?: string | null;
    userId?: string | null;
  }
): Promise<{
  entity: EntityDefinition;
  homePath: string;
  enabledModules: EnabledModulesMap;
}> {
  const entity = resolveEntityKind(opts.businessType);
  const enabledModules = enabledModulesFromPreset(entity.modulePreset);
  const now = new Date().toISOString();

  // Persist org_type + modules on profile (soft if columns missing)
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', opts.profileId)
      .maybeSingle();
    const meta =
      existing?.metadata && typeof existing.metadata === 'object'
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    meta.enabled_modules = enabledModules;
    meta.modules_configured_at = now;
    meta.entity_kind = entity.id;
    meta.entity_group = entity.group;

    await supabase
      .from('profiles')
      .update({
        org_type: entity.org_type,
        business_type: entity.business_type,
        metadata: meta,
        updated_at: now,
      })
      .eq('id', opts.profileId);
  } catch {
    try {
      await supabase
        .from('profiles')
        .update({
          org_type: entity.org_type,
          business_type: entity.business_type,
          updated_at: now,
        })
        .eq('id', opts.profileId);
    } catch {
      /* soft */
    }
  }

  if (entity.provision === 'school' || entity.provision === 'facility_health') {
    try {
      const memberType =
        entity.provision === 'facility_health' ? 'hospital' : 'school';
      const { data: existingSchool } = await supabase
        .from('school_profiles')
        .select('id, member_type')
        .eq('profile_id', opts.profileId)
        .maybeSingle();
      if (!existingSchool) {
        await supabase.from('school_profiles').insert({
          profile_id: opts.profileId,
          school_name: opts.tradingName,
          member_type: memberType,
          principal_name: opts.contactName || null,
          principal_email: opts.contactEmail || null,
          principal_phone: opts.contactPhone || null,
          city: opts.city || null,
          province: opts.province || null,
          has_on_site_kitchen: true,
          feeding_lunch: true,
          status: 'active',
        });
      } else if (
        entity.provision === 'facility_health' &&
        !existingSchool.member_type
      ) {
        await supabase
          .from('school_profiles')
          .update({ member_type: 'hospital', updated_at: now })
          .eq('id', existingSchool.id);
      }
    } catch {
      /* migration may not be applied */
    }
  }

  if (entity.provision === 'agency_education') {
    try {
      await supabase.from('nsnp_agency_profiles').upsert(
        {
          profile_id: opts.profileId,
          agency_name: opts.tradingName,
          agency_type: 'dbe',
          province: opts.province || null,
          contact_name: opts.contactName || null,
          contact_email: opts.contactEmail || null,
          contact_phone: opts.contactPhone || null,
          status: 'active',
          updated_at: now,
        },
        { onConflict: 'profile_id' }
      );
    } catch {
      /* soft */
    }
  }

  if (entity.provision === 'agency_health') {
    // Health uses same agency table with type marker when available
    try {
      await supabase.from('nsnp_agency_profiles').upsert(
        {
          profile_id: opts.profileId,
          agency_name: opts.tradingName,
          agency_type: 'department_of_health',
          province: opts.province || null,
          contact_name: opts.contactName || null,
          contact_email: opts.contactEmail || null,
          contact_phone: opts.contactPhone || null,
          status: 'active',
          updated_at: now,
        },
        { onConflict: 'profile_id' }
      );
    } catch {
      /* soft until health tables exist */
    }
  }

  if (entity.provision === 'isp') {
    try {
      await supabase.from('nsnp_isp_profiles').upsert(
        {
          profile_id: opts.profileId,
          trading_name: opts.tradingName,
          contact_name: opts.contactName || null,
          contact_email: opts.contactEmail || null,
          contact_phone: opts.contactPhone || null,
          compliance_status: 'pending',
          food_handling_cert: false,
          updated_at: now,
        },
        { onConflict: 'profile_id' }
      );
    } catch {
      /* soft */
    }
  }

  return {
    entity,
    homePath: entity.homePath,
    enabledModules,
  };
}
