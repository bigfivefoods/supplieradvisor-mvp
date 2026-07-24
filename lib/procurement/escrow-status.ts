/**
 * Escrow lifecycle chips — derived from PO row + metadata.chain_events.
 * Aligns with POEscrowV2 / POEscrowUSDC: create → fund → ship → release.
 */

export const ESCROW_STEPS = [
  { key: 'create', label: 'Created', short: '1' },
  { key: 'fund', label: 'Funded', short: '2' },
  { key: 'ship', label: 'Shipped', short: '3' },
  { key: 'release', label: 'Released', short: '4' },
] as const;

export type EscrowStepKey = (typeof ESCROW_STEPS)[number]['key'];

export type EscrowStepState = {
  key: EscrowStepKey;
  label: string;
  done: boolean;
  active: boolean;
  tx?: string | null;
  at?: string | null;
};

export type EscrowStatusView = {
  enabled: boolean;
  mode: 'none' | 'eth' | 'usdc' | 'unknown';
  onchainPoId: string | number | null;
  currentStep: EscrowStepKey | null;
  nextStep: EscrowStepKey | null;
  nextActor: 'buyer' | 'supplier' | 'none';
  nextLabel: string;
  steps: EscrowStepState[];
  chainStatus?: string | null;
  complete: boolean;
};

function metaOf(po: {
  metadata?: unknown;
  onchain_po_id?: string | number | null;
  onchain_tx?: string | null;
  onchain_tx_hash?: string | null;
  status?: string | null;
}): Record<string, unknown> {
  const m = po.metadata;
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return {};
}

function eventsOf(meta: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = meta.chain_events;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === 'object') as Array<Record<string, unknown>>;
}

export function deriveEscrowStatus(po: {
  metadata?: unknown;
  onchain_po_id?: string | number | null;
  onchain_tx?: string | null;
  onchain_tx_hash?: string | null;
  status?: string | null;
  use_escrow?: boolean | null;
}): EscrowStatusView {
  const meta = metaOf(po);
  const events = eventsOf(meta);
  const onchainPoId =
    po.onchain_po_id != null && po.onchain_po_id !== ''
      ? po.onchain_po_id
      : meta.onchain_po_id != null
        ? (meta.onchain_po_id as string | number)
        : null;

  const useEscrow =
    Boolean(po.use_escrow) ||
    Boolean(meta.use_escrow) ||
    onchainPoId != null ||
    events.length > 0;

  const kindDone = new Set<string>();
  const kindTx: Record<string, string | null> = {};
  const kindAt: Record<string, string | null> = {};
  for (const e of events) {
    const k = String(e.kind || e.step || e.type || '').toLowerCase();
    if (k) {
      kindDone.add(k);
      if (e.tx || e.tx_hash || e.hash) {
        kindTx[k] = String(e.tx || e.tx_hash || e.hash);
      }
      if (e.at || e.created_at) kindAt[k] = String(e.at || e.created_at);
    }
  }

  // Fallback signals
  if (onchainPoId != null) kindDone.add('create');
  if (meta.fund_tx || kindDone.has('fund')) kindDone.add('fund');
  if (meta.ship_tx || meta.chain_status === 'shipped' || kindDone.has('ship'))
    kindDone.add('ship');
  if (
    meta.release_tx ||
    kindDone.has('release') ||
    String(po.status || '').toLowerCase() === 'completed'
  ) {
    if (kindDone.has('fund') || kindDone.has('ship')) kindDone.add('release');
  }
  if (String(po.status || '').toLowerCase() === 'funded') kindDone.add('fund');

  if (meta.fund_tx) kindTx.fund = String(meta.fund_tx);
  if (meta.ship_tx) kindTx.ship = String(meta.ship_tx);
  if (meta.release_tx) kindTx.release = String(meta.release_tx);
  if (po.onchain_tx || po.onchain_tx_hash) {
    kindTx.create = String(po.onchain_tx || po.onchain_tx_hash);
  }

  const steps: EscrowStepState[] = ESCROW_STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    done: kindDone.has(s.key),
    active: false,
    tx: kindTx[s.key] || null,
    at: kindAt[s.key] || null,
  }));

  // First incomplete is active
  let current: EscrowStepKey | null = null;
  let next: EscrowStepKey | null = null;
  for (const s of steps) {
    if (!s.done) {
      next = s.key;
      s.active = true;
      break;
    }
    current = s.key;
  }
  const complete = steps.every((s) => s.done);
  if (complete) {
    current = 'release';
    next = null;
  }

  let nextActor: EscrowStatusView['nextActor'] = 'none';
  let nextLabel = 'Escrow complete';
  if (next === 'create') {
    nextActor = 'buyer';
    nextLabel = 'Create on-chain PO';
  } else if (next === 'fund') {
    nextActor = 'buyer';
    nextLabel = 'Fund escrow';
  } else if (next === 'ship') {
    nextActor = 'supplier';
    nextLabel = 'Mark shipped on-chain';
  } else if (next === 'release') {
    nextActor = 'buyer';
    nextLabel = 'Confirm delivery / release';
  }

  const modeRaw = String(meta.escrow_asset || meta.asset || '').toLowerCase();
  const mode: EscrowStatusView['mode'] = !useEscrow
    ? 'none'
    : modeRaw === 'usdc'
      ? 'usdc'
      : modeRaw === 'eth'
        ? 'eth'
        : onchainPoId != null
          ? 'unknown'
          : 'none';

  return {
    enabled: useEscrow,
    mode,
    onchainPoId,
    currentStep: current,
    nextStep: next,
    nextActor,
    nextLabel,
    steps,
    chainStatus: meta.chain_status ? String(meta.chain_status) : null,
    complete,
  };
}

export function escrowStepBadgeClass(step: EscrowStepKey | null, complete?: boolean): string {
  if (complete) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  switch (step) {
    case 'create':
      return 'bg-violet-50 text-violet-800 border-violet-200';
    case 'fund':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'ship':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'release':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
}
