import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import type { MarketplaceListing } from '@/lib/marketplace/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&mode=browse|mine&q=&category=&visibility=
 * Browse catalogue (public + connected sellers) or seller's own listings.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const mode = request.nextUrl.searchParams.get('mode') || 'browse';
    const q = (request.nextUrl.searchParams.get('q') || '').toLowerCase().trim();
    const category = request.nextUrl.searchParams.get('category');
    const status = request.nextUrl.searchParams.get('status');

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();

    if (mode === 'mine') {
      let query = supabase
        .from('marketplace_listings')
        .select('*')
        .eq('seller_profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(300);
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) {
        return NextResponse.json({
          success: true,
          listings: [],
          warning: error.message,
          hint: 'Run supabase/migrations/20260709_marketplace.sql',
        });
      }
      let listings = (data || []) as MarketplaceListing[];
      if (q) {
        listings = listings.filter((l) =>
          [l.title, l.sku, l.category, l.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        );
      }
      return NextResponse.json({ success: true, listings });
    }

    // Browse: active listings that are public OR seller is connected to us OR own
    const { data: allActive, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(400);

    if (error) {
      return NextResponse.json({
        success: true,
        listings: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_marketplace.sql',
      });
    }

    // Connected peer profile ids (accepted, not suspended)
    const { data: conns } = await supabase
      .from('business_connections')
      .select('requester_profile_id, requestee_profile_id, status, metadata')
      .or(`requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`)
      .eq('status', 'accepted');

    const connectedIds = new Set<number>();
    for (const c of conns || []) {
      const meta =
        c.metadata && typeof c.metadata === 'object' && !Array.isArray(c.metadata)
          ? (c.metadata as Record<string, unknown>)
          : {};
      if (meta.suspended === true || meta.suspended === 'true') continue;
      const a = Number(c.requester_profile_id);
      const b = Number(c.requestee_profile_id);
      if (a === companyId) connectedIds.add(b);
      if (b === companyId) connectedIds.add(a);
    }

    let listings = (allActive || []).filter((row) => {
      const sellerId = Number(row.seller_profile_id);
      if (sellerId === companyId) return true;
      const vis = String(row.visibility || 'public');
      if (vis === 'public') return true;
      if (vis === 'connected') return connectedIds.has(sellerId);
      return false;
    }) as MarketplaceListing[];

    if (category && category !== 'all') {
      listings = listings.filter(
        (l) => String(l.category || '').toLowerCase() === category.toLowerCase()
      );
    }
    if (q) {
      listings = listings.filter((l) =>
        [l.title, l.sku, l.category, l.description, l.origin_city, l.origin_country]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    // Enrich sellers
    const sellerIds = Array.from(
      new Set(listings.map((l) => Number(l.seller_profile_id)).filter(Boolean))
    );
    const sellerMap = new Map<
      number,
      NonNullable<MarketplaceListing['seller']>
    >();
    if (sellerIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select(
          'id, trading_name, city, country, verification_status, is_verified, wallet_address, logo_url'
        )
        .in('id', sellerIds);
      for (const p of profiles || []) {
        sellerMap.set(Number(p.id), p as NonNullable<MarketplaceListing['seller']>);
      }
    }

    const enriched = listings.map((l) => {
      const sid = Number(l.seller_profile_id);
      return {
        ...l,
        seller: sellerMap.get(sid) || { id: sid, trading_name: `Company #${sid}` },
        is_connected: connectedIds.has(sid) || sid === companyId,
        is_own: sid === companyId,
      };
    });

    const categories = Array.from(
      new Set(
        enriched
          .map((l) => l.category)
          .filter((c): c is string => Boolean(c && String(c).trim()))
      )
    ).sort();

    return NextResponse.json({
      success: true,
      listings: enriched,
      categories,
      connectedCount: connectedIds.size,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — publish / create listing from inventory product or freeform
 * Body: companyId, privyUserId, productId? | title, fields...
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const productId = body.productId ? Number(body.productId) : null;
    let product: Record<string, unknown> | null = null;

    if (productId) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json({ error: 'Product not found in your inventory' }, { status: 404 });
      }
      product = data;

      // One active listing per product (update if exists)
      const { data: existing } = await supabase
        .from('marketplace_listings')
        .select('id')
        .eq('seller_profile_id', companyId)
        .eq('product_id', productId)
        .neq('status', 'archived')
        .maybeSingle();

      if (existing?.id && !body.forceNew) {
        return await patchListing(Number(existing.id), companyId, mem.userId, body, product);
      }
    }

    // Optional stock snapshot
    let stockQty: number | null = null;
    if (productId) {
      const { data: levels } = await supabase
        .from('stock_levels')
        .select('qty_on_hand')
        .eq('profile_id', companyId)
        .eq('product_id', productId);
      stockQty = (levels || []).reduce(
        (s, l) => s + Number(l.qty_on_hand || 0),
        0
      );
    }

    // Seller geo for origin defaults
    const { data: sellerProf } = await supabase
      .from('profiles')
      .select('city, country')
      .eq('id', companyId)
      .maybeSingle();

    const title =
      String(body.title || product?.name || '').trim() ||
      null;
    if (!title) {
      return NextResponse.json({ error: 'title or productId required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const status = body.status === 'draft' ? 'draft' : 'active';
    const row = {
      seller_profile_id: companyId,
      product_id: productId,
      title,
      description:
        body.description ??
        product?.short_description ??
        null,
      category: body.category ?? product?.category ?? null,
      product_type: body.product_type ?? product?.product_type ?? 'finished_good',
      sku: body.sku ?? product?.sku ?? null,
      uom: body.uom ?? product?.uom ?? 'unit',
      unit_price:
        body.unit_price != null
          ? Number(body.unit_price)
          : Number(product?.sell_price || 0),
      currency: body.currency || product?.base_currency || 'ZAR',
      min_order_qty: body.min_order_qty != null ? Number(body.min_order_qty) : 1,
      moq_note: body.moq_note || null,
      visibility: body.visibility === 'connected' ? 'connected' : 'public',
      status,
      primary_image_url:
        body.primary_image_url ?? product?.primary_image_url ?? null,
      show_stock: body.show_stock === true,
      stock_qty_snapshot: stockQty,
      lead_time_days:
        body.lead_time_days != null ? Number(body.lead_time_days) : null,
      incoterms: body.incoterms || null,
      origin_country: body.origin_country || sellerProf?.country || null,
      origin_city: body.origin_city || sellerProf?.city || null,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      public_id: product?.public_id || randomUUID(),
      onchain_hash: product?.onchain_hash || null,
      onchain_status: product?.onchain_status || null,
      metadata: {
        source: productId ? 'inventory' : 'manual',
        created_by: mem.userId,
      },
      published_at: status === 'active' ? now : null,
      created_at: now,
      updated_at: now,
    };

    const { data: created, error: insErr } = await supabase
      .from('marketplace_listings')
      .insert(row)
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json(
        {
          error: insErr.message,
          hint: 'Run supabase/migrations/20260709_marketplace.sql',
        },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'marketplace.listing_created',
      entity_type: 'marketplace_listings',
      entity_id: String(created.id),
      summary: `Listed ${title} on marketplace`,
      metadata: { productId, visibility: row.visibility },
    });

    return NextResponse.json({ success: true, listing: created });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — update listing (seller only)
 * Body: companyId, privyUserId, listingId, fields | action: pause|activate|archive
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const listingId = Number(body.listingId || body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(listingId)) {
      return NextResponse.json({ error: 'listingId required' }, { status: 400 });
    }

    return await patchListing(listingId, companyId, mem.userId, body, null);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE ?companyId=&listingId=&privyUserId= — archive listing
 */
export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const listingId = Number(request.nextUrl.searchParams.get('listingId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('marketplace_listings')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', listingId)
      .eq('seller_profile_id', companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function patchListing(
  listingId: number,
  companyId: number,
  userId: string,
  body: Record<string, unknown>,
  product: Record<string, unknown> | null
) {
  const supabase = getSupabaseServer();
  const { data: existing, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', listingId)
    .eq('seller_profile_id', companyId)
    .maybeSingle();

  if (error || !existing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };
  const action = String(body.action || '');

  if (action === 'pause') updates.status = 'paused';
  else if (action === 'activate') {
    updates.status = 'active';
    if (!existing.published_at) updates.published_at = now;
  } else if (action === 'archive') updates.status = 'archived';
  else {
    const fields = [
      'title',
      'description',
      'category',
      'product_type',
      'sku',
      'uom',
      'currency',
      'moq_note',
      'primary_image_url',
      'incoterms',
      'origin_country',
      'origin_city',
    ] as const;
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f] === '' ? null : body[f];
    }
    if (body.unit_price !== undefined) updates.unit_price = Number(body.unit_price);
    if (body.min_order_qty !== undefined) {
      updates.min_order_qty = Number(body.min_order_qty);
    }
    if (body.lead_time_days !== undefined) {
      updates.lead_time_days =
        body.lead_time_days === '' || body.lead_time_days == null
          ? null
          : Number(body.lead_time_days);
    }
    if (body.visibility !== undefined) {
      updates.visibility = body.visibility === 'connected' ? 'connected' : 'public';
    }
    if (body.status !== undefined) updates.status = body.status;
    if (body.show_stock !== undefined) updates.show_stock = Boolean(body.show_stock);
    if (Array.isArray(body.tags)) updates.tags = body.tags.map(String);

    // Refresh stock snapshot if linked product
    if (existing.product_id || product) {
      const pid = Number(existing.product_id || product?.id);
      const { data: levels } = await supabase
        .from('stock_levels')
        .select('qty_on_hand')
        .eq('profile_id', companyId)
        .eq('product_id', pid);
      updates.stock_qty_snapshot = (levels || []).reduce(
        (s, l) => s + Number(l.qty_on_hand || 0),
        0
      );
    }
  }

  const { data: updated, error: upErr } = await supabase
    .from('marketplace_listings')
    .update(updates)
    .eq('id', listingId)
    .select('*')
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  await logActivity({
    profile_id: companyId,
    actor_user_id: userId,
    action: 'marketplace.listing_updated',
    entity_type: 'marketplace_listings',
    entity_id: String(listingId),
    summary: `Updated marketplace listing #${listingId}`,
    metadata: { action: action || 'fields' },
  });

  return NextResponse.json({ success: true, listing: updated });
}
