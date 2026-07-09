import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/** Built-in fallback if table not migrated yet */
const DEFAULT_CATEGORIES = [
  'General',
  'Raw materials',
  'Finished goods',
  'Packaging',
  'Consumables',
  'Ingredients',
  'Beverages',
  'Food & grocery',
  'Personal care',
  'Household',
  'Electronics',
  'Apparel',
  'Spare parts',
  'Tools & equipment',
  'Cold chain',
  'Hazardous / controlled',
  'Services',
  'Kits & bundles',
  'Returns / seconds',
  'Other',
];

/**
 * GET ?companyId=
 * Returns global defaults + company-specific categories.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const supabase = getSupabaseServer();

    let q = supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    // Global (profile_id null) + this company
    if (Number.isFinite(companyId)) {
      q = q.or(`profile_id.is.null,profile_id.eq.${companyId}`);
    } else {
      q = q.is('profile_id', null);
    }

    const { data, error } = await q;

    if (error) {
      // Table missing — return static list
      return NextResponse.json({
        success: true,
        categories: DEFAULT_CATEGORIES.map((name, i) => ({
          id: -(i + 1),
          profile_id: null,
          name,
          is_global: true,
          sort_order: (i + 1) * 10,
        })),
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_product_categories.sql',
      });
    }

    const categories = (data || []).map((c) => ({
      ...c,
      is_global: c.profile_id == null,
    }));

    // If empty, seed-like response
    if (categories.length === 0) {
      return NextResponse.json({
        success: true,
        categories: DEFAULT_CATEGORIES.map((name, i) => ({
          id: -(i + 1),
          profile_id: null,
          name,
          is_global: true,
          sort_order: (i + 1) * 10,
        })),
      });
    }

    return NextResponse.json({ success: true, categories });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST — add company category
 * Body: { companyId, name, description? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const name = String(body.name || '').trim();

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    if (!name || name.length < 1) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json({ error: 'Category name too long (max 80)' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Avoid duplicate for this company (case-insensitive)
    const { data: existing } = await supabase
      .from('product_categories')
      .select('id, name, profile_id')
      .eq('profile_id', companyId)
      .ilike('name', name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        category: { ...existing, is_global: false },
        alreadyExists: true,
      });
    }

    // Also check if identical global name exists — still allow company override? skip create, return global
    const { data: globalMatch } = await supabase
      .from('product_categories')
      .select('id, name, profile_id')
      .is('profile_id', null)
      .ilike('name', name)
      .maybeSingle();

    if (globalMatch) {
      return NextResponse.json({
        success: true,
        category: { ...globalMatch, is_global: true },
        alreadyExists: true,
        message: 'Category already exists in the global list',
      });
    }

    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        profile_id: companyId,
        name,
        description: body.description ? String(body.description).trim() : null,
        sort_order: body.sort_order != null ? Number(body.sort_order) : 500,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260709_product_categories.sql',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      category: { ...data, is_global: false },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * DELETE ?id=&companyId= — soft-delete company category only (not global)
 */
export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(id) || !Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'id and companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: row } = await supabase
      .from('product_categories')
      .select('id, profile_id, name')
      .eq('id', id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    if (row.profile_id == null) {
      return NextResponse.json(
        { error: 'Global system categories cannot be deleted' },
        { status: 403 }
      );
    }
    if (Number(row.profile_id) !== companyId) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const { error } = await supabase
      .from('product_categories')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
