import { NextResponse } from 'next/server';
import { getSupabaseServer, hasServiceRole } from '@/lib/supabase/server-client';

/**
 * GET /api/system/health
 * Lightweight Supabase connectivity + schema probe for the control tower.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<
    string,
    { ok: boolean; ms?: number; error?: string; count?: number | null }
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

  if (!checks.env.ok) {
    return NextResponse.json({
      ok: false,
      serviceRole: hasServiceRole(),
      latencyMs: Date.now() - started,
      checks,
      at: new Date().toISOString(),
    });
  }

  try {
    const supabase = getSupabaseServer();
    const t0 = Date.now();

    // Core identity table — must exist
    const profiles = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    checks.profiles = {
      ok: !profiles.error,
      ms: Date.now() - t0,
      error: profiles.error?.message,
      count: profiles.count ?? null,
    };

    // Trade / ops tables (soft — report but do not hard-fail health)
    const softTables = [
      'products',
      'purchase_orders',
      'shipments',
      'manufacturing_production_orders',
      'stock_levels',
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

    const coreOk = checks.env.ok && checks.profiles.ok;
    const softOk = softTables.filter((t) => checks[t]?.ok).length;
    const softTotal = softTables.length;

    return NextResponse.json({
      ok: coreOk,
      degraded: coreOk && softOk < softTotal,
      serviceRole: hasServiceRole(),
      latencyMs: Date.now() - started,
      schemaReady: softOk,
      schemaTotal: softTotal,
      checks,
      at: new Date().toISOString(),
      hint:
        softOk < softTotal
          ? 'Some module tables missing — run latest supabase/migrations/*.sql on production'
          : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        serviceRole: hasServiceRole(),
        latencyMs: Date.now() - started,
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
