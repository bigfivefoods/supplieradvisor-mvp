import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  loadApprovedBrands,
  loadApprovedProducts,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';

/**
 * DBE-owned NSNP approved catalogue.
 * - GET: schools/ISPs see the list for their linked agency (or national fallback)
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

    if (ctx.canEdit) {
      // Agency editor: only their catalogue (not merged national when they have edits)
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
      const [br, pr] = await Promise.all([bq, pq]);
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
        // columns missing — fall back without agency filter
        brands = await loadApprovedBrands(supabase, null, { activeOnly });
        products = await loadApprovedProducts(supabase, null, {
          activeOnly,
        });
      } else {
        brands = (br.data || []) as Array<Record<string, unknown>>;
        products = (pr.data || []) as Array<Record<string, unknown>>;
        // If agency has no products yet, show national seed as read-only template hint
        if (!products.length) {
          const national = await loadApprovedProducts(supabase, null, {
            activeOnly: true,
          });
          products = national.map((p) => ({
            ...p,
            _national_template: true,
          }));
        }
      }
    } else {
      brands = await loadApprovedBrands(supabase, agencyProfileId, {
        activeOnly,
      });
      products = await loadApprovedProducts(supabase, agencyProfileId, {
        activeOnly,
        includeNationalFallback: true,
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
        message: ctx.canEdit
          ? 'You publish this list as the government agency. Schools and ISPs must buy/supply only these items.'
          : ctx.source === 'agency'
            ? `Catalogue set by ${ctx.agencyName || 'DBE'}. You may only order and receive these approved foods.`
            : 'National fallback list — join and get approved by DBE to use their official catalogue.',
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

    // Clone national template into agency list
    if (body.action === 'clone_national') {
      const national = await loadApprovedProducts(supabase, null, {
        activeOnly: true,
      });
      const brands = await loadApprovedBrands(supabase, null, {
        activeOnly: true,
      });
      let brandMap = new Map<string, number>();
      for (const b of brands) {
        const { data: nb } = await supabase
          .from('nsnp_approved_brands')
          .upsert(
            {
              name: String(b.name),
              slug: String(b.slug || b.name)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-'),
              manufacturer: b.manufacturer || null,
              active: true,
              agency_profile_id: companyId,
              published_at: new Date().toISOString(),
            },
            { onConflict: 'agency_profile_id,name' }
          )
          .select('id, name')
          .maybeSingle();
        // upsert onConflict may fail if unique index differs — insert or find
        if (nb?.id) {
          brandMap.set(String(nb.name).toLowerCase(), Number(nb.id));
        } else {
          const { data: existing } = await supabase
            .from('nsnp_approved_brands')
            .select('id, name')
            .eq('agency_profile_id', companyId)
            .ilike('name', String(b.name))
            .maybeSingle();
          if (existing) {
            brandMap.set(String(existing.name).toLowerCase(), Number(existing.id));
          } else {
            const { data: ins } = await supabase
              .from('nsnp_approved_brands')
              .insert({
                name: String(b.name),
                slug: String(b.slug || b.name)
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-'),
                manufacturer: b.manufacturer || null,
                active: true,
                agency_profile_id: companyId,
                published_at: new Date().toISOString(),
              })
              .select('id, name')
              .single();
            if (ins) {
              brandMap.set(String(ins.name).toLowerCase(), Number(ins.id));
            }
          }
        }
      }

      let imported = 0;
      for (const p of national) {
        const brandName = String(p.brand_name || '');
        const brandId = brandMap.get(brandName.toLowerCase()) || null;
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
          agency_profile_id: companyId,
          published_at: new Date().toISOString(),
          notes: p.notes || 'Cloned from national template',
        });
        if (!error) imported += 1;
      }
      return NextResponse.json({
        success: true,
        imported,
        message: `Cloned ${imported} products into your DBE catalogue`,
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
