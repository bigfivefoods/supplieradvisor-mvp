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

/** Tables the live OS cannot run without. Missing = P0 blocker. */
export const REQUIRED_STORE_TABLES: Array<{
  table: string;
  column: string;
  migrationHint: string;
}> = [
  {
    table: 'company_module_stores',
    column: 'data',
    migrationHint: '20260820_ensure_system_schema.sql',
  },
  {
    table: 'company_workspace',
    column: 'chrome',
    migrationHint: '20260820_ensure_system_schema.sql',
  },
];

/** Ledger / membership columns that should exist after 20260821_saas_db_harden.sql */
export const OPTIONAL_LEDGER_COLUMNS: Array<{
  table: string;
  column: string;
  migrationHint: string;
}> = [
  {
    table: 'accounting_settings',
    column: 'profile_id',
    migrationHint: '20260821_saas_db_harden.sql',
  },
  {
    table: 'journal_entries',
    column: 'entry_number',
    migrationHint: '20260821_saas_db_harden.sql',
  },
  {
    table: 'bank_transactions',
    column: 'allocation_status',
    migrationHint: '20260821_saas_db_harden.sql',
  },
  {
    table: 'trade_portals',
    column: 'public_token',
    migrationHint: '20260822_trade_portals.sql',
  },
  {
    table: 'pm_projects',
    column: 'customer_id',
    migrationHint: '20260824_trade_projects.sql',
  },
  {
    table: 'paystack_webhook_events',
    column: 'reference',
    migrationHint: '20260825_saas_reliability.sql',
  },
  {
    table: 'customers',
    column: 'continent',
    migrationHint: 'RUN_THIS_FOR_CRM_SRM_BOOK.sql',
  },
  {
    table: 'customers',
    column: 'province',
    migrationHint: 'RUN_THIS_FOR_CRM_SRM_BOOK.sql',
  },
  {
    table: 'srm_suppliers',
    column: 'vat_number',
    migrationHint: 'RUN_THIS_FOR_CRM_SRM_BOOK.sql',
  },
  {
    table: 'order_batches',
    column: 'expiry_date',
    migrationHint: 'RUN_THIS_FOR_ORDER_CHAINS_COMPLETE.sql',
  },
  {
    table: 'order_chain_setups',
    column: 'product_ids',
    migrationHint: 'RUN_THIS_FOR_ORDER_CHAINS_COMPLETE.sql',
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

  const profileResults = await Promise.all(
    REQUIRED_PROFILE_COLUMNS.map(async (col) => {
      const { error } = await supabase.from('profiles').select(col).limit(0);
      return { col, error };
    })
  );
  for (const { col, error } of profileResults) {
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
  const optionalSpecs = [
    ...OPTIONAL_COMMERCIAL_COLUMNS,
    ...OPTIONAL_LEDGER_COLUMNS,
  ];
  const optionalResults = await Promise.all(
    optionalSpecs.map(async (opt) => {
      const { error } = await supabase
        .from(opt.table)
        .select(opt.column)
        .limit(0);
      return { opt, error };
    })
  );
  for (const { opt, error } of optionalResults) {
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

  const storeMissing: Array<{ table: string; column: string; hint: string }> =
    [];
  const storeResults = await Promise.all(
    REQUIRED_STORE_TABLES.map(async (req) => {
      const { error } = await supabase
        .from(req.table)
        .select(req.column)
        .limit(0);
      return { req, error };
    })
  );
  for (const { req, error } of storeResults) {
    const ok = !error;
    probes.push({
      table: req.table,
      column: req.column,
      ok,
      error: error?.message,
    });
    if (!ok) {
      storeMissing.push({
        table: req.table,
        column: req.column,
        hint: req.migrationHint,
      });
      missing.push(`${req.table}.${req.column}`);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    optionalMissing,
    probes,
    ghostColumns: [...GHOST_PROFILE_COLUMNS],
    hint:
      storeMissing.length > 0
        ? `Missing system stores: ${storeMissing
            .map((m) => m.table)
            .join(', ')}. Run supabase/migrations/20260820_ensure_system_schema.sql in the Supabase SQL editor.`
        : missing.length > 0
          ? `Missing profiles columns: ${missing.join(', ')}. Run supabase/migrations/20260716_profiles_branch_code.sql and 20260716_bank_account_verification.sql`
        : optionalMissing.length > 0
          ? `Optional columns missing: ${optionalMissing
              .map((m) => `${m.table}.${m.column} (${m.hint})`)
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
