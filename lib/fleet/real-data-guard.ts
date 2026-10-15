/**
 * FleetAdvisor® demo-data gate. Personal details stay off until an owner confirms.
 */
import type { FleetOp, FleetWorkspace } from './types';

export const REAL_DATA_PHRASE = 'ENABLE REAL DATA';

export function assertRealDataAllowed(
  workspace: Pick<FleetWorkspace, 'real_data_enabled'>,
  op: FleetOp
): { ok: true } | { ok: false; error: string } {
  if (workspace.real_data_enabled) return { ok: true };
  const personal = carriesPersonal(op);
  if (!personal) return { ok: true };
  return {
    ok: false,
    error: 'Demo-data mode is on. Personal details stay off until an owner confirms real data in Settings.',
  };
}

function carriesPersonal(op: FleetOp): boolean {
  const payload = op.payload || {};
  if (op.op === 'driver.upsert') {
    return Boolean(text(payload.full_name) || text(payload.phone) || text(payload.email));
  }
  if (op.op === 'job.upsert' && Array.isArray(payload.stops)) {
    return payload.stops.some((stop) => {
      if (!stop || typeof stop !== 'object') return false;
      const row = stop as { contact_name?: unknown; contact_phone?: unknown };
      return Boolean(text(row.contact_name) || text(row.contact_phone));
    });
  }
  return false;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
