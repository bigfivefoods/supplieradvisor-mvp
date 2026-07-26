import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

/**
 * School menu cycles — weekly/monthly NSNP menus with optional approved product links.
 * items: [{ day: 1-7, meal_type, dish, approved_product_ids?: number[] }]
 */
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
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const { data, error: mErr } = await supabase
      .from('school_menu_cycles')
      .select('*')
      .or(`school_profile_id.eq.${school.id},profile_id.eq.${companyId}`)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (mErr) {
      if (/does not exist|schema cache/i.test(mErr.message)) {
        return NextResponse.json({
          success: true,
          menus: [],
          warning: 'Menu tables missing — run schools migrations',
        });
      }
      return NextResponse.json({ error: mErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      menus: data || [],
      schoolId: school.id,
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
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    // Validate approved_product_ids if present
    const productIds: number[] = [
      ...new Set(
        items.flatMap((it: { approved_product_ids?: unknown }) => {
          if (!Array.isArray(it?.approved_product_ids)) return [] as number[];
          return it.approved_product_ids
            .map((x) => Number(x))
            .filter((n): n is number => Number.isFinite(n) && n > 0);
        })
      ),
    ];

    if (productIds.length) {
      const { data: approved } = await supabase
        .from('nsnp_approved_products')
        .select('id')
        .in('id', productIds)
        .eq('active', true);
      const ok = new Set((approved || []).map((p) => Number(p.id)));
      const bad = productIds.filter((id) => !ok.has(id));
      if (bad.length) {
        return NextResponse.json(
          {
            error: `Menu references non-approved product ids: ${bad.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    // If setting active, deactivate other menus for this school
    if (body.active !== false) {
      await supabase
        .from('school_menu_cycles')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('school_profile_id', school.id);
    }

    const { data, error: iErr } = await supabase
      .from('school_menu_cycles')
      .insert({
        school_profile_id: school.id,
        profile_id: companyId,
        name,
        cycle_days: Number(body.cycle_days || 7),
        items,
        active: body.active !== false,
        description: body.description || null,
        meal_types: body.meal_types || ['lunch'],
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, menu: data });
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
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (!school) {
      return NextResponse.json({ error: 'No school' }, { status: 503 });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'name',
      'cycle_days',
      'items',
      'active',
      'description',
      'meal_types',
    ] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    if (body.active === true) {
      await supabase
        .from('school_menu_cycles')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('school_profile_id', school.id)
        .neq('id', id);
    }

    const { data, error } = await supabase
      .from('school_menu_cycles')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, menu: data });
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
    const { error } = await supabase
      .from('school_menu_cycles')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
