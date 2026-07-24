/**
 * Settle mode + chain/DB drift for purchase orders.
 */
import {
  deriveEscrowStatus,
  type EscrowStatusView,
} from '@/lib/procurement/escrow-status';

export type SettleMode = 'fiat' | 'usdc' | 'eth' | 'hybrid' | 'none';

export type SettleModeView = {
  mode: SettleMode;
  label: string;
  className: string;
  escrow: EscrowStatusView;
  /** Human-readable drift warning when DB status and chain step disagree */
  drift: string | null;
  driftSeverity: 'none' | 'warning' | 'critical';
};

export function deriveSettleMode(po: {
  status?: string | null;
  metadata?: unknown;
  onchain_po_id?: string | number | null;
  onchain_tx?: string | null;
  onchain_tx_hash?: string | null;
  use_escrow?: boolean | null;
}): SettleModeView {
  const escrow = deriveEscrowStatus(po);
  const st = String(po.status || '').toLowerCase();
  const meta =
    po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
      ? (po.metadata as Record<string, unknown>)
      : {};
  const asset = String(meta.escrow_asset || meta.asset || '').toLowerCase();

  let mode: SettleMode = 'none';
  if (escrow.enabled || escrow.onchainPoId != null) {
    if (asset === 'usdc' || escrow.mode === 'usdc') mode = 'usdc';
    else if (asset === 'eth' || escrow.mode === 'eth') mode = 'eth';
    else mode = 'eth'; // default chain rail when asset unknown
    // Hybrid if invoice/claim path also active while escrow open
    if (['invoiced', 'paid'].includes(st) && !escrow.complete) mode = 'hybrid';
  } else {
    mode = 'fiat';
  }

  const labels: Record<SettleMode, string> = {
    fiat: 'Fiat settle',
    usdc: 'USDC escrow',
    eth: 'ETH escrow',
    hybrid: 'Hybrid',
    none: 'Standard',
  };

  const classNames: Record<SettleMode, string> = {
    fiat: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    usdc: 'bg-violet-50 text-violet-800 border-violet-200',
    eth: 'bg-sky-50 text-sky-800 border-sky-200',
    hybrid: 'bg-amber-50 text-amber-900 border-amber-200',
    none: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  };

  // Drift detection
  let drift: string | null = null;
  let driftSeverity: SettleModeView['driftSeverity'] = 'none';

  if (escrow.enabled) {
    if (st === 'funded' && escrow.nextStep === 'create') {
      drift = 'DB funded but chain not created — re-link create tx';
      driftSeverity = 'critical';
    } else if (
      st === 'funded' &&
      escrow.nextStep === 'fund' &&
      !escrow.steps.find((s) => s.key === 'fund')?.done
    ) {
      drift = 'DB funded but chain fund step incomplete — verify fund tx';
      driftSeverity = 'warning';
    } else if (
      (st === 'completed' || st === 'paid') &&
      escrow.enabled &&
      !escrow.complete &&
      escrow.nextStep === 'release'
    ) {
      drift = 'Off-chain complete but escrow not released on-chain';
      driftSeverity = 'warning';
    } else if (
      escrow.complete &&
      !['completed', 'paid'].includes(st) &&
      st !== 'cancelled'
    ) {
      drift = 'Chain released but DB status not completed — refresh/link release';
      driftSeverity = 'warning';
    } else if (
      escrow.nextStep === 'ship' &&
      st === 'completed'
    ) {
      drift = 'DB completed before chain ship — confirm escrow timeline';
      driftSeverity = 'warning';
    }
  }

  return {
    mode,
    label: labels[mode],
    className: classNames[mode],
    escrow,
    drift,
    driftSeverity,
  };
}
