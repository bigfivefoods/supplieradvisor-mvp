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
  'registration_number',
  'trading_name',
  'legal_name',
] as const;

/**
 * Columns that must NOT be selected/written (do not exist on prod profiles).
 * Health reports them as "ghost" warnings if someone reintroduces selects.
 */
export const GHOST_PROFILE_COLUMNS = ['is_verified'] as const;

/** Optional commercial columns (degrade soft if missing) */
export const OPTIONAL_COMMERCIAL_COLUMNS: Array<{
  table: string;
  column: string;
  migrationHint: string;
}> = [
  {
    table: 'customer_invoices',
    column: 'source_po_id',
    migrationHint: '20260716_customer_invoices_source_po_id.sql',
  },
  {
    table: 'profiles',
    column: 'verification_payment_ref',
    migrationHint: '20260717_verification_payment_ref.sql',
  },
  {
    table: 'profiles',
    column: 'verified_at',
    migrationHint: '20260717_verification_payment_ref.sql',
  },
];

export type ColumnProbe = {
  table: string;
  column: string;
  ok: boolean;
  error?: string;
};

export type ProfileColumnProbeResult = {
  ok: boolean;
  missing: string[];
  optionalMissing: Array<{ table: string; column: string; hint: string }>;
  ghostColumns: string[];
  probes: ColumnProbe[];
  hint?: string;
};

/**
 * Probe that each column is selectable on a table (limit 0 = schema only).
 */
export async function probeProfileColumns(): Promise<ProfileColumnProbeResult> {
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

  // Optional commercial columns (soft)
  const optionalMissing: Array<{ table: string; column: string; hint: string }> =
    [];
  for (const opt of OPTIONAL_COMMERCIAL_COLUMNS) {
    const { error } = await supabase
      .from(opt.table)
      .select(opt.column)
      .limit(0);
    const ok = !error;
    probes.push({
      table: opt.table,
      column: opt.column,
      ok,
      error: error?.message,
    });
    if (!ok) {
      optionalMissing.push({
        table: opt.table,
        column: opt.column,
        hint: opt.migrationHint,
      });
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    optionalMissing,
    probes,
    ghostColumns: [...GHOST_PROFILE_COLUMNS],
    hint:
      missing.length > 0
        ? `Missing profiles columns: ${missing.join(', ')}. Run supabase/migrations/20260716_profiles_branch_code.sql and 20260716_bank_account_verification.sql`
        : optionalMissing.length > 0
          ? `Optional columns missing: ${optionalMissing
              .map((m) => `${m.table}.${m.column}`)
              .join(', ')}`
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
