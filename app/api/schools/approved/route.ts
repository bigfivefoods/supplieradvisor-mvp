import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  cloneNationalIntoAgency,
  ensureNationalNsnpSeed,
  loadApprovedBrands,
  loadApprovedProducts,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';
import {
  defaultMealFlagsFromCategory,
  enrichProductsWithMealFlags,
} from '@/lib/schools/meal-guide';

/** Persist breakfast/lunch tags on product metadata (+ columns when present). */
function mealPatchFromBody(
  body: Record<string, unknown>,
  existingMeta?: unknown,
  category?: string | null
): {
  metadata: Record<string, unknown>;
  for_breakfast: boolean;
  for_lunch: boolean;
} {
  const base =
    existingMeta && typeof existingMeta === 'object'
      ? { ...(existingMeta as Record<string, unknown>) }
      : {};
  const defaults = defaultMealFlagsFromCategory(
    category != null ? String(category) : body.category != null ? String(body.category) : null
  );
  const for_breakfast =
    body.for_breakfast === undefined
      ? base.for_breakfast !== undefined
        ? Boolean(base.for_breakfast)
        : defaults.for_breakfast
      : Boolean(body.for_breakfast);
  const for_lunch =
    body.for_lunch === undefined
      ? base.for_lunch !== undefined
        ? Boolean(base.for_lunch)
        : defaults.for_lunch
      : Boolean(body.for_lunch);
  return {
    for_breakfast,
    for_lunch,
    metadata: {
      ...base,
      for_breakfast,
      for_lunch,
    },
  };
}

/**
 * DBE-owned NSNP approved catalogue.
 * - GET: schools/SPs see the list for their linked agency (or national fallback)
 * - POST/PATCH/DELETE: only registered DBE/PEU agencies may edit their list
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const activeOnly = sp.get('all') !== '1';
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const category = String(sp.get('category') || '').trim();
    const province = String(sp.get('province') || '').trim();
    // agency may force view of their own list via agencyProfileId=
    const forceAgency = sp.get('agencyProfileId')
      ? Number(sp.get('agencyProfileId'))
      : null;

    const ctx = await resolveCatalogueContext(supabase, companyId);
    const agencyProfileId =
      forceAgency && ctx.canEdit && forceAgency === companyId
        ? forceAgency
        : ctx.agencyProfileId;

    // When agency is editing, always show their own items (including empty)
    // When school views, use resolved agency list
    let brands: Array<Record<string, unknown>> = [];
    let products: Array<Record<string, unknown>> = [];

    // Keep national seed available as template source
    await ensureNationalNsnpSeed(supabase);

    if (ctx.canEdit) {
      // Agency editor: live catalogue for this DBE/PEU only
      // Auto-import NSNP starter list once so schools have something to measure against
      let bq = supabase
        .from('nsnp_approved_brands')
        .select('*')
        .eq('agency_profile_id', companyId)
        .order('name');
      let pq = supabase
        .from('nsnp_approved_products')
        .select('*')
        .eq('agency_profile_id', companyId)
        .order('category')
        .order('name')
        .limit(3000);
      if (activeOnly) {
        bq = bq.eq('active', true);
        pq = pq.eq('active', true);
      }
      let [br, pr] = await Promise.all([bq, pq]);
      if (br.error || pr.error) {
        const msg = br.error?.message || pr.error?.message || '';
        if (/does not exist|schema cache/i.test(msg)) {
          return NextResponse.json({
            success: true,
            brands: [],
            products: [],
            catalogue: ctx,
            warning:
              'Run migrations 20260726_schools_nsnp_module.sql and 20260726_nsnp_agency_owned_catalogue.sql',
          });
        }
        brands = await loadApprovedBrands(supabase, null, { activeOnly });
        products = await loadApprovedProducts(supabase, null, {
          activeOnly,
        });
      } else {
        brands = (br.data || []) as Array<Record<string, unknown>>;
        products = (pr.data || []) as Array<Record<string, unknown>>;
        // First open: clone full NSNP seed into this department's catalogue
        if (!products.length) {
          await cloneNationalIntoAgency(supabase, companyId);
          const [br2, pr2] = await Promise.all([bq, pq]);
          brands = (br2.data || []) as Array<Record<string, unknown>>;
          products = (pr2.data || []) as Array<Record<string, unknown>>;
        }
      }
    } else {
      // School / SP: always the department's live list when associated
      if (agencyProfileId != null) {
        // If department never opened catalogue, seed it so associates are not blocked
        const owned = await loadApprovedProducts(supabase, agencyProfileId, {
          activeOnly: true,
          includeNationalFallback: false,
        });
        if (!owned.length) {
          await cloneNationalIntoAgency(supabase, agencyProfileId);
        }
      }
      brands = await loadApprovedBrands(supabase, agencyProfileId, {
        activeOnly,
      });
      products = await loadApprovedProducts(supabase, agencyProfileId, {
        activeOnly,
        // Only fall back to national if no department association
        includeNationalFallback: agencyProfileId == null,
      });
    }

    // Facets from the unfiltered list so dropdowns stay complete
    const categories = [
      ...new Set(
        products.map((p) => String(p.category || '')).filter(Boolean)
      ),
    ].sort();
    const provinces = [
      ...new Set(
        products.map((p) => String(p.province || '').trim()).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    if (category) {
      products = products.filter(
        (p) =>
          String(p.category || '').toLowerCase() === category.toLowerCase()
      );
    }
    if (province) {
      products = products.filter(
        (p) =>
          String(p.province || '').toLowerCase() === province.toLowerCase()
      );
    }
    if (q) {
      products = products.filter((p) => {
        const hay =
          `${p.name} ${p.brand_name} ${p.category} ${p.sku || ''} ${p.province || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // Surface for_breakfast / for_lunch for menu + catalogue UI
    products = enrichProductsWithMealFlags(
      products as Array<Record<string, unknown>>
    );

    return NextResponse.json({
      success: true,
      brands,
      products,
      categories,
      provinces,
      catalogue: {
        ...ctx,
        agencyProfileId,
        live_pull_through: true,
        message: ctx.canEdit
          ? 'You own this NSNP catalogue. Schools and SPs associated with you always see the live list — edits pull through immediately for orders, GRNs, prizes and claims.'
          : ctx.source === 'agency'
            ? `Live catalogue from ${ctx.agencyName || 'your department'}. You are measured only against these approved foods (orders, GRNs, prizes, claims).`
            : 'Not yet associated with a department — join DBE/PEU to inherit their approved foods list.',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const ctx = await resolveCatalogueContext(supabase, companyId);
    if (!ctx.canEdit) {
      return NextResponse.json(
        {
          error:
            'Only a registered DBE / PEU agency can publish the approved foods list. Register under Schools → DBE first.',
        },
        { status: 403 }
      );
    }

    if (body.kind === 'brand') {
      if (!body.name) {
        return NextResponse.json({ error: 'name required' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('nsnp_approved_brands')
        .insert({
          name: String(body.name),
          slug: String(body.slug || body.name)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-'),
          manufacturer: body.manufacturer || null,
          notes: body.notes || null,
          active: body.active !== false,
          agency_profile_id: companyId,
          published_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, brand: data });
    }

    // Clone / re-sync NSNP starter list into this department's catalogue
    if (
      body.action === 'clone_national' ||
      body.action === 'import_nsnp_seed' ||
      body.action === 'sync_nsnp_seed'
    ) {
      const result = await cloneNationalIntoAgency(supabase, companyId);
      return NextResponse.json({
        success: true,
        imported: result.imported,
        brands: result.brands,
        skipped: result.skipped,
        message:
          result.imported > 0
            ? `Imported ${result.imported} NSNP products into your department catalogue (${result.skipped} already present). Schools and SPs under you use this list live.`
            : result.skipped > 0
              ? `Catalogue already has NSNP items (${result.skipped} unchanged). Edits here pull through to all associated schools and SPs.`
              : 'No products imported — check national seed.',
      });
    }

    if (!body.name || !body.brand_name) {
      return NextResponse.json(
        { error: 'name and brand_name required' },
        { status: 400 }
      );
    }
    const category = String(body.category || 'commodity');
    const meal = mealPatchFromBody(body as Record<string, unknown>, {}, category);
    const insertRow: Record<string, unknown> = {
      brand_id: body.brand_id || null,
      category,
      name: String(body.name),
      brand_name: String(body.brand_name),
      sku: body.sku || null,
      pack_size: body.pack_size || null,
      uom: body.uom || 'kg',
      energy_kcal: body.energy_kcal ?? null,
      protein_g: body.protein_g ?? null,
      active: body.active !== false,
      notes: body.notes || null,
      image_url: body.image_url ? String(body.image_url) : null,
      // SA province where the food supplier / producer is based
      province: body.province ? String(body.province) : null,
      agency_profile_id: companyId,
      published_at: new Date().toISOString(),
      metadata: meal.metadata,
      for_breakfast: meal.for_breakfast,
      for_lunch: meal.for_lunch,
    };
    let { data, error } = await supabase
      .from('nsnp_approved_products')
      .insert(insertRow)
      .select('*')
      .single();
    // Soft-retry without meal columns if migration not applied yet
    if (
      error &&
      /for_breakfast|for_lunch|column|schema cache/i.test(error.message || '')
    ) {
      delete insertRow.for_breakfast;
      delete insertRow.for_lunch;
      const retry = await supabase
        .from('nsnp_approved_products')
        .insert(insertRow)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const product = enrichProductsWithMealFlags([
      (data || {}) as Record<string, unknown>,
    ])[0];
    return NextResponse.json({ success: true, product });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const ctx = await resolveCatalogueContext(supabase, companyId);
    if (!ctx.canEdit) {
      return NextResponse.json(
        { error: 'Only the DBE / PEU agency can edit this catalogue' },
        { status: 403 }
      );
    }

    const kind = String(body.kind || 'product');

    if (kind === 'brand') {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      for (const k of ['name', 'manufacturer', 'notes', 'active'] as const) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { data, error } = await supabase
        .from('nsnp_approved_brands')
        .update(patch)
        .eq('id', id)
        .eq('agency_profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, brand: data });
    }

    // Load existing metadata so we merge meal flags cleanly
    const { data: existing } = await supabase
      .from('nsnp_approved_products')
      .select('id, metadata, category')
      .eq('id', id)
      .eq('agency_profile_id', companyId)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'name',
      'brand_name',
      'brand_id',
      'category',
      'sku',
      'pack_size',
      'uom',
      'energy_kcal',
      'protein_g',
      'active',
      'notes',
      'province',
      'image_url',
    ] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    if (
      body.for_breakfast !== undefined ||
      body.for_lunch !== undefined ||
      body.metadata !== undefined
    ) {
      const meal = mealPatchFromBody(
        body as Record<string, unknown>,
        existing?.metadata,
        body.category != null
          ? String(body.category)
          : existing?.category != null
            ? String(existing.category)
            : null
      );
      patch.metadata = meal.metadata;
      patch.for_breakfast = meal.for_breakfast;
      patch.for_lunch = meal.for_lunch;
    }

    let { data, error } = await supabase
      .from('nsnp_approved_products')
      .update(patch)
      .eq('id', id)
      .eq('agency_profile_id', companyId)
      .select('*')
      .single();
    if (
      error &&
      /for_breakfast|for_lunch|column|schema cache/i.test(error.message || '')
    ) {
      delete patch.for_breakfast;
      delete patch.for_lunch;
      const retry = await supabase
        .from('nsnp_approved_products')
        .update(patch)
        .eq('id', id)
        .eq('agency_profile_id', companyId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            'Could not update — only products on your agency list can be edited',
        },
        { status: 400 }
      );
    }
    const product = enrichProductsWithMealFlags([
      (data || {}) as Record<string, unknown>,
    ])[0];
    return NextResponse.json({ success: true, product });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    const kind = String(sp.get('kind') || 'product');
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const ctx = await resolveCatalogueContext(supabase, companyId);
    if (!ctx.canEdit) {
      return NextResponse.json(
        { error: 'Only the DBE / PEU agency can deactivate catalogue items' },
        { status: 403 }
      );
    }

    const table =
      kind === 'brand' ? 'nsnp_approved_brands' : 'nsnp_approved_products';
    const { data, error } = await supabase
      .from(table)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('agency_profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, item: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
