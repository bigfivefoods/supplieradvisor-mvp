import { getSupabaseServer } from '@/lib/supabase/server-client';
import { findConnectionBetween } from '@/lib/connections/sync';
import { isAgreementEffective, type PricingLookupResult } from '@/lib/pricing/types';

/**
 * Require an accepted (non-suspended) network edge between seller and buyer.
 */
export async function assertPricingTradeLink(
  sellerProfileId: number,
  buyerProfileId: number
): Promise<
  | { ok: true; connectionId: number | null }
  | { ok: false; error: string; status: number }
> {
  if (!Number.isFinite(sellerProfileId) || !Number.isFinite(buyerProfileId)) {
    return { ok: false, error: 'seller and buyer profile ids required', status: 400 };
  }
  if (sellerProfileId === buyerProfileId) {
    return { ok: false, error: 'Seller and buyer must be different companies', status: 400 };
  }

  const edge = await findConnectionBetween(sellerProfileId, buyerProfileId);
  if (!edge || String(edge.status) !== 'accepted') {
    return {
      ok: false,
      error:
        'No accepted network connection between these companies. Connect them first in Network.',
      status: 403,
    };
  }
  const meta =
    edge.metadata && typeof edge.metadata === 'object' && !Array.isArray(edge.metadata)
      ? (edge.metadata as Record<string, unknown>)
      : {};
  if (meta.suspended === true || meta.suspended === 'true') {
    return {
      ok: false,
      error: 'Connection is suspended — pricing agreements are frozen',
      status: 403,
    };
  }
  return { ok: true, connectionId: Number(edge.id) };
}

/**
 * Lookup active list price for buyer purchasing from seller.
 * Matches product by seller_product_id, then sku, then name.
 */
export async function lookupListPrice(opts: {
  sellerProfileId: number;
  buyerProfileId: number;
  sellerProductId?: number | null;
  sku?: string | null;
  productName?: string | null;
}): Promise<PricingLookupResult | null> {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const { data: agreements } = await supabase
    .from('pricing_agreements')
    .select('*')
    .eq('seller_profile_id', opts.sellerProfileId)
    .eq('buyer_profile_id', opts.buyerProfileId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(20);

  const active = (agreements || []).filter((a) =>
    isAgreementEffective(
      {
        status: a.status,
        effective_from: a.effective_from,
        effective_to: a.effective_to,
      },
      new Date(today)
    )
  );
  if (!active.length) return null;

  const agreementIds = active.map((a) => Number(a.id));
  const { data: lines } = await supabase
    .from('pricing_agreement_lines')
    .select('*')
    .in('agreement_id', agreementIds)
    .order('sort_order', { ascending: true });

  if (!lines?.length) return null;

  let match =
    opts.sellerProductId != null
      ? lines.find((l) => Number(l.seller_product_id) === Number(opts.sellerProductId))
      : null;

  if (!match && opts.sku) {
    const sku = opts.sku.toLowerCase().trim();
    match = lines.find((l) => String(l.sku || '').toLowerCase() === sku) || null;
  }
  if (!match && opts.productName) {
    const name = opts.productName.toLowerCase().trim();
    match =
      lines.find((l) => String(l.product_name || '').toLowerCase() === name) || null;
  }
  if (!match) return null;

  const agreement = active.find((a) => Number(a.id) === Number(match!.agreement_id));
  if (!agreement) return null;

  return {
    agreement_id: Number(agreement.id),
    agreement_title: agreement.title,
    line_id: Number(match.id),
    seller_profile_id: Number(agreement.seller_profile_id),
    buyer_profile_id: Number(agreement.buyer_profile_id),
    seller_product_id: match.seller_product_id ? Number(match.seller_product_id) : null,
    product_name: match.product_name,
    sku: match.sku,
    uom: match.uom,
    list_price: Number(match.list_price || 0),
    currency: String(match.currency || agreement.currency || 'ZAR'),
    min_qty: match.min_qty != null ? Number(match.min_qty) : 1,
    suggested_resale_price:
      match.suggested_resale_price != null
        ? Number(match.suggested_resale_price)
        : null,
    specs_sheet_url: match.specs_sheet_url,
    specs_sheet_name: match.specs_sheet_name,
    primary_image_url: match.primary_image_url,
  };
}
