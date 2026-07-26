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
      // Agency editor: live catalogue for this DBE/DoH only
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

    if (category) {
      products = products.filter(
        (p) =>
          String(p.category || '').toLowerCase() === category.toLowerCase()
      );
    }
    if (q) {
      products = products.filter((p) => {
        const hay =
          `${p.name} ${p.brand_name} ${p.category} ${p.sku || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const categories = [
      ...new Set(
        products.map((p) => String(p.category || '')).filter(Boolean)
      ),
    ].sort();

    return NextResponse.json({
      success: true,
      brands,
      products,
      categories,
      catalogue: {
        ...ctx,
        agencyProfileId,
        live_pull_through: true,
        message: ctx.canEdit
          ? 'You own this NSNP catalogue. Schools and SPs associated with you always see the live list — edits pull through immediately for orders, GRNs, prizes and claims.'
          : ctx.source === 'agency'
            ? `Live catalogue from ${ctx.agencyName || 'your department'}. You are measured only against these approved foods (orders, GRNs, prizes, claims).`
            : 'Not yet associated with a department — join DBE/DoH to inherit their approved foods list.',
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
    const { data, error } = await supabase
      .from('nsnp_approved_products')
      .insert({
        brand_id: body.brand_id || null,
        category: body.category || 'commodity',
        name: String(body.name),
        brand_name: String(body.brand_name),
        sku: body.sku || null,
        pack_size: body.pack_size || null,
        uom: body.uom || 'kg',
        energy_kcal: body.energy_kcal ?? null,
        protein_g: body.protein_g ?? null,
        active: body.active !== false,
        notes: body.notes || null,
        agency_profile_id: companyId,
        published_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, product: data });
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
    ] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    const { data, error } = await supabase
      .from('nsnp_approved_products')
      .update(patch)
      .eq('id', id)
      .eq('agency_profile_id', companyId)
      .select('*')
      .single();
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
    return NextResponse.json({ success: true, product: data });
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
