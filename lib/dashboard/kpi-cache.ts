/**
 * 15–60s in-process cache for private KPI payloads (dashboard, ops, intel,
 * accounting, manufacturing). Money / webhooks / invites must not use this.
 */
import { ttlGetOrLoad } from '@/lib/system/memory-ttl';

export const KPI_TTL_MS = 30_000;
export const HOLDING_TTL_MS = 45_000;

export function withCompanyKpiCache<T>(
  companyId: number,
  name: string,
  load: () => Promise<T>
): Promise<T> {
  return ttlGetOrLoad(`kpi:${name}:${companyId}`, KPI_TTL_MS, load);
}
