import {
  KELPACK_SEED_PRICES,
  type PartyCatalogueLine,
  type PartyKind,
  type PriceActor,
  type PriceRevision,
} from './types';

export function roundMoney(n: number): number {
  return Math.round(Number(n) * 10000) / 10000;
}

export function productFamily(opts: {
  name?: string | null;
  product_type?: string | null;
  sku?: string | null;
}): string {
  const hay = `${opts.name || ''} ${opts.sku || ''}`.toLowerCase();
  if (/film|laminate|pouch film/.test(hay)) return 'Film';
  if (/one\s*pot|chakalaka|chilli beef/.test(hay)) return 'OnePot';
  if (/porridge|fortified/.test(hay)) return 'Fortified porridge';
  if (/nsnp|soya mince/.test(hay)) return 'NSNP';
  const type = String(opts.product_type || '').toLowerCase();
  if (type === 'raw_material') return 'Film / other';
  return 'Other';
}

export const FAMILY_ORDER = [
  'OnePot',
  'Fortified porridge',
  'NSNP',
  'Film',
  'Film / other',
  'Other',
] as const;

export function familyRank(family: string): number {
  const i = FAMILY_ORDER.indexOf(family as (typeof FAMILY_ORDER)[number]);
  return i >= 0 ? i : FAMILY_ORDER.length;
}

export function groupLinesByFamily(
  lines: PartyCatalogueLine[]
): Array<{ family: string; lines: PartyCatalogueLine[] }> {
  const map = new Map<string, PartyCatalogueLine[]>();
  for (const line of lines) {
    const family =
      line.family ||
      productFamily({
        name: line.product_name,
        product_type: line.product_type,
        sku: line.sku,
      });
    const cur = map.get(family) || [];
    cur.push({ ...line, family });
    map.set(family, cur);
  }
  return [...map.entries()]
    .sort((a, b) => familyRank(a[0]) - familyRank(b[0]))
    .map(([family, rows]) => ({
      family,
      lines: rows.sort((a, b) =>
        String(a.product_name || '').localeCompare(String(b.product_name || ''))
      ),
    }));
}

/** Counterparty of the proposal must Accept / Reject. Proposer cannot. */
export function counterpartyMayDecide(opts: {
  pendingProposedBy: PriceActor | null;
  actor: PriceActor;
}): boolean {
  if (!opts.pendingProposedBy) return false;
  return opts.actor !== opts.pendingProposedBy;
}

export function billedUnitPrice(line: {
  accepted_price?: number | null;
  pending_price?: number | null;
}): number {
  return roundMoney(Number(line.accepted_price || 0));
}

export function applyAcceptedUnitPrices<
  T extends {
    product_id?: number | null;
    quantity?: number;
    qty?: number;
    unit_price: number;
  },
>(
  items: T[],
  acceptedByProductId: Record<number, number>
): { items: T[]; total: number } {
  const next = items.map((item) => {
    const pid = Number(item.product_id);
    if (!Number.isFinite(pid) || pid <= 0) return item;
    if (!Object.prototype.hasOwnProperty.call(acceptedByProductId, pid)) {
      return item;
    }
    const unit_price = roundMoney(acceptedByProductId[pid]);
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const line_total = roundMoney(qty * unit_price);
    return { ...item, unit_price, line_total };
  });
  const total = roundMoney(
    next.reduce((s, i) => {
      const qty = Number(i.quantity ?? i.qty ?? 0);
      return s + qty * Number(i.unit_price || 0);
    }, 0)
  );
  return { items: next, total };
}

export function kelpackSeedPrice(productId: number): number | null {
  const hit = KELPACK_SEED_PRICES.find((r) => r.product_id === productId);
  return hit ? hit.accepted_price : null;
}

export function actorLabel(opts: {
  actor: PriceActor | null;
  hostName?: string | null;
  partyName?: string | null;
}): string {
  if (opts.actor === 'host') return opts.hostName || 'Big Five Foods';
  if (opts.actor === 'party') return opts.partyName || 'the other party';
  return '—';
}

export function sortRevisionsOldestLast(
  rows: PriceRevision[]
): PriceRevision[] {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(a.created_at) || 0;
    const tb = Date.parse(b.created_at) || 0;
    if (ta !== tb) return ta - tb;
    return Number(a.id) - Number(b.id);
  });
}

export function parsePartyKind(raw: unknown): PartyKind | null {
  const v = String(raw || '').toLowerCase();
  if (v === 'supplier' || v === 'customer') return v;
  return null;
}

export function parsePriceActor(raw: unknown): PriceActor | null {
  const v = String(raw || '').toLowerCase();
  if (v === 'host' || v === 'party') return v;
  return null;
}
