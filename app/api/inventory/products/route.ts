import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashProductIdentity } from '@/lib/inventory/hash';
import { productQrPayload } from '@/lib/inventory/types';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const q = request.nextUrl.searchParams.get('q');
    const type = request.nextUrl.searchParams.get('type');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    let query = supabase
      .from('products')
      .select('*')
      .eq('profile_id', companyId)
      .order('name');

    if (type && type !== 'all') query = query.eq('product_type', type);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        products: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_inventory_world_class.sql',
      });
    }

    let products = data || [];
    if (q) {
      const n = q.toLowerCase();
      products = products.filter(
        (p) =>
          p.name?.toLowerCase().includes(n) ||
          p.sku?.toLowerCase().includes(n) ||
          p.barcode?.toLowerCase().includes(n) ||
          p.category?.toLowerCase().includes(n)
      );
    }

    // Aggregate stock
    const { data: levels } = await supabase
      .from('stock_levels')
      .select('product_id, qty_on_hand')
      .eq('profile_id', companyId);

    const qtyMap: Record<number, number> = {};
    for (const l of levels || []) {
      const pid = Number(l.product_id);
      qtyMap[pid] = (qtyMap[pid] || 0) + Number(l.qty_on_hand || 0);
    }

    const enriched = products.map((p) => ({
      ...p,
      qty_on_hand: qtyMap[p.id] ?? 0,
    }));

    return NextResponse.json({ success: true, products: enriched });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.name) {
      return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
    }

    const publicId = body.public_id || randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const qrPayload = body.qr_payload || productQrPayload(publicId, appUrl);
    const onchainHash = hashProductIdentity({
      profileId: companyId,
      publicId,
      sku: body.sku,
      name: body.name,
      uom: body.uom,
    });

    const payload = {
      profile_id: companyId,
      name: String(body.name).trim(),
      sku: body.sku || null,
      barcode: body.barcode || null,
      public_id: publicId,
      category: body.category || null,
      product_type: body.product_type || 'finished_good',
      uom: body.uom || 'unit',
      sell_price: body.sell_price != null ? Number(body.sell_price) : 0,
      cost_price: body.cost_price != null ? Number(body.cost_price) : 0,
      reorder_level: body.reorder_level != null ? Number(body.reorder_level) : 0,
      reorder_qty: body.reorder_qty != null ? Number(body.reorder_qty) : 0,
      short_description: body.short_description || null,
      status: body.status || 'active',
      primary_image_url: body.primary_image_url || null,
      track_lot: !!body.track_lot,
      track_serial: !!body.track_serial,
      is_sellable: body.is_sellable !== false,
      is_purchasable: body.is_purchasable !== false,
      qr_payload: qrPayload,
      onchain_status: 'hashed',
      onchain_hash: onchainHash,
      onchain_chain: body.onchain_chain || 'base-sepolia',
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('products').insert(payload).select('*').single();
    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run 20260709_inventory_world_class.sql if columns missing',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, product: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const fields = [
      'name',
      'sku',
      'barcode',
      'category',
      'product_type',
      'uom',
      'sell_price',
      'cost_price',
      'reorder_level',
      'reorder_qty',
      'short_description',
      'status',
      'primary_image_url',
      'track_lot',
      'track_serial',
      'is_sellable',
      'is_purchasable',
      'onchain_status',
      'onchain_tx_hash',
      'onchain_token_id',
      'onchain_chain',
    ] as const;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    if (body.anchor === true) {
      updates.onchain_status = 'anchored';
      updates.onchain_anchored_at = new Date().toISOString();
      if (body.onchain_tx_hash) updates.onchain_tx_hash = body.onchain_tx_hash;
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, product: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
