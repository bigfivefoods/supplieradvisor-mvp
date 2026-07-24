'use client';

/**
 * On-chain escrow hub — config + live portfolio with create→fund→ship→release steppers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  Coins,
  Shield,
  ArrowRight,
  ExternalLink,
  Wallet,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  isUsdcEscrowConfigured,
  getUsdcEscrowAddress,
  getUsdcTokenAddress,
  getUsdcEscrowChainId,
} from '@/lib/contracts/usdcEscrow';
import {
  isEscrowConfigured,
  getPoEscrowAddress,
  escrowTxUrl,
  ESCROW_LIFECYCLE,
} from '@/lib/contracts/escrow';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import type { GoldenPathPo } from '@/lib/business/golden-path';
import {
  ESCROW_STEPS,
  escrowStepBadgeClass,
} from '@/lib/procurement/escrow-status';
import { money } from '@/lib/intelligence/useIntelligence';

export default function EscrowHubPage() {
  return (
    <CompanyRequired>
      <EscrowInner />
    </CompanyRequired>
  );
}

function EscrowInner() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const usdcOn = isUsdcEscrowConfigured();
  const ethOn = isEscrowConfigured();
  const chainId = getUsdcEscrowChainId();
  const usdcAddr = getUsdcEscrowAddress();
  const token = getUsdcTokenAddress();
  const ethAddr = getPoEscrowAddress();

  const [trades, setTrades] = useState<GoldenPathPo[]>([]);
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
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const headers: Record<string, string> = {};
      try {
        if (authenticated && typeof getAccessToken === 'function') {
          const token = await getAccessToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        /* cookie */
      }
      const res = await fetch(`/api/business/golden-path?${params}`, {
        headers,
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setTrades(json.trades || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const escrowTrades = useMemo(
    () => trades.filter((t) => t.escrow.enabled || t.escrow.onchainPoId != null),
    [trades]
  );
  const open = escrowTrades.filter((t) => !t.escrow.complete);
  const awaitingShip = open.filter((t) => t.escrow.nextStep === 'ship').length;
  const awaitingRelease = open.filter((t) => t.escrow.nextStep === 'release').length;

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="On-chain"
        titleAccent="Escrow"
        showNav
        description="PO escrow portfolio: create → fund → mark shipped → confirm delivery. Fiat claims stay on Money hub — use chain when counterparties need programmable release."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{' '}
            Refresh
          </button>
        }
      />

      <div className="max-w-4xl space-y-6">
        <div className="grid sm:grid-cols-2 gap-3">
          <div
            className={`rounded-2xl border p-4 ${
              usdcOn
                ? 'border-emerald-300 bg-emerald-50/60'
                : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-sm">
              <Coins className="w-4 h-4" />
              USDC · Base
            </div>
            <p className="text-xs mt-1 text-slate-700">
              {usdcOn
                ? 'Configured — create → approve → fund on PO page.'
                : 'Not configured — set NEXT_PUBLIC_USDC_ESCROW_ADDRESS + token.'}
            </p>
            <ul className="text-[11px] font-mono mt-2 space-y-0.5 text-slate-600 break-all">
              <li>chain: {chainId}</li>
              <li>escrow: {usdcAddr || '—'}</li>
              <li>token: {token || '—'}</li>
            </ul>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              ethOn ? 'border-sky-300 bg-sky-50/60' : 'border-neutral-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-sm">
              <Shield className="w-4 h-4" />
              ETH · Sepolia fallback
            </div>
            <p className="text-xs mt-1 text-slate-700">
              POEscrowV2 for demos when USDC is unavailable.
            </p>
            <p className="text-[11px] font-mono mt-2 text-slate-600 break-all">
              {ethAddr || '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border bg-white p-3">
            <div className="text-[10px] font-bold uppercase text-neutral-400">Open</div>
            <div className="text-2xl font-black">{open.length}</div>
          </div>
          <div className="rounded-2xl border bg-white p-3">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              Await ship
            </div>
            <div className="text-2xl font-black text-amber-700">{awaitingShip}</div>
          </div>
          <div className="rounded-2xl border bg-white p-3">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              Await release
            </div>
            <div className="text-2xl font-black text-rose-700">{awaitingRelease}</div>
          </div>
        </div>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-sm font-black text-slate-900">Lifecycle</p>
          <ol className="mt-2 flex flex-wrap gap-2">
            {ESCROW_LIFECYCLE.map((s) => (
              <li
                key={s.step}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-neutral-50"
              >
                {s.step}. {s.label}
                <span className="text-neutral-400 font-normal"> · {s.role}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href="/dashboard/suppliers/po"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] text-white text-xs font-bold px-4 py-2"
            >
              Open POs
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/dashboard/settle"
              className="inline-flex items-center gap-1.5 rounded-full border text-xs font-bold px-4 py-2"
            >
              Settle command
            </Link>
            <Link
              href="/dashboard/customers/money"
              className="inline-flex items-center gap-1.5 rounded-full border text-xs font-bold px-4 py-2"
            >
              <Wallet className="w-3.5 h-3.5" />
              Fiat Money hub
            </Link>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <section>
          <h2 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2">
            Escrow portfolio
          </h2>
          {loading && !trades.length ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
            </div>
          ) : escrowTrades.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-neutral-500">
              No escrow-linked POs yet. On Suppliers → PO, enable escrow and create on-chain.
              <div className="mt-3">
                <Link
                  href="/dashboard/suppliers/po"
                  className="btn-primary !py-2 !px-4 text-sm"
                >
                  Raise escrow PO
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {escrowTrades.map((t) => (
                <li
                  key={t.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${escrowStepBadgeClass(
                            t.escrow.complete
                              ? 'release'
                              : t.escrow.nextStep || t.escrow.currentStep,
                            t.escrow.complete
                          )}`}
                        >
                          {t.escrow.complete
                            ? 'Released'
                            : t.escrow.nextLabel}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-neutral-50">
                          {t.escrow.mode}
                        </span>
                        {t.escrow.onchainPoId != null && (
                          <span className="text-[10px] font-mono text-neutral-500">
                            chain #{String(t.escrow.onchainPoId)}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-sm">
                        {t.po_number || `PO #${t.id}`}
                        {t.total_amount != null && (
                          <span className="ml-2 text-neutral-500 font-semibold">
                            {money(t.total_amount, t.currency || 'ZAR')}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Next actor: {t.escrow.nextActor} · off-chain status{' '}
                        {t.status}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/suppliers/po"
                      className="text-xs font-bold text-[#00b4d8] h-fit"
                    >
                      Act on PO →
                    </Link>
                  </div>
                  <div className="mt-3 flex gap-1">
                    {ESCROW_STEPS.map((s) => {
                      const st = t.escrow.steps.find((x) => x.key === s.key);
                      const done = st?.done;
                      const active = st?.active;
                      const tx = st?.tx;
                      return (
                        <div
                          key={s.key}
                          className={`flex-1 rounded-lg border px-1 py-2 text-center ${
                            done
                              ? 'bg-emerald-50 border-emerald-200'
                              : active
                                ? 'bg-sky-50 border-sky-300'
                                : 'bg-neutral-50 border-neutral-100'
                          }`}
                        >
                          <div className="text-[10px] font-black">{s.label}</div>
                          {tx ? (
                            <a
                              href={escrowTxUrl(tx)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-[#00b4d8] inline-flex items-center gap-0.5 mt-0.5"
                            >
                              tx <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <div className="text-[9px] text-neutral-400 mt-0.5">
                              {done ? 'done' : active ? 'now' : '—'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SuppliersPage>
  );
}
