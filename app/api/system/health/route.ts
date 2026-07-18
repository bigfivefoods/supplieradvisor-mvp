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
  let paystackPulse: Awaited<
    ReturnType<typeof import('@/lib/system/paystack-pulse').loadPaystackWebhookPulse>
  > | null = null;
  if (paystackSecret) {
    try {
      const { loadPaystackWebhookPulse } = await import(
        '@/lib/system/paystack-pulse'
      );
      paystackPulse = await loadPaystackWebhookPulse();
    } catch {
      paystackPulse = null;
    }
  }
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
      webhookPulse: paystackPulse,
      webhookStale: paystackPulse?.stale ?? !paystackSecret,
      webhookLastAt: paystackPulse?.lastAt ?? null,
      webhookAgeHours: paystackPulse?.ageHours ?? null,
      webhookLast24h: paystackPulse?.last24hCount ?? 0,
    },
  };
  checks.verifynow = {
    ok: Boolean(process.env.VERIFYNOW_API_KEY),
    error: process.env.VERIFYNOW_API_KEY
      ? undefined
      : 'VERIFYNOW_API_KEY not set',
  };
  const opsAlert = Boolean(
    // Accept OPS_ALERT_EMAIL, OPS_EMAIL_ALERT (prod), PAYSTACK_OPS_EMAIL
    process.env.OPS_ALERT_EMAIL ||
      process.env.OPS_EMAIL_ALERT ||
      process.env.PAYSTACK_OPS_EMAIL
  );
  checks.ops_alert = {
    ok: opsAlert,
    error: opsAlert
      ? undefined
      : 'OPS_ALERT_EMAIL / OPS_EMAIL_ALERT / PAYSTACK_OPS_EMAIL not set — CIPC/webhook SLA emails soft-skip',
    detail: {
      opsBoard: '/api/system/ops-board',
      opsUi: '/dashboard/my-business/ops',
      migrations: 'docs/OPS_MIGRATIONS.md',
    },
  };
  const twilioSid = Boolean(
    process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID
  );
  const twilioToken = Boolean(
    process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN
  );
  const twilioFrom = Boolean(
    process.env.TWILIO_WHATSAPP_FROM ||
      process.env.TWILIO_FROM ||
      process.env.TWILIO_WHATSAPP_NUMBER
  );
  const twilioOk = twilioSid && twilioToken && twilioFrom;
  checks.twilio_whatsapp = {
    ok: twilioOk,
    error: twilioOk
      ? undefined
      : 'Twilio WhatsApp not fully set — claim/PDF WhatsApp soft-skips. Need TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM',
    detail: {
      accountSid: twilioSid,
      authToken: twilioToken,
      from: twilioFrom,
      missing: [
        !twilioSid ? 'TWILIO_ACCOUNT_SID' : null,
        !twilioToken ? 'TWILIO_AUTH_TOKEN' : null,
        !twilioFrom ? 'TWILIO_WHATSAPP_FROM' : null,
      ].filter(Boolean),
      setup: 'bash scripts/setup-twilio-env.sh  OR  Vercel → Env → add three vars → Redeploy',
      smoke: 'GET/POST /api/system/twilio-smoke (CRON_SECRET)',
      docs: 'docs/alerts-whatsapp.md',
      sandboxFrom: 'whatsapp:+14155238886',
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

    // Settle-by-default tables (P0 ops migrations)
    const settleTables = [
      {
        key: 'customer_invoice_payments',
        migration: '20260717_ar_ledger.sql',
      },
      {
        key: 'customer_payment_claims',
        migration: '20260717_payment_claims_and_ledger_fx.sql',
      },
      {
        key: 'customer_invoice_installments',
        migration: '20260718_installments_collections.sql',
      },
    ] as const;
    const settleMissing: string[] = [];
    for (const { key, migration } of settleTables) {
      const t = Date.now();
      const res = await supabase
        .from(key)
        .select('id', { count: 'exact', head: true });
      const missing =
        Boolean(res.error) &&
        /relation|does not exist|schema cache/i.test(res.error?.message || '');
      checks[key] = {
        ok: !missing && !res.error,
        ms: Date.now() - t,
        error: res.error?.message,
        count: res.count ?? null,
        detail: { migration, requiredFor: 'settle-by-default' },
      };
      if (missing || (res.error && !checks[key].ok)) {
        // only treat as missing table, not other errors
        if (missing) settleMissing.push(`${key} (${migration})`);
      }
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
        optionalMissing.length > 0 ||
        settleMissing.length > 0 ||
        !checks.ops_alert.ok);

    // P0 production readiness (public — no secrets)
    const p0Blockers: string[] = [];
    const p0Warnings: string[] = [];
    if (!checks.paystack.ok) {
      p0Blockers.push(
        'PAYSTACK_SECRET_KEY missing — paid CIPC webhook soft-fails'
      );
    }
    if (!checks.cron_secret.ok) {
      p0Blockers.push('CRON_SECRET missing — settle/verification crons blocked');
    }
    if (settleMissing.length) {
      p0Blockers.push(
        `Settle tables missing: ${settleMissing.join('; ')} — run SQL in Supabase`
      );
    }
    if (!schemaColumnsOk && colProbe.missing?.length) {
      p0Blockers.push(
        `Profile columns missing: ${colProbe.missing.join(', ')}`
      );
    }
    if (!checks.ops_alert.ok) {
      p0Warnings.push(
        'Ops alert email not set (use OPS_ALERT_EMAIL or OPS_EMAIL_ALERT) — CIPC/webhook SLA emails will not send'
      );
    }
    if (!checks.resend.ok) {
      p0Warnings.push('RESEND_API_KEY not set — transactional email soft-fails');
    }
    if (!checks.verifynow.ok) {
      p0Warnings.push('VERIFYNOW_API_KEY not set — CIPC match soft-fails');
    }
    if (paystackPulse?.stale && checks.paystack.ok) {
      p0Warnings.push(
        `Paystack webhook pulse stale (ageHours=${paystackPulse.ageHours ?? '—'})`
      );
    }
    if (!checks.twilio_whatsapp.ok) {
      p0Warnings.push(
        'Twilio WhatsApp incomplete — PDF delivery uses mobile share fallback'
      );
    }

    const p0Readiness = {
      ok: p0Blockers.length === 0,
      blockers: p0Blockers,
      warnings: p0Warnings,
      settleTablesOk: settleMissing.length === 0,
      settleMissing,
      paystackOk: checks.paystack.ok,
      cronOk: checks.cron_secret.ok,
      opsAlertOk: checks.ops_alert.ok,
      deploy: {
        commit: deploy.commit || deploy.commitShort || null,
        commitShort: deploy.commitShort || null,
        env: deploy.env || null,
      },
      tipCheck:
        'Compare deploy.commitShort to `git rev-parse --short HEAD` on the tip you shipped',
      migrationsDoc: 'docs/OPS_MIGRATIONS.md',
      opsBoard: '/api/system/ops-board',
      opsUi: '/dashboard/my-business/ops',
      settleSmoke: '/api/system/settle-smoke',
      settleUi: '/dashboard/settle',
      moneyHub: '/dashboard/customers/money',
    };

    return NextResponse.json({
      ok: coreOk,
      degraded,
      p0Readiness,
      serviceRole: hasServiceRole(),
      latencyMs: Date.now() - started,
      schemaReady: softOk,
      schemaTotal: softTotal,
      schemaColumnsOk,
      schemaMissingColumns: colProbe.missing,
      schemaOptionalMissing: optionalMissing,
      schemaGhostColumns: ghostColumns,
      settleMissing,
      deploy,
      checks,
      at: new Date().toISOString(),
      hint:
        p0Blockers.length
          ? p0Blockers[0]
          : !schemaColumnsOk
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
