/**
 * Resolve and load the DBE/agency-owned NSNP approved catalogue.
 *
 * Inheritance model (live pull-through):
 * - DBE/PEU owns products with agency_profile_id = their company id
 * - Schools & SPs with an active association always read THAT list
 * - When the department edits the catalogue, all associates see it next load
 * - National rows (agency_profile_id IS NULL) are a template only until cloned
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  NSNP_SEED_BRANDS,
  NSNP_SEED_PRODUCTS,
} from '@/lib/schools/nsnp-seed-products';
import { defaultMealFlagsFromCategory } from '@/lib/schools/meal-guide';
import { nsnpCacheGet, nsnpCacheSet, NSNP_TTL } from '@/lib/schools/nsnp-cache';

export type CatalogueContext = {
  /** Company id of owning agency (DBE), or null for national fallback */
  agencyProfileId: number | null;
  agencyName: string | null;
  agencyType: string | null;
  source: 'agency' | 'national' | 'none';
  canEdit: boolean;
  schoolProfileId?: number | null;
  /** True when viewer is SP reading department catalogue */
  isIsp?: boolean;
};

export async function getAgencyRegistration(
  supabase: SupabaseClient,
  companyId: number
): Promise<Record<string, unknown> | null> {
  const ck = `nsnp:agency:${companyId}`;
  const hit = nsnpCacheGet<{ v: Record<string, unknown> | null }>(ck);
  if (hit) return hit.v;
  const { data } = await supabase
    .from('nsnp_agency_profiles')
    .select(
      'id, profile_id, agency_name, agency_type, province, district, status, contact_email'
    )
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .maybeSingle();
  const row = (data as Record<string, unknown>) || null;
  nsnpCacheSet(ck, { v: row }, NSNP_TTL.agency);
  return row;
}

/**
 * For a school company: primary active agency link wins.
 * For an SP: first active nsnp_isp_agency_links agency.
 * For an agency company: themselves.
 * Else national template (not yet associated).
 */
export async function resolveCatalogueContext(
  supabase: SupabaseClient,
  companyId: number,
  opts?: { schoolProfileId?: number | null }
): Promise<CatalogueContext> {
  if (!opts?.schoolProfileId) {
    const ck = `nsnp:ctx:${companyId}`;
    const hit = nsnpCacheGet<CatalogueContext>(ck);
    if (hit) return hit;
    const resolved = await resolveCatalogueContextUncached(
      supabase,
      companyId,
      opts
    );
    return nsnpCacheSet(ck, resolved, NSNP_TTL.ctx);
  }
  return resolveCatalogueContextUncached(supabase, companyId, opts);
}

async function resolveCatalogueContextUncached(
  supabase: SupabaseClient,
  companyId: number,
  opts?: { schoolProfileId?: number | null }
): Promise<CatalogueContext> {
  // Am I an agency?
  const myAgency = await getAgencyRegistration(supabase, companyId);
  if (myAgency) {
    return {
      agencyProfileId: companyId,
      agencyName: String(myAgency.agency_name || 'Agency'),
      agencyType: myAgency.agency_type != null ? String(myAgency.agency_type) : null,
      source: 'agency',
      canEdit: true,
      schoolProfileId: null,
    };
  }

  // SP path — catalogue of the department they supply under
  const { data: ispRow } = await supabase
    .from('nsnp_isp_profiles')
    .select('profile_id')
    .eq('profile_id', companyId)
    .maybeSingle();
  if (ispRow) {
    const { data: ispLinks } = await supabase
      .from('nsnp_isp_agency_links')
      .select('agency_profile_id, status, accepted_at')
      .eq('isp_profile_id', companyId)
      .eq('status', 'active')
      .order('accepted_at', { ascending: false })
      .limit(1);
    const al = ispLinks?.[0];
    if (al?.agency_profile_id) {
      const aid = Number(al.agency_profile_id);
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('agency_name, agency_type')
        .eq('profile_id', aid)
        .maybeSingle();
      return {
        agencyProfileId: aid,
        agencyName: ag?.agency_name ? String(ag.agency_name) : 'DBE',
        agencyType: ag?.agency_type != null ? String(ag.agency_type) : null,
        source: 'agency',
        canEdit: false,
        schoolProfileId: null,
        isIsp: true,
      };
    }
  }

  // School path
  let schoolId = opts?.schoolProfileId ?? null;
  if (!schoolId) {
    const { data: school } = await supabase
      .from('school_profiles')
      .select('id, primary_agency_profile_id')
      .eq('profile_id', companyId)
      .maybeSingle();
    if (school) {
      schoolId = Number(school.id);
      // Prefer explicit primary if still linked active
      const primary = school.primary_agency_profile_id
        ? Number(school.primary_agency_profile_id)
        : null;
      if (primary) {
        const { data: link } = await supabase
          .from('school_agency_links')
          .select('status')
          .eq('school_profile_id', schoolId)
          .eq('agency_profile_id', primary)
          .eq('status', 'active')
          .maybeSingle();
        if (link) {
          const { data: ag } = await supabase
            .from('nsnp_agency_profiles')
            .select('agency_name, agency_type')
            .eq('profile_id', primary)
            .maybeSingle();
          return {
            agencyProfileId: primary,
            agencyName: ag?.agency_name ? String(ag.agency_name) : 'DBE',
            agencyType: ag?.agency_type != null ? String(ag.agency_type) : null,
            source: 'agency',
            canEdit: false,
            schoolProfileId: schoolId,
          };
        }
      }
    }
  }

  if (schoolId) {
    const { data: links } = await supabase
      .from('school_agency_links')
      .select('agency_profile_id, status, created_at')
      .eq('school_profile_id', schoolId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1);
    const link = links?.[0];
    if (link?.agency_profile_id) {
      const aid = Number(link.agency_profile_id);
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('agency_name, agency_type')
        .eq('profile_id', aid)
        .maybeSingle();
      return {
        agencyProfileId: aid,
        agencyName: ag?.agency_name ? String(ag.agency_name) : 'DBE',
        agencyType: ag?.agency_type != null ? String(ag.agency_type) : null,
        source: 'agency',
        canEdit: false,
        schoolProfileId: schoolId,
      };
    }
  }

  return {
    agencyProfileId: null,
    agencyName: null,
    agencyType: null,
    source: 'national',
    canEdit: false,
    schoolProfileId: schoolId,
  };
}

export async function loadApprovedProducts(
  supabase: SupabaseClient,
  agencyProfileId: number | null,
  opts?: { activeOnly?: boolean; includeNationalFallback?: boolean }
): Promise<Array<Record<string, unknown>>> {
  const activeOnly = opts?.activeOnly !== false;
  const includeNational = opts?.includeNationalFallback !== false;
  const ck = `nsnp:products:${agencyProfileId ?? 'nat'}:${activeOnly ? 1 : 0}:${includeNational ? 1 : 0}`;
  const cached = nsnpCacheGet<Array<Record<string, unknown>>>(ck);
  if (cached) return cached;

  // Prefer agency-owned items; optionally merge national (null) as fallback
  // when agency list is empty or for transitional periods
  let q = supabase.from('nsnp_approved_products').select('*').limit(3000);
  if (agencyProfileId != null) {
    if (includeNational) {
      q = q.or(
        `agency_profile_id.eq.${agencyProfileId},agency_profile_id.is.null`
      );
    } else {
      q = q.eq('agency_profile_id', agencyProfileId);
    }
  } else {
    q = q.is('agency_profile_id', null);
  }
  if (activeOnly) q = q.eq('active', true);

  const { data, error } = await q.order('category').order('name');
  if (error) return [];

  const rows = (data || []) as Array<Record<string, unknown>>;
  // If agency has its own products, prefer those only (strict agency list)
  let out = rows;
  if (agencyProfileId != null) {
    const owned = rows.filter(
      (r) => Number(r.agency_profile_id) === agencyProfileId
    );
    if (owned.length > 0) out = owned;
  }
  return nsnpCacheSet(ck, out, NSNP_TTL.products);
}

export async function loadApprovedBrands(
  supabase: SupabaseClient,
  agencyProfileId: number | null,
  opts?: { activeOnly?: boolean }
): Promise<Array<Record<string, unknown>>> {
  const activeOnly = opts?.activeOnly !== false;
  let q = supabase.from('nsnp_approved_brands').select('*').limit(1000);
  if (agencyProfileId != null) {
    q = q.or(
      `agency_profile_id.eq.${agencyProfileId},agency_profile_id.is.null`
    );
  } else {
    q = q.is('agency_profile_id', null);
  }
  if (activeOnly) q = q.eq('active', true);
  const { data } = await q.order('name');
  const rows = (data || []) as Array<Record<string, unknown>>;
  if (agencyProfileId != null) {
    const owned = rows.filter(
      (r) => Number(r.agency_profile_id) === agencyProfileId
    );
    if (owned.length > 0) return owned;
  }
  return rows;
}

/** Validate product ids against the resolved catalogue. */
export async function filterApprovedProductIds(
  supabase: SupabaseClient,
  agencyProfileId: number | null,
  productIds: number[]
): Promise<Map<number, Record<string, unknown>>> {
  const ids = [
    ...new Set(
      productIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (!ids.length) return new Map();
  let q = supabase
    .from('nsnp_approved_products')
    .select(
      'id, name, brand_name, category, uom, active, agency_profile_id'
    )
    .in('id', ids.slice(0, 400))
    .eq('active', true);
  if (agencyProfileId != null) {
    q = q.eq('agency_profile_id', agencyProfileId);
  }
  const { data, error } = await q.limit(ids.length + 5);
  if (error) {
    const products = await loadApprovedProducts(supabase, agencyProfileId, {
      activeOnly: true,
      includeNationalFallback: agencyProfileId == null,
    });
    const byId = new Map(products.map((p) => [Number(p.id), p] as const));
    const out = new Map<number, Record<string, unknown>>();
    for (const id of ids) {
      const p = byId.get(id);
      if (p && p.active !== false) out.set(id, p);
    }
    return out;
  }
  const out = new Map<number, Record<string, unknown>>();
  for (const p of data || []) {
    out.set(Number(p.id), p as Record<string, unknown>);
  }
  return out;
}

export type MenuProductStrip = {
  id: number;
  label: string;
  reason: 'inactive' | 'not_on_catalogue';
};

/**
 * Menu products: only active department catalogue items.
 * Inactive / foreign ids are stripped (never re-activated, never shown).
 */
export async function sanitizeMenuProductIds(
  supabase: SupabaseClient,
  agencyProfileId: number,
  productIds: number[]
): Promise<{
  allowedIds: number[];
  allowed: Map<number, Record<string, unknown>>;
  stripped: MenuProductStrip[];
}> {
  const ids = [
    ...new Set(
      productIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (!ids.length) {
    return { allowedIds: [], allowed: new Map(), stripped: [] };
  }

  const { data: rows, error } = await supabase
    .from('nsnp_approved_products')
    .select('id, name, brand_name, agency_profile_id, active')
    .in('id', ids)
    .limit(ids.length + 10);

  if (error) {
    const byActive = await filterApprovedProductIds(
      supabase,
      agencyProfileId,
      ids
    );
    const allowedIds = ids.filter((id) => byActive.has(id));
    const stripped = ids
      .filter((id) => !byActive.has(id))
      .map((id) => ({
        id,
        label: String(id),
        reason: 'not_on_catalogue' as const,
      }));
    return { allowedIds, allowed: byActive, stripped };
  }

  // Does agency have its own catalogue rows?
  const { count: ownedCount } = await supabase
    .from('nsnp_approved_products')
    .select('id', { count: 'exact', head: true })
    .eq('agency_profile_id', agencyProfileId);

  const allowed = new Map<number, Record<string, unknown>>();
  const stripped: MenuProductStrip[] = [];
  const found = new Set<number>();

  for (const r of rows || []) {
    const id = Number(r.id);
    found.add(id);
    const agency =
      r.agency_profile_id != null ? Number(r.agency_profile_id) : null;
    const label = `${r.brand_name ? `${r.brand_name} · ` : ''}${r.name || id}`;
    const onCatalogue =
      agency === agencyProfileId ||
      ((!ownedCount || ownedCount === 0) && agency == null);

    if (!onCatalogue) {
      stripped.push({ id, label, reason: 'not_on_catalogue' });
      continue;
    }
    if (r.active === false) {
      stripped.push({ id, label, reason: 'inactive' });
      continue;
    }
    allowed.set(id, r as Record<string, unknown>);
  }

  for (const id of ids) {
    if (!found.has(id) && !allowed.has(id)) {
      stripped.push({
        id,
        label: String(id),
        reason: 'not_on_catalogue',
      });
    }
  }

  return {
    allowedIds: ids.filter((id) => allowed.has(id)),
    allowed,
    stripped,
  };
}

/** Drop inactive / off-catalogue product ids from menu cycle items. */
export async function sanitizeMenuItemsProducts(
  supabase: SupabaseClient,
  agencyProfileId: number,
  items: Array<{
    day: number;
    meal_type?: string;
    dish?: string;
    approved_product_ids?: number[];
    notes?: string;
    recipe_id?: number | null;
  }>
): Promise<{
  items: Array<{
    day: number;
    meal_type?: string;
    dish?: string;
    approved_product_ids: number[];
    notes?: string;
    recipe_id?: number | null;
  }>;
  stripped: MenuProductStrip[];
}> {
  const allIds = [
    ...new Set(items.flatMap((it) => it.approved_product_ids || [])),
  ];
  const { allowedIds, stripped } = await sanitizeMenuProductIds(
    supabase,
    agencyProfileId,
    allIds
  );
  const allow = new Set(allowedIds);
  return {
    items: items.map((it) => ({
      ...it,
      approved_product_ids: (it.approved_product_ids || []).filter((id) =>
        allow.has(id)
      ),
    })),
    stripped,
  };
}

/** @deprecated use sanitizeMenuProductIds — kept name for any external import */
export async function validateMenuProductsForAgency(
  supabase: SupabaseClient,
  agencyProfileId: number,
  productIds: number[]
): Promise<{
  ok: boolean;
  bad: Array<{ id: number; label: string }>;
  reactivated: number[];
  byId: Map<number, Record<string, unknown>>;
  stripped: MenuProductStrip[];
  allowedIds: number[];
}> {
  const r = await sanitizeMenuProductIds(
    supabase,
    agencyProfileId,
    productIds
  );
  return {
    ok: r.stripped.length === 0,
    bad: r.stripped.map((s) => ({ id: s.id, label: s.label })),
    reactivated: [],
    byId: r.allowed,
    stripped: r.stripped,
    allowedIds: r.allowedIds,
  };
}

/**
 * Ensure national NSNP seed rows exist (agency_profile_id null).
 * Idempotent by name+brand.
 */
export async function ensureNationalNsnpSeed(
  supabase: SupabaseClient
): Promise<{ brands: number; products: number }> {
  let brandsAdded = 0;
  let productsAdded = 0;
  const brandIdBySlug = new Map<string, number>();

  for (const b of NSNP_SEED_BRANDS) {
    const { data: existing } = await supabase
      .from('nsnp_approved_brands')
      .select('id, name')
      .is('agency_profile_id', null)
      .ilike('name', b.name)
      .maybeSingle();
    if (existing?.id) {
      brandIdBySlug.set(b.slug, Number(existing.id));
      continue;
    }
    const { data: ins } = await supabase
      .from('nsnp_approved_brands')
      .insert({
        name: b.name,
        slug: b.slug,
        manufacturer: b.manufacturer,
        notes: b.notes || null,
        active: true,
        agency_profile_id: null,
      })
      .select('id')
      .single();
    if (ins?.id) {
      brandIdBySlug.set(b.slug, Number(ins.id));
      brandsAdded += 1;
    }
  }

  // Resolve brand ids that already existed under alternate lookup
  for (const b of NSNP_SEED_BRANDS) {
    if (brandIdBySlug.has(b.slug)) continue;
    const { data: bySlug } = await supabase
      .from('nsnp_approved_brands')
      .select('id')
      .is('agency_profile_id', null)
      .eq('slug', b.slug)
      .maybeSingle();
    if (bySlug?.id) brandIdBySlug.set(b.slug, Number(bySlug.id));
  }

  for (const p of NSNP_SEED_PRODUCTS) {
    const { data: existing } = await supabase
      .from('nsnp_approved_products')
      .select('id')
      .is('agency_profile_id', null)
      .ilike('name', p.name)
      .limit(1)
      .maybeSingle();
    if (existing?.id) continue;
    const brandId = brandIdBySlug.get(p.brand_slug) || null;
    const brandName =
      NSNP_SEED_BRANDS.find((b) => b.slug === p.brand_slug)?.name ||
      p.brand_slug;
    const { error } = await supabase.from('nsnp_approved_products').insert({
      brand_id: brandId,
      category: p.category,
      name: p.name,
      brand_name: brandName,
      pack_size: p.pack_size,
      uom: p.uom,
      energy_kcal: p.energy_kcal ?? null,
      protein_g: p.protein_g ?? null,
      active: true,
      agency_profile_id: null,
      notes: p.notes || 'NSNP national seed',
    });
    if (!error) productsAdded += 1;
  }

  return { brands: brandsAdded, products: productsAdded };
}

/**
 * Clone national (or seed) products into an agency catalogue.
 * Skips name+brand already present for that agency — safe to re-run.
 * Schools/SPs always read this live list for the department.
 */
export async function cloneNationalIntoAgency(
  supabase: SupabaseClient,
  agencyProfileId: number
): Promise<{ imported: number; brands: number; skipped: number }> {
  await ensureNationalNsnpSeed(supabase);

  const nationalBrands = await loadApprovedBrands(supabase, null, {
    activeOnly: true,
  });
  const nationalProducts = await loadApprovedProducts(supabase, null, {
    activeOnly: true,
    includeNationalFallback: false,
  });

  // Existing agency products for skip
  const { data: existingAgency } = await supabase
    .from('nsnp_approved_products')
    .select('name, brand_name')
    .eq('agency_profile_id', agencyProfileId)
    .limit(5000);
  const existingKeys = new Set(
    (existingAgency || []).map(
      (p) =>
        `${String(p.brand_name || '').toLowerCase()}::${String(p.name || '').toLowerCase()}`
    )
  );

  const brandMap = new Map<string, number>();
  let brandsCreated = 0;
  for (const b of nationalBrands) {
    const name = String(b.name);
    const { data: existing } = await supabase
      .from('nsnp_approved_brands')
      .select('id, name')
      .eq('agency_profile_id', agencyProfileId)
      .ilike('name', name)
      .maybeSingle();
    if (existing?.id) {
      brandMap.set(name.toLowerCase(), Number(existing.id));
      continue;
    }
    const { data: ins } = await supabase
      .from('nsnp_approved_brands')
      .insert({
        name,
        slug: String(b.slug || name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-'),
        manufacturer: b.manufacturer || null,
        notes: b.notes || null,
        active: true,
        agency_profile_id: agencyProfileId,
        published_at: new Date().toISOString(),
      })
      .select('id, name')
      .single();
    if (ins?.id) {
      brandMap.set(String(ins.name).toLowerCase(), Number(ins.id));
      brandsCreated += 1;
    }
  }

  let imported = 0;
  let skipped = 0;
  for (const p of nationalProducts) {
    const brandName = String(p.brand_name || '');
    const key = `${brandName.toLowerCase()}::${String(p.name || '').toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    const brandId = brandMap.get(brandName.toLowerCase()) || null;
    const meal = defaultMealFlagsFromCategory(
      p.category != null ? String(p.category) : null
    );
    const { error } = await supabase.from('nsnp_approved_products').insert({
      brand_id: brandId,
      category: p.category || 'commodity',
      name: p.name,
      brand_name: brandName,
      sku: p.sku || null,
      pack_size: p.pack_size || null,
      uom: p.uom || 'kg',
      energy_kcal: p.energy_kcal ?? null,
      protein_g: p.protein_g ?? null,
      active: true,
      agency_profile_id: agencyProfileId,
      published_at: new Date().toISOString(),
      notes:
        p.notes ||
        'NSNP catalogue — owned by department; schools & SPs inherit live',
      metadata: {
        for_breakfast: meal.for_breakfast,
        for_lunch: meal.for_lunch,
      },
    });
    if (!error) {
      imported += 1;
      existingKeys.add(key);
    }
  }

  return { imported, brands: brandsCreated, skipped };
}
