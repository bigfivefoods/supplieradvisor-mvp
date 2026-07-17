import { NextResponse } from 'next/server';
import { getSupabaseServer, hasServiceRole } from '@/lib/supabase/server-client';
import {
  deploymentMeta,
  probeProfileColumns,
  type ProfileColumnProbeResult,
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
  const paystackSecret = Boolean(
    process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
  );
  const paystackPublic = Boolean(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY);
  checks.paystack = {
    // Secret is required for verify + webhook CIPC — public key alone is not enough
    ok: paystackSecret,
    error: paystackSecret
      ? undefined
      : paystackPublic
        ? 'PAYSTACK_SECRET_KEY not set (public key present; paid CIPC / webhook soft-fails)'
        : 'PAYSTACK_SECRET_KEY not set (payment verify soft-fails in prod)',
    detail: {
      webhookPath: '/api/paystack/webhook',
      webhookHint:
        'Paystack Dashboard → Settings → Webhooks → https://www.supplieradvisor.com/api/paystack/webhook (events: charge.success). R69 CIPC runs even if browser closes.',
      publicKey: paystackPublic,
      secretKey: paystackSecret,
      ops:
        'Vercel → Project → Settings → Environment Variables → PAYSTACK_SECRET_KEY (Production). Redeploy once after setting.',
    },
  };
  checks.verifynow = {
    ok: Boolean(process.env.VERIFYNOW_API_KEY),
    error: process.env.VERIFYNOW_API_KEY
      ? undefined
      : 'VERIFYNOW_API_KEY not set',
  };
  const twilioOk = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
  checks.twilio_whatsapp = {
    ok: twilioOk,
    error: twilioOk
      ? undefined
      : 'Twilio WhatsApp not fully set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM) — PDF documents fall back to mobile share / link',
    detail: {
      accountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
      authToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
      from: Boolean(process.env.TWILIO_WHATSAPP_FROM),
      ops: 'Vercel env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (whatsapp:+…). Enables real PDF document attach on WhatsApp PDF.',
    },
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

    // Column-level gate for banking / discovery / verification
    const colProbe: ProfileColumnProbeResult = await probeProfileColumns();
    const optionalMissing = colProbe.optionalMissing ?? [];
    const ghostColumns = colProbe.ghostColumns ?? [];
    checks.profiles_columns = {
      ok: colProbe.ok,
      error: colProbe.hint,
      detail: {
        missing: colProbe.missing,
        optionalMissing,
        ghostColumnsDoNotSelect: ghostColumns,
      },
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
        !checks.verifynow.ok ||
        !checks.twilio_whatsapp.ok ||
        optionalMissing.length > 0);

    return NextResponse.json({
      ok: coreOk,
      degraded,
      serviceRole: hasServiceRole(),
      latencyMs: Date.now() - started,
      schemaReady: softOk,
      schemaTotal: softTotal,
      schemaColumnsOk,
      schemaMissingColumns: colProbe.missing,
      schemaOptionalMissing: optionalMissing,
      schemaGhostColumns: ghostColumns,
      deploy,
      checks,
      at: new Date().toISOString(),
      hint:
        !schemaColumnsOk
          ? colProbe.hint
          : softOk < softTotal
            ? 'Some module tables missing — run latest supabase/migrations/*.sql on production'
            : optionalMissing.length
              ? colProbe.hint
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
