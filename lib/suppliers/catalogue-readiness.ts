/**
 * Seller catalogue readiness for network trade.
 * Buyers use this to see if a supplier can be ordered from cleanly.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isAgreementEffective } from '@/lib/pricing/types';

export type CatalogueReadiness = {
  sellerProfileId: number;
  sellableProducts: number;
  finishedGoods: number;
  services: number;
  activeAgreements: number;
  agreementLines: number;
  score: number; // 0–100
  level: 'empty' | 'thin' | 'ready' | 'strong';
  tips: string[];
  label: string;
};

export async function computeCatalogueReadiness(
  sellerProfileId: number,
  opts?: { buyerProfileId?: number | null }
): Promise<CatalogueReadiness> {
  const supabase = getSupabaseServer();
  const tips: string[] = [];

  let sellableProducts = 0;
  let finishedGoods = 0;
  let services = 0;

  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, product_type, is_sellable, status')
    .eq('profile_id', sellerProfileId)
    .limit(500);

  if (!pErr && products) {
    for (const p of products) {
      const st = String(p.status || 'active').toLowerCase();
      if (st === 'archived' || st === 'inactive' || st === 'deleted') continue;
      if (p.is_sellable === false) continue;
      sellableProducts += 1;
      const t = String(p.product_type || '').toLowerCase();
      if (t === 'finished_good') finishedGoods += 1;
      if (t === 'service') services += 1;
    }
  }

  let activeAgreements = 0;
  let agreementLines = 0;
  const buyerId = opts?.buyerProfileId;

  let aq = supabase
    .from('pricing_agreements')
    .select('id, status, effective_from, effective_to, buyer_profile_id')
    .eq('seller_profile_id', sellerProfileId)
    .eq('status', 'active')
    .limit(50);
  if (buyerId && Number.isFinite(buyerId)) {
    aq = aq.eq('buyer_profile_id', buyerId);
  }
  const { data: agreements } = await aq;
  const active = (agreements || []).filter((a) =>
    isAgreementEffective({
      status: a.status,
      effective_from: a.effective_from,
      effective_to: a.effective_to,
    })
  );
  activeAgreements = active.length;
  if (active.length) {
    const { count } = await supabase
      .from('pricing_agreement_lines')
      .select('id', { count: 'exact', head: true })
      .in(
        'agreement_id',
        active.map((a) => Number(a.id))
      );
    agreementLines = count ?? 0;
  }

  // Score: products up to 60, agreements up to 40
  const productScore = Math.min(60, sellableProducts * 12);
  const agreeScore =
    agreementLines > 0
      ? Math.min(40, 20 + agreementLines * 4)
      : activeAgreements > 0
        ? 15
        : 0;
  const score = Math.min(100, productScore + agreeScore);

  let level: CatalogueReadiness['level'] = 'empty';
  if (score >= 70) level = 'strong';
  else if (score >= 40) level = 'ready';
  else if (score > 0) level = 'thin';

  if (sellableProducts === 0) {
    tips.push('Publish sellable finished goods or services under Inventory → Products');
  } else if (finishedGoods === 0 && services === 0) {
    tips.push('Mark products as finished goods or services and is_sellable');
  }
  if (buyerId && agreementLines === 0) {
    tips.push('Share a pricing agreement with this buyer for agreed list prices');
  } else if (!buyerId && agreementLines === 0 && sellableProducts < 3) {
    tips.push('Add more SKUs or create pricing agreements for key buyers');
  }
  if (level === 'empty') {
    tips.push('Until then, buyers can only use free-text PO lines');
  }

  const label =
    level === 'strong'
      ? 'Strong catalogue'
      : level === 'ready'
        ? 'Ready to sell'
        : level === 'thin'
          ? 'Thin catalogue'
          : 'No sellable catalogue';

  return {
    sellerProfileId,
    sellableProducts,
    finishedGoods,
    services,
    activeAgreements,
    agreementLines,
    score,
    level,
    tips: tips.slice(0, 4),
    label,
  };
}
