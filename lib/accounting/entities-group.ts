/**
 * Bridge company group links → accounting legal entities.
 * Peers include multi-level group companies (Holding → Sub → OpCo).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  displayCompanyName,
  linkTypeMeta,
  type GroupLinkType,
} from '@/lib/business/company-groups';
import { loadFullGroupStructure } from '@/lib/business/group-structure-load';

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
  /** Hops from this workspace company (1 = direct) */
  depth?: number;
};

function codeFromName(name: string, profileId: number): string {
  const base = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  return `${base || 'CO'}${profileId}`.slice(0, 12);
}

/** Active group peers for this workspace company (full multi-level chain). */
export async function loadGroupCompaniesForProfile(
  companyId: number
): Promise<{
  companies: GroupCompanyForEntities[];
  warning?: string;
}> {
  const supabase = getSupabaseServer();
  const full = await loadFullGroupStructure(companyId);

  if (full.warning && full.edges.length === 0) {
    return { companies: [], warning: full.warning };
  }

  const nodeIds = full.node_ids.length ? full.node_ids : [companyId];
  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, country, city, registration_number, tax_number, vat_number, primary_currency'
    )
    .in('id', nodeIds);

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

  // Depth from viewer (undirected hops via edges)
  const depthById = new Map<number, number>();
  depthById.set(companyId, 0);
  {
    const adj = new Map<number, number[]>();
    for (const e of full.edges) {
      if (!adj.has(e.parent_id)) adj.set(e.parent_id, []);
      if (!adj.has(e.child_id)) adj.set(e.child_id, []);
      adj.get(e.parent_id)!.push(e.child_id);
      adj.get(e.child_id)!.push(e.parent_id);
    }
    const q = [companyId];
    while (q.length) {
      const id = q.shift()!;
      const d = depthById.get(id) || 0;
      for (const n of adj.get(id) || []) {
        if (depthById.has(n)) continue;
        depthById.set(n, d + 1);
        q.push(n);
      }
    }
  }

  const directEdge = new Map<number, (typeof full.edges)[0]>();
  for (const e of full.edges) {
    if (e.parent_id === companyId) directEdge.set(e.child_id, e);
    if (e.child_id === companyId) directEdge.set(e.parent_id, e);
  }

  const companies: GroupCompanyForEntities[] = [];
  const seen = new Set<number>();

  const selfProf = profileMap.get(companyId);
  const selfEnt = entityByLinked.get(companyId);
  companies.push({
    profile_id: companyId,
    display_name: full.company_name,
    legal_name: selfProf?.legal_name || null,
    trading_name: selfProf?.trading_name || null,
    country: selfProf?.country || null,
    city: selfProf?.city || null,
    registration_number: selfProf?.registration_number || null,
    tax_number: selfProf?.tax_number || null,
    vat_number: selfProf?.vat_number || null,
    primary_currency: selfProf?.primary_currency || null,
    link_type: 'self',
    link_type_label: 'This company',
    role: 'parent',
    ownership_pct: null,
    group_link_id: 0,
    entity_id: selfEnt?.id ?? null,
    entity_code: selfEnt?.code ?? null,
    depth: 0,
  });
  seen.add(companyId);

  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const peer = profileMap.get(id);
    const ent = entityByLinked.get(id);
    const edge =
      directEdge.get(id) ||
      full.edges.find((e) => e.parent_id === id || e.child_id === id);
    const lt = edge?.link_type || 'group';
    let role: 'parent' | 'child' = 'parent';
    if (edge) {
      if (edge.child_id === companyId) role = 'child';
      else if (edge.parent_id === companyId) role = 'parent';
      else {
        role = full.edges.some((e) => e.parent_id === companyId)
          ? 'parent'
          : full.edges.some((e) => e.child_id === companyId)
            ? 'child'
            : 'parent';
      }
    }

    companies.push({
      profile_id: id,
      display_name: displayCompanyName(peer, id),
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
      role,
      ownership_pct: edge?.ownership_pct ?? null,
      group_link_id: edge?.link_id || 0,
      entity_id: ent?.id ?? null,
      entity_code: ent?.code ?? null,
      depth: depthById.get(id) ?? 1,
    });
  }

  companies.sort((a, b) => {
    if (a.link_type === 'self') return -1;
    if (b.link_type === 'self') return 1;
    const da = a.depth ?? 99;
    const db = b.depth ?? 99;
    if (da !== db) return da - db;
    return a.display_name.localeCompare(b.display_name);
  });

  return { companies, warning: full.warning };
}

/**
 * Ensure an accounting_entities row exists for each active group company
 * (and this company itself). Idempotent. Includes multi-level chain.
 */
export async function syncGroupCompaniesToEntities(
  companyId: number
): Promise<{
  created: number;
  updated: number;
  companies: GroupCompanyForEntities[];
}> {
  const supabase = getSupabaseServer();
  const { companies, warning } = await loadGroupCompaniesForProfile(companyId);
  if (warning && companies.length === 0) {
    return { created: 0, updated: 0, companies: [] };
  }

  let created = 0;
  let updated = 0;

  for (const g of companies) {
    if (g.entity_id) {
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
            depth: g.depth ?? null,
            source: 'company_group',
          },
        })
        .eq('id', g.entity_id)
        .eq('profile_id', companyId);
      if (!error) updated++;
      continue;
    }

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
          depth: g.depth ?? null,
          source: 'company_group',
        },
      })
      .select('id, code')
      .single();

    if (!error && inserted) {
      created++;
      g.entity_id = Number(inserted.id);
      g.entity_code = String(inserted.code);
    } else if (
      error &&
      /linked_profile_id|column|schema cache/i.test(error.message)
    ) {
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
            depth: g.depth ?? null,
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
