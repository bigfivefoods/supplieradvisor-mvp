import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * Strict NSNP approved catalogue (read for schools/ISPs; write for platform admins).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    // Allow unauthenticated browse of public approved list when no companyId
    // but prefer company gate when provided
    if (Number.isFinite(companyId)) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;
    }

    const supabase = getSupabaseServer();
    // all=1 includes inactive (for editors); default active-only for order/GRN UIs
    const activeOnly = sp.get('all') !== '1';
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const category = String(sp.get('category') || '').trim();

    let brandsQ = supabase
      .from('nsnp_approved_brands')
      .select('*')
      .order('name');
    if (activeOnly) brandsQ = brandsQ.eq('active', true);

    let productsQ = supabase
      .from('nsnp_approved_products')
      .select('*')
      .order('category')
      .order('name')
      .limit(2000);
    if (activeOnly) productsQ = productsQ.eq('active', true);
    if (category) productsQ = productsQ.eq('category', category);

    const [brandsRes, productsRes] = await Promise.all([brandsQ, productsQ]);

    if (brandsRes.error || productsRes.error) {
      const msg = brandsRes.error?.message || productsRes.error?.message || '';
      if (/does not exist|schema cache/i.test(msg)) {
        return NextResponse.json({
          success: true,
          brands: [],
          products: [],
          warning:
            'Run migration 20260726_schools_nsnp_module.sql for NSNP catalogue',
        });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let products = productsRes.data || [];
    if (q) {
      products = products.filter((p) => {
        const hay = `${p.name} ${p.brand_name} ${p.category} ${p.sku || ''}`
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const categories = [
      ...new Set(products.map((p) => String(p.category || '')).filter(Boolean)),
    ].sort();

    return NextResponse.json({
      success: true,
      brands: brandsRes.data || [],
      products,
      categories,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** Add brand or product (authenticated company — programme admins / operators). */
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
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, brand: data });
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

/** Update brand or product (edit / deactivate). */
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
    const kind = String(body.kind || 'product');

    if (kind === 'brand') {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      for (const k of ['name', 'manufacturer', 'notes', 'active'] as const) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      if (body.name) {
        patch.slug = String(body.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
      }
      const { data, error } = await supabase
        .from('nsnp_approved_brands')
        .update(patch)
        .eq('id', id)
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

/** Soft-delete = deactivate (keep history for audits). */
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
    const table =
      kind === 'brand' ? 'nsnp_approved_brands' : 'nsnp_approved_products';
    const { data, error } = await supabase
      .from(table)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
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
