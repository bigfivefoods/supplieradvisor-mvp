import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';

/**
 * GET ?companyId=&role=buyer|seller
 * List marketplace inquiries for this company.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const role = request.nextUrl.searchParams.get('role') || 'seller';
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const col = role === 'buyer' ? 'buyer_profile_id' : 'seller_profile_id';

    const { data, error } = await supabase
      .from('marketplace_inquiries')
      .select('*')
      .eq(col, companyId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({
        success: true,
        inquiries: [],
        warning: error.message,
        hint: 'Run 20260709_marketplace.sql',
      });
    }

    const rows = data || [];
    const listingIds = Array.from(
      new Set(rows.map((r) => Number(r.listing_id)).filter(Boolean))
    );
    const listingMap = new Map<number, Record<string, unknown>>();
    if (listingIds.length) {
      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('id, title, unit_price, currency, sku, primary_image_url, seller_profile_id')
        .in('id', listingIds);
      for (const l of listings || []) listingMap.set(Number(l.id), l);
    }

    // Peer names
    const peerIds = new Set<number>();
    for (const r of rows) {
      peerIds.add(Number(r.buyer_profile_id));
      peerIds.add(Number(r.seller_profile_id));
    }
    const peerMap = new Map<number, { id: number; trading_name?: string | null }>();
    if (peerIds.size) {
      const { data: peers } = await supabase
        .from('profiles')
        .select('id, trading_name')
        .in('id', Array.from(peerIds));
      for (const p of peers || []) peerMap.set(Number(p.id), p);
    }

    const inquiries = rows.map((r) => ({
      ...r,
      listing: listingMap.get(Number(r.listing_id)) || null,
      buyer: peerMap.get(Number(r.buyer_profile_id)) || null,
      seller: peerMap.get(Number(r.seller_profile_id)) || null,
    }));

    return NextResponse.json({ success: true, inquiries });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — buyer inquires / RFQ on a listing
 * Body: companyId, privyUserId, listingId, quantity, message, contact_*
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const listingId = Number(body.listingId);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(listingId)) {
      return NextResponse.json({ error: 'listingId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: listing, error: lErr } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    if (lErr || !listing) {
      return NextResponse.json({ error: 'Listing not available' }, { status: 404 });
    }

    const sellerId = Number(listing.seller_profile_id);
    if (sellerId === companyId) {
      return NextResponse.json({ error: 'Cannot inquire on your own listing' }, { status: 400 });
    }

    // Connected-only listings require accepted edge
    if (String(listing.visibility) === 'connected') {
      const { data: conn } = await supabase
        .from('business_connections')
        .select('id, metadata, status')
        .or(
          `and(requester_profile_id.eq.${companyId},requestee_profile_id.eq.${sellerId}),and(requester_profile_id.eq.${sellerId},requestee_profile_id.eq.${companyId})`
        )
        .eq('status', 'accepted')
        .maybeSingle();

      const meta =
        conn?.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
          ? (conn.metadata as Record<string, unknown>)
          : {};
      if (!conn || meta.suspended === true || meta.suspended === 'true') {
        return NextResponse.json(
          {
            error: 'This listing is for connected businesses only. Connect first.',
            code: 'CONNECTION_REQUIRED',
          },
          { status: 403 }
        );
      }
    }

    const qty = Math.max(Number(body.quantity) || 1, Number(listing.min_order_qty) || 1);
    const now = new Date().toISOString();

    const { data: created, error } = await supabase
      .from('marketplace_inquiries')
      .insert({
        listing_id: listingId,
        buyer_profile_id: companyId,
        seller_profile_id: sellerId,
        quantity: qty,
        unit_price: listing.unit_price,
        currency: listing.currency || 'ZAR',
        message: body.message || null,
        status: 'new',
        contact_name: body.contact_name || null,
        contact_email: body.contact_email || null,
        contact_phone: body.contact_phone || null,
        metadata: {
          listing_title: listing.title,
          source: 'marketplace',
        },
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_marketplace.sql' },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: sellerId,
      actor_user_id: mem.userId,
      action: 'marketplace.inquiry_received',
      entity_type: 'marketplace_inquiries',
      entity_id: String(created.id),
      summary: `Marketplace inquiry on ${listing.title}`,
      metadata: { buyerProfileId: companyId, listingId, qty },
    });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'marketplace.inquiry_sent',
      entity_type: 'marketplace_inquiries',
      entity_id: String(created.id),
      summary: `Sent inquiry for ${listing.title}`,
      metadata: { sellerProfileId: sellerId, listingId, qty },
    });

    return NextResponse.json({
      success: true,
      inquiry: created,
      next: {
        connect: '/dashboard/connections',
        po: '/dashboard/suppliers/po',
        message:
          'Inquiry sent. If you are connected, convert to a PO from Suppliers → POs.',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — seller updates inquiry status
 * Body: companyId, privyUserId, inquiryId, status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const inquiryId = Number(body.inquiryId);
    const status = String(body.status || '');
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const allowed = ['quoted', 'accepted', 'declined', 'converted', 'cancelled'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: inv, error } = await supabase
      .from('marketplace_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .maybeSingle();

    if (error || !inv) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }
    if (
      Number(inv.seller_profile_id) !== companyId &&
      Number(inv.buyer_profile_id) !== companyId
    ) {
      return NextResponse.json({ error: 'Not a party to this inquiry' }, { status: 403 });
    }

    const { data: updated, error: upErr } = await supabase
      .from('marketplace_inquiries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', inquiryId)
      .select('*')
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inquiry: updated });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
