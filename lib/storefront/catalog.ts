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
import {
  applyStorefrontCatalog,
  DEFAULT_STOREFRONT_CATALOG,
  gymStorefrontItemId,
  storefrontCatalogFromProfileMetadata,
  type StorefrontCatalogPick,
} from './catalog-pick';
import { normaliseStoreSlug } from './public-store';
import {
  invalidateStoreSlugCache,
  readStoreSlugCache,
  writeStoreSlugCache,
} from './slug-cache';

const EXACT_PROFILE_COLUMNS =
  'id, trading_name, legal_name, logo_url, short_description, description, verification_status, city, country, metadata, is_discoverable';
const FALLBACK_PROFILE_COLUMNS =
  'id, trading_name, legal_name, logo_url, short_description, description, verification_status, city, country, metadata';

type StoreLookupDb = {
  from: (table: string) => {
    select: (columns: string) => unknown;
  };
};

function supabaseClient(preferAdmin = false) {
  try {
    return preferAdmin ? getSupabaseAdmin() : getSupabaseServer();
  } catch {
    return getSupabaseServer();
  }
}

function quotePostgrest(value: string): string {
  return `"${value.replace(/"/g, '')}"`;
}

function bigFiveNameOr(): string {
  return BIG_FIVE_FOODS_TRADING_NAMES.map(
    (name) => `trading_name.ilike.${quotePostgrest(name)}`
  ).join(',');
}

function virtualBigFiveCompany(): StoreCompany {
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

async function lookupStoreSlug(
  supabase: StoreLookupDb,
  values: string[]
): Promise<{ row: Record<string, unknown> | null; failed: boolean }> {
  try {
    const selected = supabase.from('profiles').select(EXACT_PROFILE_COLUMNS) as {
      filter: (col: string, op: string, value: string) => {
        limit: (n: number) => Promise<{
          data?: Record<string, unknown>[] | null;
          error?: { message?: string } | null;
        }>;
      };
    };
    const filtered =
      values.length === 1
        ? selected.filter('metadata->>store_slug', 'eq', values[0])
        : selected.filter(
            'metadata->>store_slug',
            'in',
            `(${values.map(quotePostgrest).join(',')})`
          );
    const { data, error } = await filtered.limit(1);
    if (error) return { row: null, failed: true };
    return { row: (data || [])[0] || null, failed: false };
  } catch {
    return { row: null, failed: true };
  }
}

async function fallbackStoreCompany(
  supabase: StoreLookupDb,
  key: string
): Promise<{ company: StoreCompany | null; failed: boolean }> {
  if (key === BIG_FIVE_FOODS_SLUG) {
    try {
      const query = supabase.from('profiles').select(FALLBACK_PROFILE_COLUMNS) as {
        or: (expr: string) => {
          limit: (n: number) => Promise<{
            data?: Record<string, unknown>[] | null;
            error?: { message?: string } | null;
          }>;
        };
      };
      const { data, error } = await query.or(bigFiveNameOr()).limit(1);
      if (error) return { company: null, failed: true };
      const hit = (data || [])[0];
      if (hit && storedSlugMatches(hit, key)) {
        return { company: mapCompany(hit, BIG_FIVE_FOODS_SLUG), failed: false };
      }
      return { company: virtualBigFiveCompany(), failed: false };
    } catch {
      return { company: null, failed: true };
    }
  }

  try {
    const query = supabase.from('profiles').select(FALLBACK_PROFILE_COLUMNS) as {
      not: (col: string, op: string, value: null) => {
        order: (
          col: string,
          opts: { ascending: boolean }
        ) => {
          limit: (n: number) => Promise<{
            data?: Record<string, unknown>[] | null;
            error?: { message?: string } | null;
          }>;
        };
      };
    };
    const { data, error } = await query
      .not('trading_name', 'is', null)
      .order('id', { ascending: false })
      .limit(400);
    if (error) return { company: null, failed: true };
    for (const candidate of data || []) {
      const name = String(candidate.trading_name || candidate.legal_name || '');
      if (slugifyCompanyName(name) === key && storedSlugMatches(candidate, key)) {
        return { company: mapCompany(candidate, key), failed: false };
      }
    }
    return { company: null, failed: false };
  } catch {
    return { company: null, failed: true };
  }
}

function storedSlugMatches(row: Record<string, unknown>, key: string): boolean {
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const stored = normaliseStoreSlug(String(meta.store_slug || ''));
  if (stored) return stored === key;
  const name = String(row.trading_name || row.legal_name || '');
  return slugifyCompanyName(name) === key;
}

function cacheableCompany(company: StoreCompany | null, key: string): boolean {
  if (!company) return true;
  return normaliseStoreSlug(company.slug) === key;
}

export async function resolveStoreCompany(
  slug: string,
  client?: StoreLookupDb
): Promise<StoreCompany | null> {
  const key = normaliseStoreSlug(slug);
  if (!key) return null;

  const cached = readStoreSlugCache(key);
  if (cached.hit) {
    if (cacheableCompany(cached.company, key)) return cached.company;
    invalidateStoreSlugCache({ slug: key });
  }

  const supabase = client || (supabaseClient(true) as StoreLookupDb);
  // Equality on the normalised slug only. Matching the caller's original
  // casing as well aliases two tenants onto this one cache key.
  const exact = await lookupStoreSlug(supabase, [key]);
  if (exact.row && storedSlugMatches(exact.row, key)) {
    const company = mapCompany(exact.row, key);
    if (cacheableCompany(company, key)) {
      writeStoreSlugCache(key, company);
      return company;
    }
  }

  const fallback = await fallbackStoreCompany(supabase, key);
  if (fallback.failed) return null;
  if (!cacheableCompany(fallback.company, key)) return null;
  writeStoreSlugCache(key, fallback.company);
  return fallback.company;
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
    storefrontCatalog: storefrontCatalogFromProfileMetadata(meta),
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
  let price = Number.isFinite(sell as number) && (sell as number) > 0 ? sell : null;
  let currency = String(row.base_currency || 'ZAR');
  if (price == null && prices[0]) {
    const p0 = prices[0] as { sell_price?: number; currency?: string };
    const n = p0.sell_price != null ? Number(p0.sell_price) : NaN;
    if (Number.isFinite(n) && n > 0) price = n;
    if (p0.currency) currency = String(p0.currency);
  }
  const priceOnRequest = price == null;

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
    price,
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
    price: p.price ?? null,
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
  const pick: StorefrontCatalogPick =
    company.storefrontCatalog || DEFAULT_STOREFRONT_CATALOG;
  let hadDbProducts = false;

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
      hadDbProducts = true;
      products = data
        .filter((p) => {
          if (p.is_sellable === false) return false;
          if (pick.mode === 'selected') return true;
          const meta = (p.metadata || {}) as Record<string, unknown>;
          if (meta.storefront_public === false) return false;
          if (meta.storefrontPublic === false) return false;
          return true;
        })
        .map((p) => mapDbProduct(p as Record<string, unknown>));
    }
  }

  // Fallback seed catalog for Big Five Foods when this company has no SKUs yet
  if (!hadDbProducts && company.slug === BIG_FIVE_FOODS_SLUG) {
    products = seedDefsAsStoreProducts();
  }

  if (company.id > 0) {
    products = await appendGymShopToStoreProducts(company, products);
  }

  products = applyStorefrontCatalog(products, pick);

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

async function appendGymShopToStoreProducts(
  company: StoreCompany,
  products: StoreProduct[]
): Promise<StoreProduct[]> {
  try {
    const { loadAdvisorModuleStore } = await import(
      '@/lib/business/company-data'
    );
    const { readFitgraphFromMetadata } = await import(
      '@/lib/fitness/fitgraph'
    );
    const { gymShopCatalog } = await import('@/lib/fitness/gym-shop');
    const loaded = await loadAdvisorModuleStore(
      company.id,
      'fitgraph',
      readFitgraphFromMetadata
    );
    const items = gymShopCatalog(loaded.store);
    if (!items.length) return products;
    const token = String(loaded.store.settings?.public_token || '').trim();
    const shopHref = token
      ? `/pwa/fitgraph/${encodeURIComponent(token)}`
      : null;
    const skus = new Set(
      products
        .map((p) => String(p.sku || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const names = new Set(products.map((p) => p.name.trim().toLowerCase()));
    const extra: StoreProduct[] = [];
    for (const item of items) {
      const sku = String(item.code || '').trim().toLowerCase();
      if (sku && skus.has(sku)) continue;
      if (names.has(item.name.trim().toLowerCase())) continue;
      extra.push({
        id: gymStorefrontItemId(item.kind, item.id),
        sku: item.code || null,
        name: item.name,
        shortName: item.name,
        description: item.description || null,
        packSize: item.billing || null,
        pack: item.billing || null,
        uom: item.billing || 'month',
        imageUrl: item.image_url || null,
        images: item.image_url ? [item.image_url] : [],
        badges: ['Fitness'],
        channels: ['retail'],
        channelFlags: ['retail'],
        channel: 'retail',
        price: item.price_zar,
        currency: 'ZAR',
        priceOnRequest: false,
        inStock: true,
        externalRef: gymStorefrontItemId(item.kind, item.id),
        quoteFirst: false,
        active: true,
        category:
          item.kind === 'programme' ? 'Programmes' : 'Fitness services',
        ctaHref: shopHref,
        ctaLabel: 'Buy in the gym app',
      });
    }
    return extra.length ? [...extra, ...products] : products;
  } catch {
    return products;
  }
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

export async function persistStorefrontCatalog(
  supabase: { from: (table: string) => any },
  companyId: number,
  pick: StorefrontCatalogPick
): Promise<string | null> {
  const loaded = await supabase
    .from('profiles')
    .select('id, metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (loaded?.error) return String(loaded.error.message || 'load failed');
  if (!loaded?.data) return 'Company not found';
  const raw = loaded.data.metadata;
  const prev =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  prev.storefront_catalog = pick;
  const saved = await supabase
    .from('profiles')
    .update({
      metadata: prev,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (saved?.error) return String(saved.error.message || 'save failed');
  invalidateStoreSlugCache({ companyId });
  return null;
}

/** Ensure Big Five Foods profile has store_slug + seed products (admin). */
export async function seedBigFiveFoodsCatalog(opts?: {
  profileId?: number;
  client?: StoreLookupDb;
}): Promise<{
  profileId: number | null;
  productsUpserted: number;
  createdProfile: boolean;
  warning?: string;
}> {
  const supabase = (opts?.client as ReturnType<typeof supabaseClient> | undefined) || supabaseClient(true);
  let profileId = opts?.profileId != null ? Number(opts.profileId) : 0;
  let createdProfile = false;
  let wroteSlug = false;

  if (!profileId) {
    const company = await resolveStoreCompany(BIG_FIVE_FOODS_SLUG, opts?.client);
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
    wroteSlug = true;
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
      const { error: slugError } = await supabase
        .from('profiles')
        .update({
          metadata: meta,
          is_discoverable: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);
      if (!slugError) wroteSlug = true;
    } catch {
      /* soft */
    }
  }

  if (wroteSlug && profileId) {
    invalidateStoreSlugCache({
      slug: BIG_FIVE_FOODS_SLUG,
      companyId: profileId,
    });
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
        priceOnRequest: s.price == null,
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
