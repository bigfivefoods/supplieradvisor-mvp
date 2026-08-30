/**
 * One posting path: stock_movements then stock_levels.
 * Documents (receive / transfer / issue / produce / count) must call this.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashMovement } from '@/lib/inventory/hash';

export type StockMovementType =
  | 'receive'
  | 'issue'
  | 'sale'
  | 'transfer_issue'
  | 'transfer_receive'
  | 'transfer_ship'
  | 'produce'
  | 'consume'
  | 'count'
  | 'adjustment'
  | 'return';

export type StockPost = {
  profileId: number;
  productId: number;
  warehouseId: number;
  movementType: StockMovementType;
  /** Signed qty for the movement. Count uses absoluteQty instead. */
  quantity?: number;
  /** Count: set on-hand to this value; movement qty is the delta. */
  absoluteQty?: number;
  unitCost?: number | null;
  referenceType?: string | null;
  referenceId?: string | number | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  fromWarehouseId?: number | null;
  toWarehouseId?: number | null;
  notes?: string | null;
  allowNegative?: boolean;
  createdBy?: string | null;
};

export type StockPostOk = {
  ok: true;
  qty_on_hand: number;
  qty_available: number;
  movement_qty: number;
};

export type StockPostErr = { ok: false; error: string; status: number };

function asRow(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

async function resolveUnitCost(
  supabase: ReturnType<typeof getSupabaseServer>,
  profileId: number,
  productId: number,
  explicit: number | null | undefined
): Promise<number> {
  if (explicit != null && Number.isFinite(Number(explicit)) && Number(explicit) > 0) {
    return Number(explicit);
  }
  try {
    const { productCostFromRow } = await import('@/lib/commercial/engine');
    const { data } = await supabase
      .from('products')
      .select('cost_price, prices')
      .eq('profile_id', profileId)
      .eq('id', productId)
      .maybeSingle();
    const cost = productCostFromRow(
      data && typeof data === 'object'
        ? (data as unknown as Record<string, unknown>)
        : null
    );
    if (cost != null) return cost;
  } catch {
    /* cost column optional */
  }
  return explicit != null && Number.isFinite(Number(explicit)) ? Number(explicit) : 0;
}

function signedForType(type: StockMovementType, abs: number): number {
  if (
    type === 'issue' ||
    type === 'sale' ||
    type === 'transfer_issue' ||
    type === 'transfer_ship' ||
    type === 'consume'
  ) {
    return -Math.abs(abs);
  }
  if (
    type === 'receive' ||
    type === 'return' ||
    type === 'transfer_receive' ||
    type === 'produce'
  ) {
    return Math.abs(abs);
  }
  return abs;
}

export async function postStock(
  opts: StockPost
): Promise<StockPostOk | StockPostErr> {
  const profileId = Number(opts.profileId);
  const productId = Number(opts.productId);
  const warehouseId = Number(opts.warehouseId);
  if (
    !Number.isFinite(profileId) ||
    !Number.isFinite(productId) ||
    !Number.isFinite(warehouseId) ||
    warehouseId <= 0
  ) {
    return { ok: false, error: 'profile, product, and warehouse required', status: 400 };
  }

  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const existing = await supabase
    .from('stock_levels')
    .select('id, qty_on_hand, qty_reserved')
    .eq('profile_id', profileId)
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();
  const current = Number(asRow(existing.data)?.qty_on_hand || 0);
  const reserved = Number(asRow(existing.data)?.qty_reserved || 0);

  let movementQty: number;
  let nextQty: number;
  if (opts.absoluteQty != null && Number.isFinite(Number(opts.absoluteQty))) {
    nextQty = Number(opts.absoluteQty);
    if (nextQty < 0) {
      return { ok: false, error: 'qty_on_hand must be zero or more', status: 400 };
    }
    movementQty = nextQty - current;
  } else {
    const raw = Number(opts.quantity);
    if (!Number.isFinite(raw) || raw === 0) {
      return { ok: false, error: 'quantity required', status: 400 };
    }
    movementQty = signedForType(opts.movementType, raw);
    nextQty = current + movementQty;
  }

  if (nextQty < -1e-9 && !opts.allowNegative) {
    return {
      ok: false,
      error: `Insufficient stock (have ${current}, need ${Math.abs(movementQty)})`,
      status: 409,
    };
  }

  const available = nextQty - reserved;
  const levelId = Number(asRow(existing.data)?.id);
  if (Number.isFinite(levelId) && levelId > 0) {
    const upd = await supabase
      .from('stock_levels')
      .update({
        qty_on_hand: nextQty,
        qty_available: available,
        lot_number: opts.lotNumber || undefined,
        expiry_date: opts.expiryDate || undefined,
        updated_at: now,
      } as never)
      .eq('id', levelId)
      .eq('profile_id', profileId);
    if (upd.error && /qty_available|lot_number|expiry/i.test(upd.error.message || '')) {
      const retry = await supabase
        .from('stock_levels')
        .update({ qty_on_hand: nextQty, updated_at: now } as never)
        .eq('id', levelId);
      if (retry.error) {
        return { ok: false, error: retry.error.message, status: 500 };
      }
    } else if (upd.error) {
      return { ok: false, error: upd.error.message, status: 500 };
    }
  } else {
    const ins = await supabase.from('stock_levels').insert({
      profile_id: profileId,
      product_id: productId,
      warehouse_id: warehouseId,
      qty_on_hand: nextQty,
      qty_available: available,
      lot_number: opts.lotNumber || null,
      expiry_date: opts.expiryDate || null,
      updated_at: now,
    } as never);
    if (ins.error && /qty_available|lot_number|expiry/i.test(ins.error.message || '')) {
      const retry = await supabase.from('stock_levels').insert({
        profile_id: profileId,
        product_id: productId,
        warehouse_id: warehouseId,
        qty_on_hand: nextQty,
        updated_at: now,
      } as never);
      if (retry.error) {
        return { ok: false, error: retry.error.message, status: 500 };
      }
    } else if (ins.error) {
      return { ok: false, error: ins.error.message, status: 500 };
    }
  }

  const onchainHash = hashMovement({
    profileId,
    productId,
    movementType: opts.movementType,
    quantity: movementQty,
    at: now,
    reference: opts.referenceId != null ? String(opts.referenceId) : null,
  });
  const movement: Record<string, unknown> = {
    profile_id: profileId,
    product_id: productId,
    warehouse_id: warehouseId,
    from_warehouse_id: opts.fromWarehouseId ?? null,
    to_warehouse_id: opts.toWarehouseId ?? null,
    movement_type: opts.movementType,
    quantity: movementQty,
    unit_cost: await resolveUnitCost(supabase, profileId, productId, opts.unitCost),
    reference_type: opts.referenceType || null,
    reference_id: opts.referenceId != null ? String(opts.referenceId) : null,
    notes: opts.notes || null,
    lot_number: opts.lotNumber || null,
    expiry_date: opts.expiryDate || null,
    created_by: opts.createdBy || null,
    onchain_hash: onchainHash,
    created_at: now,
  };
  const mov = await supabase.from('stock_movements').insert(movement as never);
  if (mov.error && /column|schema cache|does not exist/i.test(mov.error.message || '')) {
    const soft = {
      profile_id: profileId,
      product_id: productId,
      warehouse_id: warehouseId,
      movement_type: opts.movementType,
      quantity: movementQty,
      created_at: now,
    };
    await supabase.from('stock_movements').insert(soft as never);
  }

  if (opts.lotNumber) {
    const lotHit = await supabase
      .from('inventory_lots')
      .select('id, qty_on_hand')
      .eq('profile_id', profileId)
      .eq('product_id', productId)
      .eq('lot_number', opts.lotNumber)
      .maybeSingle();
    const lotRow = asRow(lotHit.data);
    const lotQty = Number(lotRow?.qty_on_hand || 0) + movementQty;
    if (lotRow?.id) {
      await supabase
        .from('inventory_lots')
        .update({
          qty_on_hand: lotQty,
          warehouse_id: warehouseId,
          expiry_date: opts.expiryDate || undefined,
          updated_at: now,
        } as never)
        .eq('id', Number(lotRow.id));
    } else {
      await supabase.from('inventory_lots').insert({
        profile_id: profileId,
        product_id: productId,
        warehouse_id: warehouseId,
        lot_number: opts.lotNumber,
        expiry_date: opts.expiryDate || null,
        qty_on_hand: Math.max(0, lotQty),
        status: 'active',
        updated_at: now,
      } as never);
    }
  }

  await syncProductOnHand(profileId, productId);
  return { ok: true, qty_on_hand: nextQty, qty_available: available, movement_qty: movementQty };
}

export async function syncProductOnHand(
  profileId: number,
  productId: number
): Promise<void> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('stock_levels')
    .select('qty_on_hand')
    .eq('profile_id', profileId)
    .eq('product_id', productId);
  const sum = (Array.isArray(data) ? data : []).reduce(
    (s, r) => s + Number((r as { qty_on_hand?: number }).qty_on_hand || 0),
    0
  );
  await supabase
    .from('products')
    .update({ qty_on_hand: sum, updated_at: new Date().toISOString() } as never)
    .eq('id', productId)
    .eq('profile_id', profileId);
}
