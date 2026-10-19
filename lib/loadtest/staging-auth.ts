/**
 * Staging-only load-test sign-in.
 * Production (VERCEL_ENV=production) returns before the signing key is used.
 * There is no environment variable that turns this on in production.
 */
import { createHmac } from 'node:crypto';
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  STAGING_SUPABASE_PROJECT_REF,
  supabaseProjectRefFromUrl,
} from '@/lib/system/env-guard';
import { STAGING_PROJECT_REF, usableSigningKey, verifyLoadtestJwt } from './jwt.js';

export type LoadtestAuthEnv = NodeJS.ProcessEnv;

export type LoadtestAuthResult =
  | { ok: true; userId: string }
  | { ok: false; code: string };

function hmacSha256Hex(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

/**
 * True only for a Vercel preview whose Supabase URL is the staging project,
 * with LOADTEST_ENDPOINTS=1 and a signing key of at least 32 non-whitespace
 * characters after trim. VERCEL_ENV=production is refused before any other
 * condition is consulted.
 */
export function loadtestAuthEnabled(env: LoadtestAuthEnv): boolean {
  if (env.VERCEL_ENV === 'production') return false;
  if (env.VERCEL_ENV !== 'preview') return false;
  if (env.LOADTEST_ENDPOINTS !== '1') return false;
  if (!usableSigningKey(env.LOADTEST_SIGNING_KEY)) return false;

  const serverUrl = (env.SUPABASE_URL || '').trim();
  const publicUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!serverUrl || !publicUrl) return false;
  if (
    serverUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF) ||
    publicUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)
  ) {
    return false;
  }
  const serverRef = supabaseProjectRefFromUrl(serverUrl);
  const publicRef = supabaseProjectRefFromUrl(publicUrl);
  if (!serverRef || serverRef !== publicRef) return false;
  if (serverRef === PRODUCTION_SUPABASE_PROJECT_REF) return false;
  if (serverRef !== STAGING_SUPABASE_PROJECT_REF) return false;
  if (STAGING_PROJECT_REF !== STAGING_SUPABASE_PROJECT_REF) return false;
  return true;
}

type JwtVerifyResult =
  | { ok: true; sub: string }
  | { ok: false; code: string };

export function authenticateLoadtestToken(
  token: string | null | undefined,
  env: LoadtestAuthEnv,
  nowSeconds: number
): LoadtestAuthResult {
  if (!loadtestAuthEnabled(env)) return { ok: false, code: 'LOADTEST_AUTH_DISABLED' };
  const key = usableSigningKey(env.LOADTEST_SIGNING_KEY);
  const verified = verifyLoadtestJwt({
    token,
    key,
    now: nowSeconds,
    hmacSha256Hex,
  }) as JwtVerifyResult;
  if (!verified.ok) return { ok: false, code: verified.code };
  return { ok: true, userId: verified.sub };
}
