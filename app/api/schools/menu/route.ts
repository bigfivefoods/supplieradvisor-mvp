import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  resolveCatalogueContext,
  sanitizeMenuItemsProducts,
} from '@/lib/schools/approved-catalogue';
import {
  loadMandatedMenu,
  parseMenuItems,
  productsPrescribedOnMenu,
  schoolMenuAdherenceForPeriod,
} from '@/lib/schools/agency-menu';
import { currentQuarterPeriod } from '@/lib/schools/prize';
import { MEAL_TYPES } from '@/lib/schools/meal-guide';

/**
 * Department menu (DBE/DoH sets) + school view of mandated cycle.
 * GET ?companyId=  → mandated menu for associates; full edit list for agency
 * POST            → agency publishes/updates mandated menu
 *                   (schools cannot override the department cycle)
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
    const ctx = await resolveCatalogueContext(supabase, companyId);
    const mandated = await loadMandatedMenu(supabase, companyId);

    // Strip inactive / off-catalogue products so they never appear on menus
    const stripMenuItems = async (
      agencyId: number | null | undefined,
      rawItems: unknown
    ) => {
      const parsed = parseMenuItems(rawItems);
      if (!agencyId || !parsed.length) return parsed;
      const { items } = await sanitizeMenuItemsProducts(
        supabase,
        Number(agencyId),
        parsed
      );
      return items;
    };

    // Agency: list all their menus + mandated active
    if (ctx.canEdit && ctx.agencyProfileId) {
      const { data: menus, error } = await supabase
        .from('school_menu_cycles')
        .select('*')
        .eq('agency_profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error && /does not exist|schema cache|column/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          role: 'agency',
          canEdit: true,
          menus: [],
          mandated: null,
          catalogue: ctx,
          warning:
            'Run migration 20260726_agency_mandated_menu.sql for department menus',
        });
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const agencyId = Number(ctx.agencyProfileId);
      const menusClean = await Promise.all(
        (menus || []).map(async (m) => ({
          ...m,
          items: await stripMenuItems(agencyId, m.items),
        }))
      );
      const mandatedClean = mandated.menu
        ? {
            ...mandated.menu,
            items: await stripMenuItems(agencyId, mandated.menu.items),
          }
        : null;

      return NextResponse.json({
        success: true,
        role: 'agency',
        canEdit: true,
        meal_types: MEAL_TYPES,
        menus: menusClean,
        mandated: mandatedClean,
        catalogue: ctx,
        policy:
          'Set breakfast and lunch for each school day. Only active approved-list products appear — inactive foods stay off the menu. Schools and SPs follow this live; schools are rated on % menu adherence.',
      });
    }

    // School / SP / facility: mandated menu + adherence
    let schoolId: number | null = null;
    let adherence = null as Awaited<
      ReturnType<typeof schoolMenuAdherenceForPeriod>
    > | null;
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (school) {
      schoolId = Number(school.id);
      const q = currentQuarterPeriod();
      adherence = await schoolMenuAdherenceForPeriod(
        supabase,
        companyId,
        schoolId,
        q.starts_on,
        q.ends_on
      );
    }

    // Local school drafts (optional, non-mandated)
    let localMenus: unknown[] = [];
    if (schoolId) {
      const { data } = await supabase
        .from('school_menu_cycles')
        .select('*')
        .eq('school_profile_id', schoolId)
        .or('is_agency_menu.is.null,is_agency_menu.eq.false')
        .order('updated_at', { ascending: false })
        .limit(20);
      localMenus = (data || []).map((m) => ({
        ...m,
        items: parseMenuItems(m.items),
      }));
    }

    const mandatedItems = mandated.menu
      ? await stripMenuItems(mandated.agencyProfileId, mandated.menu.items)
      : [];
    const mandatedClean = mandated.menu
      ? { ...mandated.menu, items: mandatedItems }
      : null;
    const prescribedIds = mandatedClean
      ? productsPrescribedOnMenu(mandatedClean.items)
      : [];

    return NextResponse.json({
      success: true,
      role: ctx.isIsp ? 'sp' : 'school',
      canEdit: false,
      meal_types: MEAL_TYPES,
      mandated: mandatedClean,
      agencyName: mandated.agencyName,
      agencyProfileId: mandated.agencyProfileId,
      /** Product ids the department selected across breakfast+lunch for the week */
      weekly_approved_product_ids: prescribedIds,
      menus: localMenus,
      adherence: adherence
        ? {
            pct: adherence.pct,
            matched: adherence.matched,
            total: adherence.total,
            byDay: adherence.byDay.slice(-14),
          }
        : null,
      catalogue: ctx,
      policy: mandated.menu
        ? `2 meals/day (breakfast + lunch) set by ${mandated.agencyName || 'department'}. Adherence this quarter: ${adherence?.pct ?? 0}% (${adherence?.matched ?? 0}/${adherence?.total ?? 0} days).`
        : 'Your department has not published a 2-meal mandated menu yet.',
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

    // Only department may publish mandated menus
    if (!ctx.canEdit || !ctx.agencyProfileId) {
      return NextResponse.json(
        {
          error:
            'Only DBE / PEU / DoH can set the programme menu. Schools and SPs follow the department menu.',
        },
        { status: 403 }
      );
    }

    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const parsed = parseMenuItems(body.items);
    // Only active department catalogue products may appear on the menu
    const sanitized = await sanitizeMenuItemsProducts(
      supabase,
      companyId,
      parsed
    );
    const items = sanitized.items;
    const strippedInactive = sanitized.stripped.filter(
      (s) => s.reason === 'inactive'
    );
    const strippedOther = sanitized.stripped.filter(
      (s) => s.reason !== 'inactive'
    );
    if (strippedOther.length) {
      return NextResponse.json(
        {
          error: `Menu products must be on your department approved list: ${strippedOther
            .map((b) => b.label)
            .join('; ')}`,
          bad_product_ids: strippedOther.map((b) => b.id),
        },
        { status: 400 }
      );
    }

    // Deactivate previous mandated menus when publishing active
    const makeActive = body.active !== false;
    if (makeActive) {
      await supabase
        .from('school_menu_cycles')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('agency_profile_id', companyId)
        .eq('is_agency_menu', true);
    }

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      school_profile_id: null,
      profile_id: companyId,
      agency_profile_id: companyId,
      is_agency_menu: true,
      is_template: true,
      mandatory: body.mandatory !== false,
      name,
      description: body.description || null,
      cycle_days: Number(body.cycle_days || items.length || 5),
      items,
      meal_types: body.meal_types || ['breakfast', 'lunch'],
      active: makeActive,
      published_at: makeActive ? now : null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('school_menu_cycles')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      // Retry without newer columns
      if (/column|schema cache/i.test(error.message || '')) {
        const soft = {
          school_profile_id: null,
          profile_id: companyId,
          name,
          description: body.description || null,
          cycle_days: Number(body.cycle_days || 5),
          items,
          active: makeActive,
          updated_at: now,
        };
        const retry = await supabase
          .from('school_menu_cycles')
          .insert(soft)
          .select('*')
          .single();
        if (retry.error) {
          return NextResponse.json(
            { error: retry.error.message },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          menu: { ...retry.data, items: parseMenuItems(retry.data.items) },
          warning:
            'Partial save — run 20260726_agency_mandated_menu.sql for full agency menu fields',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      menu: { ...data, items: parseMenuItems(data.items) },
      stripped_inactive: strippedInactive,
      message:
        strippedInactive.length > 0
          ? `Department menu published. ${strippedInactive.length} inactive product(s) were removed (inactive foods never appear on the menu). Schools and SPs see it live.`
          : 'Department menu published. Associated schools and SPs see it live and are rated on adherence.',
    });
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
        { error: 'Only the department can edit the mandated menu' },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.description !== undefined) patch.description = body.description;
    if (body.cycle_days != null) patch.cycle_days = Number(body.cycle_days);
    if (body.mandatory != null) patch.mandatory = Boolean(body.mandatory);
    let strippedInactive: Array<{ id: number; label: string; reason: string }> =
      [];
    if (Array.isArray(body.items)) {
      const parsed = parseMenuItems(body.items);
      const sanitized = await sanitizeMenuItemsProducts(
        supabase,
        companyId,
        parsed
      );
      strippedInactive = sanitized.stripped.filter(
        (s) => s.reason === 'inactive'
      );
      const strippedOther = sanitized.stripped.filter(
        (s) => s.reason !== 'inactive'
      );
      if (strippedOther.length) {
        return NextResponse.json(
          {
            error: `Menu products must be on your department approved list: ${strippedOther
              .map((b) => b.label)
              .join('; ')}`,
            bad_product_ids: strippedOther.map((b) => b.id),
          },
          { status: 400 }
        );
      }
      patch.items = sanitized.items;
    }
    if (body.active === true) {
      await supabase
        .from('school_menu_cycles')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('agency_profile_id', companyId)
        .neq('id', id);
      patch.active = true;
      patch.published_at = new Date().toISOString();
    } else if (body.active === false) {
      patch.active = false;
    }

    const { data, error } = await supabase
      .from('school_menu_cycles')
      .update(patch)
      .eq('id', id)
      .eq('agency_profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      menu: { ...data, items: parseMenuItems(data.items) },
      stripped_inactive: strippedInactive,
      message:
        strippedInactive.length > 0
          ? `Menu updated — ${strippedInactive.length} inactive product(s) removed (inactive foods never appear on the menu). Schools and SPs see changes live.`
          : 'Menu updated — schools and SPs see changes live',
    });
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
    const ctx = await resolveCatalogueContext(supabase, companyId);
    if (!ctx.canEdit) {
      return NextResponse.json(
        { error: 'Only the department can delete mandated menus' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('school_menu_cycles')
      .delete()
      .eq('id', id)
      .eq('agency_profile_id', companyId);

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
