import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const productId = request.nextUrl.searchParams.get('productId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let q = supabase
      .from('inventory_lots')
      .select('*')
      .eq('profile_id', companyId)
      .order('expiry_date', { ascending: true, nullsFirst: false });
    if (productId) q = q.eq('product_id', Number(productId));
    const { data, error } = await q.limit(500);
    if (error) {
      return NextResponse.json({
        success: true,
        lots: [],
        warning: error.message,
        hint: 'Run 20260709_inventory_pedigree_edi.sql',
      });
    }

    // Serial numbers (full fields for UI pedigree list)
    const { data: serials } = await supabase
      .from('inventory_serials')
      .select('id, product_id, serial_number, lot_id, lot_number, status, warehouse_id, container_id, created_at')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500);

    const productIds = [
      ...new Set(
        [...(data || []).map((l) => l.product_id), ...(serials || []).map((s) => s.product_id)].filter(
          Boolean
        )
      ),
    ];
    let pMap: Record<number, { name: string; sku?: string | null }> = {};
    if (productIds.length) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);
      for (const p of products || []) pMap[p.id] = { name: p.name, sku: p.sku };
    }

    const lots = (data || []).map((l) => ({
      ...l,
      product_name: l.product_id ? pMap[l.product_id]?.name : null,
      product_sku: l.product_id ? pMap[l.product_id]?.sku : null,
    }));

    const serialRows = (serials || []).map((s) => ({
      ...s,
      product_name: s.product_id ? pMap[s.product_id]?.name : null,
    }));

    return NextResponse.json({
      success: true,
      lots,
      serials: serialRows,
      expiringSoon: lots.filter((l) => {
        if (!l.expiry_date) return false;
        const d = new Date(l.expiry_date).getTime();
        const days = (d - Date.now()) / 86400000;
        return days >= 0 && days <= 30;
      }),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.lot_number || !body.product_id) {
      return NextResponse.json(
        { error: 'companyId, product_id, lot_number required' },
        { status: 400 }
      );
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('inventory_lots')
      .insert({
        profile_id: companyId,
        product_id: Number(body.product_id),
        lot_number: String(body.lot_number).trim(),
        expiry_date: body.expiry_date || null,
        best_before: body.best_before || null,
        manufactured_date: body.manufactured_date || null,
        qty_on_hand: Number(body.qty_on_hand || 0),
        warehouse_id: body.warehouse_id || null,
        container_id: body.container_id || null,
        supplier_ref: body.supplier_ref || null,
        notes: body.notes || null,
        gtin14: body.gtin14 || null,
        status: 'active',
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (Array.isArray(body.serials) && body.serials.length) {
      for (const sn of body.serials) {
        await supabase.from('inventory_serials').insert({
          profile_id: companyId,
          product_id: Number(body.product_id),
          serial_number: String(sn),
          lot_id: data.id,
          lot_number: data.lot_number,
          status: 'in_stock',
          warehouse_id: body.warehouse_id || null,
          container_id: body.container_id || null,
        });
      }
    }

    return NextResponse.json({ success: true, lot: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
