/**
 * Bridge company group links → accounting legal entities.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  displayCompanyName,
  linkTypeMeta,
  type GroupLinkType,
} from '@/lib/business/company-groups';

export type GroupCompanyForEntities = {
  profile_id: number;
  display_name: string;
  legal_name: string | null;
  trading_name: string | null;
  country: string | null;
  city: string | null;
  registration_number: string | null;
  tax_number: string | null;
  vat_number: string | null;
  primary_currency: string | null;
  link_type: string;
  link_type_label: string;
  /** Viewing company is parent (holding/assoc) or child (subsidiary/member) */
  role: 'parent' | 'child';
  ownership_pct: number | null;
  group_link_id: number;
  /** accounting_entities.id when already synced into books */
  entity_id: number | null;
  entity_code: string | null;
};

function codeFromName(name: string, profileId: number): string {
  const base = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  return `${base || 'CO'}${profileId}`.slice(0, 12);
}

/** Active group peers for this workspace company. */
export async function loadGroupCompaniesForProfile(
  companyId: number
): Promise<{
  companies: GroupCompanyForEntities[];
  warning?: string;
}> {
  const supabase = getSupabaseServer();
  const { data: links, error } = await supabase
    .from('company_group_links')
    .select(
      'id, parent_profile_id, child_profile_id, link_type, status, ownership_pct, role_label'
    )
    .eq('status', 'active')
    .or(
      `parent_profile_id.eq.${companyId},child_profile_id.eq.${companyId}`
    )
    .limit(200);

  if (error) {
    return {
      companies: [],
      warning: error.message,
    };
  }

  const peerIds = new Set<number>();
  // Include self so HQ can link to this profile
  peerIds.add(companyId);
  for (const r of links || []) {
    const p = Number(r.parent_profile_id);
    const c = Number(r.child_profile_id);
    if (p && p !== companyId) peerIds.add(p);
    if (c && c !== companyId) peerIds.add(c);
  }

  const ids = Array.from(peerIds);
  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, country, city, registration_number, tax_number, vat_number, primary_currency'
    )
    .in('id', ids);

  const profileMap = new Map(
    (profiles || []).map((p) => [Number(p.id), p] as const)
  );

  const { data: entities } = await supabase
    .from('accounting_entities')
    .select('id, code, linked_profile_id')
    .eq('profile_id', companyId);

  const entityByLinked = new Map<number, { id: number; code: string }>();
  for (const e of entities || []) {
    const lp = e.linked_profile_id != null ? Number(e.linked_profile_id) : null;
    if (lp) entityByLinked.set(lp, { id: Number(e.id), code: String(e.code) });
  }

  const companies: GroupCompanyForEntities[] = [];
  const seen = new Set<number>();

  // Self first
  const self = profileMap.get(companyId);
  if (self) {
    const ent = entityByLinked.get(companyId);
    companies.push({
      profile_id: companyId,
      display_name: displayCompanyName(self, companyId),
      legal_name: self.legal_name || null,
      trading_name: self.trading_name || null,
      country: self.country || null,
      city: self.city || null,
      registration_number: self.registration_number || null,
      tax_number: self.tax_number || null,
      vat_number: self.vat_number || null,
      primary_currency: self.primary_currency || null,
      link_type: 'self',
      link_type_label: 'This company',
      role: 'parent',
      ownership_pct: null,
      group_link_id: 0,
      entity_id: ent?.id ?? null,
      entity_code: ent?.code ?? null,
    });
    seen.add(companyId);
  }

  for (const r of links || []) {
    const parentId = Number(r.parent_profile_id);
    const childId = Number(r.child_profile_id);
    const isParent = parentId === companyId;
    const peerId = isParent ? childId : parentId;
    if (!peerId || seen.has(peerId)) continue;
    seen.add(peerId);
    const peer = profileMap.get(peerId);
    const ent = entityByLinked.get(peerId);
    const lt = String(r.link_type || 'group');
    companies.push({
      profile_id: peerId,
      display_name: displayCompanyName(peer, peerId),
      legal_name: peer?.legal_name || null,
      trading_name: peer?.trading_name || null,
      country: peer?.country || null,
      city: peer?.city || null,
      registration_number: peer?.registration_number || null,
      tax_number: peer?.tax_number || null,
      vat_number: peer?.vat_number || null,
      primary_currency: peer?.primary_currency || null,
      link_type: lt,
      link_type_label: linkTypeMeta(lt as GroupLinkType).label,
      role: isParent ? 'parent' : 'child',
      ownership_pct:
        r.ownership_pct != null ? Number(r.ownership_pct) : null,
      group_link_id: Number(r.id),
      entity_id: ent?.id ?? null,
      entity_code: ent?.code ?? null,
    });
  }

  return { companies };
}

/**
 * Ensure an accounting_entities row exists for each active group company
 * (and this company itself). Idempotent.
 */
export async function syncGroupCompaniesToEntities(
  companyId: number
): Promise<{ created: number; updated: number; companies: GroupCompanyForEntities[] }> {
  const supabase = getSupabaseServer();
  const { companies, warning } = await loadGroupCompaniesForProfile(companyId);
  if (warning && companies.length === 0) {
    return { created: 0, updated: 0, companies: [] };
  }

  let created = 0;
  let updated = 0;

  for (const g of companies) {
    if (g.entity_id) {
      // Soft refresh name/legal from profile
      const { error } = await supabase
        .from('accounting_entities')
        .update({
          name: g.display_name,
          legal_name: g.legal_name || g.display_name,
          country: g.country || 'ZA',
          currency: g.primary_currency || 'ZAR',
          tax_number: g.tax_number || g.vat_number || null,
          registration_number: g.registration_number || null,
          updated_at: new Date().toISOString(),
          metadata: {
            group_link_id: g.group_link_id || null,
            link_type: g.link_type,
            group_role: g.role,
            source: 'company_group',
          },
        })
        .eq('id', g.entity_id)
        .eq('profile_id', companyId);
      if (!error) updated++;
      continue;
    }

    // Find primary entity without linked_profile for "self"
    if (g.link_type === 'self') {
      const { data: primary } = await supabase
        .from('accounting_entities')
        .select('id')
        .eq('profile_id', companyId)
        .eq('is_primary', true)
        .maybeSingle();
      if (primary?.id) {
        const { error } = await supabase
          .from('accounting_entities')
          .update({
            linked_profile_id: companyId,
            name: g.display_name,
            legal_name: g.legal_name || g.display_name,
            country: g.country || 'ZA',
            currency: g.primary_currency || 'ZAR',
            tax_number: g.tax_number || g.vat_number || null,
            registration_number: g.registration_number || null,
            updated_at: new Date().toISOString(),
            metadata: { source: 'company_group', link_type: 'self' },
          })
          .eq('id', primary.id);
        if (!error) {
          updated++;
          g.entity_id = Number(primary.id);
          continue;
        }
      }
    }

    const code = codeFromName(g.display_name, g.profile_id);
    const { data: inserted, error } = await supabase
      .from('accounting_entities')
      .insert({
        profile_id: companyId,
        code,
        name: g.display_name,
        legal_name: g.legal_name || g.display_name,
        country: g.country || 'ZA',
        currency: g.primary_currency || 'ZAR',
        tax_number: g.tax_number || g.vat_number || null,
        registration_number: g.registration_number || null,
        is_primary: g.link_type === 'self',
        status: 'active',
        linked_profile_id: g.profile_id,
        metadata: {
          group_link_id: g.group_link_id || null,
          link_type: g.link_type,
          group_role: g.role,
          source: 'company_group',
        },
      })
      .select('id, code')
      .single();

    if (!error && inserted) {
      created++;
      g.entity_id = Number(inserted.id);
      g.entity_code = String(inserted.code);
    } else if (error && /linked_profile|unique|duplicate/i.test(error.message)) {
      // Race or existing — ignore
    } else if (error && /linked_profile_id|column/i.test(error.message)) {
      // Column missing — insert without linked_profile_id, store in metadata
      const { data: soft, error: softErr } = await supabase
        .from('accounting_entities')
        .insert({
          profile_id: companyId,
          code,
          name: g.display_name,
          legal_name: g.legal_name || g.display_name,
          country: g.country || 'ZA',
          currency: g.primary_currency || 'ZAR',
          tax_number: g.tax_number || g.vat_number || null,
          registration_number: g.registration_number || null,
          is_primary: g.link_type === 'self',
          status: 'active',
          metadata: {
            group_link_id: g.group_link_id || null,
            link_type: g.link_type,
            group_role: g.role,
            source: 'company_group',
            linked_profile_id: g.profile_id,
          },
        })
        .select('id, code')
        .single();
      if (!softErr && soft) {
        created++;
        g.entity_id = Number(soft.id);
        g.entity_code = String(soft.code);
      }
    }
  }

  const refreshed = await loadGroupCompaniesForProfile(companyId);
  return {
    created,
    updated,
    companies: refreshed.companies,
  };
}
