'use client';

import { AlertTriangle } from 'lucide-react';
import { deriveSettleMode } from '@/lib/procurement/settle-mode';

type PoLike = {
  status?: string | null;
  metadata?: unknown;
  onchain_po_id?: string | number | null;
  onchain_tx?: string | null;
  onchain_tx_hash?: string | null;
  use_escrow?: boolean | null;
};

export default function SettleModeChip({
  po,
  showDrift = true,
}: {
  po: PoLike;
  showDrift?: boolean;
}) {
  const view = deriveSettleMode(po);

  return (
    <div className="inline-flex flex-col gap-1 min-w-0">
      <span
        className={`inline-flex w-fit text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${view.className}`}
        title={view.escrow.enabled ? view.escrow.nextLabel : view.label}
      >
        {view.label}
      </span>
      {showDrift && view.drift && (
        <span
          className={`inline-flex items-start gap-1 text-[10px] font-semibold leading-snug max-w-[220px] ${
            view.driftSeverity === 'critical'
              ? 'text-rose-700'
              : 'text-amber-800'
          }`}
          title={view.drift}
        >
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          {view.drift}
        </span>
      )}
    </div>
  );
}
