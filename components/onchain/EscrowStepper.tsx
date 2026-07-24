'use client';

import { ExternalLink } from 'lucide-react';
import {
  deriveEscrowStatus,
  ESCROW_STEPS,
  escrowStepBadgeClass,
  type EscrowStatusView,
} from '@/lib/procurement/escrow-status';
import { escrowTxUrl } from '@/lib/contracts/escrow';

type PoLike = {
  metadata?: unknown;
  onchain_po_id?: string | number | null;
  onchain_tx?: string | null;
  onchain_tx_hash?: string | null;
  status?: string | null;
  use_escrow?: boolean | null;
};

export default function EscrowStepper({
  po,
  compact = false,
  className = '',
}: {
  po: PoLike;
  compact?: boolean;
  className?: string;
}) {
  const view: EscrowStatusView = deriveEscrowStatus(po);
  if (!view.enabled && view.onchainPoId == null) return null;

  return (
    <div className={`mt-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${escrowStepBadgeClass(
            view.complete ? 'release' : view.nextStep || view.currentStep,
            view.complete
          )}`}
        >
          {view.complete ? 'Escrow released' : view.nextLabel}
        </span>
        {view.onchainPoId != null && (
          <span className="text-[10px] font-mono text-neutral-500">
            chain #{String(view.onchainPoId)}
          </span>
        )}
        {view.mode !== 'none' && view.mode !== 'unknown' && (
          <span className="text-[10px] font-bold uppercase text-neutral-400">
            {view.mode}
          </span>
        )}
        {!view.complete && view.nextActor !== 'none' && (
          <span className="text-[10px] text-neutral-500">
            next: {view.nextActor}
          </span>
        )}
      </div>
      <div className={`flex gap-1 ${compact ? '' : ''}`}>
        {ESCROW_STEPS.map((s) => {
          const st = view.steps.find((x) => x.key === s.key);
          const done = Boolean(st?.done);
          const active = Boolean(st?.active);
          const tx = st?.tx;
          return (
            <div
              key={s.key}
              className={`flex-1 min-w-0 rounded-lg border px-1 py-1.5 text-center ${
                done
                  ? 'bg-emerald-50 border-emerald-200'
                  : active
                    ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-200'
                    : 'bg-neutral-50 border-neutral-100'
              }`}
            >
              <div
                className={`text-[9px] sm:text-[10px] font-black truncate ${
                  done
                    ? 'text-emerald-800'
                    : active
                      ? 'text-sky-900'
                      : 'text-neutral-400'
                }`}
              >
                {compact ? s.short : s.label}
              </div>
              {tx ? (
                <a
                  href={escrowTxUrl(tx)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[8px] text-[#00b4d8] inline-flex items-center gap-0.5 mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  tx <ExternalLink className="w-2 h-2" />
                </a>
              ) : (
                <div className="text-[8px] text-neutral-400 mt-0.5">
                  {done ? '✓' : active ? 'now' : '—'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
