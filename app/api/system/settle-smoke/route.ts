import { NextResponse } from 'next/server';
import { getSupabaseServer, hasServiceRole } from '@/lib/supabase/server-client';
import { deploymentMeta } from '@/lib/system/schema-probe';

/**
 * GET /api/system/settle-smoke
 * Non-mutating readiness for live settle: claims, ledger, installments, money path.
 */
export async function GET() {
  const deploy = deploymentMeta();
  const checks: Record<
    string,
    { ok: boolean; error?: string; detail?: unknown }
  > = {};

  if (!hasServiceRole()) {
    return NextResponse.json({
      ok: false,
      deploy,
      error: 'Service role required',
      checks,
    });
  }

  const supabase = getSupabaseServer();

  const tables = [
    {
      key: 'customer_payment_claims',
      migration: '20260717_payment_claims_and_ledger_fx.sql',
    },
    {
      key: 'customer_invoice_payments',
      migration: '20260717_ar_ledger.sql',
    },
    {
      key: 'customer_invoice_installments',
      migration: '20260718_installments_collections.sql',
    },
    { key: 'customer_invoices', migration: null },
    { key: 'rating_prompts', migration: null },
  ] as const;

  for (const t of tables) {
    const { error, count } = await supabase
      .from(t.key)
      .select('id', { count: 'exact', head: true });
    const missing =
      error && /relation|does not exist|schema cache/i.test(error.message || '');
    checks[`table_${t.key}`] = {
      ok: !missing,
      error: missing ? error?.message : undefined,
      detail: {
        count: count ?? null,
        migration: t.migration,
      },
    };
  }

  const colProbes: Array<{ table: string; column: string; hint: string }> = [
    {
      table: 'customer_payment_claims',
      column: 'proof_url',
      hint: 'proof_url on claims for POP',
    },
    {
      table: 'customer_payment_claims',
      column: 'ledger_payment_id',
      hint: 'claim → ledger link',
    },
    {
      table: 'customer_invoice_payments',
      column: 'amount_base',
      hint: 'ledger FX amount_base',
    },
    {
      table: 'customer_invoices',
      column: 'promise_to_pay_date',
      hint: 'collections promise-to-pay',
    },
  ];

  for (const p of colProbes) {
    const { error } = await supabase.from(p.table).select(p.column).limit(1);
    const missing =
      error && /column|schema cache|does not exist/i.test(error.message || '');
    checks[`col_${p.table}_${p.column}`] = {
      ok: !missing,
      error: missing ? error?.message : undefined,
      detail: missing ? { hint: p.hint } : { present: true },
    };
  }

  // Soft head of money-hub path dependencies
  try {
    const { count: overdue } = await supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue');
    checks.overdue_invoices_probe = {
      ok: true,
      detail: { overdueCount: overdue ?? 0 },
    };
  } catch (e: unknown) {
    checks.overdue_invoices_probe = {
      ok: false,
      error: e instanceof Error ? e.message : 'probe failed',
    };
  }

  checks.env_resend = {
    ok: Boolean(process.env.RESEND_API_KEY),
    detail: { neededFor: 'claim emails' },
  };
  checks.env_cron = {
    ok: Boolean(process.env.CRON_SECRET),
    detail: { neededFor: 'dunning / activation digests' },
  };
  checks.env_paystack = {
    ok: Boolean(
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
    ),
  };

  const failed = Object.entries(checks).filter(([, v]) => !v.ok);
  const blockers = failed
    .filter(([k]) => k.startsWith('table_'))
    .map(([k, v]) => `${k}: ${v.error || 'missing'}`);
  const warnings = failed
    .filter(([k]) => !k.startsWith('table_'))
    .map(([k, v]) => `${k}: ${v.error || 'not ok'}`);

  return NextResponse.json({
    ok: blockers.length === 0,
    settleLive: blockers.length === 0,
    deploy,
    blockers,
    warnings,
    checks,
    moneyHub: '/dashboard/customers/money',
    buyerMoney: '/dashboard/buyer/money',
    docs: 'docs/OPS_MIGRATIONS.md',
    at: new Date().toISOString(),
  });
}
