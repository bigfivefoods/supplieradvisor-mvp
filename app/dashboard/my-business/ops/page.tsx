'use client';

/**
 * Ops control plane — Paystack, CIPC SLA, schema migrations, claims.
 * Uses referral-ops auth on the API (or CRON_SECRET via tools).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { getCanonicalUserId } from '@/lib/auth/identity';
import SettleFunnelStrip from '@/components/dashboard/SettleFunnelStrip';

type Board = {
  at: string;
  deploy?: { commitShort?: string; commit?: string };
  env?: Record<string, boolean>;
  paystack?: {
    lastAt?: string | null;
    ageHours?: number | null;
    last24hCount?: number;
    stale?: boolean;
  };
  schema?: {
    arLedger?: boolean | null;
    paymentClaims?: boolean | null;
    installments?: boolean | null;
  };
  cipc?: {
    paidNotBadged?: number;
    slaBreaches?: number;
    sample?: Array<{ id: number; name: string | null; hours: number | null }>;
  };
  claims?: { pending?: number };
  invites24h?: number;
  analytics?: {
    firstTradeBootstrap24h?: number;
    firstTradeSent24h?: number;
    claimsPending?: number;
    claimsConfirmed24h?: number;
    connectionAccepted24h?: number;
    requestToTrade24h?: number;
    ratingsPublished24h?: number;
  };
  readiness?: {
    ok?: boolean;
    blockers?: string[];
    warnings?: string[];
  };
};

export default function OpsBoardPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/ops-board', {
        cache: 'no-store',
        headers: privyUserId
          ? { 'x-privy-user-id': privyUserId }
          : undefined,
      });
      // Also try with query legacy if needed
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            'Ops board requires referral ops or CRON_SECRET auth'
        );
      }
      setBoard(data.board || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <BusinessPage>
      <BusinessHeader
        title="Ops control plane"
        description="Paystack pulse, CIPC SLA, schema migrations, open claims — production readiness."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </p>
          <p className="text-xs mt-1 text-amber-900/80">
            Platform ops users can open this after referral-ops access is granted.
            Also try{' '}
            <Link
              href="/dashboard/my-business/verifications"
              className="font-bold underline"
            >
              Verifications
            </Link>{' '}
            for CIPC dead-letter and Paystack pulse.
          </p>
        </div>
      ) : board ? (
        <div className="space-y-4">
          <SettleFunnelStrip />
          <div
            className={`rounded-2xl border px-4 py-3 ${
              board.readiness?.ok
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-rose-300 bg-rose-50'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-sm">
              {board.readiness?.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-700" />
              )}
              {board.readiness?.ok ? 'Ready' : 'Blockers present'}
              <span className="text-[11px] font-semibold text-slate-500">
                · deploy {board.deploy?.commitShort || board.deploy?.commit || '—'}
              </span>
            </div>
            {(board.readiness?.blockers || []).length > 0 ? (
              <ul className="mt-2 text-xs text-rose-900 list-disc list-inside">
                {board.readiness!.blockers!.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {(board.readiness?.warnings || []).length > 0 ? (
              <ul className="mt-2 text-xs text-amber-900 list-disc list-inside">
                {board.readiness!.warnings!.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile
              label="Paystack secret"
              value={board.env?.paystackSecret ? 'set' : 'missing'}
              ok={board.env?.paystackSecret}
            />
            <Tile
              label="Webhook last"
              value={
                board.paystack?.lastAt
                  ? String(board.paystack.lastAt).slice(0, 16).replace('T', ' ')
                  : 'never'
              }
              ok={!board.paystack?.stale}
            />
            <Tile
              label="SLA breaches"
              value={String(board.cipc?.slaBreaches ?? 0)}
              ok={(board.cipc?.slaBreaches ?? 0) === 0}
            />
            <Tile
              label="Pending claims"
              value={String(board.claims?.pending ?? 0)}
              ok
            />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-800 mb-2">
              Schema migrations
            </p>
            <ul className="text-xs space-y-1">
              <SchemaRow
                name="customer_invoice_payments (AR ledger)"
                ok={board.schema?.arLedger}
              />
              <SchemaRow
                name="customer_payment_claims"
                ok={board.schema?.paymentClaims}
              />
              <SchemaRow
                name="customer_invoice_installments"
                ok={board.schema?.installments}
              />
            </ul>
            <p className="text-[11px] text-neutral-500 mt-2">
              See docs/OPS_MIGRATIONS.md — run SQL in Supabase if any are false.
            </p>
          </div>

          {(board.cipc?.sample || []).length > 0 ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-xs font-bold text-rose-950 mb-2">
                CIPC SLA sample
              </p>
              <ul className="text-xs space-y-1">
                {board.cipc!.sample!.map((s) => (
                  <li key={s.id}>
                    #{s.id} {s.name || ''} · {s.hours ?? '?'}h since pay
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/my-business/verifications"
                className="inline-block mt-2 text-xs font-bold text-[#0077b6] underline"
              >
                Open verifications queue
              </Link>
            </div>
          ) : null}

          {board.analytics ? (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
              <p className="text-xs font-bold text-sky-950 mb-2">
                Activation funnel (24h)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <Analytic
                  label="FT bootstrap"
                  value={board.analytics.firstTradeBootstrap24h ?? 0}
                />
                <Analytic
                  label="FT sent"
                  value={board.analytics.firstTradeSent24h ?? 0}
                />
                <Analytic
                  label="Claims confirmed"
                  value={board.analytics.claimsConfirmed24h ?? 0}
                />
                <Analytic
                  label="Connections"
                  value={board.analytics.connectionAccepted24h ?? 0}
                />
                <Analytic
                  label="Request-to-trade"
                  value={board.analytics.requestToTrade24h ?? 0}
                />
                <Analytic
                  label="Ratings published"
                  value={board.analytics.ratingsPublished24h ?? 0}
                />
                <Analytic
                  label="Claims open"
                  value={board.analytics.claimsPending ?? 0}
                />
                <Analytic label="Invites" value={board.invites24h ?? 0} />
              </div>
            </div>
          ) : null}

          <p className="text-[11px] text-neutral-400">
            Snapshot {board.at} · invites 24h: {board.invites24h ?? 0} · OPS_ALERT:{' '}
            {board.env?.opsAlertEmail ? 'set' : 'missing'}
          </p>
        </div>
      ) : null}
    </BusinessPage>
  );
}

function Tile({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        ok === false
          ? 'border-rose-200 bg-rose-50'
          : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="text-[10px] font-bold uppercase text-neutral-400">
        {label}
      </div>
      <div className="text-sm font-black text-slate-900 mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function SchemaRow({ name, ok }: { name: string; ok?: boolean | null }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>{name}</span>
      <span
        className={`font-bold ${
          ok === true
            ? 'text-emerald-700'
            : ok === false
              ? 'text-rose-700'
              : 'text-neutral-400'
        }`}
      >
        {ok === true ? 'ok' : ok === false ? 'missing' : '—'}
      </span>
    </li>
  );
}

function Analytic({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white border border-sky-100 px-2 py-2">
      <div className="text-lg font-black text-slate-900 tabular-nums">
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </div>
    </div>
  );
}
