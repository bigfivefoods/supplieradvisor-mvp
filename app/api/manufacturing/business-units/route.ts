import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('manufacturing_business_units')
      .select('*')
      .eq('profile_id', companyId)
      .order('code');

    if (error) {
      return NextResponse.json({
        success: true,
        businessUnits: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260720_manufacturing_cost_structure.sql',
      });
    }
    return NextResponse.json({ success: true, businessUnits: data || [] });
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
    if (!Number.isFinite(companyId) || !body.code || !body.name) {
      return NextResponse.json(
        { error: 'companyId, code, name required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      code: String(body.code).trim().toUpperCase(),
      name: String(body.name).trim(),
      description: body.description || null,
      parent_id: body.parent_id ? Number(body.parent_id) : null,
      cost_centre_code: body.cost_centre_code
        ? String(body.cost_centre_code).trim().toUpperCase()
        : String(body.code).trim().toUpperCase(),
      currency: body.currency || 'ZAR',
      budget_monthly: Number(body.budget_monthly ?? 0),
      status: body.status || 'active',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('manufacturing_business_units')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260720_manufacturing_cost_structure.sql',
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, businessUnit: data });
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
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'code',
      'name',
      'description',
      'parent_id',
      'cost_centre_code',
      'currency',
      'budget_monthly',
      'status',
    ]) {
      if (body[key] !== undefined) {
        updates[key] =
          key === 'code' || key === 'cost_centre_code'
            ? String(body[key]).trim().toUpperCase()
            : key === 'parent_id'
              ? body[key]
                ? Number(body[key])
                : null
              : body[key];
      }
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('manufacturing_business_units')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, businessUnit: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('manufacturing_business_units')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
