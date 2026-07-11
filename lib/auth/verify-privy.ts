/**
 * Server-side Privy access-token verification (ES256 JWT via JWKS).
 * Never trust client-supplied privyUserId alone for authorization.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getCanonicalUserId } from '@/lib/auth/identity';

export type VerifiedPrivyUser = {
  userId: string;
  sessionId?: string;
  appId?: string;
  raw: JWTPayload;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getAppId(): string {
  return (
    process.env.NEXT_PUBLIC_PRIVY_APP_ID ||
    process.env.PRIVY_APP_ID ||
    ''
  ).trim();
}

function getJwks() {
  const appId = getAppId();
  if (!appId) return null;
  if (!jwks) {
    // Privy JWKS endpoint for app access tokens
    jwks = createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`)
    );
  }
  return jwks;
}

/**
 * When true (default in production): reject requests without a valid Bearer token.
 * Set AUTH_STRICT=false only for emergency local recovery.
 */
export function isAuthStrict(): boolean {
  const raw = process.env.AUTH_STRICT;
  if (raw === undefined || raw === '') {
    return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  }
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase().trim());
}

/**
 * Allow body/query privyUserId only when it matches verified token (always)
 * or when AUTH_ALLOW_LEGACY_PRIVY_ID=true and AUTH_STRICT=false (dev only).
 */
export function allowLegacyPrivyId(): boolean {
  if (isAuthStrict()) return false;
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.AUTH_ALLOW_LEGACY_PRIVY_ID || '').toLowerCase().trim()
  );
}

export async function verifyPrivyAccessToken(
  token: string | null | undefined
): Promise<
  | { ok: true; user: VerifiedPrivyUser }
  | { ok: false; error: string; code: string }
> {
  if (!token || typeof token !== 'string' || token.length < 20) {
    return { ok: false, error: 'Missing access token', code: 'NO_TOKEN' };
  }

  const appId = getAppId();
  if (!appId) {
    return {
      ok: false,
      error: 'NEXT_PUBLIC_PRIVY_APP_ID not configured on server',
      code: 'NO_APP_ID',
    };
  }

  const keySet = getJwks();
  if (!keySet) {
    return { ok: false, error: 'JWKS unavailable', code: 'NO_JWKS' };
  }

  const rawToken = token.replace(/^Bearer\s+/i, '').trim();

  let payload: JWTPayload | null = null;
  try {
    const res = await jwtVerify(rawToken, keySet, {
      audience: appId,
      algorithms: ['ES256'],
    });
    payload = res.payload;
  } catch {
    // Fallback: some Privy token shapes vary on aud/issuer — verify signature only then check app claim
    try {
      const res = await jwtVerify(rawToken, keySet, { algorithms: ['ES256'] });
      payload = res.payload;
      const claimApp = String(
        (payload as { app_id?: string }).app_id ||
          (Array.isArray(payload.aud) ? payload.aud[0] : payload.aud) ||
          ''
      );
      if (claimApp && claimApp !== appId && !claimApp.includes(appId)) {
        return {
          ok: false,
          error: 'Token audience/app_id does not match this app',
          code: 'WRONG_APP',
        };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Token verification failed';
      return { ok: false, error: msg, code: 'INVALID_TOKEN' };
    }
  }

  if (!payload) {
    return { ok: false, error: 'Token verification failed', code: 'INVALID_TOKEN' };
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  const userId = getCanonicalUserId(sub);
  if (!userId) {
    return { ok: false, error: 'Token missing subject', code: 'NO_SUB' };
  }

  return {
    ok: true,
    user: {
      userId,
      sessionId:
        typeof (payload as { session_id?: string }).session_id === 'string'
          ? (payload as { session_id?: string }).session_id
          : undefined,
      appId,
      raw: payload,
    },
  };
}

/** Extract bearer from Authorization header or privy-token cookie */
export function extractAccessToken(headers: Headers, cookieHeader?: string | null): string | null {
  const auth = headers.get('authorization') || headers.get('Authorization');
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim();
  }
  // Cookie: privy-token=...
  const cookie = cookieHeader || headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)privy-token=([^;]+)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}
