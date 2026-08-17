/**
 * Shared browser cache for /api/business/membership.
 * Sidebar + dashboard layout used to fire the same request twice on every
 * navigation. In-flight dedupe + a short TTL keep chrome snappy.
 */
'use client';

export type CompanyMembershipPayload = {
  success?: boolean;
  error?: string;
  membership?: {
    role?: string;
    roleLabel?: string;
    rights?: string;
    memberId?: number;
    canManageTeam?: boolean;
    [key: string]: unknown;
  };
  enabledModules?: Record<string, boolean>;
  packaging?: unknown;
  businessType?: string | null;
  logoUrl?: string | null;
  companyName?: string | null;
  sidebarModuleOrder?: string[];
  [key: string]: unknown;
};

const TTL_MS = 20_000;
const cache = new Map<
  string,
  { at: number; data: CompanyMembershipPayload }
>();
const inflight = new Map<string, Promise<CompanyMembershipPayload>>();

function cacheKey(companyId: number, privyUserId: string): string {
  return `${companyId}:${privyUserId}`;
}

export function invalidateCompanyMembership(
  companyId?: number | null,
  privyUserId?: string | null
): void {
  if (companyId && privyUserId) {
    cache.delete(cacheKey(companyId, privyUserId));
    return;
  }
  cache.clear();
}

export async function fetchCompanyMembership(
  companyId: number,
  privyUserId: string,
  opts?: { force?: boolean }
): Promise<CompanyMembershipPayload> {
  const key = cacheKey(companyId, privyUserId);
  if (!opts?.force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const run = (async () => {
    const params = new URLSearchParams({
      companyId: String(companyId),
      privyUserId,
    });
    const res = await fetch(`/api/business/membership?${params}`, {
      credentials: 'same-origin',
    });
    const data = (await res.json().catch(() => ({}))) as CompanyMembershipPayload;
    if (!res.ok) {
      throw new Error(data.error || 'Could not load membership');
    }
    cache.set(key, { at: Date.now(), data });
    return data;
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}
