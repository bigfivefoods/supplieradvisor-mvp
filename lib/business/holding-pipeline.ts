/**
 * Holding / group pipeline roll-up: descendant operating companies'
 * opportunities count toward the parent company's pipeline.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { displayCompanyName } from '@/lib/business/company-groups';
import { STRUCTURE_MAX_DEPTH, STRUCTURE_MAX_NODES } from '@/lib/business/group-structure';

export const PIPELINE_ROLLUP_LINK_TYPES = [
  'holding',
  'group',
  'joint_venture',
  'affiliate',
] as const;

export type HoldingEdge = {
  parent_id: number;
  child_id: number;
  link_type?: string | null;
  status?: string | null;
};

/** Children of `rootId` walking only ownership-style links. Does not include root. */
export function descendantIdsFromHoldingEdges(
  rootId: number,
  edges: HoldingEdge[]
): number[] {
  const kids = new Map<number, number[]>();
  const types = new Set<string>(PIPELINE_ROLLUP_LINK_TYPES);
  for (const e of edges) {
    if (e.status && String(e.status) !== 'active') continue;
    const t = String(e.link_type || 'holding').toLowerCase();
    if (!types.has(t)) continue;
    const p = Number(e.parent_id);
    const c = Number(e.child_id);
    if (!p || !c || p === c) continue;
    const list = kids.get(p) || [];
    list.push(c);
    kids.set(p, list);
  }
  const out: number[] = [];
  const seen = new Set<number>([rootId]);
  const q = [rootId];
  while (q.length) {
    const id = q.shift()!;
    for (const child of kids.get(id) || []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
      q.push(child);
    }
  }
  return out;
}

export type HoldingSubtree = {
  ids: number[];
  names: Map<number, string>;
  descendantCount: number;
};

export async function loadHoldingSubtree(
  companyId: number
): Promise<HoldingSubtree> {
  const names = new Map<number, string>();
  const ids = [companyId];
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ids, names, descendantCount: 0 };
  }

  const supabase = getSupabaseServer();
  try {
    const { data: me } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle();
    if (me) {
      names.set(
        companyId,
        displayCompanyName(
          { trading_name: me.trading_name, legal_name: me.legal_name },
          companyId
        )
      );
    }
  } catch {
    /* soft */
  }

  const seen = new Set<number>([companyId]);
  let frontier = [companyId];
  const descendants: number[] = [];

  for (let depth = 0; depth < STRUCTURE_MAX_DEPTH && frontier.length; depth++) {
    if (seen.size >= STRUCTURE_MAX_NODES) break;
    const { data, error } = await supabase
      .from('company_group_links')
      .select('parent_profile_id, child_profile_id, link_type, status')
      .eq('status', 'active')
      .in('parent_profile_id', frontier)
      .in('link_type', [...PIPELINE_ROLLUP_LINK_TYPES])
      .limit(300);
    if (error) break;
    const next: number[] = [];
    for (const r of data || []) {
      const c = Number(r.child_profile_id);
      if (!c || seen.has(c)) continue;
      if (seen.size >= STRUCTURE_MAX_NODES) break;
      seen.add(c);
      descendants.push(c);
      next.push(c);
    }
    frontier = next;
  }

  if (descendants.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .in('id', descendants);
    for (const p of profiles || []) {
      const id = Number(p.id);
      names.set(
        id,
        displayCompanyName(
          { trading_name: p.trading_name, legal_name: p.legal_name },
          id
        )
      );
    }
  }

  return {
    ids: [companyId, ...descendants],
    names,
    descendantCount: descendants.length,
  };
}

export function annotateGroupOpportunity<T extends Record<string, unknown>>(
  row: T,
  viewerCompanyId: number,
  names: Map<number, string>
): T & {
  source_company_id: number;
  source_company_name: string | null;
  group_rollup: boolean;
} {
  const pid = Number(row.profile_id || viewerCompanyId);
  const rollup = pid > 0 && pid !== viewerCompanyId;
  return {
    ...row,
    source_company_id: pid,
    source_company_name: names.get(pid) || null,
    group_rollup: rollup,
  };
}
