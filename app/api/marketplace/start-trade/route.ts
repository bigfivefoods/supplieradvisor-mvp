import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * POST { companyId, listingId, peerId? }
 * Catalogue → trade handoff: returns deep links for connect / PO / first-trade.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    const listingId = Number(body.listingId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let peerId = Number(body.peerId || body.sellerProfileId || 0);
    let title = String(body.title || 'Marketplace item').slice(0, 120);
    let unitPrice: number | null =
      body.unitPrice != null ? Number(body.unitPrice) : null;
    let currency = String(body.currency || 'ZAR');

    if (Number.isFinite(listingId) && listingId > 0) {
      const { data: listing } = await supabase
        .from('marketplace_listings')
        .select(
          'id, title, unit_price, currency, seller_profile_id, uom, min_order_qty'
        )
        .eq('id', listingId)
        .maybeSingle();
      if (listing) {
        peerId = Number(listing.seller_profile_id || peerId);
        title = String(listing.title || title);
        unitPrice =
          listing.unit_price != null ? Number(listing.unit_price) : unitPrice;
        currency = String(listing.currency || currency);
      }
    }

    if (!peerId || peerId === companyId) {
      return NextResponse.json(
        { error: 'peerId / listing seller required' },
        { status: 400 }
      );
    }

    // Connected?
    const { data: edge } = await supabase
      .from('business_connections')
      .select('id, status')
      .or(
        `and(requester_profile_id.eq.${companyId},requestee_profile_id.eq.${peerId}),and(requester_profile_id.eq.${peerId},requestee_profile_id.eq.${companyId})`
      )
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    const connected = Boolean(edge?.id);
    const poHref = `/dashboard/suppliers/po?peer=${peerId}&fromListing=${listingId || ''}&q=${encodeURIComponent(title)}`;
    const connectHref = `/dashboard/connections/discover?peer=${peerId}`;
    const firstTradeHref = `/dashboard?peerTrade=${peerId}&peerName=${encodeURIComponent(title)}`;

    return NextResponse.json({
      success: true,
      peerId,
      title,
      unitPrice,
      currency,
      connected,
      hrefs: {
        primary: connected ? poHref : connectHref,
        po: poHref,
        connect: connectHref,
        firstTrade: firstTradeHref,
        settle: '/dashboard/settle',
        escrow: '/dashboard/escrow',
      },
      nextStep: connected
        ? 'Raise PO from listing lines'
        : 'Request to trade, then raise PO',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
