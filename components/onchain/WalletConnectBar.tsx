'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import {
  getPoEscrowChain,
  getPoEscrowChainId,
  getPoEscrowAddress,
  escrowAddressUrl,
} from '@/lib/contracts/escrow';

type Props = {
  /** Compact single-line for forms */
  compact?: boolean;
  className?: string;
};

/**
 * Wallet connect + chain guard for POEscrowV2 flows.
 * Ensures user is on the configured escrow chain before signing.
 */
export default function WalletConnectBar({ compact = false, className = '' }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const requiredId = getPoEscrowChainId();
  const required = getPoEscrowChain();
  const wrongChain = isConnected && chainId !== requiredId;
  const addr = getPoEscrowAddress();

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
        />
        {wrongChain && (
          <button
            type="button"
            disabled={isPending || !switchChain}
            onClick={() => switchChain?.({ chainId: requiredId })}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-200"
          >
            Switch to {required.name}
          </button>
        )}
        {isConnected && !wrongChain && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready for escrow
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[#00b4d8]/25 bg-gradient-to-r from-[#00b4d8]/5 to-white p-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Wallet className="w-4 h-4 text-[#00b4d8]" />
            On-chain wallet
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Escrow uses{' '}
            <span className="font-semibold">{required.name}</span>
            {' · '}
            <a
              href={escrowAddressUrl(addr)}
              target="_blank"
              rel="noreferrer"
              className="text-[#0077b6] hover:underline font-mono text-[11px]"
            >
              {addr.slice(0, 6)}…{addr.slice(-4)}
            </a>
          </p>
          {wrongChain && (
            <p className="mt-2 text-xs text-amber-800 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Wrong network ({chainId}). Switch to {required.name} ({requiredId}) to sign
              createPO / fundPO / confirmDelivery.
            </p>
          )}
          {isConnected && address && !wrongChain && (
            <p className="mt-1 text-[11px] text-emerald-700 font-mono">
              Connected {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {wrongChain && (
            <button
              type="button"
              disabled={isPending || !switchChain}
              onClick={() => switchChain?.({ chainId: requiredId })}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {isPending ? 'Switching…' : `Switch to ${required.name}`}
            </button>
          )}
          <ConnectButton chainStatus="full" showBalance={false} />
        </div>
      </div>
    </div>
  );
}
