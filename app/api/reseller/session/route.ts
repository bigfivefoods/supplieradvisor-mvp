import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST { privyUserId, email? } — resolve reseller portal session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: body.privyUserId,
    });
    if (!auth.ok) return auth.response;

    const userId = getCanonicalUserId(auth.userId || body.privyUserId);
    const email = body.email ? String(body.email).toLowerCase().trim() : null;
    if (!userId) {
      return NextResponse.json({ error: 'privyUserId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const variants = userIdMatchVariants(userId);

    let { data: byUser } = await supabase
      .from('container_resellers')
      .select('*')
      .in('user_id', variants);

    let resellers = (byUser || []).filter(
      (r) =>
        r.portal_status === 'active' ||
        r.contract_accepted_at ||
        (r.user_id && r.status === 'active' && r.portal_status !== 'suspended')
    );

    if ((!resellers || resellers.length === 0) && email) {
      const { data: byEmail } = await supabase
        .from('container_resellers')
        .select('*')
        .eq('email', email)
        .neq('portal_status', 'suspended');
      resellers = byEmail || [];
      for (const row of resellers) {
        if (!row.user_id || !variants.includes(String(row.user_id))) {
          await supabase
            .from('container_resellers')
            .update({
              user_id: userId,
              portal_status: 'active',
              contract_accepted_at:
                row.contract_accepted_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          row.user_id = userId;
          row.portal_status = 'active';
        }
      }
    }

    if (!resellers.length) {
      return NextResponse.json({
        success: true,
        isReseller: false,
        resellers: [],
        inventory: [],
        sales: [],
      });
    }

    const ids = resellers.map((r) => r.id);
    const profileId = Number(resellers[0].profile_id);

    const [
      { data: inventory },
      { data: sales },
      { data: containers },
      productsRes,
    ] = await Promise.all([
      supabase
        .from('reseller_inventory')
        .select('*')
        .in('reseller_id', ids)
        .order('product_name'),
      supabase
        .from('reseller_sales')
        .select('*')
        .in('reseller_id', ids)
        .order('sale_date', { ascending: false })
        .limit(50),
      supabase
        .from('containers')
        .select('id, name, container_code, city')
        .eq('profile_id', profileId),
      supabase
        .from('products')
        .select('id, name, sku, primary_image_url, status, sell_price')
        .eq('profile_id', profileId)
        .order('name')
        .limit(300),
    ]);

    type ProductRow = {
      id: number;
      name?: string | null;
      sku?: string | null;
      primary_image_url?: string | null;
      status?: string | null;
    };
    let products: ProductRow[] = [];
    if (!productsRes.error && productsRes.data) {
      products = productsRes.data as ProductRow[];
    }

    // Map product_id → image / canonical name for inventory lines
    const productById = new Map<
      number,
      { name: string; sku: string | null; primary_image_url: string | null }
    >();
    for (const p of products) {
      const id = Number(p.id);
      if (!Number.isFinite(id)) continue;
      productById.set(id, {
        name: String(p.name || ''),
        sku: p.sku ? String(p.sku) : null,
        primary_image_url: p.primary_image_url
          ? String(p.primary_image_url)
          : null,
      });
    }

    // Also resolve images for inventory product_ids not already in products query (edge)
    const invProductIds = [
      ...new Set(
        (inventory || [])
          .map((i) => Number(i.product_id))
          .filter((n) => Number.isFinite(n) && n > 0 && !productById.has(n))
      ),
    ];
    if (invProductIds.length) {
      const { data: extra, error: extraErr } = await supabase
        .from('products')
        .select('id, name, sku, primary_image_url')
        .in('id', invProductIds);
      if (!extraErr) {
        for (const p of extra || []) {
          productById.set(Number(p.id), {
            name: String(p.name || ''),
            sku: p.sku ? String(p.sku) : null,
            primary_image_url: p.primary_image_url
              ? String(p.primary_image_url)
              : null,
          });
        }
      }
    }

    const inventoryEnriched = (inventory || []).map((row) => {
      const pid = row.product_id != null ? Number(row.product_id) : null;
      const prod = pid != null ? productById.get(pid) : null;
      return {
        ...row,
        primary_image_url: prod?.primary_image_url ?? null,
        product_name: row.product_name || prod?.name || 'Product',
        sku: row.sku || prod?.sku || null,
      };
    });

    // Catalogue for feedback picker: stock lines first, then company products not on hand
    const seenKeys = new Set<string>();
    const productOptions: Array<{
      key: string;
      inventory_id: number | null;
      product_id: number | null;
      product_name: string;
      sku: string | null;
      primary_image_url: string | null;
      qty_on_hand: number | null;
      source: 'stock' | 'catalogue';
    }> = [];

    for (const row of inventoryEnriched) {
      const pid = row.product_id != null ? Number(row.product_id) : null;
      const key = pid
        ? `p:${pid}`
        : `i:${row.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      productOptions.push({
        key,
        inventory_id: Number(row.id),
        product_id: pid,
        product_name: String(row.product_name || 'Product'),
        sku: row.sku ? String(row.sku) : null,
        primary_image_url: row.primary_image_url ?? null,
        qty_on_hand: Number(row.qty_on_hand || 0),
        source: 'stock',
      });
    }

    for (const p of products) {
      const status = String(p.status || '').toLowerCase();
      if (
        status === 'archived' ||
        status === 'inactive' ||
        status === 'deleted'
      ) {
        continue;
      }
      const pid = Number(p.id);
      const key = `p:${pid}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      productOptions.push({
        key,
        inventory_id: null,
        product_id: pid,
        product_name: String(p.name || 'Product'),
        sku: p.sku ? String(p.sku) : null,
        primary_image_url: p.primary_image_url
          ? String(p.primary_image_url)
          : null,
        qty_on_hand: null,
        source: 'catalogue',
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .eq('id', profileId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      isReseller: true,
      companyName:
        profile?.trading_name || profile?.legal_name || 'Container network',
      resellers,
      inventory: inventoryEnriched,
      productOptions,
      sales: sales || [],
      containers: containers || [],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
