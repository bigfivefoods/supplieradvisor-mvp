/**
 * Storefront catalog resolution — public seller catalog by company slug.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { slugifyCompanyName } from '@/lib/seo/company-public';
import {
  BIG_FIVE_FOODS_SLUG,
  BIG_FIVE_FOODS_TRADING_NAMES,
  seedDefsAsStoreProducts,
  BIG_FIVE_FOODS_SEED,
} from './big-five-foods-seed';
import type { StoreChannel, StoreCompany, StoreProduct } from './types';

function supabaseClient(preferAdmin = false) {
  try {
    return preferAdmin ? getSupabaseAdmin() : getSupabaseServer();
  } catch {
    return getSupabaseServer();
  }
}

export async function resolveStoreCompany(
  slug: string
): Promise<StoreCompany | null> {
  const raw = String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!raw) return null;

  const supabase = supabaseClient(true);

  // 1) metadata.store_slug exact
  try {
    const { data: byMeta } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, logo_url, short_description, description, verification_status, city, country, metadata, is_discoverable'
      )
      .filter('metadata->>store_slug', 'eq', raw)
      .limit(5);
    const hit = (byMeta || [])[0];
    if (hit) return mapCompany(hit, raw);
  } catch {
    /* soft */
  }

  // 2) Big Five Foods known names
  if (raw === BIG_FIVE_FOODS_SLUG) {
    for (const name of BIG_FIVE_FOODS_TRADING_NAMES) {
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, logo_url, short_description, description, verification_status, city, country, metadata'
        )
        .ilike('trading_name', name)
        .limit(1)
        .maybeSingle();
      if (data) return mapCompany(data, BIG_FIVE_FOODS_SLUG);
    }
    // fuzzy
    const { data: fuzzy } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, logo_url, short_description, description, verification_status, city, country, metadata'
      )
      .ilike('trading_name', '%big five%food%')
      .limit(3);
    if (fuzzy?.[0]) return mapCompany(fuzzy[0], BIG_FIVE_FOODS_SLUG);

    // Virtual company shell so storefront still renders before profile seed
    return {
      id: 0,
      slug: BIG_FIVE_FOODS_SLUG,
      tradingName: 'Big Five Foods',
      legalName: 'Big Five Foods',
      logoUrl: null,
      shortDescription:
        'Order on the verified network — one OS for trade and proof.',
      verificationStatus: 'verified',
      city: null,
      country: 'South Africa',
      tagline: 'Order on the verified network — one OS for trade and proof',
    };
  }

  // 3) slugify trading_name match (scan recent discoverable)
  const { data: candidates } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, logo_url, short_description, description, verification_status, city, country, metadata'
    )
    .not('trading_name', 'is', null)
    .order('id', { ascending: false })
    .limit(400);

  for (const c of candidates || []) {
    const n = String(c.trading_name || c.legal_name || '');
    if (slugifyCompanyName(n) === raw) return mapCompany(c, raw);
  }

  return null;
}

function mapCompany(
  row: Record<string, unknown>,
  slug: string
): StoreCompany {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  return {
    id: Number(row.id) || 0,
    slug: String(meta.store_slug || slug),
    tradingName: String(row.trading_name || row.legal_name || 'Seller'),
    legalName: row.legal_name ? String(row.legal_name) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    shortDescription: row.short_description
      ? String(row.short_description)
      : row.description
        ? String(row.description).slice(0, 280)
        : null,
    verificationStatus: row.verification_status
      ? String(row.verification_status)
      : null,
    city: row.city ? String(row.city) : null,
    country: row.country ? String(row.country) : null,
    tagline:
      String(meta.store_tagline || '').trim() ||
      'Order on the verified network — one OS for trade and proof',
  };
}

function metaChannels(meta: Record<string, unknown>): StoreChannel[] {
  const raw = meta.channelFlags || meta.channels || meta.channel_flags;
  if (Array.isArray(raw)) {
    return raw
      .map((c) => String(c).toLowerCase())
      .filter((c): c is StoreChannel =>
        ['retail', 'wholesale', 'institutional'].includes(c)
      );
  }
  if (typeof raw === 'string' && raw) {
    return raw
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c): c is StoreChannel =>
        ['retail', 'wholesale', 'institutional'].includes(c)
      );
  }
  return ['retail', 'wholesale'];
}

function mapDbProduct(row: Record<string, unknown>): StoreProduct {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const badgesRaw = meta.badges;
  const badges = Array.isArray(badgesRaw)
    ? badgesRaw.map(String)
    : typeof badgesRaw === 'string'
      ? badgesRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  const channels = metaChannels(meta);
  const quoteFirst =
    meta.quoteFirst === true ||
    meta.quote_first === true ||
    badges.some((b) => /nsnp/i.test(b)) ||
    channels.length === 1 && channels[0] === 'institutional';
  const sell = row.sell_price != null ? Number(row.sell_price) : null;
  const prices = Array.isArray(row.prices) ? row.prices : [];
  let price = Number.isFinite(sell as number) ? sell : null;
  let currency = String(row.base_currency || 'ZAR');
  if (price == null && prices[0]) {
    const p0 = prices[0] as { sell_price?: number; currency?: string };
    if (p0.sell_price != null) price = Number(p0.sell_price);
    if (p0.currency) currency = String(p0.currency);
  }
  const priceOnRequest =
    quoteFirst || price == null || meta.priceOnRequest === true;

  const packSize =
    meta.packSize != null
      ? String(meta.packSize)
      : meta.pack_size != null
        ? String(meta.pack_size)
        : meta.pack != null
          ? String(meta.pack)
          : row.uom
            ? String(row.uom)
            : null;

  const imageUrl = row.primary_image_url ? String(row.primary_image_url) : null;
  const extraImages = Array.isArray(meta.images)
    ? meta.images.map(String).filter(Boolean)
    : [];
  const images = imageUrl
    ? [imageUrl, ...extraImages.filter((u) => u !== imageUrl)]
    : extraImages;

  const inStock =
    meta.inStock === false || meta.in_stock === false
      ? false
      : meta.madeToOrder === true || meta.made_to_order === true
        ? false
        : true;

  const externalRef = meta.externalRef
    ? String(meta.externalRef)
    : meta.external_ref
      ? String(meta.external_ref)
      : null;

  const shortName = meta.shortName
    ? String(meta.shortName)
    : meta.short_name
      ? String(meta.short_name)
      : String(row.name || 'Product').split('—')[0].trim();

  return {
    id: externalRef || Number(row.id),
    sku: row.sku ? String(row.sku) : null,
    name: String(row.name || 'Product'),
    shortName,
    description: row.short_description
      ? String(row.short_description)
      : null,
    packSize,
    pack: packSize,
    uom: row.uom ? String(row.uom) : null,
    imageUrl,
    images,
    badges,
    channels,
    channelFlags: channels,
    channel: channels[0] || null,
    price: priceOnRequest ? null : price,
    currency,
    priceOnRequest,
    inStock,
    externalRef,
    quoteFirst,
    active: String(row.status || 'active').toLowerCase() === 'active',
    category: row.category ? String(row.category) : null,
  };
}

/** Public API product shape for marketing site proxy */
export function toPublicCatalogProduct(p: StoreProduct) {
  return {
    id: p.externalRef || p.sku || String(p.id),
    sku: p.sku,
    externalRef: p.externalRef || p.sku || String(p.id),
    name: p.name,
    shortName: p.shortName || p.name,
    description: p.description,
    pack: p.pack || p.packSize,
    packSize: p.packSize,
    images: p.images?.length
      ? p.images
      : p.imageUrl
        ? [p.imageUrl]
        : [],
    imageUrl: p.imageUrl,
    badges: p.badges,
    channel: p.channel || p.channels[0] || null,
    channelFlags: p.channelFlags || p.channels,
    quoteFirst: p.quoteFirst,
    inStock: p.inStock !== false,
    priceOnRequest: p.priceOnRequest,
    price: p.priceOnRequest ? null : p.price,
    currency: p.currency,
    active: p.active,
    category: p.category,
  };
}

export async function listStoreProducts(
  company: StoreCompany,
  opts?: { channel?: string | null; q?: string | null }
): Promise<StoreProduct[]> {
  let products: StoreProduct[] = [];

  if (company.id > 0) {
    const supabase = supabaseClient(true);
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, name, sku, category, uom, short_description, status, primary_image_url, sell_price, base_currency, prices, is_sellable, metadata'
      )
      .eq('profile_id', company.id)
      .eq('status', 'active')
      .limit(500);

    if (!error && data?.length) {
      products = data
        .filter((p) => {
          if (p.is_sellable === false) return false;
          const meta = (p.metadata || {}) as Record<string, unknown>;
          if (meta.storefront_public === false) return false;
          if (meta.storefrontPublic === false) return false;
          return true;
        })
        .map((p) => mapDbProduct(p as Record<string, unknown>));
    }
  }

  // Fallback seed catalog for Big Five Foods when DB empty
  if (
    products.length === 0 &&
    company.slug === BIG_FIVE_FOODS_SLUG
  ) {
    products = seedDefsAsStoreProducts();
  }

  if (opts?.channel) {
    const ch = String(opts.channel).toLowerCase();
    products = products.filter(
      (p) => p.channels.includes(ch as StoreChannel) || p.channels.length === 0
    );
  }

  if (opts?.q) {
    const q = opts.q.toLowerCase();
    products = products.filter((p) => {
      const hay = [p.name, p.sku, p.externalRef, p.category, p.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return products;
}

export async function getStoreProduct(
  company: StoreCompany,
  productKey: string
): Promise<StoreProduct | null> {
  const key = String(productKey || '')
    .trim()
    .toLowerCase();
  if (!key) return null;

  const all = await listStoreProducts(company);
  const hit = all.find((p) => {
    const idMatch = String(p.id).toLowerCase() === key;
    const skuMatch = (p.sku || '').toLowerCase() === key;
    const extMatch = (p.externalRef || '').toLowerCase() === key;
    const slugName =
      slugifyCompanyName(p.name) === key ||
      slugifyCompanyName(p.name).includes(key);
    return idMatch || skuMatch || extMatch || slugName;
  });
  return hit || null;
}

/** Ensure Big Five Foods profile has store_slug + seed products (admin). */
export async function seedBigFiveFoodsCatalog(opts?: {
  profileId?: number;
}): Promise<{
  profileId: number | null;
  productsUpserted: number;
  createdProfile: boolean;
  warning?: string;
}> {
  const supabase = supabaseClient(true);
  let profileId = opts?.profileId != null ? Number(opts.profileId) : 0;
  let createdProfile = false;

  if (!profileId) {
    const company = await resolveStoreCompany(BIG_FIVE_FOODS_SLUG);
    profileId = company?.id || 0;
  }

  if (!profileId) {
    // Create minimal profile for Foods if missing (service role)
    const now = new Date().toISOString();
    const { data: created, error } = await supabase
      .from('profiles')
      .insert({
        trading_name: 'Big Five Foods',
        legal_name: 'Big Five Foods',
        verification_status: 'verified',
        is_discoverable: true,
        country: 'South Africa',
        short_description:
          'Order on the verified network — one OS for trade and proof.',
        metadata: {
          store_slug: BIG_FIVE_FOODS_SLUG,
          store_tagline:
            'Order on the verified network — one OS for trade and proof',
        },
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error || !created) {
      return {
        profileId: null,
        productsUpserted: 0,
        createdProfile: false,
        warning: error?.message || 'Could not create Big Five Foods profile',
      };
    }
    profileId = Number(created.id);
    createdProfile = true;
  } else {
    // Patch store_slug on existing
    try {
      const { data: row } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', profileId)
        .maybeSingle();
      const meta = {
        ...((row?.metadata || {}) as object),
        store_slug: BIG_FIVE_FOODS_SLUG,
        store_tagline:
          'Order on the verified network — one OS for trade and proof',
      };
      await supabase
        .from('profiles')
        .update({
          metadata: meta,
          is_discoverable: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);
    } catch {
      /* soft */
    }
  }

  let productsUpserted = 0;
  for (const s of BIG_FIVE_FOODS_SEED) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('profile_id', profileId)
      .eq('sku', s.sku)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      profile_id: profileId,
      name: s.name,
      sku: s.sku,
      category: s.category,
      uom: 'unit',
      short_description: s.description,
      status: 'active',
      is_sellable: true,
      is_purchasable: false,
      sell_price: s.price,
      base_currency: 'ZAR',
      primary_image_url: s.imageUrl || null,
      metadata: {
        externalRef: s.externalRef,
        external_ref: s.externalRef,
        shortName: s.name.split('—')[0].trim(),
        packSize: s.packSize,
        pack_size: s.packSize,
        pack: s.packSize,
        badges: s.badges || [],
        channelFlags: s.channels,
        channels: s.channels,
        quoteFirst: Boolean(s.quoteFirst),
        priceOnRequest: s.price == null || Boolean(s.quoteFirst),
        inStock: !s.quoteFirst,
        madeToOrder: Boolean(s.quoteFirst),
        storefront_public: true,
      },
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', existing.id);
      if (!error) productsUpserted += 1;
    } else {
      const { error } = await supabase.from('products').insert({
        ...payload,
        created_at: new Date().toISOString(),
      });
      if (!error) productsUpserted += 1;
    }
  }

  return { profileId, productsUpserted, createdProfile };
}
