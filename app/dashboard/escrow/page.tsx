'use client';

/**
 * On-chain escrow hub — USDC (Base) + ETH fallback wiring for PO settle.
 */
import Link from 'next/link';
import { Coins, Shield, ArrowRight, ExternalLink, Wallet } from 'lucide-react';
import {
  isUsdcEscrowConfigured,
  getUsdcEscrowAddress,
  getUsdcTokenAddress,
  getUsdcEscrowChainId,
} from '@/lib/contracts/usdcEscrow';
import {
  isEscrowConfigured,
  getPoEscrowAddress,
} from '@/lib/contracts/escrow';

export default function EscrowHubPage() {
  const usdcOn = isUsdcEscrowConfigured();
  const ethOn = isEscrowConfigured();
  const chainId = getUsdcEscrowChainId();
  const usdcAddr = getUsdcEscrowAddress();
  const token = getUsdcTokenAddress();
  const ethAddr = getPoEscrowAddress();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
          Settlement rails
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          On-chain escrow
        </h1>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          Prefer fiat settle via Money hub (claims + AR ledger). Use USDC on Base when
          counterparties need programmable release after ship/confirm.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
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
              ? 'Configured — use PO page actions to create → approve → fund.'
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
            ethOn
              ? 'border-sky-300 bg-sky-50/60'
              : 'border-neutral-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2 font-black text-sm">
            <Shield className="w-4 h-4" />
            ETH · Sepolia fallback
          </div>
          <p className="text-xs mt-1 text-slate-700">
            Legacy POEscrowV2 for demos when USDC is unavailable.
          </p>
          <p className="text-[11px] font-mono mt-2 text-slate-600 break-all">
            {ethAddr || '—'}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 mb-6">
        <p className="text-sm font-black text-slate-900">Lifecycle</p>
        <ol className="mt-2 text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Create PO on Suppliers → PO (buyer/seller wallets connected).</li>
          <li>USDC: approve token spend → fund escrow (transferFrom).</li>
          <li>Seller marks shipped → buyer confirm delivery → release.</li>
          <li>Off-chain parallel: invoice + Money hub claims when fiat settles.</li>
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
            href="/dashboard/customers/money"
            className="inline-flex items-center gap-1.5 rounded-full border text-xs font-bold px-4 py-2"
          >
            <Wallet className="w-3.5 h-3.5" />
            Fiat Money hub
          </Link>
          <a
            href="https://docs.base.org"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border text-xs font-bold px-4 py-2"
          >
            Base docs
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 text-xs text-slate-700 leading-relaxed">
        <p className="font-black text-violet-950 text-sm">Ops env checklist</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            <code>NEXT_PUBLIC_USDC_ESCROW_ENABLED=true</code>
          </li>
          <li>
            <code>NEXT_PUBLIC_USDC_ESCROW_ADDRESS</code> from deploy
          </li>
          <li>
            <code>NEXT_PUBLIC_USDC_TOKEN_ADDRESS</code> (Base Sepolia faucet USDC)
          </li>
          <li>
            <code>NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID=84532</code> (or Base mainnet)
          </li>
          <li>
            <code>NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED=true</code>
          </li>
        </ul>
        <p className="mt-2 text-violet-900/80">
          Deploy guide: <code>docs/usdc-escrow-base.md</code>
        </p>
      </section>
    </div>
  );
}
