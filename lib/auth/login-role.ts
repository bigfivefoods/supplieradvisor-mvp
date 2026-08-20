/**
 * Cached post-login role so /login, AuthGate, and select-company
 * do not each wait on a full contractor session.
 */
export type LoginRole = {
  isContractor: boolean;
  isBusinessUser: boolean;
};

const KEY = 'sa_login_role';
const TTL_MS = 60_000;

export function cacheLoginRole(role: LoginRole): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...role, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function readCachedLoginRole(): LoginRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoginRole & { at?: number };
    if (!parsed || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return {
      isContractor: parsed.isContractor === true,
      isBusinessUser: parsed.isBusinessUser === true,
    };
  } catch {
    return null;
  }
}

export async function fetchLoginRole(opts: {
  privyUserId: string | null;
  email?: string | null;
}): Promise<LoginRole> {
  const cached = readCachedLoginRole();
  if (cached) return cached;
  const res = await fetch('/api/contractor/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lite: true,
      privyUserId: opts.privyUserId,
      email: opts.email || null,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as LoginRole & {
    isContractor?: boolean;
    isBusinessUser?: boolean;
  };
  const role: LoginRole = {
    isContractor: data.isContractor === true,
    isBusinessUser: data.isBusinessUser === true,
  };
  cacheLoginRole(role);
  return role;
}
