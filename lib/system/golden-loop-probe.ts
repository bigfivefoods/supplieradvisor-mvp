/**
 * Soft probes for golden-loop tables used by health + board pack.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type TableProbe = {
  key: string;
  ok: boolean;
  error?: string;
  migration?: string;
  requiredFor: string;
};

const GOLDEN_TABLES: Array<{
  key: string;
  migration?: string;
  requiredFor: string;
}> = [
  {
    key: 'purchase_orders',
    migration: '20260709_customer_purchase_orders.sql',
    requiredFor: 'trade-loop',
  },
  {
    key: 'customer_invoices',
    requiredFor: 'invoice-settle',
  },
  {
    key: 'customer_payment_claims',
    migration: '20260717_payment_claims_and_ledger_fx.sql',
    requiredFor: 'settle-by-default',
  },
  {
    key: 'customer_invoice_payments',
    migration: '20260717_ar_ledger.sql',
    requiredFor: 'settle-by-default',
  },
  {
    key: 'stock_levels',
    migration: '20260709_inventory_world_class.sql',
    requiredFor: 'receive-to-stock',
  },
  {
    key: 'stock_movements',
    migration: '20260709_inventory_world_class.sql',
    requiredFor: 'receive-to-stock',
  },
  {
    key: 'products',
    requiredFor: 'receive-to-stock',
  },
  {
    key: 'po_reviews',
    migration: '20260709_po_reviews.sql',
    requiredFor: 'peer-rate',
  },
  {
    key: 'pm_projects',
    migration: '20260711_haccp_esg_pm_suite.sql',
    requiredFor: 'pmo-insights',
  },
  {
    key: 'pm_project_riads',
    migration: '20260723_pm_epm_pmo.sql',
    requiredFor: 'pmo-insights',
  },
  {
    key: 'esg_emissions',
    migration: '20260724_sustainability_esg_suite.sql',
    requiredFor: 'esg',
  },
  {
    key: 'esg_targets',
    migration: '20260724_sustainability_esg_suite.sql',
    requiredFor: 'esg',
  },
];

export async function probeGoldenLoopTables(
  supabase: SupabaseClient
): Promise<{
  ok: boolean;
  missing: string[];
  tables: TableProbe[];
  migrationsToApply: string[];
}> {
  const tables: TableProbe[] = [];
  const missing: string[] = [];
  const migrations = new Set<string>();

  for (const t of GOLDEN_TABLES) {
    const { error } = await supabase
      .from(t.key)
      .select('id', { count: 'exact', head: true });
    const isMissing =
      Boolean(error) &&
      /relation|does not exist|schema cache/i.test(error?.message || '');
    tables.push({
      key: t.key,
      ok: !isMissing && !error,
      error: error?.message,
      migration: t.migration,
      requiredFor: t.requiredFor,
    });
    if (isMissing) {
      missing.push(t.key);
      if (t.migration) migrations.add(t.migration);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    tables,
    migrationsToApply: [...migrations],
  };
}
