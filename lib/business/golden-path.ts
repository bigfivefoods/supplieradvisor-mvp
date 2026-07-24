/**
 * Trade golden path: PO → accept → receive → stock → invoice → settle → review/OTIFEF
 * Company portfolio + per-PO stage completion.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  deriveEscrowStatus,
  type EscrowStatusView,
} from '@/lib/procurement/escrow-status';

export const GOLDEN_STAGES = [
  { key: 'created', label: 'PO', short: 'PO' },
  { key: 'sent', label: 'Sent', short: 'Sent' },
  { key: 'accepted', label: 'Accepted', short: 'OK' },
  { key: 'received', label: 'Received', short: 'Rcv' },
  { key: 'stocked', label: 'Stocked', short: 'Stk' },
  { key: 'invoiced', label: 'Invoiced', short: 'Inv' },
  { key: 'settled', label: 'Settled', short: 'Pay' },
  { key: 'reviewed', label: 'Reviewed', short: '★' },
] as const;

export type GoldenStageKey = (typeof GOLDEN_STAGES)[number]['key'];

export type PoStageMap = Record<GoldenStageKey, boolean>;

export type GoldenPathPo = {
  id: number;
  po_number?: string | null;
  status: string;
  total_amount?: number | null;
  currency?: string | null;
  role: 'buyer' | 'seller';
  counterparty?: string | null;
  stages: PoStageMap;
  stage_index: number;
  next_stage: GoldenStageKey | null;
  next_label: string;
  next_href: string;
  escrow: EscrowStatusView;
  otifef_ready: boolean;
};

export type GoldenPathSnapshot = {
  companyId: number;
  at: string;
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
  funnel: Array<{ key: GoldenStageKey; label: string; count: number; pct: number }>;
  trades: GoldenPathPo[];
  next_actions: Array<{
    id: string;
    title: string;
    body: string;
    href: string;
    cta: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
};

const ACTIVE = new Set([
  'draft',
  'sent',
  'accepted',
  'funded',
  'invoiced',
  'paid',
]);

function stageIndex(stages: PoStageMap): number {
  let i = 0;
  for (const s of GOLDEN_STAGES) {
    if (stages[s.key]) i++;
    else break;
  }
  return Math.max(0, i - 1);
}

function nextStage(stages: PoStageMap): GoldenStageKey | null {
  for (const s of GOLDEN_STAGES) {
    if (!stages[s.key]) return s.key;
  }
  return null;
}

function nextMeta(
  next: GoldenStageKey | null,
  role: 'buyer' | 'seller',
  poId: number
): { label: string; href: string } {
  switch (next) {
    case 'sent':
      return {
        label: role === 'buyer' ? 'Send / submit PO' : 'Await buyer send',
        href: role === 'buyer' ? '/dashboard/suppliers/po' : '/dashboard/customers/orders',
      };
    case 'accepted':
      return {
        label: role === 'seller' ? 'Accept inbound PO' : 'Await supplier accept',
        href:
          role === 'seller'
            ? '/dashboard/customers/orders?tab=inbound'
            : '/dashboard/suppliers/po',
      };
    case 'received':
      return {
        label: 'Record delivery / OTIFEF quantities',
        href: role === 'buyer' ? '/dashboard/suppliers/po' : '/dashboard/customers/orders',
      };
    case 'stocked':
      return {
        label: 'Receive into inventory (stock movement)',
        href: '/dashboard/inventory/stock',
      };
    case 'invoiced':
      return {
        label: role === 'seller' ? 'Raise invoice from PO' : 'Await supplier invoice',
        href:
          role === 'seller'
            ? '/dashboard/customers/invoices'
            : '/dashboard/buyer/documents',
      };
    case 'settled':
      return {
        label: 'Settle (claim / ledger / escrow release)',
        href: '/dashboard/settle',
      };
    case 'reviewed':
      return {
        label: 'Rate counterparty',
        href:
          role === 'buyer'
            ? '/dashboard/suppliers/ratings'
            : '/dashboard/customers/ratings',
      };
    default:
      return { label: 'Complete', href: `/dashboard/suppliers/po` };
  }
}

function computeStages(opts: {
  status: string;
  delivered: boolean;
  stocked: boolean;
  hasInvoice: boolean;
  invoiceSettled: boolean;
  reviewed: boolean;
  poPaidOrComplete: boolean;
}): PoStageMap {
  const st = opts.status.toLowerCase();
  const pastDraft = st !== 'draft' && st !== 'cancelled';
  const accepted = [
    'accepted',
    'funded',
    'invoiced',
    'paid',
    'completed',
  ].includes(st);
  const invoiced =
    opts.hasInvoice ||
    ['invoiced', 'paid', 'completed'].includes(st);
  const settled =
    opts.invoiceSettled ||
    opts.poPaidOrComplete ||
    st === 'paid' ||
    st === 'completed';

  return {
    created: true,
    sent: pastDraft,
    accepted,
    received: opts.delivered || st === 'completed',
    stocked: opts.stocked,
    invoiced,
    settled,
    reviewed: opts.reviewed,
  };
}

export async function loadGoldenPath(
  companyId: number,
  limit = 40
): Promise<GoldenPathSnapshot> {
  const supabase = getSupabaseServer();

  const [buyerPos, sellerPos, invoices, claims, reviews, stockMoves, funnelClaims] =
    await Promise.all([
      supabase
        .from('purchase_orders')
        .select(
          'id, po_number, status, total_amount, currency, buyer_profile_id, supplier_profile_id, supplier_id, actual_delivery_date, delivered_quantity, onchain_po_id, onchain_tx, onchain_tx_hash, metadata, created_at'
        )
        .eq('buyer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('purchase_orders')
        .select(
          'id, po_number, status, total_amount, currency, buyer_profile_id, supplier_profile_id, seller_customer_id, actual_delivery_date, delivered_quantity, onchain_po_id, onchain_tx, onchain_tx_hash, metadata, created_at'
        )
        .eq('supplier_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('customer_invoices')
        .select('id, source_po_id, status, amount_paid, total_amount')
        .eq('profile_id', companyId)
        .limit(300),
      supabase
        .from('customer_payment_claims')
        .select('id, status, invoice_id')
        .eq('seller_profile_id', companyId)
        .eq('status', 'pending')
        .limit(100),
      supabase
        .from('po_reviews')
        .select('id, purchase_order_id')
        .or(
          `reviewer_profile_id.eq.${companyId},reviewee_profile_id.eq.${companyId}`
        )
        .limit(300),
      supabase
        .from('stock_movements')
        .select('id, reference_type, reference_id, movement_type')
        .eq('profile_id', companyId)
        .eq('movement_type', 'receive')
        .limit(500),
      // soft ignore errors
      Promise.resolve(null),
    ]);

  const invByPo = new Map<
    number,
    { paid: boolean; exists: boolean }
  >();
  for (const inv of invoices.data || []) {
    const pid = Number(inv.source_po_id);
    if (!pid) continue;
    const status = String(inv.status || '').toLowerCase();
    const paid =
      status === 'paid' ||
      (Number(inv.amount_paid) > 0 &&
        Number(inv.amount_paid) >= Number(inv.total_amount || 0) * 0.99);
    const prev = invByPo.get(pid);
    invByPo.set(pid, {
      exists: true,
      paid: Boolean(prev?.paid || paid),
    });
  }

  const reviewedPo = new Set(
    (reviews.data || [])
      .map((r) => Number(r.purchase_order_id))
      .filter((n) => Number.isFinite(n) && n > 0)
  );

  const stockedPo = new Set<number>();
  for (const m of stockMoves.data || []) {
    const refType = String(m.reference_type || '').toLowerCase();
    const refId = Number(m.reference_id);
    if (
      refId > 0 &&
      (refType.includes('po') ||
        refType.includes('purchase') ||
        refType === 'purchase_order')
    ) {
      stockedPo.add(refId);
    }
  }

  const seen = new Set<number>();
  const trades: GoldenPathPo[] = [];

  const pushPo = (
    p: Record<string, unknown>,
    role: 'buyer' | 'seller'
  ) => {
    const id = Number(p.id);
    if (!Number.isFinite(id) || seen.has(id)) return;
    seen.add(id);
    const status = String(p.status || 'draft');
    if (status === 'cancelled') return;

    const delivered =
      p.actual_delivery_date != null ||
      (p.delivered_quantity != null && Number(p.delivered_quantity) > 0);
    const inv = invByPo.get(id);
    const stages = computeStages({
      status,
      delivered: Boolean(delivered),
      stocked: stockedPo.has(id),
      hasInvoice: Boolean(inv?.exists),
      invoiceSettled: Boolean(inv?.paid),
      reviewed: reviewedPo.has(id),
      poPaidOrComplete: ['paid', 'completed'].includes(status.toLowerCase()),
    });
    const next = nextStage(stages);
    const meta = nextMeta(next, role, id);
    const escrow = deriveEscrowStatus({
      metadata: p.metadata,
      onchain_po_id: p.onchain_po_id as string | number | null,
      onchain_tx: p.onchain_tx as string | null,
      onchain_tx_hash: p.onchain_tx_hash as string | null,
      status,
    });

    trades.push({
      id,
      po_number: (p.po_number as string) || null,
      status,
      total_amount: p.total_amount != null ? Number(p.total_amount) : null,
      currency: (p.currency as string) || null,
      role,
      counterparty: null,
      stages,
      stage_index: stageIndex(stages),
      next_stage: next,
      next_label: meta.label,
      next_href: meta.href,
      escrow,
      otifef_ready: Boolean(delivered),
    });
  };

  for (const p of buyerPos.data || []) pushPo(p, 'buyer');
  for (const p of sellerPos.data || []) {
    // avoid double-count when same company both sides
    if (Number(p.buyer_profile_id) === companyId) continue;
    pushPo(p, 'seller');
  }

  // Funnel counts
  const n = trades.length || 1;
  const funnel = GOLDEN_STAGES.map((s) => {
    const count = trades.filter((t) => t.stages[s.key]).length;
    return {
      key: s.key,
      label: s.label,
      count,
      pct: Math.round((count / n) * 100),
    };
  });

  const open = trades.filter((t) => ACTIVE.has(t.status.toLowerCase()));
  const completedPath = trades.filter((t) => t.stages.reviewed || t.stages.settled)
    .length;
  const stuckReceive = open.filter(
    (t) => t.stages.accepted && !t.stages.received
  ).length;
  const stuckSettle = open.filter(
    (t) => t.stages.invoiced && !t.stages.settled
  ).length;
  const openEscrows = trades.filter(
    (t) => t.escrow.enabled && !t.escrow.complete
  ).length;
  const escrowAwaitingShip = trades.filter(
    (t) => t.escrow.nextStep === 'ship'
  ).length;
  const escrowAwaitingRelease = trades.filter(
    (t) => t.escrow.nextStep === 'release'
  ).length;
  const claimsPending = (claims.data || []).length;

  let openAr = 0;
  try {
    const { loadSellerMoneyHub } = await import('@/lib/customers/money-hub');
    const hub = await loadSellerMoneyHub(companyId);
    openAr = hub.openAr ?? 0;
  } catch {
    /* soft */
  }

  const next_actions: GoldenPathSnapshot['next_actions'] = [];
  if (claimsPending > 0) {
    next_actions.push({
      id: 'claims',
      title: `${claimsPending} payment claim${claimsPending === 1 ? '' : 's'} pending`,
      body: 'Confirm POP on Money hub to close the settle loop.',
      href: '/dashboard/customers/money',
      cta: 'Open Money hub',
      severity: 'warning',
    });
  }
  if (escrowAwaitingRelease > 0) {
    next_actions.push({
      id: 'escrow-release',
      title: `${escrowAwaitingRelease} escrow awaiting release`,
      body: 'Buyer confirm delivery to release funds to supplier.',
      href: '/dashboard/suppliers/po',
      cta: 'Open POs',
      severity: 'critical',
    });
  }
  if (escrowAwaitingShip > 0) {
    next_actions.push({
      id: 'escrow-ship',
      title: `${escrowAwaitingShip} funded escrow awaiting ship`,
      body: 'Supplier must mark shipped on-chain before release.',
      href: '/dashboard/suppliers/po',
      cta: 'Mark shipped',
      severity: 'warning',
    });
  }
  if (stuckReceive > 0) {
    next_actions.push({
      id: 'receive',
      title: `${stuckReceive} accepted PO${stuckReceive === 1 ? '' : 's'} without delivery`,
      body: 'Record delivery quantities to unlock OTIFEF and complete.',
      href: '/dashboard/suppliers/po',
      cta: 'Record delivery',
      severity: 'info',
    });
  }
  if (stuckSettle > 0) {
    next_actions.push({
      id: 'settle',
      title: `${stuckSettle} invoiced trade${stuckSettle === 1 ? '' : 's'} unsettled`,
      body: 'Collect via claim, ledger, or escrow release.',
      href: '/dashboard/settle',
      cta: 'Settle command',
      severity: 'warning',
    });
  }
  if (openEscrows > 0 && next_actions.length === 0) {
    next_actions.push({
      id: 'escrow-open',
      title: `${openEscrows} open escrow trade${openEscrows === 1 ? '' : 's'}`,
      body: 'Track create → fund → ship → release on Escrow hub.',
      href: '/dashboard/escrow',
      cta: 'Escrow portfolio',
      severity: 'info',
    });
  }

  void funnelClaims;

  return {
    companyId,
    at: new Date().toISOString(),
    summary: {
      open_pos: open.length,
      completed_path: completedPath,
      stuck_receive: stuckReceive,
      stuck_settle: stuckSettle,
      open_escrows: openEscrows,
      escrow_awaiting_ship: escrowAwaitingShip,
      escrow_awaiting_release: escrowAwaitingRelease,
      claims_pending: claimsPending,
      open_ar: openAr,
      pct_complete:
        trades.length > 0
          ? Math.round((completedPath / trades.length) * 100)
          : 0,
    },
    funnel,
    trades: trades.slice(0, limit),
    next_actions,
  };
}
