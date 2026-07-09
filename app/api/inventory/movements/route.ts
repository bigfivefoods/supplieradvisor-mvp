import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/** GET recent stock movements for company */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const type = request.nextUrl.searchParams.get('type');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let q = supabase
      .from('stock_movements')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (type) q = q.eq('movement_type', type);
    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ success: true, movements: [], warning: error.message });
    }

    const productIds = [...new Set((data || []).map((m) => m.product_id).filter(Boolean))];
    const whIds = [
      ...new Set(
        (data || [])
          .flatMap((m) => [m.warehouse_id, m.from_warehouse_id, m.to_warehouse_id])
          .filter(Boolean)
      ),
    ];

    let pMap: Record<number, { name: string; sku?: string }> = {};
    let wMap: Record<number, { name: string; code?: string | null }> = {};

    if (productIds.length) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);
      for (const p of products || []) pMap[p.id] = { name: p.name, sku: p.sku };
    }
    if (whIds.length) {
      const { data: warehouses } = await supabase
        .from('warehouses')
        .select('id, name, code')
        .in('id', whIds);
      for (const w of warehouses || []) wMap[w.id] = { name: w.name, code: w.code };
    }

    const movements = (data || []).map((m) => ({
      ...m,
      product_name: m.product_id ? pMap[m.product_id]?.name : null,
      product_sku: m.product_id ? pMap[m.product_id]?.sku : null,
      warehouse_name: m.warehouse_id ? wMap[m.warehouse_id]?.name : null,
      from_warehouse_name: m.from_warehouse_id ? wMap[m.from_warehouse_id]?.name : null,
      to_warehouse_name: m.to_warehouse_id ? wMap[m.to_warehouse_id]?.name : null,
    }));

    return NextResponse.json({ success: true, movements });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
