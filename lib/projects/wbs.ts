import { addDays, clampDayRange, dateEnvelope, isoDay } from '@/lib/projects/waterfall';

export const WBS_MAX_DEPTH = 5;

export type WbsTask = {
  id: number;
  parent_task_id?: number | null;
  start_date?: string | null;
  due_date?: string | null;
};

export type WbsNode<T extends WbsTask> = T & {
  depth: number;
  children: Array<WbsNode<T>>;
};

export function buildWbsTree<T extends WbsTask>(tasks: T[]): Array<WbsNode<T>> {
  const nodes = new Map<number, WbsNode<T>>();
  for (const t of tasks) {
    nodes.set(t.id, { ...t, depth: 0, children: [] });
  }
  const roots: Array<WbsNode<T>> = [];
  for (const node of nodes.values()) {
    const pid = node.parent_task_id != null ? Number(node.parent_task_id) : 0;
    const parent = pid > 0 && pid !== node.id ? nodes.get(pid) : null;
    if (parent) {
      node.depth = Math.min(parent.depth + 1, WBS_MAX_DEPTH);
      parent.children.push(node);
    } else {
      node.parent_task_id = null;
      roots.push(node);
    }
  }
  return roots;
}

export function flattenWbs<T extends WbsTask>(
  roots: Array<WbsNode<T>>,
  collapsedIds?: Set<number>
): Array<WbsNode<T>> {
  const out: Array<WbsNode<T>> = [];
  const walk = (list: Array<WbsNode<T>>) => {
    for (const n of list) {
      out.push(n);
      if (n.children.length && !collapsedIds?.has(n.id)) walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/** Summary tasks take the envelope of descendants (MS Project). */
export function rollupWbsDates<T extends WbsTask>(
  roots: Array<WbsNode<T>>
): Array<WbsNode<T>> {
  const visit = (n: WbsNode<T>): { start: string; end: string } | null => {
    const childEnvs = n.children.map(visit).filter(Boolean) as Array<{
      start: string;
      end: string;
    }>;
    const own = dateEnvelope([
      { start: n.start_date, end: n.due_date },
      ...childEnvs,
    ]);
    if (n.children.length && own) {
      n.start_date = own.start;
      n.due_date = own.end;
    } else if (!n.start_date || !n.due_date) {
      const start = n.start_date || isoDay(new Date());
      const end = n.due_date || addDays(start, 6);
      const range = clampDayRange(start, end);
      n.start_date = range.start;
      n.due_date = range.end;
    }
    return n.start_date && n.due_date
      ? { start: String(n.start_date), end: String(n.due_date) }
      : null;
  };
  for (const r of roots) visit(r);
  return roots;
}

export function wbsDepthOf<T extends WbsTask>(
  tasks: T[],
  taskId: number
): number {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let depth = 0;
  let cur = byId.get(taskId);
  const seen = new Set<number>();
  while (cur?.parent_task_id && byId.has(cur.parent_task_id) && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth += 1;
    cur = byId.get(cur.parent_task_id);
    if (depth > WBS_MAX_DEPTH) break;
  }
  return depth;
}
