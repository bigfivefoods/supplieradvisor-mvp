/**
 * Best-effort links from TradeAdvisor® into SupplierAdvisor® inventory
 * and purchase orders. A failure here must not roll back the trade book.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { PriceItem } from './desk';
import type { QuoteLine } from './tradegraph';

export async function loadInventoryPriceLines(companyId: number): Promise<PriceItem[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, sell_price, prices, status, is_sellable')
    .eq('profile_id', companyId)
    .limit(200);
  if (error || !data?.length) return [];
  return data
    .filter((row) => {
      const status = String(row.status || 'active').toLowerCase();
      return status !== 'archived' && status !== 'inactive' && row.is_sellable !== false;
    })
    .map((row) => {
      const prices = Array.isArray(row.prices) ? row.prices : [];
      const zar = prices.find(
        (item: { currency?: string; sell_price?: number }) => String(item?.currency || '').toUpperCase() === 'ZAR'
      ) as { sell_price?: number } | undefined;
      const sell = Math.round((Number(zar?.sell_price) || Number(row.sell_price) || 0) * 100);
      return {
        id: `inv_${row.id}`,
        kind: 'material' as const,
        name: String(row.name || 'Product'),
        unit: 'each',
        cost_cents: sell,
        markup_pct: 0,
        sku: String(row.sku || row.id),
      };
    })
    .filter((row) => row.name);
}

export async function raiseTradePurchaseOrder(input: {
  companyId: number;
  supplierId: number;
  lines: QuoteLine[];
  note: string;
}): Promise<void> {
  const total = input.lines.reduce((sum, line) => sum + Math.round(line.qty * line.unit_cents), 0) / 100;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('purchase_orders').insert({
    buyer_profile_id: input.companyId,
    supplier_profile_id: input.supplierId,
    total_amount: total,
    description: input.note.slice(0, 240),
    items: input.lines.map((line) => ({
      description: line.description,
      qty: line.qty,
      unit_price: line.unit_cents / 100,
    })),
    status: 'draft',
    metadata: { source: 'tradegraph' },
  });
  if (error) throw new Error(error.message);
}
