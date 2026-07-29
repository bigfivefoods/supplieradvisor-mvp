/**
 * Public Parent / SGB weekly menu (no auth).
 * GET ?token=  or  ?emis= & pin=
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

function pinHash(pin: string, schoolId: number) {
  return createHash('sha256')
    .update(`nsnp-menu:${schoolId}:${pin}`)
    .digest('hex')
    .slice(0, 24);
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const token = sp.get('token');
    const emis = sp.get('emis');
    const pin = sp.get('pin');
    const supabase = getSupabaseServer();

    let school: Record<string, unknown> | null = null;

    if (token) {
      // token format: base64url schoolId.pinHash or metadata.public_menu_token
      const { data } = await supabase
        .from('school_profiles')
        .select(
          'id, school_name, emis_number, district, province, metadata, phase'
        )
        .contains('metadata', { public_menu_token: token })
        .maybeSingle();
      school = data as Record<string, unknown> | null;
      if (!school) {
        // try simple id-token: schoolId-hash
        const m = /^(\d+)-([a-f0-9]+)$/i.exec(token);
        if (m) {
          const { data: s2 } = await supabase
            .from('school_profiles')
            .select(
              'id, school_name, emis_number, district, province, metadata, phase'
            )
            .eq('id', Number(m[1]))
            .maybeSingle();
          if (s2) {
            const meta =
              s2.metadata && typeof s2.metadata === 'object'
                ? (s2.metadata as Record<string, unknown>)
                : {};
            if (String(meta.public_menu_token || '') === token) {
              school = s2 as Record<string, unknown>;
            }
          }
        }
      }
    } else if (emis && pin) {
      const { data } = await supabase
        .from('school_profiles')
        .select(
          'id, school_name, emis_number, district, province, metadata, phase'
        )
        .eq('emis_number', emis)
        .maybeSingle();
      if (data) {
        const meta =
          data.metadata && typeof data.metadata === 'object'
            ? (data.metadata as Record<string, unknown>)
            : {};
        const expected = String(meta.public_menu_pin_hash || '');
        const got = pinHash(String(pin), Number(data.id));
        if (expected && expected === got) {
          school = data as Record<string, unknown>;
        } else if (!expected && String(meta.public_menu_pin || '') === pin) {
          school = data as Record<string, unknown>;
        }
      }
    }

    if (!school) {
      return NextResponse.json(
        { error: 'Menu not found or PIN incorrect', success: false },
        { status: 404 }
      );
    }

    const schoolId = Number(school.id);
    // Agency menu via link
    const { data: link } = await supabase
      .from('school_agency_links')
      .select('agency_profile_id')
      .eq('school_profile_id', schoolId)
      .eq('status', 'active')
      .maybeSingle();

    let menu: Record<string, unknown> | null = null;
    if (link) {
      const { data: menus } = await supabase
        .from('school_menu_cycles')
        .select('id, name, items, weekly_approved_product_ids, cycle_json, active')
        .eq('agency_profile_id', link.agency_profile_id)
        .limit(5);
      menu =
        (menus || []).find((m) => m.active !== false) ||
        menus?.[0] ||
        null;
    }
    if (!menu) {
      const { data: schoolMenu } = await supabase
        .from('school_menu_cycles')
        .select('id, name, items, weekly_approved_product_ids, cycle_json, active')
        .eq('school_profile_id', schoolId)
        .limit(3);
      menu =
        (schoolMenu || []).find((m) => m.active !== false) ||
        schoolMenu?.[0] ||
        null;
    }

    // Recent serve days (what was served)
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const { data: fed } = await supabase
      .from('school_feeding_days')
      .select('feed_date, meal_type, menu_name, served_meals, planned_meals')
      .eq('school_profile_id', schoolId)
      .gte('feed_date', from.toISOString().slice(0, 10))
      .order('feed_date', { ascending: false })
      .limit(20);

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const week: Array<{ day: string; dishes: string[] }> = days.map((d, i) => ({
      day: d,
      dishes: [],
    }));
    const items = Array.isArray(menu?.items)
      ? (menu!.items as Array<Record<string, unknown>>)
      : [];
    for (const it of items) {
      const day = Number(it.day || 0);
      if (day >= 1 && day <= 5) {
        const dish = String(it.dish || it.name || it.meal_type || '').trim();
        if (dish) week[day - 1].dishes.push(dish);
      }
    }

    return NextResponse.json({
      success: true,
      school: {
        name: school.school_name,
        emis: school.emis_number,
        district: school.district,
        province: school.province,
      },
      menu: {
        name: menu?.name || 'Weekly menu',
        week,
        items,
      },
      served_recent: (fed || []).map((f) => ({
        date: f.feed_date,
        meal: f.meal_type,
        menu: f.menu_name,
        served: f.served_meals,
        planned: f.planned_meals,
      })),
      generated_at: new Date().toISOString(),
      note: 'Public SGB / parent view — planned menu vs recent serve days.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error', success: false },
      { status: 500 }
    );
  }
}

/** School enables public menu token/PIN */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Requires company auth for enable — soft public enable is not allowed
    const { requireCompanyAccess, legacyPrivyFrom } = await import(
      '@/lib/auth/api-auth'
    );
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const { getOrCreateSchoolProfile } = await import(
      '@/lib/schools/school-context'
    );
    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);
    const pin = String(body.pin || '1234').slice(0, 12);
    const token = `${schoolId}-${pinHash(pin, schoolId)}`;
    const meta =
      school.metadata && typeof school.metadata === 'object'
        ? { ...(school.metadata as Record<string, unknown>) }
        : {};
    meta.public_menu_token = token;
    meta.public_menu_pin_hash = pinHash(pin, schoolId);
    meta.public_menu_enabled = true;

    await supabase
      .from('school_profiles')
      .update({
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schoolId);

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      request.nextUrl.origin;

    return NextResponse.json({
      success: true,
      token,
      public_url: `${origin.replace(/\/$/, '')}/nsnp/menu?token=${encodeURIComponent(token)}`,
      pin_hint: 'Share PIN only with SGB / parents you trust.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
