import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashProductIdentity } from '@/lib/inventory/hash';
import { normalizeProductPrices, productQrPayload } from '@/lib/inventory/types';
import { toGtin14, isValidGtin } from '@/lib/inventory/gs1';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

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

    const gtinRaw = body.gtin || body.barcode || null;
    const gtin14 = gtinRaw ? toGtin14(String(gtinRaw)) : null;
    if (gtinRaw && !isValidGtin(String(gtinRaw))) {
      // soft warning — still store for operational use
    }

    const productType = body.product_type || 'finished_good';
    // Legacy DB often has NOT NULL on category (and similar) without defaults
    const category =
      (body.category && String(body.category).trim()) ||
      (productType === 'raw_material'
        ? 'Raw materials'
        : productType === 'consumable'
          ? 'Consumables'
          : productType === 'kit'
            ? 'Kits'
            : 'General');

    const priceRows = normalizeProductPrices(
      Array.isArray(body.prices)
        ? body.prices
        : [
            {
              currency: body.base_currency || body.currency || 'ZAR',
              cost_price: body.cost_price,
              sell_price: body.sell_price,
            },
          ]
    );
    const primary = priceRows[0];

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      name: String(body.name).trim(),
      sku: body.sku ? String(body.sku).trim() : null,
      barcode: body.barcode || gtinRaw || null,
      gtin: gtinRaw,
      gtin14,
      public_id: publicId,
      category,
      product_type: productType,
      uom: body.uom || 'unit',
      base_currency: primary.currency,
      sell_price: primary.sell_price,
      cost_price: primary.cost_price,
      prices: priceRows,
      reorder_level: body.reorder_level != null ? Number(body.reorder_level) : 0,
      reorder_qty: body.reorder_qty != null ? Number(body.reorder_qty) : 0,
      short_description: body.short_description || null,
      status: body.status || 'active',
      primary_image_url: body.primary_image_url || null,
      specs_sheet_url: body.specs_sheet_url || null,
      specs_sheet_name: body.specs_sheet_name || null,
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
    let { data, error } = await supabase.from('products').insert(payload).select('*').single();

    // Retry without optional columns if older schema rejects them
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const minimal = {
        profile_id: companyId,
        name: payload.name,
        sku: payload.sku,
        category,
        uom: payload.uom,
        sell_price: payload.sell_price,
        short_description: payload.short_description,
        status: payload.status,
        primary_image_url: payload.primary_image_url,
      };
      const retry = await supabase.from('products').insert(minimal).select('*').single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint:
            'If category is NOT NULL without default, run: ALTER TABLE products ALTER COLUMN category SET DEFAULT \'General\'; UPDATE products SET category = \'General\' WHERE category IS NULL;',
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
      'gtin',
      'gtin14',
      'category',
      'product_type',
      'uom',
      'sell_price',
      'cost_price',
      'base_currency',
      'reorder_level',
      'reorder_qty',
      'short_description',
      'status',
      'primary_image_url',
      'specs_sheet_url',
      'specs_sheet_name',
      'upstream_specs_sheet_url',
      'upstream_specs_sheet_name',
      'source_profile_id',
      'source_product_id',
      'source_agreement_id',
      'source_agreement_line_id',
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

    if (Array.isArray(body.prices) || body.currency || body.base_currency) {
      const priceRows = normalizeProductPrices(
        Array.isArray(body.prices)
          ? body.prices
          : [
              {
                currency: body.base_currency || body.currency || 'ZAR',
                cost_price: body.cost_price,
                sell_price: body.sell_price,
              },
            ]
      );
      updates.prices = priceRows;
      updates.base_currency = priceRows[0].currency;
      updates.sell_price = priceRows[0].sell_price;
      updates.cost_price = priceRows[0].cost_price;
    }

    if (body.category !== undefined) {
      updates.category = String(body.category || '').trim() || 'General';
    }

    if (body.anchor === true) {
      updates.onchain_status = 'anchored';
      updates.onchain_anchored_at = new Date().toISOString();
      if (body.onchain_tx_hash) updates.onchain_tx_hash = body.onchain_tx_hash;
    }

    const supabase = getSupabaseServer();
    let { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();

    if (error && /prices|base_currency|column/i.test(error.message)) {
      const soft = { ...updates };
      delete soft.prices;
      delete soft.base_currency;
      const retry = await supabase
        .from('products')
        .update(soft)
        .eq('id', Number(body.id))
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

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
