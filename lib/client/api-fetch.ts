/**
 * Browser API helper — Bearer token + credentials + optional privyUserId.
 * Use for all dashboard trade/money/intelligence calls so AUTH_STRICT production works.
 */
'use client';

export type ApiFetchOptions = RequestInit & {
  /** Privy access token (from usePrivy().getAccessToken) */
  accessToken?: string | null;
  /** Legacy body/query privy user id (only when AUTH_ALLOW_LEGACY_PRIVY_ID) */
  privyUserId?: string | null;
  /** Append companyId + privyUserId to query string for GET */
  companyId?: number | string | null;
  /** Merge privyUserId into JSON body for POST/PATCH */
  jsonBody?: Record<string, unknown>;
};

/**
 * Fetch /api/* with auth headers and cookies.
 * - Always credentials: 'include' (privy-token cookie)
 * - Sets Authorization when accessToken provided
 * - For GET with companyId, appends query params
 * - For jsonBody, serializes JSON and injects companyId/privyUserId
 */
export async function apiFetch(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<Response> {
  const {
    accessToken,
    privyUserId,
    companyId,
    jsonBody,
    headers: initHeaders,
    body: initBody,
    method,
    ...rest
  } = opts;

  const headers = new Headers(initHeaders || {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let url = path.startsWith('/') ? path : `/${path}`;
  const m = (method || (jsonBody ? 'POST' : 'GET')).toUpperCase();

  if (m === 'GET' || m === 'HEAD') {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://local');
    if (companyId != null && companyId !== '') {
      u.searchParams.set('companyId', String(companyId));
    }
    if (privyUserId) u.searchParams.set('privyUserId', privyUserId);
    url = u.pathname + u.search;
  }

  let body = initBody;
  if (jsonBody) {
    headers.set('Content-Type', 'application/json');
    const payload = { ...jsonBody };
    if (companyId != null && payload.companyId === undefined) {
      payload.companyId = Number(companyId);
    }
    if (privyUserId && payload.privyUserId === undefined) {
      payload.privyUserId = privyUserId;
    }
    body = JSON.stringify(payload);
  }

  return fetch(url, {
    ...rest,
    method: m,
    headers,
    body,
    credentials: 'include',
  });
}

/** Parse JSON safely; throws with server error message when !ok */
export async function apiJson<T = Record<string, unknown>>(
  path: string,
  opts?: ApiFetchOptions
): Promise<T> {
  const res = await apiFetch(path, opts);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data && typeof data === 'object' && 'error' in data && data.error) ||
        `Request failed (${res.status})`
    );
  }
  return data;
}
