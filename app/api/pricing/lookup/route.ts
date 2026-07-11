import { NextRequest, NextResponse } from 'next/server';
import { assertCompanyMember } from '@/lib/customers/access';
import { lookupListPrice } from '@/lib/pricing/access';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isAgreementEffective } from '@/lib/pricing/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET — resolve list prices for PO / catalogue import
 *
 * Modes:
 * 1) Single: ?companyId=&sellerProfileId=&productId= | sku= | q=
 * 2) Catalogue for buyer: ?companyId=&sellerProfileId=&catalogue=1
 *    Returns all active agreement lines from that seller to this buyer
 * 3) All sellers into us: ?companyId=&catalogue=1  (no seller)
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const sellerProfileId = sp.get('sellerProfileId')
      ? Number(sp.get('sellerProfileId'))
      : null;
    const productId = sp.get('productId') ? Number(sp.get('productId')) : null;
    const sku = sp.get('sku') || null;
    const q = sp.get('q') || null;
    const catalogue = sp.get('catalogue') === '1';
    const privyUserId = sp.get('privyUserId');

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    // Catalogue mode — full price list(s) where we are the buyer
    if (catalogue) {
      const supabase = getSupabaseServer();
      let aq = supabase
        .from('pricing_agreements')
        .select('*')
        .eq('buyer_profile_id', companyId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false });
      if (sellerProfileId && Number.isFinite(sellerProfileId)) {
        aq = aq.eq('seller_profile_id', sellerProfileId);
      }
      const { data: agreements, error } = await aq;
      if (error) {
        return NextResponse.json({
          success: true,
          lines: [],
          warning: error.message,
          hint: 'Run supabase/migrations/20260710_pricing_agreements.sql',
        });
      }
      const active = (agreements || []).filter((a) =>
        isAgreementEffective({
          status: a.status,
          effective_from: a.effective_from,
          effective_to: a.effective_to,
        })
      );
      if (!active.length) {
        return NextResponse.json({ success: true, lines: [], agreements: [] });
      }

      const agreementIds = active.map((a) => Number(a.id));
      const { data: lines } = await supabase
        .from('pricing_agreement_lines')
        .select('*')
        .in('agreement_id', agreementIds)
        .order('sort_order', { ascending: true });

      const sellerIds = [...new Set(active.map((a) => Number(a.seller_profile_id)))];
      const { data: sellers } = await supabase
        .from('profiles')
        .select('id, trading_name')
        .in('id', sellerIds);
      const sellerMap = Object.fromEntries(
        (sellers || []).map((s) => [Number(s.id), s.trading_name])
      );
      const agreementMap = Object.fromEntries(
        active.map((a) => [Number(a.id), a])
      );

      const enriched = (lines || []).map((l) => {
        const a = agreementMap[Number(l.agreement_id)];
        return {
          ...l,
          agreement_title: a?.title,
          agreement_number: a?.agreement_number,
          seller_profile_id: a ? Number(a.seller_profile_id) : null,
          seller_name: a ? sellerMap[Number(a.seller_profile_id)] || null : null,
          currency: l.currency || a?.currency || 'ZAR',
          payment_terms: a?.payment_terms || null,
        };
      });

      return NextResponse.json({
        success: true,
        lines: enriched,
        agreements: active.map((a) => ({
          ...a,
          seller_name: sellerMap[Number(a.seller_profile_id)] || null,
        })),
      });
    }

    if (!sellerProfileId || !Number.isFinite(sellerProfileId)) {
      return NextResponse.json(
        { error: 'sellerProfileId required (or use catalogue=1)' },
        { status: 400 }
      );
    }

    const hit = await lookupListPrice({
      sellerProfileId,
      buyerProfileId: companyId,
      sellerProductId: productId,
      sku,
      productName: q,
    });

    return NextResponse.json({
      success: true,
      price: hit,
      found: Boolean(hit),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
