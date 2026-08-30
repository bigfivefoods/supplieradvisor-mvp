import type {
  PartyCatalogueLine,
  PartyKind,
  PriceActor,
  PriceRevision,
} from './types';

export function roundMoney(n: number): number {
  return Math.round(Number(n) * 10000) / 10000;
}

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** Inventory buy price — what we pay a supplier. Never sell_price. */
export function productCostFromRow(
  row: Record<string, unknown> | null | undefined
): number | null {
  if (!row) return null;
  if (row.cost_price != null && row.cost_price !== '') {
    const direct = Number(row.cost_price);
    if (Number.isFinite(direct)) return roundMoney(direct);
  }
  const prices = Array.isArray(row.prices) ? row.prices : [];
  const zar = prices.find((raw) => {
    const p = asObject(raw);
    return String(p.currency || '').toUpperCase() === 'ZAR' && p.cost_price != null;
  });
  if (zar) {
    const n = Number(asObject(zar).cost_price);
    if (Number.isFinite(n)) return roundMoney(n);
  }
  for (const raw of prices) {
    const n = Number(asObject(raw).cost_price);
    if (Number.isFinite(n)) return roundMoney(n);
  }
  return null;
}

/** Supplier portal / supplier PO unit: live cost_price wins over a stale catalogue seed. */
export function supplierFacingUnitPrice(opts: {
  costPrice?: number | null;
  prices?: unknown;
  acceptedPrice?: number | null;
}): number | null {
  const cost = productCostFromRow({
    cost_price: opts.costPrice,
    prices: opts.prices,
  });
  if (cost != null) return cost;
  if (opts.acceptedPrice != null && Number.isFinite(Number(opts.acceptedPrice))) {
    return roundMoney(Number(opts.acceptedPrice));
  }
  return null;
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
    line_total?: number;
  },
>(
  items: T[],
  acceptedByProductId: Record<number, number>
): { items: Array<T & { line_total: number }>; total: number } {
  const next = items.map((item) => {
    const pid = Number(item.product_id);
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const unit_price =
      Number.isFinite(pid) &&
      pid > 0 &&
      Object.prototype.hasOwnProperty.call(acceptedByProductId, pid)
        ? roundMoney(acceptedByProductId[pid])
        : Number(item.unit_price || 0);
    const line_total = roundMoney(qty * unit_price);
    return { ...item, unit_price, line_total };
  });
  const total = roundMoney(
    next.reduce((s, i) => s + Number(i.line_total || 0), 0)
  );
  return { items: next, total };
}

/** Supplier POs: every line must have a mapped unit. Never keep a typed guess. */
export function applyMappedUnitPrices<
  T extends {
    product_id?: number | null;
    item_name?: string | null;
    name?: string | null;
    quantity?: number;
    qty?: number;
    unit_price?: number;
    line_total?: number;
  },
>(
  items: T[],
  unitByProductId: Record<number, number>
):
  | { ok: true; items: Array<T & { unit_price: number; line_total: number }>; total: number }
  | { ok: false; error: string } {
  const next: Array<T & { unit_price: number; line_total: number }> = [];
  for (const item of items) {
    const pid = Number(item.product_id);
    const name = String(item.item_name || item.name || `product ${pid || ''}`).trim() || 'line';
    if (!Number.isFinite(pid) || pid <= 0) {
      return {
        ok: false,
        error: `Missing product_id for ${name}. Match a SKU or pick a catalogue line.`,
      };
    }
    if (!Object.prototype.hasOwnProperty.call(unitByProductId, pid)) {
      return { ok: false, error: `No agreed cost for ${name}` };
    }
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const unit_price = roundMoney(unitByProductId[pid]);
    const line_total = roundMoney(qty * unit_price);
    next.push({ ...item, product_id: pid, unit_price, line_total });
  }
  const total = roundMoney(
    next.reduce((s, i) => s + Number(i.line_total || 0), 0)
  );
  return { ok: true, items: next, total };
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
