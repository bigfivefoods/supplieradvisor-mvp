/**
 * Column-level schema probe for release health.
 * Missing columns → degraded health with migration hints.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

/** profiles columns that must exist for banking, discovery, and verification */
export const REQUIRED_PROFILE_COLUMNS = [
  'branch_code',
  'account_type',
  'bank_verification_status',
  'bank_verified_at',
  'bank_verification_payment_ref',
  'is_discoverable',
  'verification_status',
  'logo_url',
  'continent',
  'province',
  'metadata',
] as const;

export type ColumnProbe = {
  table: string;
  column: string;
  ok: boolean;
  error?: string;
};

/**
 * Probe that each column is selectable on a table (limit 0 = schema only).
 */
export async function probeProfileColumns(): Promise<{
  ok: boolean;
  missing: string[];
  probes: ColumnProbe[];
  hint?: string;
}> {
  const supabase = getSupabaseServer();
  const probes: ColumnProbe[] = [];
  const missing: string[] = [];

  for (const col of REQUIRED_PROFILE_COLUMNS) {
    const { error } = await supabase.from('profiles').select(col).limit(0);
    const ok = !error;
    if (!ok) missing.push(col);
    probes.push({
      table: 'profiles',
      column: col,
      ok,
      error: error?.message,
    });
  }

  return {
    ok: missing.length === 0,
    missing,
    probes,
    hint:
      missing.length > 0
        ? `Missing profiles columns: ${missing.join(', ')}. Run supabase/migrations/20260716_profiles_branch_code.sql and 20260716_bank_account_verification.sql`
        : undefined,
  };
}

export function deploymentMeta() {
  return {
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      process.env.GIT_COMMIT ||
      null,
    commitShort: (() => {
      const full =
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
        '';
      return full ? full.slice(0, 7) : null;
    })(),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    region: process.env.VERCEL_REGION || null,
  };
}
