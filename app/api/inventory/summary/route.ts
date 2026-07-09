import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/** GET ?companyId= — inventory command-center summary */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const [products, warehouses, levels, movements, containerInv] = await Promise.all([
      supabase
        .from('products')
        .select('id, status, onchain_status, product_type')
        .eq('profile_id', companyId),
      supabase.from('warehouses').select('id, status').eq('profile_id', companyId),
      supabase
        .from('stock_levels')
        .select('id, qty_on_hand, reorder_level, product_id')
        .eq('profile_id', companyId),
      supabase
        .from('stock_movements')
        .select('id, movement_type, quantity, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('container_inventory')
        .select('id, qty_on_hand, reorder_level')
        .eq('profile_id', companyId),
    ]);

    const prods = products.data || [];
    const wh = warehouses.data || [];
    const lv = levels.data || [];
    const cin = containerInv.data || [];

    const units = lv.reduce((s, i) => s + Number(i.qty_on_hand || 0), 0);
    const cUnits = cin.reduce((s, i) => s + Number(i.qty_on_hand || 0), 0);
    const low = lv.filter((i) => Number(i.qty_on_hand) <= Number(i.reorder_level || 0)).length;
    const cLow = cin.filter((i) => Number(i.qty_on_hand) <= Number(i.reorder_level || 0)).length;
    const onchain = prods.filter((p) =>
      ['hashed', 'anchored', 'minted'].includes(String(p.onchain_status || ''))
    ).length;

    return NextResponse.json({
      success: true,
      summary: {
        products: prods.length,
        productsActive: prods.filter((p) => p.status === 'active').length,
        warehouses: wh.length,
        stockLines: lv.length,
        unitsOnHand: units,
        containerUnits: cUnits,
        lowStock: low + cLow,
        onchainReady: onchain,
        rawMaterials: prods.filter((p) => p.product_type === 'raw_material').length,
        finishedGoods: prods.filter((p) => p.product_type === 'finished_good').length,
      },
      recentMovements: movements.data || [],
      warnings: [products.error, warehouses.error, levels.error]
        .filter(Boolean)
        .map((e) => (e as { message: string }).message),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
