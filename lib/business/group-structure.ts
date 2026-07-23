/**
 * Build hierarchical group structure trees for diagram rendering.
 * Supports multi-level chains: Holding → Sub → Grand-sub with ownership %.
 */
import {
  displayCompanyName,
  linkTypeMeta,
  type CompanyGroupLink,
  type GroupPeerProfile,
} from '@/lib/business/company-groups';

export type StructureNode = {
  id: number;
  name: string;
  isSelf?: boolean;
  /** Ownership % of this node held by its parent (holding structures) */
  ownership_pct?: number | null;
  role_label?: string | null;
  subtitle?: string | null;
  children: StructureNode[];
};

export type StructureTree = {
  link_type: string;
  label: string;
  parentLabel: string;
  childLabel: string;
  /** Show shareholding badges on edges */
  showOwnership: boolean;
  root: StructureNode;
};

export type StructureEdge = {
  parent_id: number;
  parent_name: string;
  child_id: number;
  child_name: string;
  link_type: string;
  ownership_pct?: number | null;
  role_label?: string | null;
  status?: string;
  link_id?: number;
};

const OWNERSHIP_TYPES = new Set(['holding', 'joint_venture', 'affiliate']);

/** Max hops when expanding the connected group graph */
export const STRUCTURE_MAX_DEPTH = 8;
/** Safety cap on companies in one diagram */
export const STRUCTURE_MAX_NODES = 80;

export function edgesFromGroupLinks(
  companyId: number,
  companyName: string,
  links: CompanyGroupLink[],
  nameById?: Map<number, string>
): StructureEdge[] {
  const edges: StructureEdge[] = [];
  for (const l of links) {
    if (String(l.status) !== 'active') continue;
    const parentId = Number(l.parent_profile_id);
    const childId = Number(l.child_profile_id);
    if (!parentId || !childId) continue;

    let parentName = nameById?.get(parentId);
    let childName = nameById?.get(childId);

    // Legacy single-hop: only peer name relative to viewer
    if (!parentName || !childName) {
      const isParent = parentId === companyId;
      const peerName =
        l.peer_display_name ||
        displayCompanyName(
          l.peer as GroupPeerProfile | null | undefined,
          isParent ? childId : parentId
        );
      if (isParent) {
        parentName = parentName || companyName;
        childName = childName || peerName;
      } else if (childId === companyId) {
        parentName = parentName || peerName;
        childName = childName || companyName;
      } else {
        parentName = parentName || `Company #${parentId}`;
        childName = childName || `Company #${childId}`;
      }
    }

    edges.push({
      parent_id: parentId,
      parent_name: parentName,
      child_id: childId,
      child_name: childName,
      link_type: String(l.link_type || 'other'),
      ownership_pct: l.ownership_pct != null ? Number(l.ownership_pct) : null,
      role_label: l.role_label || null,
      status: String(l.status),
      link_id: l.id != null ? Number(l.id) : undefined,
    });
  }
  return edges;
}

/** From entities-group peer list (role relative to viewer) — direct peers only. */
export function edgesFromGroupCompanies(
  companyId: number,
  companyName: string,
  peers: Array<{
    profile_id: number;
    display_name: string;
    link_type: string;
    role: 'parent' | 'child';
    ownership_pct?: number | null;
    role_label?: string | null;
  }>
): StructureEdge[] {
  const edges: StructureEdge[] = [];
  for (const g of peers) {
    if (g.link_type === 'self') continue;
    const peerId = Number(g.profile_id);
    if (!peerId) continue;
    if (g.role === 'parent') {
      edges.push({
        parent_id: companyId,
        parent_name: companyName,
        child_id: peerId,
        child_name: g.display_name,
        link_type: g.link_type,
        ownership_pct: g.ownership_pct ?? null,
        role_label: g.role_label ?? null,
        status: 'active',
      });
    } else {
      edges.push({
        parent_id: peerId,
        parent_name: g.display_name,
        child_id: companyId,
        child_name: companyName,
        link_type: g.link_type,
        ownership_pct: g.ownership_pct ?? null,
        role_label: g.role_label ?? null,
        status: 'active',
      });
    }
  }
  return edges;
}

/**
 * Build multi-level trees from a full edge list (may include edges between
 * companies neither of which is the viewer — e.g. B→C when viewing A→B→C).
 */
export function buildGroupStructureTrees(
  companyId: number,
  companyName: string,
  edges: StructureEdge[]
): StructureTree[] {
  const byType = new Map<string, StructureEdge[]>();
  for (const e of edges) {
    const t = e.link_type || 'other';
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(e);
  }

  const trees: StructureTree[] = [];
  const typeOrder = [
    'holding',
    'association',
    'group',
    'franchise',
    'joint_venture',
    'affiliate',
    'other',
  ];

  const types = [
    ...typeOrder.filter((t) => byType.has(t)),
    ...Array.from(byType.keys()).filter((t) => !typeOrder.includes(t)),
  ];

  for (const linkType of types) {
    const list = dedupeEdges(byType.get(linkType) || []);
    if (!list.length) continue;
    const meta = linkTypeMeta(linkType);
    const showOwnership = OWNERSHIP_TYPES.has(linkType);

    const nameById = new Map<number, string>();
    nameById.set(companyId, companyName);
    for (const e of list) {
      nameById.set(e.parent_id, e.parent_name);
      nameById.set(e.child_id, e.child_name);
    }

    // Component = all nodes reachable from viewer via edges of this type
    const component = connectedComponent(companyId, list);
    if (!component.has(companyId) && list.length) {
      component.add(companyId);
    }
    const componentEdges = list.filter(
      (e) => component.has(e.parent_id) && component.has(e.child_id)
    );
    if (!componentEdges.length) continue;

    const roots = findRoots(companyId, componentEdges);

    for (const rootId of roots) {
      const visited = new Set<number>();
      const root = buildNode(
        rootId,
        componentEdges,
        companyId,
        nameById,
        meta.childLabel,
        visited
      );
      // Ensure root name is solid
      root.name = nameById.get(rootId) || root.name;
      root.subtitle =
        rootId === companyId
          ? componentEdges.some((e) => e.parent_id === companyId)
            ? meta.parentLabel
            : meta.childLabel
          : meta.parentLabel;

      trees.push({
        link_type: linkType,
        label: meta.label,
        parentLabel: meta.parentLabel,
        childLabel: meta.childLabel,
        showOwnership,
        root,
      });
    }
  }

  return trees;
}

function dedupeEdges(list: StructureEdge[]): StructureEdge[] {
  const seen = new Set<string>();
  const out: StructureEdge[] = [];
  for (const e of list) {
    const key =
      e.link_id != null
        ? `id:${e.link_id}`
        : `${e.parent_id}>${e.child_id}:${e.link_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Nodes reachable walking parent↔child edges (undirected BFS). */
function connectedComponent(
  startId: number,
  edges: StructureEdge[]
): Set<number> {
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    if (!adj.has(e.parent_id)) adj.set(e.parent_id, []);
    if (!adj.has(e.child_id)) adj.set(e.child_id, []);
    adj.get(e.parent_id)!.push(e.child_id);
    adj.get(e.child_id)!.push(e.parent_id);
  }
  const seen = new Set<number>();
  const q = [startId];
  seen.add(startId);
  while (q.length) {
    const id = q.shift()!;
    for (const n of adj.get(id) || []) {
      if (seen.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen;
}

/**
 * Ultimate parents of the viewer within this edge set.
 * Walks up ownership/membership chains so A→B→C shows root A when viewing C.
 */
function findRoots(companyId: number, edges: StructureEdge[]): number[] {
  const parentsOf = new Map<number, number[]>();
  for (const e of edges) {
    if (!parentsOf.has(e.child_id)) parentsOf.set(e.child_id, []);
    parentsOf.get(e.child_id)!.push(e.parent_id);
  }

  const roots = new Set<number>();

  function walkUp(id: number, path: Set<number>) {
    const parents = parentsOf.get(id) || [];
    if (parents.length === 0) {
      roots.add(id);
      return;
    }
    for (const p of parents) {
      if (path.has(p)) {
        // Cycle — treat current as root of remaining chain
        roots.add(id);
        continue;
      }
      const next = new Set(path);
      next.add(p);
      walkUp(p, next);
    }
  }

  walkUp(companyId, new Set([companyId]));

  // If viewer only appears as parent (true group head), ensure they're a root
  if (roots.size === 0) roots.add(companyId);

  return Array.from(roots);
}

function buildNode(
  id: number,
  edges: StructureEdge[],
  companyId: number,
  nameById: Map<number, string>,
  childLabel: string,
  visited: Set<number>
): StructureNode {
  if (visited.has(id)) {
    return {
      id,
      name: nameById.get(id) || `Company #${id}`,
      isSelf: id === companyId,
      children: [],
      subtitle: '…',
    };
  }
  visited.add(id);

  const childEdges = edges.filter((e) => e.parent_id === id);
  const children: StructureNode[] = childEdges.map((e) => {
    const childVisited = new Set(visited);
    const node = buildNode(
      e.child_id,
      edges,
      companyId,
      nameById,
      childLabel,
      childVisited
    );
    node.ownership_pct = e.ownership_pct;
    node.role_label = e.role_label;
    if (!node.subtitle) {
      node.subtitle = e.role_label || childLabel;
    }
    return node;
  });

  return {
    id,
    name: nameById.get(id) || `Company #${id}`,
    isSelf: id === companyId,
    children,
  };
}

export function formatOwnership(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const n = Number(pct);
  if (Math.abs(n - Math.round(n)) < 0.05) return `${Math.round(n)}%`;
  return `${Math.round(n * 10) / 10}%`;
}

/**
 * Count depth of a tree (for empty checks / telemetry).
 */
export function structureDepth(node: StructureNode): number {
  if (!node.children.length) return 1;
  return 1 + Math.max(...node.children.map(structureDepth));
}
