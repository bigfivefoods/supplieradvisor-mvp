/**
 * Server-side loader: expand the full multi-level group graph from a company.
 * Walks ancestors and descendants so Holding → Sub → OpCo is fully visible.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { displayCompanyName } from '@/lib/business/company-groups';
import {
  STRUCTURE_MAX_DEPTH,
  STRUCTURE_MAX_NODES,
  buildGroupStructureTrees,
  type StructureEdge,
  type StructureTree,
} from '@/lib/business/group-structure';

const LINK_SELECT =
  'id, parent_profile_id, child_profile_id, link_type, status, ownership_pct, role_label';

const PROFILE_SELECT =
  'id, trading_name, legal_name, country, city, registration_number, tax_number, vat_number, primary_currency, business_type, logo_url, verification_status';

export type FullGroupStructure = {
  company_name: string;
  edges: StructureEdge[];
  trees: StructureTree[];
  /** All company profile ids in the expanded graph (incl. self) */
  node_ids: number[];
  /** Active link rows used (raw) */
  link_count: number;
  warning?: string;
};

/**
 * BFS expansion of active company_group_links from `companyId`.
 * Includes edges between intermediate companies (grandchildren, etc.).
 */
export async function loadFullGroupStructure(
  companyId: number
): Promise<FullGroupStructure> {
  const supabase = getSupabaseServer();

  let company_name = `Company #${companyId}`;
  try {
    const { data: me } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', companyId)
      .maybeSingle();
    if (me) {
      company_name = displayCompanyName(
        {
          trading_name: me.trading_name ?? null,
          legal_name: me.legal_name ?? null,
        },
        companyId
      );
    }
  } catch {
    /* soft */
  }

  const knownNodes = new Set<number>([companyId]);
  let frontier = new Set<number>([companyId]);
  const linkById = new Map<number, Record<string, unknown>>();
  let warning: string | undefined;

  for (let depth = 0; depth < STRUCTURE_MAX_DEPTH && frontier.size > 0; depth++) {
    if (knownNodes.size >= STRUCTURE_MAX_NODES) break;
    const ids = Array.from(frontier);
    frontier = new Set();

    // parent in ids OR child in ids
    const orFilter = `parent_profile_id.in.(${ids.join(',')}),child_profile_id.in.(${ids.join(',')})`;
    const { data: rows, error } = await supabase
      .from('company_group_links')
      .select(LINK_SELECT)
      .eq('status', 'active')
      .or(orFilter)
      .limit(300);

    if (error) {
      warning = error.message;
      break;
    }

    for (const r of rows || []) {
      const lid = Number(r.id);
      if (Number.isFinite(lid) && lid > 0) {
        if (linkById.has(lid)) continue;
        linkById.set(lid, r as Record<string, unknown>);
      }
      const p = Number(r.parent_profile_id);
      const c = Number(r.child_profile_id);
      for (const n of [p, c]) {
        if (!Number.isFinite(n) || n <= 0) continue;
        if (knownNodes.has(n)) continue;
        if (knownNodes.size >= STRUCTURE_MAX_NODES) continue;
        knownNodes.add(n);
        frontier.add(n);
      }
    }
  }

  const nodeIds = Array.from(knownNodes);
  const nameById = new Map<number, string>();
  nameById.set(companyId, company_name);

  if (nodeIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .in('id', nodeIds);
    for (const p of profiles || []) {
      const id = Number(p.id);
      nameById.set(
        id,
        displayCompanyName(
          {
            trading_name: p.trading_name ?? null,
            legal_name: p.legal_name ?? null,
          },
          id
        )
      );
    }
  }

  const edges: StructureEdge[] = [];
  for (const r of linkById.values()) {
    const parentId = Number(r.parent_profile_id);
    const childId = Number(r.child_profile_id);
    if (!parentId || !childId) continue;
    edges.push({
      parent_id: parentId,
      parent_name: nameById.get(parentId) || `Company #${parentId}`,
      child_id: childId,
      child_name: nameById.get(childId) || `Company #${childId}`,
      link_type: String(r.link_type || 'other'),
      ownership_pct:
        r.ownership_pct != null ? Number(r.ownership_pct) : null,
      role_label: r.role_label ? String(r.role_label) : null,
      status: 'active',
      link_id: r.id != null ? Number(r.id) : undefined,
    });
  }

  const trees = buildGroupStructureTrees(companyId, company_name, edges);

  return {
    company_name,
    edges,
    trees,
    node_ids: nodeIds,
    link_count: edges.length,
    warning,
  };
}
