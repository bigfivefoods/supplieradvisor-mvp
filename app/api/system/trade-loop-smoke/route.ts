import { NextResponse } from 'next/server';
import { getSupabaseServer, hasServiceRole } from '@/lib/supabase/server-client';
import { deploymentMeta } from '@/lib/system/schema-probe';

/**
 * GET /api/system/trade-loop-smoke
 * Lightweight production readiness for the golden trade path:
 * discoverable profiles → connections → POs → invoices (source_po) → ratings.
 * Does not mutate data.
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
    'profiles',
    'business_connections',
    'purchase_orders',
    'customer_invoices',
    'company_ratings',
    'rating_prompts',
  ] as const;

  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });
    checks[`table_${table}`] = {
      ok: !error,
      error: error?.message,
      detail: { count: count ?? null },
    };
  }

  // Column probes critical to trade loop
  const colProbes: Array<{ table: string; column: string; hint: string }> = [
    {
      table: 'customer_invoices',
      column: 'source_po_id',
      hint: '20260716_customer_invoices_source_po_id.sql',
    },
    {
      table: 'profiles',
      column: 'verification_status',
      hint: 'profiles.verification_status required for CIPC badge',
    },
    {
      table: 'profiles',
      column: 'is_discoverable',
      hint: 'is_discoverable for SEO directory',
    },
  ];

  for (const p of colProbes) {
    const { error } = await supabase.from(p.table).select(p.column).limit(1);
    const missing =
      error && /column|schema cache|does not exist/i.test(error.message);
    checks[`col_${p.table}_${p.column}`] = {
      ok: !missing,
      error: missing ? error?.message : undefined,
      detail: missing ? { migrationHint: p.hint } : { present: true },
    };
  }

  // Env for money + document delivery
  checks.env_paystack_secret = {
    ok: Boolean(
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
    ),
    error: !(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET)
      ? 'PAYSTACK_SECRET_KEY not set'
      : undefined,
  };
  checks.env_twilio_whatsapp = {
    ok: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM
    ),
    error: !(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
    )
      ? 'Twilio incomplete — WhatsApp PDF file attach soft-fails to client share'
      : undefined,
  };
  checks.env_resend = {
    ok: Boolean(process.env.RESEND_API_KEY),
    error: process.env.RESEND_API_KEY ? undefined : 'RESEND_API_KEY not set',
  };

  const ok = Object.values(checks).every((c) => c.ok);
  const criticalFail = Object.entries(checks)
    .filter(([, c]) => !c.ok)
    .map(([k, c]) => ({ key: k, error: c.error }));

  return NextResponse.json({
    ok,
    deploy,
    path: 'discover → connect → PO → invoice(source_po) → pay → rate',
    checks,
    criticalFail,
    at: new Date().toISOString(),
    hint: ok
      ? 'Trade-loop schema + core env look ready'
      : 'Fix criticalFail items — migrations or Vercel env — then redeploy once',
  });
}
