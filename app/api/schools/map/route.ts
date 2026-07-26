import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * School locations for map (scoped: all schools if platform, else district peers).
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
    const province = request.nextUrl.searchParams.get('province');
    const district = request.nextUrl.searchParams.get('district');

    let q = supabase
      .from('school_profiles')
      .select(
        'id, profile_id, school_name, emis_number, province, district, city, lat, lng, quintile, learner_count_enrolled, learner_count_nsnp_eligible, status'
      )
      .eq('status', 'active')
      .limit(2000);

    if (province) q = q.eq('province', province);
    if (district) q = q.eq('district', district);

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          schools: [],
          warning: 'Run schools migration',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const schools = (data || []).map((s) => ({
      ...s,
      has_coords:
        s.lat != null &&
        s.lng != null &&
        Number.isFinite(Number(s.lat)) &&
        Number.isFinite(Number(s.lng)),
    }));

    return NextResponse.json({
      success: true,
      schools,
      withCoords: schools.filter((s) => s.has_coords).length,
      total: schools.length,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
