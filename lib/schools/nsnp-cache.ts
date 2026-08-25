/**
 * Short TTL for SchoolAdvisor identity / catalogue lookups.
 * Process-local — cold starts miss. Never a source of truth.
 */
import { ttlDel, ttlGet, ttlSet } from '@/lib/system/memory-ttl';

const ROLE_MS = 45_000;
const CTX_MS = 45_000;
const AGENCY_MS = 45_000;
const CATALOGUE_MS = 30_000;

export function nsnpCacheGet<T>(key: string): T | null {
  return ttlGet<T>(key);
}

export function nsnpCacheSet<T>(key: string, value: T, ttlMs: number): T {
  ttlSet(key, value, ttlMs);
  return value;
}

export function nsnpCacheDelCompany(companyId: number) {
  ttlDel(`nsnp:role:${companyId}`);
  ttlDel(`nsnp:ctx:${companyId}`);
  ttlDel(`nsnp:agency:${companyId}`);
  ttlDel(`nsnp:products:${companyId}`);
}

export const NSNP_TTL = {
  role: ROLE_MS,
  ctx: CTX_MS,
  agency: AGENCY_MS,
  products: CATALOGUE_MS,
} as const;
