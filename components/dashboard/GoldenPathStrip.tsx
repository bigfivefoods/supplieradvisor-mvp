'use client';

/**
 * Home command strip: trade golden path stuck stages + next actions.
 * Sprint A — make “what’s stuck” unmissable on the dashboard.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Package,
  Route,
  Shield,
  Wallet,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { apiJson } from '@/lib/client/api-fetch';
import { GOLDEN_STAGES, type GoldenPathPo } from '@/lib/business/golden-path';

type Snapshot = {
  success?: boolean;
  summary?: {
    open_pos: number;
    completed_path: number;
    stuck_receive: number;
    stuck_settle: number;
    open_escrows: number;
    escrow_awaiting_ship: number;
    escrow_awaiting_release: number;
    claims_pending: number;
    open_ar: number;
    pct_complete: number;
  };
  next_actions?: Array<{
    id: string;
    title: string;
    body: string;
    href: string;
    cta: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  trades?: GoldenPathPo[];
};

export default function GoldenPathStrip() {
  const companyId = getSelectedCompanyId();
  const { user, authenticated, getAccessToken } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let accessToken: string | null = null;
      try {
        if (authenticated && typeof getAccessToken === 'function') {
          accessToken = await getAccessToken();
        }
      } catch {
        /* cookie */
      }
      const json = await apiJson<Snapshot>('/api/business/golden-path', {
        method: 'GET',
        companyId,
        privyUserId,
        accessToken,
      });
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) return null;
  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-neutral-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading golden path…
      </div>
    );
  }
  if (!data?.summary) return null;

  const s = data.summary;
  const stuck =
    s.stuck_receive +
    s.stuck_settle +
    s.escrow_awaiting_release +
    s.escrow_awaiting_ship +
    s.claims_pending;
  const hot = data.next_actions?.slice(0, 3) || [];
  const stuckTrades = (data.trades || [])
    .filter((t) => !t.stages.settled || !t.stages.reviewed)
    .slice(0, 4);

  const chips = [
    {
      label: 'Receive stuck',
      value: s.stuck_receive,
      href: '/dashboard/suppliers/po',
      icon: Package,
      hot: s.stuck_receive > 0,
    },
    {
      label: 'Settle stuck',
      value: s.stuck_settle,
      href: '/dashboard/settle',
      icon: Wallet,
      hot: s.stuck_settle > 0,
    },
    {
      label: 'Escrow ship',
      value: s.escrow_awaiting_ship,
      href: '/dashboard/escrow',
      icon: Shield,
      hot: s.escrow_awaiting_ship > 0,
    },
    {
      label: 'Escrow release',
      value: s.escrow_awaiting_release,
      href: '/dashboard/escrow',
      icon: Shield,
      hot: s.escrow_awaiting_release > 0,
    },
    {
      label: 'Path complete',
      value: `${s.pct_complete}%`,
      href: '/dashboard/settle',
      icon: CheckCircle2,
      hot: false,
    },
  ];

  return (
    <section
      className={`mb-4 rounded-2xl border px-4 py-3.5 shadow-sm ${
        stuck > 0
          ? 'border-amber-200 bg-amber-50 dark:border-amber-400/40 dark:bg-gradient-to-br dark:from-[#451a03] dark:via-[#b45309] dark:to-[#fbbf24]'
          : 'border-neutral-200 bg-sky-50 dark:border-cyan-400/35 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b3a4f] dark:to-[#0e7490]'
      }`}
      aria-label="Trade golden path"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-white">
          <Route className="h-3.5 w-3.5 text-[#00b4d8] dark:text-cyan-200" />
          Golden path · open POs {s.open_pos}
          {stuck > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 normal-case tracking-normal text-amber-800 dark:border-amber-200/40 dark:bg-amber-950/50 dark:text-amber-50">
              <AlertTriangle className="h-3 w-3" />
              {stuck} stuck
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/settle"
            className="text-[11px] font-bold text-[#0077b6] underline"
          >
            Settle cockpit
          </Link>
          <Link
            href="/dashboard/escrow"
            className="text-[11px] font-bold text-[#0077b6] underline"
          >
            Escrow
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={`min-w-0 touch-manipulation rounded-xl border px-2.5 py-2 transition-colors hover:border-[#00b4d8]/40 ${
                c.hot
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-300/40 dark:bg-gradient-to-br dark:from-amber-950 dark:via-amber-700 dark:to-amber-400'
                  : 'border-neutral-100 bg-slate-50 dark:border-cyan-300/30 dark:bg-gradient-to-br dark:from-[#0b1e33] dark:via-[#0c4a6e] dark:to-[#0891b2]'
              }`}
            >
              <p className="flex items-center gap-1 text-[10px] font-semibold leading-tight text-neutral-500 dark:text-white/85">
                <Icon className="h-3 w-3 shrink-0" />
                {c.label}
              </p>
              <p
                className={`text-lg font-black tabular-nums ${
                  c.hot
                    ? 'text-amber-900 dark:text-white'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {c.value}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Mini stage legend */}
      <div className="hidden sm:flex flex-wrap gap-1 mb-3">
        {GOLDEN_STAGES.map((st) => (
          <span
            key={st.key}
            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-cyan-500/25 dark:text-cyan-50"
          >
            {st.short}
          </span>
        ))}
      </div>

      {hot.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {hot.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:border-[#00b4d8]/40 ${
                a.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50/80'
                  : a.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50/60'
                    : 'border-neutral-100 bg-neutral-50/80'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 text-xs sm:text-sm">
                  {a.title}
                </p>
                <p className="text-[11px] text-neutral-500 leading-snug line-clamp-1">
                  {a.body}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-bold text-[#0077b6] inline-flex items-center gap-0.5">
                {a.cta} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {stuckTrades.length > 0 && (
        <div className="border-t border-neutral-100 pt-2 mt-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
            Active trades
          </p>
          <div className="flex flex-col gap-1">
            {stuckTrades.map((t) => (
              <Link
                key={t.id}
                href={t.next_href || '/dashboard/settle'}
                className="flex items-center justify-between gap-2 text-xs rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-700 truncate">
                  {t.po_number || `PO #${t.id}`}
                  {t.counterparty ? (
                    <span className="text-neutral-400 font-normal">
                      {' '}
                      · {t.counterparty}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#0077b6]">
                  Next: {t.next_label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
