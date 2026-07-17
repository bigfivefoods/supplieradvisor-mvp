'use client';

/**
 * Compact platform health strip: Paystack, Twilio WhatsApp, VerifyNow, schema, deploy.
 * Safe for all members to view (no secrets) — helps ops fix degraded prod.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';

type Check = {
  ok: boolean;
  error?: string;
  detail?: unknown;
};

type HealthPayload = {
  ok?: boolean;
  degraded?: boolean;
  schemaColumnsOk?: boolean;
  schemaOptionalMissing?: string[];
  deploy?: { commitShort?: string; env?: string };
  checks?: Record<string, Check>;
  at?: string;
  hint?: string;
};

function Pill({
  label,
  ok,
  warn,
  detail,
}: {
  label: string;
  ok: boolean;
  warn?: boolean;
  detail?: string;
}) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  const cls = ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : warn
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-red-200 bg-red-50 text-red-900';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}
      title={detail || undefined}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

export default function OpsHealthStrip({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(!compact);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/health', { cache: 'no-store' });
      const json = (await res.json()) as HealthPayload;
      setData(json);
      if (json.degraded || json.ok === false) setOpen(true);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checks = data?.checks || {};
  const paystackOk = checks.paystack?.ok === true;
  const twilioOk = checks.twilio_whatsapp?.ok === true;
  const verifyOk = checks.verifynow?.ok === true;
  const schemaOk = data?.schemaColumnsOk !== false && checks.profiles_columns?.ok !== false;
  const resendOk = checks.resend?.ok === true;
  const degraded = Boolean(data?.degraded) || data?.ok === false;
  const commit = data?.deploy?.commitShort || '—';

  if (loading && !data) {
    return (
      <div
        className={`mb-4 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500 ${className}`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking platform health…
      </div>
    );
  }

  if (!data) return null;

  // Compact: only show when something is wrong
  if (compact && !degraded && data.ok !== false) {
    return (
      <div
        className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-[11px] text-emerald-900 ${className}`}
      >
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Activity className="h-3.5 w-3.5" />
          Platform healthy · deploy {commit}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:underline"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div
      className={`mb-4 rounded-2xl border px-3 py-3 sm:px-4 ${
        degraded
          ? 'border-amber-200 bg-amber-50/90'
          : 'border-neutral-200 bg-white'
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left text-sm font-black text-slate-900"
        >
          {degraded ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <Activity className="h-4 w-4 text-[#00b4d8]" />
          )}
          Platform health
          {degraded ? (
            <span className="text-[10px] font-bold uppercase text-amber-700">
              degraded
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase text-emerald-700">
              ok
            </span>
          )}
          <span className="text-[10px] font-semibold text-neutral-400">
            · {commit}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary !py-1.5 !px-2.5 text-[11px] inline-flex items-center gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Pill
              label="Paystack"
              ok={paystackOk}
              detail={checks.paystack?.error}
            />
            <Pill
              label="Twilio WA"
              ok={twilioOk}
              warn={!twilioOk}
              detail={checks.twilio_whatsapp?.error}
            />
            <Pill
              label="VerifyNow"
              ok={verifyOk}
              detail={checks.verifynow?.error}
            />
            <Pill
              label="Schema"
              ok={schemaOk}
              detail={
                data.schemaOptionalMissing?.length
                  ? `Optional missing: ${data.schemaOptionalMissing.join(', ')}`
                  : checks.profiles_columns?.error
              }
            />
            <Pill label="Resend" ok={resendOk} detail={checks.resend?.error} />
          </div>

          {!paystackOk ? (
            <p className="text-[11px] text-amber-950/90 leading-relaxed">
              <strong>Paystack secret missing.</strong> Set{' '}
              <code className="text-[10px]">PAYSTACK_SECRET_KEY</code> in Vercel
              Production, webhook{' '}
              <code className="text-[10px]">charge.success</code> →{' '}
              <code className="text-[10px]">/api/paystack/webhook</code>, then
              one redeploy.
            </p>
          ) : null}
          {!twilioOk ? (
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              <strong>Twilio WhatsApp incomplete.</strong> Without it, “WhatsApp
              PDF” uses mobile file share or a PDF document link (still includes
              supplieradvisor.com). Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
              TWILIO_WHATSAPP_FROM for automatic PDF-in-chat.
            </p>
          ) : null}
          {data.hint ? (
            <p className="text-[11px] text-neutral-500">{data.hint}</p>
          ) : null}
          <p className="text-[10px] text-neutral-400">
            <Link
              href="/dashboard/my-business/verifications"
              className="font-semibold text-[#0077b6] hover:underline"
            >
              Verifications / ops queue
            </Link>
            {data.at ? ` · checked ${new Date(data.at).toLocaleString()}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
