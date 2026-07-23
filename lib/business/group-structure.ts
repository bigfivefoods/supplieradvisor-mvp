/**
 * Build hierarchical group structure trees for diagram rendering.
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
};

const OWNERSHIP_TYPES = new Set(['holding', 'joint_venture', 'affiliate']);

export function edgesFromGroupLinks(
  companyId: number,
  companyName: string,
  links: CompanyGroupLink[]
): StructureEdge[] {
  const edges: StructureEdge[] = [];
  for (const l of links) {
    if (String(l.status) !== 'active') continue;
    const parentId = Number(l.parent_profile_id);
    const childId = Number(l.child_profile_id);
    if (!parentId || !childId) continue;
    const isParent = parentId === companyId;
    const peerName =
      l.peer_display_name ||
      displayCompanyName(l.peer as GroupPeerProfile | null | undefined, isParent ? childId : parentId);
    edges.push({
      parent_id: parentId,
      parent_name: isParent ? companyName : peerName,
      child_id: childId,
      child_name: isParent ? peerName : companyName,
      link_type: String(l.link_type || 'other'),
      ownership_pct: l.ownership_pct != null ? Number(l.ownership_pct) : null,
      role_label: l.role_label || null,
      status: String(l.status),
    });
  }
  return edges;
}

/** From entities-group peer list (role relative to viewer). */
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
      // We are group head — peer is child
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
      // We are member — peer is parent
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
 * Build one tree per link type for the viewing company.
 * Holding: parent at top, subsidiaries below with % ownership.
 * Association: association at top, members below.
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
    const list = byType.get(linkType) || [];
    if (!list.length) continue;
    const meta = linkTypeMeta(linkType);
    const showOwnership = OWNERSHIP_TYPES.has(linkType);

    const asParent = list.filter((e) => e.parent_id === companyId);
    const asChild = list.filter((e) => e.child_id === companyId);

    const selfChildren: StructureNode[] = asParent.map((e) => ({
      id: e.child_id,
      name: e.child_name,
      ownership_pct: e.ownership_pct,
      role_label: e.role_label,
      subtitle: e.role_label || meta.childLabel,
      children: [],
    }));

    const selfNode: StructureNode = {
      id: companyId,
      name: companyName,
      isSelf: true,
      subtitle: asParent.length
        ? meta.parentLabel
        : asChild.length
          ? meta.childLabel
          : undefined,
      children: selfChildren,
    };

    if (asChild.length === 0) {
      // We are the root (holding / association head)
      trees.push({
        link_type: linkType,
        label: meta.label,
        parentLabel: meta.parentLabel,
        childLabel: meta.childLabel,
        showOwnership,
        root: selfNode,
      });
      continue;
    }

    // We sit under one or more parents — one tree per parent, with our children nested
    for (const p of asChild) {
      trees.push({
        link_type: linkType,
        label: meta.label,
        parentLabel: meta.parentLabel,
        childLabel: meta.childLabel,
        showOwnership,
        root: {
          id: p.parent_id,
          name: p.parent_name,
          subtitle: meta.parentLabel,
          children: [
            {
              ...selfNode,
              ownership_pct: p.ownership_pct,
              role_label: p.role_label,
              subtitle: p.role_label || meta.childLabel,
            },
          ],
        },
      });
    }
  }

  return trees;
}

export function formatOwnership(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const n = Number(pct);
  if (Math.abs(n - Math.round(n)) < 0.05) return `${Math.round(n)}%`;
  return `${Math.round(n * 10) / 10}%`;
}
