/**
 * Per-user sidebar module order.
 * Saved on the company profile (profiles.metadata.user_sidebar_orders[userId])
 * and mirrored on business_users.permissions.sidebar_module_order.
 */

export function parseSidebarModuleOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = String(item || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Apply a saved order to currently visible modules. Unknown ids drop; new modules append. */
export function applySidebarModuleOrder<T extends { id: string }>(
  modules: T[],
  order: string[] | null | undefined
): T[] {
  if (!order?.length) return modules;
  const byId = new Map(modules.map((m) => [m.id, m]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const m = byId.get(id);
    if (!m || seen.has(id)) continue;
    out.push(m);
    seen.add(id);
  }
  for (const m of modules) {
    if (seen.has(m.id)) continue;
    out.push(m);
  }
  return out;
}

export function moveSidebarModule(
  order: string[],
  fromId: string,
  toId: string
): string[] {
  if (fromId === toId) return order;
  const next = order.filter((id) => id !== fromId);
  const to = next.indexOf(toId);
  if (to < 0) return [...next, fromId];
  next.splice(to, 0, fromId);
  return next;
}

export function readUserSidebarOrderFromCompanyMeta(
  metadata: unknown,
  userId: string
): string[] {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const map = meta.user_sidebar_orders;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
  return parseSidebarModuleOrder((map as Record<string, unknown>)[userId]);
}

export function mergeUserSidebarOrderIntoCompanyMeta(
  metadata: Record<string, unknown>,
  userId: string,
  order: string[]
): Record<string, unknown> {
  const prev =
    metadata.user_sidebar_orders &&
    typeof metadata.user_sidebar_orders === 'object' &&
    !Array.isArray(metadata.user_sidebar_orders)
      ? { ...(metadata.user_sidebar_orders as Record<string, unknown>) }
      : {};
  prev[userId] = parseSidebarModuleOrder(order);
  return { ...metadata, user_sidebar_orders: prev };
}
