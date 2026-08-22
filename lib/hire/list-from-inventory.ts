/**
 * Publish a Core Inventory product as a HireAdvisor catalogue item
 * and a marketplace hire listing.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  getHireCategory,
  upsertEntity,
  type HireUnit,
  type HiregraphStore,
} from '@/lib/hire/hiregraph';

export type InventoryHireInput = {
  companyId: number;
  productId: number;
  categoryId: string;
  rateZar: number;
  rateUnit?: string;
  depositZar?: number | null;
  qtyAvailable?: number | null;
  location?: string | null;
  srmSupplierId?: number | null;
  supplierName?: string | null;
  description?: string | null;
};

export async function listInventoryProductForHire(
  store: HiregraphStore,
  input: InventoryHireInput
): Promise<{
  store: HiregraphStore;
  itemId: string;
  listingId: number | null;
  listingWarning?: string;
}> {
  const supabase = getSupabaseServer();
  const { data: product, error } = await supabase
    .from('products')
    .select(
      'id, name, sku, category, short_description, primary_image_url, sell_price, uom, status'
    )
    .eq('id', input.productId)
    .eq('profile_id', input.companyId)
    .maybeSingle();
  if (error || !product) {
    throw new Error('Product not found in your inventory');
  }

  let stockQty = input.qtyAvailable;
  if (stockQty == null) {
    const { data: levels } = await supabase
      .from('stock_levels')
      .select('qty_on_hand')
      .eq('profile_id', input.companyId)
      .eq('product_id', input.productId);
    stockQty = (levels || []).reduce(
      (s, l) => s + Number(l.qty_on_hand || 0),
      0
    );
  }

  const cat = getHireCategory(input.categoryId);
  const existing = (store.items || []).find(
    (i) => Number(i.inventory_product_id) === input.productId
  );
  const rate =
    input.rateZar > 0
      ? input.rateZar
      : Number(existing?.rate_zar) || Number(product.sell_price) || 0;
  const unit = input.rateUnit || existing?.rate_unit || cat?.unit || 'day';

  let next = upsertEntity(store, 'items', {
    ...(existing || {}),
    id: existing?.id,
    code: existing?.code || String(product.sku || `INV-${product.id}`),
    title: String(product.name || existing?.title || 'Hire item'),
    category_id: input.categoryId,
    category_name: cat?.name || existing?.category_name,
    srm_supplier_id: input.srmSupplierId || existing?.srm_supplier_id || null,
    supplier_name:
      input.supplierName ||
      existing?.supplier_name ||
      'Own inventory',
    description:
      input.description ||
      (product.short_description as string | null) ||
      existing?.description ||
      '',
    rate_zar: rate,
    rate_unit: unit,
    qty_available: stockQty,
    deposit_zar:
      input.depositZar != null
        ? input.depositZar
        : existing?.deposit_zar ?? null,
    location: input.location || existing?.location || '',
    photo_url: product.primary_image_url || existing?.photo_url || '',
    inventory_product_id: input.productId,
    status: 'listed',
    active: true,
  });

  const item = next.items.find(
    (i) => Number(i.inventory_product_id) === input.productId
  );
  if (!item) throw new Error('Could not save hire catalogue item');
  const haveUnits = (next.units || []).some((u) => u.item_id === item.id);
  if (!haveUnits) {
    const n = Math.max(1, Number(stockQty) || 1);
    const now = new Date().toISOString();
    const seeded: HireUnit[] = Array.from({ length: Math.min(n, 20) }, (_, i) => ({
      id: `un_${item.id}_${i + 1}`,
      item_id: item.id,
      label: n === 1 ? item.title : `${item.title} #${i + 1}`,
      active: true,
      created_at: now,
      updated_at: now,
    }));
    next = { ...next, units: [...seeded, ...(next.units || [])] };
  }

  if (!next.settings?.brand_name) {
    next = {
      ...next,
      settings: {
        ...(next.settings || {}),
        allow_portal_booking: next.settings?.allow_portal_booking !== false,
      },
    };
  }

  const published = await publishHireListing({
    companyId: input.companyId,
    productId: input.productId,
    item,
    stockQty: Number(stockQty) || 0,
    categoryName: cat?.name || item.category_name || null,
  });

  if (published.listingId && published.listingId !== item.marketplace_listing_id) {
    next = upsertEntity(next, 'items', {
      ...item,
      marketplace_listing_id: published.listingId,
    });
  }

  return {
    store: next,
    itemId: item.id,
    listingId: published.listingId,
    listingWarning: published.warning,
  };
}

async function publishHireListing(opts: {
  companyId: number;
  productId: number;
  item: {
    id: string;
    title: string;
    description?: string;
    rate_zar: number;
    rate_unit?: string;
    photo_url?: string;
    category_id: string;
    deposit_zar?: number | null;
    marketplace_listing_id?: number | null;
  };
  stockQty: number;
  categoryName: string | null;
}): Promise<{ listingId: number | null; warning?: string }> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const meta = {
    channel: 'hire',
    hire_item_id: opts.item.id,
    hire_category_id: opts.item.category_id,
    rate_unit: opts.item.rate_unit || 'day',
    deposit_zar: opts.item.deposit_zar ?? null,
    source: 'hiregraph_inventory',
  };
  const payload = {
    seller_profile_id: opts.companyId,
    product_id: opts.productId,
    title: opts.item.title,
    description: opts.item.description || null,
    category: opts.categoryName,
    product_type: 'hire',
    sku: null as string | null,
    uom: opts.item.rate_unit || 'day',
    unit_price: opts.item.rate_zar,
    currency: 'ZAR',
    min_order_qty: 1,
    visibility: 'public',
    status: 'active',
    primary_image_url: opts.item.photo_url || null,
    show_stock: true,
    stock_qty_snapshot: opts.stockQty,
    metadata: meta,
    published_at: now,
    updated_at: now,
  };

  const existingId = opts.item.marketplace_listing_id
    ? Number(opts.item.marketplace_listing_id)
    : null;

  if (existingId && Number.isFinite(existingId)) {
    const { error } = await supabase
      .from('marketplace_listings')
      .update(payload)
      .eq('id', existingId)
      .eq('seller_profile_id', opts.companyId);
    if (!error) return { listingId: existingId };
  }

  const { data: rows } = await supabase
    .from('marketplace_listings')
    .select('id, metadata, product_type')
    .eq('seller_profile_id', opts.companyId)
    .eq('product_id', opts.productId)
    .neq('status', 'archived')
    .limit(20);

  const hireRow = (rows || []).find((r) => {
    const m =
      r.metadata && typeof r.metadata === 'object'
        ? (r.metadata as Record<string, unknown>)
        : {};
    return m.channel === 'hire' || r.product_type === 'hire';
  });

  if (hireRow?.id) {
    const { error } = await supabase
      .from('marketplace_listings')
      .update(payload)
      .eq('id', hireRow.id);
    if (error) return { listingId: Number(hireRow.id), warning: error.message };
    return { listingId: Number(hireRow.id) };
  }

  const { data: created, error } = await supabase
    .from('marketplace_listings')
    .insert({ ...payload, created_at: now })
    .select('id')
    .single();
  if (error) return { listingId: null, warning: error.message };
  return { listingId: created?.id ? Number(created.id) : null };
}
