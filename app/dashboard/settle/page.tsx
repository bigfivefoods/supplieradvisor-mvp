'use client';

/**
 * Settle command center — golden path + fiat claims + escrow portfolio.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  Wallet,
  Banknote,
  Coins,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Route,
  Download,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { GOLDEN_STAGES, type GoldenPathPo } from '@/lib/business/golden-path';
import {
  escrowStepBadgeClass,
  type EscrowStatusView,
} from '@/lib/procurement/escrow-status';
import { money } from '@/lib/intelligence/useIntelligence';
import { apiJson } from '@/lib/client/api-fetch';
import FeatureHealthBanner from '@/components/chrome/FeatureHealthBanner';

type Snapshot = {
  summary: {
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
  funnel: Array<{ key: string; label: string; count: number; pct: number }>;
  trades: GoldenPathPo[];
  next_actions: Array<{
    id: string;
    title: string;
    body: string;
    href: string;
    cta: string;
    severity: string;
  }>;
};

export default function SettleCommandPage() {
  return (
    <CompanyRequired>
      <SettleInner />
    </CompanyRequired>
  );
}

function SettleInner() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, authenticated, getAccessToken]);

  const downloadBoardPack = async () => {
    if (!companyId) return;
    try {
      let accessToken: string | null = null;
      try {
        if (authenticated && typeof getAccessToken === 'function') {
          accessToken = await getAccessToken();
        }
      } catch {
        /* */
      }
      const json = await apiJson<{
        pack: unknown;
        download_name?: string;
      }>('/api/business/board-pack', {
        method: 'GET',
        companyId,
        privyUserId,
        accessToken,
      });
      const blob = new Blob([JSON.stringify(json.pack, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        json.download_name || `board-pack-${companyId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Board pack failed');
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.summary;

  return (
    <CustomersPage>
      <CustomersHeader
        title="Settle"
        titleAccent="Command"
        showNav
        description="Golden path cockpit: PO → accept → receive → invoice → settle (fiat claim or on-chain escrow) → rate. Live status from your books."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadBoardPack()}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1"
            >
              <Download className="w-4 h-4" /> Board pack
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{' '}
              Refresh
            </button>
          </div>
        }
      />

      <div className="max-w-5xl space-y-6">
        <FeatureHealthBanner />
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat
                label="Open POs"
                value={s?.open_pos ?? 0}
                href="/dashboard/suppliers/po"
              />
              <Stat
                label="Path complete %"
                value={`${s?.pct_complete ?? 0}%`}
                tone="emerald"
              />
              <Stat
                label="Claims pending"
                value={s?.claims_pending ?? 0}
                tone={(s?.claims_pending || 0) > 0 ? 'amber' : 'neutral'}
                href="/dashboard/customers/money"
              />
              <Stat
                label="Open escrows"
                value={s?.open_escrows ?? 0}
                tone={(s?.open_escrows || 0) > 0 ? 'sky' : 'neutral'}
                href="/dashboard/escrow"
              />
            </div>

            {data?.next_actions && data.next_actions.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Next actions
                </h2>
                {data.next_actions.map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 hover:shadow-sm transition ${
                      a.severity === 'critical'
                        ? 'border-red-200 bg-red-50/50'
                        : a.severity === 'warning'
                          ? 'border-amber-200 bg-amber-50/40'
                          : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        a.severity === 'critical'
                          ? 'text-red-600'
                          : a.severity === 'warning'
                            ? 'text-amber-600'
                            : 'text-sky-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{a.title}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{a.body}</p>
                    </div>
                    <span className="text-xs font-bold text-[#00b4d8] shrink-0 flex items-center gap-1">
                      {a.cta} <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </section>
            )}

            <section>
              <h2 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5" /> Golden path funnel
              </h2>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {(data?.funnel || []).map((f) => (
                  <div
                    key={f.key}
                    className="min-w-[72px] flex-1 rounded-xl border border-neutral-200 bg-white px-2 py-2 text-center"
                  >
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">
                      {f.label}
                    </div>
                    <div className="text-lg font-black tabular-nums">{f.count}</div>
                    <div className="text-[10px] text-neutral-500">{f.pct}%</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Live trades
                </h2>
                <div className="flex gap-2 text-xs font-semibold">
                  <Link href="/dashboard/customers/money" className="text-emerald-700">
                    Fiat Money →
                  </Link>
                  <Link href="/dashboard/escrow" className="text-amber-700">
                    Escrow →
                  </Link>
                </div>
              </div>
              {!data?.trades?.length ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
                  No purchase orders yet. Raise a PO to start the golden path.
                  <div className="mt-3">
                    <Link
                      href="/dashboard/suppliers/po"
                      className="btn-primary !py-2 !px-4 text-sm"
                    >
                      Open POs
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {data.trades.slice(0, 15).map((t) => (
                    <TradeRow key={`${t.role}-${t.id}`} trade={t} />
                  ))}
                </ul>
              )}
            </section>

            <div className="grid sm:grid-cols-3 gap-3">
              <QuickCard
                href="/dashboard/customers/money"
                icon={Wallet}
                title="Seller Money"
                body="Claims, POP, AR, ledger"
              />
              <QuickCard
                href="/dashboard/buyer/money"
                icon={Banknote}
                title="Buyer Money"
                body="Pay, upload POP, track claims"
              />
              <QuickCard
                href="/dashboard/escrow"
                icon={Coins}
                title="On-chain escrow"
                body="USDC / ETH portfolio & stepper"
              />
            </div>
          </>
        )}
      </div>
    </CustomersPage>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'emerald' | 'amber' | 'sky';
  href?: string;
}) {
  const toneCls =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'sky'
          ? 'text-sky-700'
          : 'text-slate-900';
  const inner = (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase text-neutral-400">{label}</div>
      <div className={`text-2xl font-black tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function TradeRow({ trade }: { trade: GoldenPathPo }) {
  const ccy = trade.currency || 'ZAR';
  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-neutral-50">
              {trade.role}
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border capitalize">
              {trade.status}
            </span>
            {trade.escrow.enabled && (
              <EscrowChip escrow={trade.escrow} />
            )}
          </div>
          <p className="font-bold text-sm text-slate-900 mt-1">
            {trade.po_number || `PO #${trade.id}`}
            {trade.total_amount != null && (
              <span className="ml-2 text-neutral-500 font-semibold tabular-nums">
                {money(trade.total_amount, ccy)}
              </span>
            )}
          </p>
        </div>
        <Link
          href={trade.next_href}
          className="text-xs font-bold text-[#00b4d8] inline-flex items-center gap-1"
        >
          {trade.next_label}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="mt-3 flex gap-0.5 overflow-x-auto">
        {GOLDEN_STAGES.map((s) => {
          const done = trade.stages[s.key];
          const active = trade.next_stage === s.key;
          return (
            <div
              key={s.key}
              title={s.label}
              className={`min-w-[36px] flex-1 h-7 rounded-md text-[9px] font-bold flex items-center justify-center border ${
                done
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : active
                    ? 'bg-sky-50 text-sky-800 border-sky-300 ring-1 ring-sky-200'
                    : 'bg-neutral-50 text-neutral-400 border-neutral-100'
              }`}
            >
              {done ? <CheckCircle2 className="w-3 h-3" /> : s.short}
            </div>
          );
        })}
      </div>
    </li>
  );
}

function EscrowChip({ escrow }: { escrow: EscrowStatusView }) {
  const step = escrow.complete ? 'release' : escrow.nextStep || escrow.currentStep;
  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${escrowStepBadgeClass(step, escrow.complete)}`}
    >
      Escrow · {escrow.complete ? 'released' : escrow.nextLabel}
    </span>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: typeof Wallet;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 transition"
    >
      <Icon className="w-4 h-4 text-[#0077b6] mb-2" />
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{body}</p>
    </Link>
  );
}
