import { NextResponse } from 'next/server';
import { getSupabaseServer, hasServiceRole } from '@/lib/supabase/server-client';
import {
  deploymentMeta,
  probeProfileColumns,
} from '@/lib/system/schema-probe';

/**
 * GET /api/system/health
 * Connectivity + table probes + column schema gate + deploy identity.
 */
export async function GET() {
  const started = Date.now();
  const deploy = deploymentMeta();
  const checks: Record<
    string,
    { ok: boolean; ms?: number; error?: string; count?: number | null; detail?: unknown }
  > = {};

  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  checks.env = {
    ok: hasUrl && hasKey,
    error: !hasUrl
      ? 'Missing NEXT_PUBLIC_SUPABASE_URL'
      : !hasKey
        ? 'Missing Supabase key'
        : undefined,
  };

  checks.resend = {
    ok: Boolean(process.env.RESEND_API_KEY),
    error: process.env.RESEND_API_KEY ? undefined : 'RESEND_API_KEY not set',
  };
  checks.xai = {
    ok: Boolean(process.env.XAI_API_KEY),
    error: process.env.XAI_API_KEY ? undefined : 'XAI_API_KEY not set (SAM)',
  };
  checks.cron_secret = {
    ok: Boolean(process.env.CRON_SECRET),
    error: process.env.CRON_SECRET ? undefined : 'CRON_SECRET not set',
  };
  checks.paystack = {
    ok: Boolean(
      process.env.PAYSTACK_SECRET_KEY ||
        process.env.PAYSTACK_SECRET ||
        process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    ),
    error:
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
        ? undefined
        : 'PAYSTACK_SECRET_KEY not set (payment verify soft-fails in prod)',
  };
  checks.verifynow = {
    ok: Boolean(process.env.VERIFYNOW_API_KEY),
    error: process.env.VERIFYNOW_API_KEY
      ? undefined
      : 'VERIFYNOW_API_KEY not set',
  };
  checks.inventory_passport = {
    ok: Boolean(
      process.env.INVENTORY_PASSPORT_ADDRESS ||
        process.env.INVENTORY_PASSPORT_ADDRES
    ),
    error:
      process.env.INVENTORY_PASSPORT_ADDRESS || process.env.INVENTORY_PASSPORT_ADDRES
        ? undefined
        : 'INVENTORY_PASSPORT_ADDRESS not set (anchors may simulate)',
  };

  if (!checks.env.ok) {
    return NextResponse.json({
      ok: false,
      serviceRole: hasServiceRole(),
      latencyMs: Date.now() - started,
      deploy,
      checks,
      at: new Date().toISOString(),
    });
  }

  try {
    const supabase = getSupabaseServer();
    const t0 = Date.now();

    const profiles = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    checks.profiles = {
      ok: !profiles.error,
      ms: Date.now() - t0,
      error: profiles.error?.message,
      count: profiles.count ?? null,
    };

    const softTables = [
      'products',
      'purchase_orders',
      'shipments',
      'manufacturing_production_orders',
      'stock_levels',
      'continents',
      'countries',
      'provinces',
    ] as const;

    for (const table of softTables) {
      const t = Date.now();
      const res = await supabase.from(table).select('id', { count: 'exact', head: true });
      checks[table] = {
        ok: !res.error,
        ms: Date.now() - t,
        error: res.error?.message,
        count: res.count ?? null,
      };
    }

    // Column-level gate for banking / discovery
    const colProbe = await probeProfileColumns();
    checks.profiles_columns = {
      ok: colProbe.ok,
      error: colProbe.hint,
      detail: { missing: colProbe.missing },
    };

    const coreOk = checks.env.ok && checks.profiles.ok;
    const softOk = softTables.filter((t) => checks[t]?.ok).length;
    const softTotal = softTables.length;
    const schemaColumnsOk = colProbe.ok;
    const degraded =
      coreOk &&
      (softOk < softTotal ||
        !schemaColumnsOk ||
        !checks.paystack.ok ||
        !checks.verifynow.ok);

    return NextResponse.json({
      ok: coreOk,
      degraded,
      serviceRole: hasServiceRole(),
      latencyMs: Date.now() - started,
      schemaReady: softOk,
      schemaTotal: softTotal,
      schemaColumnsOk,
      schemaMissingColumns: colProbe.missing,
      deploy,
      checks,
      at: new Date().toISOString(),
      hint:
        !schemaColumnsOk
          ? colProbe.hint
          : softOk < softTotal
            ? 'Some module tables missing — run latest supabase/migrations/*.sql on production'
            : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        serviceRole: hasServiceRole(),
        latencyMs: Date.now() - started,
        deploy,
        checks: {
          ...checks,
          exception: {
            ok: false,
            error: e instanceof Error ? e.message : 'Unknown error',
          },
        },
        at: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
