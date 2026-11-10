/**
 * Process-diagram model for the in-app how-to guides.
 * Pure data: edges, lanes, ranks, and a wrapping swimlane layout.
 */
import type { GuideEdge, GuideNode, ModuleGuide } from '@/lib/help/types';

/** Inner width of the guide column on a desktop screen (max-w-5xl minus the diagram padding). */
export const DESKTOP_FLOW_WIDTH = 984;

export const FLOW_LAYOUT = {
  columnWidth: 176,
  columnGap: 44,
  laneWidth: 108,
  lanePad: 10,
  bandGap: 20,
  edgeGutter: 28,
  pad: 8,
  decisionSize: 124,
  stackGap: 8,
} as const;

export type FlowBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rank: number;
  band: number;
  col: number;
  lane: string;
};

export type FlowLaneBand = {
  lane: string;
  laneIndex: number;
  band: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FlowRoute = {
  from: string;
  to: string;
  label?: string;
  back: boolean;
  d: string;
  labelX: number;
  labelY: number;
};

export type FlowLayout = {
  width: number;
  height: number;
  columns: number;
  boxes: FlowBox[];
  lanes: FlowLaneBand[];
  routes: FlowRoute[];
  showLanes: boolean;
  laneNames: string[];
};

export function flowLanes(nodes: GuideNode[]): string[] {
  const lanes: string[] = [];
  for (const node of nodes) {
    if (node.lane && !lanes.includes(node.lane)) lanes.push(node.lane);
  }
  return lanes;
}

export function resolveEdges(nodes: GuideNode[], edges?: GuideEdge[]): GuideEdge[] {
  if (edges) return edges;
  const sequential: GuideEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    sequential.push({ from: nodes[i].id, to: nodes[i + 1].id });
  }
  return sequential;
}

function edgeKey(edge: GuideEdge): string {
  return `${edge.from}\0${edge.to}`;
}

export function classifyEdges(
  nodes: GuideNode[],
  edges: GuideEdge[]
): { forward: GuideEdge[]; back: GuideEdge[] } {
  const outgoing = new Map<string, GuideEdge[]>();
  for (const node of nodes) outgoing.set(node.id, []);
  for (const edge of edges) {
    const list = outgoing.get(edge.from);
    if (list) list.push(edge);
  }
  const color = new Map<string, 0 | 1 | 2>();
  const forward: GuideEdge[] = [];
  const back: GuideEdge[] = [];

  const visit = (id: string) => {
    color.set(id, 1);
    for (const edge of outgoing.get(id) ?? []) {
      const state = color.get(edge.to) ?? 0;
      if (state === 1) back.push(edge);
      else {
        forward.push(edge);
        if (state === 0) visit(edge.to);
      }
    }
    color.set(id, 2);
  };

  for (const node of nodes) {
    if ((color.get(node.id) ?? 0) === 0) visit(node.id);
  }
  return { forward, back };
}

export function rankNodes(nodes: GuideNode[], forward: GuideEdge[]): Map<string, number> {
  const rank = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  for (const node of nodes) outgoing.set(node.id, []);
  for (const edge of forward) {
    if (!outgoing.has(edge.from) || !indegree.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }
  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const seen = new Set<string>();
  const topo: string[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    topo.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  for (const node of nodes) {
    if (!seen.has(node.id)) topo.push(node.id);
  }
  for (const id of topo) {
    for (const next of outgoing.get(id) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(id) ?? 0) + 1));
    }
  }
  return rank;
}

export function columnsForWidth(width: number, lanesOn: boolean): number {
  const lane = lanesOn ? FLOW_LAYOUT.laneWidth + FLOW_LAYOUT.lanePad : 0;
  const usable = Math.max(FLOW_LAYOUT.columnWidth, width - lane - FLOW_LAYOUT.pad * 2);
  const stride = FLOW_LAYOUT.columnWidth + FLOW_LAYOUT.columnGap;
  const cols = Math.floor((usable + FLOW_LAYOUT.columnGap) / stride);
  return Math.max(1, Math.min(4, cols));
}

export function readingOrder(nodes: GuideNode[], edges: GuideEdge[]): GuideNode[] {
  const { forward } = classifyEdges(nodes, edges);
  const rank = rankNodes(nodes, forward);
  const lanes = flowLanes(nodes);
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  return [...nodes].sort((a, b) => {
    const byRank = (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
    if (byRank) return byRank;
    const byLane = lanes.indexOf(a.lane ?? '') - lanes.indexOf(b.lane ?? '');
    if (byLane) return byLane;
    return (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0);
  });
}

export function stepNumbers(ordered: GuideNode[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let n = 1;
  for (const node of ordered) {
    if (node.kind === 'decision') continue;
    numbers.set(node.id, n);
    n += 1;
  }
  return numbers;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Rough card height so the first paint matches the text before the browser measures it. */
export function estimateNodeHeight(node: GuideNode, showLane: boolean, compact = false): number {
  if (node.kind === 'decision') return FLOW_LAYOUT.decisionSize;
  const chars = 28;
  const booksLines = !compact && node.books ? Math.ceil(node.books.length / chars) : 0;
  const hintLines = node.hint ? Math.max(1, Math.ceil(node.hint.length / 32)) : 0;
  const titleLines = Math.max(1, Math.ceil(node.label.length / 18));
  return (
    22 +
    28 +
    6 +
    titleLines * 18 +
    (hintLines ? 4 + hintLines * 16 : 0) +
    (booksLines ? 8 + booksLines * 15 : 0) +
    (showLane && node.lane ? 24 : 0)
  );
}

function nodeSize(node: GuideNode, heights: Record<string, number>): { w: number; h: number } {
  if (node.kind === 'decision') {
    const measured = heights[node.id];
    const tall = Boolean(measured && measured > FLOW_LAYOUT.decisionSize + 8);
    return {
      w: tall ? FLOW_LAYOUT.columnWidth : FLOW_LAYOUT.decisionSize,
      h: Math.max(FLOW_LAYOUT.decisionSize, measured || FLOW_LAYOUT.decisionSize),
    };
  }
  const measured = heights[node.id];
  return { w: FLOW_LAYOUT.columnWidth, h: Math.max(84, measured || 108) };
}

function routeForward(a: FlowBox, b: FlowBox, edge: GuideEdge): FlowRoute {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const dx = bcx - acx;
  const dy = bcy - acy;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const start = horizontal
    ? { x: dx >= 0 ? a.x + a.w : a.x, y: acy }
    : { x: acx, y: dy >= 0 ? a.y + a.h : a.y };
  const end = horizontal
    ? { x: dx >= 0 ? b.x : b.x + b.w, y: bcy }
    : { x: bcx, y: dy >= 0 ? b.y : b.y + b.h };
  const d = elbow(start, end, horizontal);
  const mid = horizontal
    ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return {
    from: edge.from,
    to: edge.to,
    label: edge.label,
    back: false,
    d,
    labelX: mid.x,
    labelY: mid.y,
  };
}

function elbow(
  start: { x: number; y: number },
  end: { x: number; y: number },
  horizontalFirst: boolean
): string {
  if (Math.abs(start.y - end.y) < 10 || Math.abs(start.x - end.x) < 10) {
    return `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`;
  }
  if (horizontalFirst) {
    const mid = (start.x + end.x) / 2;
    return `M ${round(start.x)} ${round(start.y)} L ${round(mid)} ${round(start.y)} L ${round(mid)} ${round(end.y)} L ${round(end.x)} ${round(end.y)}`;
  }
  const mid = (start.y + end.y) / 2;
  return `M ${round(start.x)} ${round(start.y)} L ${round(start.x)} ${round(mid)} L ${round(end.x)} ${round(mid)} L ${round(end.x)} ${round(end.y)}`;
}

function routeEdge(
  a: FlowBox,
  b: FlowBox,
  edge: GuideEdge,
  back: boolean,
  width: number,
  laneBands: FlowLaneBand[]
): FlowRoute {
  if (back) {
    const x1 = a.x + a.w / 2;
    const x2 = b.x + b.w / 2;
    if (a.band !== b.band) {
      const upper = a.y <= b.y ? a : b;
      const gapY = upper.y + upper.h + 18;
      const fromY = a.y <= b.y ? a.y + a.h : a.y;
      const toY = a.y <= b.y ? b.y : b.y + b.h;
      return {
        from: edge.from,
        to: edge.to,
        label: edge.label,
        back: true,
        d: `M ${round(x1)} ${round(fromY)} L ${round(x1)} ${round(gapY)} L ${round(x2)} ${round(gapY)} L ${round(x2)} ${round(toY)}`,
        labelX: Math.min(width - 56, Math.max(56, (x1 + x2) / 2)),
        labelY: gapY,
      };
    }
    const bottoms = laneBands.filter((lane) => lane.band === a.band).map((lane) => lane.y + lane.h);
    const y = Math.max(a.y + a.h, b.y + b.h, ...bottoms) + 16;
    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      back: true,
      d: `M ${round(x1)} ${round(a.y + a.h)} L ${round(x1)} ${round(y)} L ${round(x2)} ${round(y)} L ${round(x2)} ${round(b.y + b.h)}`,
      labelX: Math.min(width - 56, Math.max(56, (x1 + x2) / 2)),
      labelY: y - 10,
    };
  }
  return routeForward(a, b, edge);
}

export function layoutFlow(args: {
  nodes: GuideNode[];
  edges?: GuideEdge[];
  width: number;
  heights?: Record<string, number>;
}): FlowLayout {
  const edges = resolveEdges(args.nodes, args.edges);
  const laneNames = flowLanes(args.nodes);
  const showLanes = laneNames.length > 1;
  const columns = columnsForWidth(args.width, showLanes);
  const { forward, back } = classifyEdges(args.nodes, edges);
  const backKeys = new Set(back.map(edgeKey));
  const rank = rankNodes(args.nodes, forward);
  const heights = args.heights ?? {};
  const laneBlock = showLanes ? FLOW_LAYOUT.laneWidth + FLOW_LAYOUT.lanePad : 0;
  const width = args.width;

  const ordered = readingOrder(args.nodes, edges);
  const rows: GuideNode[][] = [];
  for (let index = 0; index < ordered.length; index += columns) {
    rows.push(ordered.slice(index, index + columns));
  }

  const boxes: FlowBox[] = [];
  const lanes: FlowLaneBand[] = [];
  let cursor = FLOW_LAYOUT.pad;
  const bandOf = new Map<string, number>();

  rows.forEach((row, band) => {
    const sized = row.map((node) => ({ node, ...nodeSize(node, heights), rank: rank.get(node.id) ?? 0 }));
    const rowH = sized.reduce((max, item) => Math.max(max, item.h), 0);
    const laneSet = [...new Set(row.map((node) => node.lane).filter((lane): lane is string => Boolean(lane)))];
    const uniform = laneSet.length === 1 ? laneSet[0] : '';
    const top = cursor;
    const boxH = rowH + 16;
    sized.forEach((item, index) => {
      const col = band % 2 === 1 ? columns - 1 - index : index;
      const slotX = laneBlock + FLOW_LAYOUT.pad + col * (FLOW_LAYOUT.columnWidth + FLOW_LAYOUT.columnGap);
      bandOf.set(item.node.id, band);
      boxes.push({
        id: item.node.id,
        x: slotX + (FLOW_LAYOUT.columnWidth - item.w) / 2,
        y: top + 8 + (rowH - item.h) / 2,
        w: item.w,
        h: item.h,
        rank: item.rank,
        band,
        col,
        lane: item.node.lane ?? '',
      });
    });
    lanes.push({
      lane: uniform,
      laneIndex: uniform ? Math.max(0, laneNames.indexOf(uniform)) : 0,
      band,
      x: 4,
      y: top,
      w: width - 8,
      h: boxH,
    });
    const loop = back.some((edge) => bandOf.get(edge.from) === band && bandOf.get(edge.to) === band);
    cursor += boxH + (loop ? FLOW_LAYOUT.edgeGutter : 10) + FLOW_LAYOUT.bandGap;
  });

  const routes = edges.flatMap((edge) => {
    const from = boxes.find((box) => box.id === edge.from);
    const to = boxes.find((box) => box.id === edge.to);
    if (!from || !to) return [];
    return [routeEdge(from, to, edge, backKeys.has(edgeKey(edge)), width, lanes)];
  });

  return {
    width,
    height: Math.max(cursor, 80),
    columns,
    boxes,
    lanes,
    routes,
    showLanes,
    laneNames,
  };
}

export function boxesOverlap(a: FlowBox, b: FlowBox): boolean {
  return a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;
}

export type FlowCheckOptions = {
  /** Every node must scroll to a real feature section. */
  requireAnchor?: boolean;
  /** Every step (not a decision) must name an icon. */
  requireIcon?: boolean;
};

export function flowErrors(guide: Pick<ModuleGuide, 'id' | 'flow' | 'edges' | 'features'>, options?: FlowCheckOptions): string[] {
  const errors: string[] = [];
  const prefix = guide.id;
  if (!guide.flow.length) errors.push(`${prefix} has no flow`);
  const ids = new Set<string>();
  const featureIds = new Set(guide.features.map((feature) => feature.id));
  const lanes = flowLanes(guide.flow);

  for (const node of guide.flow) {
    if (!node.id) errors.push(`${prefix} has a node with no id`);
    if (ids.has(node.id)) errors.push(`${prefix} duplicate node ${node.id}`);
    ids.add(node.id);
    if (!node.label.trim()) errors.push(`${prefix} node ${node.id} has no label`);
    if (lanes.length > 0 && !node.lane) errors.push(`${prefix} node ${node.id} is missing a lane`);
    if (node.anchor && !featureIds.has(node.anchor)) {
      errors.push(`${prefix} node ${node.id} anchor ${node.anchor} is not a feature`);
    }
    if (options?.requireAnchor && (!node.anchor || !featureIds.has(node.anchor))) {
      errors.push(`${prefix} node ${node.id} anchor does not resolve`);
    }
    if (options?.requireIcon && node.kind !== 'decision' && !node.icon) {
      errors.push(`${prefix} node ${node.id} is missing an icon`);
    }
  }

  const edges = resolveEdges(guide.flow, guide.edges);
  const outgoing = new Map<string, GuideEdge[]>();
  const seen = new Set<string>();
  for (const edge of edges) {
    if (!ids.has(edge.from)) errors.push(`${prefix} edge from unknown node ${edge.from}`);
    if (!ids.has(edge.to)) errors.push(`${prefix} edge to unknown node ${edge.to}`);
    if (edge.from === edge.to) errors.push(`${prefix} edge loops on itself at ${edge.from}`);
    const key = `${edge.from}\0${edge.to}\0${edge.label ?? ''}`;
    if (seen.has(key)) errors.push(`${prefix} duplicate edge ${edge.from} → ${edge.to}`);
    seen.add(key);
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  for (const node of guide.flow) {
    if (node.kind !== 'decision') continue;
    const outs = outgoing.get(node.id) ?? [];
    if (outs.length < 2) errors.push(`${prefix} decision ${node.id} needs 2 or more outgoing edges`);
    for (const edge of outs) {
      if (!edge.label?.trim()) errors.push(`${prefix} decision ${node.id} has an unlabelled branch to ${edge.to}`);
    }
  }

  return errors;
}

/** A diagram longer than this is grouped into named stages. */
export const FLOW_STAGE_LIMIT = 8;

export function needsFlowStages(nodes: GuideNode[]): boolean {
  return nodes.length > FLOW_STAGE_LIMIT;
}

export type FlowStageGroup = {
  id: string;
  title: string;
  nodes: GuideNode[];
};

export function stageId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function flowStages(nodes: GuideNode[]): FlowStageGroup[] {
  if (!needsFlowStages(nodes)) return [{ id: 'all', title: '', nodes }];
  const order: string[] = [];
  const groups = new Map<string, GuideNode[]>();
  for (const node of nodes) {
    const title = node.stage?.trim() || 'Process';
    if (!groups.has(title)) {
      groups.set(title, []);
      order.push(title);
    }
    groups.get(title)?.push(node);
  }
  return order.map((title) => ({
    id: stageId(title),
    title,
    nodes: groups.get(title) ?? [],
  }));
}

export function missingStageIds(nodes: GuideNode[]): string[] {
  if (!needsFlowStages(nodes)) return [];
  return nodes.filter((node) => !node.stage?.trim()).map((node) => node.id);
}

export function initialOpenStages(stages: FlowStageGroup[]): string[] {
  return stages[0] ? [stages[0].id] : [];
}

export function toggleId(open: readonly string[], id: string): string[] {
  return open.includes(id) ? open.filter((item) => item !== id) : [...open, id];
}

export function expandAllStages(stages: FlowStageGroup[]): string[] {
  return stages.map((stage) => stage.id);
}

export function collapseAllStages(): string[] {
  return [];
}

export type BranchDetail = {
  label: string;
  target: string;
  outcome: string;
};

export function estimateDetailHeight(node: GuideNode, edges: GuideEdge[], nodes: GuideNode[]): number {
  const chars = 32;
  let lines = 1;
  if (node.does || node.hint) lines += 2;
  if (node.who || node.lane) lines += 2;
  if (node.posts) lines += Math.max(1, Math.ceil(node.posts.length / chars));
  if (node.status) lines += Math.max(1, Math.ceil(node.status.length / chars));
  if (!node.posts && !node.status && node.books) lines += Math.max(1, Math.ceil(node.books.length / chars));
  if (node.kind === 'decision') lines += 1 + branchDetails(node, edges, nodes).length * 2;
  return 20 + lines * 18;
}

export function branchDetails(node: GuideNode, edges: GuideEdge[], nodes: GuideNode[]): BranchDetail[] {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  return edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => {
      const target = byId.get(edge.to);
      return {
        label: edge.label?.trim() || 'Next',
        target: target?.label ?? edge.to,
        outcome: target?.status || target?.posts || target?.books || target?.hint || '',
      };
    });
}

export function edgesWithin(nodes: GuideNode[], edges: GuideEdge[]): GuideEdge[] {
  const ids = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
}
