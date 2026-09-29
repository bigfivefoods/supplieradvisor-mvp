import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { publicStorePath, publicStoreSlug } from '@/lib/storefront/public-store';
import {
  gymStorefrontItemId,
  parseStorefrontCatalog,
  serializeStorefrontCatalog,
  storefrontCatalogFromProfileMetadata,
  type StorefrontCatalogPick,
  type StorefrontPickerItem,
} from '@/lib/storefront/catalog-pick';
import {
  BIG_FIVE_FOODS_SEED,
  BIG_FIVE_FOODS_SLUG,
} from '@/lib/storefront/big-five-foods-seed';

/**
 * GET ?companyId= — catalogue picker rows + current storefront allowlist.
 * Never select profiles.phone.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name, metadata')
      .eq('id', companyId)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const catalog = storefrontCatalogFromProfileMetadata(profile.metadata);
    const slug = publicStoreSlug({
      tradingName: profile.trading_name,
      legalName: profile.legal_name,
      metadata: profile.metadata,
    });
    const storePath = publicStorePath({
      tradingName: profile.trading_name,
      legalName: profile.legal_name,
      metadata: profile.metadata,
    });

    const { data: rows, error: prodErr } = await supabase
      .from('products')
      .select(
        'id, name, sku, category, status, is_sellable, primary_image_url, metadata'
      )
      .eq('profile_id', companyId)
      .order('name')
      .limit(500);

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    const items: StorefrontPickerItem[] = [];
    for (const p of rows || []) {
      const meta = (p.metadata || {}) as Record<string, unknown>;
      const seedKey = String(
        meta.externalRef || meta.external_ref || p.sku || ''
      )
        .trim()
        .toLowerCase();
      items.push({
        key: `product:${p.id}`,
        kind: 'product',
        id: Number(p.id),
        name: String(p.name || 'Product'),
        sku: p.sku ? String(p.sku) : null,
        category: p.category ? String(p.category) : null,
        image_url: p.primary_image_url ? String(p.primary_image_url) : null,
        status: String(p.status || 'active'),
        is_sellable: p.is_sellable !== false,
        seed_key: seedKey || null,
      });
    }

    if (!items.length && slug === BIG_FIVE_FOODS_SLUG) {
      for (const s of BIG_FIVE_FOODS_SEED) {
        items.push({
          key: `seed:${s.externalRef}`,
          kind: 'seed',
          id: s.externalRef,
          name: s.name,
          sku: s.sku,
          category: s.category,
          image_url: s.imageUrl || null,
          status: 'active',
          is_sellable: true,
          seed_key: s.externalRef,
        });
      }
    }

    const gymItems = await loadGymPickerItems(companyId);
    items.push(...gymItems);

    return NextResponse.json({
      success: true,
      catalog,
      store_slug: slug,
      store_path: storePath,
      products: items,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH { companyId, mode, product_ids, seed_keys, gym_item_ids }
 * Merges profiles.metadata.storefront_catalog. Never select profiles.phone.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const pick: StorefrontCatalogPick = serializeStorefrontCatalog(
      parseStorefrontCatalog({
        mode: body.mode,
        product_ids: body.product_ids ?? body.productIds,
        seed_keys: body.seed_keys ?? body.seedKeys,
        gym_item_ids: body.gym_item_ids ?? body.gymItemIds,
      })
    );

    const supabase = getSupabaseServer();
    const { data: row, error: loadErr } = await supabase
      .from('profiles')
      .select('id, metadata')
      .eq('id', companyId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const prev =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    prev.storefront_catalog = pick;

    const { error: saveErr } = await supabase
      .from('profiles')
      .update({
        metadata: prev,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, catalog: pick });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function loadGymPickerItems(
  companyId: number
): Promise<StorefrontPickerItem[]> {
  try {
    const { loadAdvisorModuleStore } = await import('@/lib/business/company-data');
    const { readFitgraphFromMetadata } = await import('@/lib/fitness/fitgraph');
    const { gymShopCatalog } = await import('@/lib/fitness/gym-shop');
    const loaded = await loadAdvisorModuleStore(
      companyId,
      'fitgraph',
      readFitgraphFromMetadata
    );
    const shop = gymShopCatalog(loaded.store);
    return shop.map((item) => {
      const gid = gymStorefrontItemId(item.kind, item.id);
      return {
        key: `gym:${gid}`,
        kind: 'gym' as const,
        id: gid,
        name: item.name,
        sku: item.code || null,
        category:
          item.kind === 'programme' ? 'Programmes' : 'Fitness services',
        image_url: item.image_url || null,
        status: 'active',
        is_sellable: true,
        seed_key: gid,
      };
    });
  } catch {
    return [];
  }
}
