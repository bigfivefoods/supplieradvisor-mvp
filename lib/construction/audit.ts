/** Additive audit rows. Brief 112 owns the same array; this only appends. */

export type ConstructionAuditEvent = {
  at: string;
  actor_kind: 'staff' | 'portal';
  actor_id: string;
  action: string;
  target: string;
};

export function appendConstructionAudit(
  meta: Record<string, unknown>,
  events: ConstructionAuditEvent[]
): Record<string, unknown> {
  if (!events.length) return meta;
  const prev = Array.isArray(meta.constructiongraph_audit) ? meta.constructiongraph_audit : [];
  const next = [...prev, ...events].slice(-200);
  return { ...meta, constructiongraph_audit: next };
}
