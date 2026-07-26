import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

/**
 * DBE / governmental agency:
 * - Register current company as agency (DBE)
 * - School joins agency
 * - Agency lists linked schools + summary scores
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
    const mode = String(sp.get('mode') || 'school'); // school | agency | directory

    // Directory of agencies schools can join
    if (mode === 'directory' || sp.get('directory') === '1') {
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .select('*')
        .eq('status', 'active')
        .order('agency_name')
        .limit(200);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json({
            success: true,
            agencies: [],
            warning:
              'Run migration 20260726_schools_dbe_agency_menu.sql for agency links',
          });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, agencies: data || [] });
    }

    // Agency console: schools linked to me
    const { data: myAgency } = await supabase
      .from('nsnp_agency_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (mode === 'agency' || myAgency) {
      const { data: links, error: lErr } = await supabase
        .from('school_agency_links')
        .select('*')
        .eq('agency_profile_id', companyId)
        .in('status', ['active', 'pending'])
        .limit(2000);

      if (lErr && /does not exist|schema cache/i.test(lErr.message)) {
        return NextResponse.json({
          success: true,
          agency: myAgency,
          schools: [],
          warning: lErr.message,
        });
      }
      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }

      const schoolIds = [
        ...new Set(
          (links || [])
            .map((l) => Number(l.school_profile_id))
            .filter((n) => Number.isFinite(n))
        ),
      ];

      let schools: Array<Record<string, unknown>> = [];
      if (schoolIds.length) {
        const { data: rows } = await supabase
          .from('school_profiles')
          .select(
            'id, profile_id, school_name, emis_number, province, district, quintile, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, staff_count, lat, lng, status'
          )
          .in('id', schoolIds);
        schools = (rows || []) as Array<Record<string, unknown>>;
      }

      // Latest prize scores if any
      const schoolIdList = schools.map((s) => Number(s.id));
      let scores: Array<Record<string, unknown>> = [];
      if (schoolIdList.length) {
        const { data: sc } = await supabase
          .from('nsnp_prize_scores')
          .select(
            'school_profile_id, total_score, approved_brand_pct, feeding_completeness_pct, data_quality_pct, computed_at, period_id'
          )
          .in('school_profile_id', schoolIdList)
          .order('computed_at', { ascending: false })
          .limit(500);
        // keep latest per school
        const seen = new Set<number>();
        for (const row of sc || []) {
          const sid = Number(row.school_profile_id);
          if (seen.has(sid)) continue;
          seen.add(sid);
          scores.push(row as Record<string, unknown>);
        }
      }
      const scoreBySchool = new Map(
        scores.map((s) => [Number(s.school_profile_id), s])
      );

      const enriched = schools.map((s) => {
        const link = (links || []).find(
          (l) => Number(l.school_profile_id) === Number(s.id)
        );
        const sc = scoreBySchool.get(Number(s.id));
        return {
          ...s,
          link_status: link?.status || null,
          linked_at: link?.created_at || null,
          prize_score: sc?.total_score ?? null,
          approved_brand_pct: sc?.approved_brand_pct ?? null,
          feeding_completeness_pct: sc?.feeding_completeness_pct ?? null,
        };
      });

      const summary = {
        schoolCount: enriched.length,
        activeLinks: (links || []).filter((l) => l.status === 'active').length,
        pendingLinks: (links || []).filter((l) => l.status === 'pending')
          .length,
        totalLearners: enriched.reduce(
          (n, s) => n + Number(s.learner_count_enrolled || 0),
          0
        ),
        totalVerified: enriched.reduce(
          (n, s) => n + Number(s.learner_count_verified || 0),
          0
        ),
        avgPrizeScore: (() => {
          const vals = enriched
            .map((s) => Number(s.prize_score))
            .filter((n) => Number.isFinite(n) && n > 0);
          if (!vals.length) return null;
          return (
            Math.round(
              (vals.reduce((a, b) => a + b, 0) / vals.length) * 10
            ) / 10
          );
        })(),
      };

      return NextResponse.json({
        success: true,
        role: 'agency',
        agency: myAgency,
        schools: enriched,
        summary,
        links: links || [],
      });
    }

    // School view: my links + directory
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const [linksRes, dirRes] = await Promise.all([
      supabase
        .from('school_agency_links')
        .select('*')
        .eq('school_profile_id', school.id),
      supabase
        .from('nsnp_agency_profiles')
        .select('*')
        .eq('status', 'active')
        .order('agency_name')
        .limit(200),
    ]);

    if (linksRes.error && /does not exist|schema cache/i.test(linksRes.error.message)) {
      return NextResponse.json({
        success: true,
        role: 'school',
        school,
        links: [],
        agencies: [],
        warning:
          'Run migration 20260726_schools_dbe_agency_menu.sql for DBE agency links',
      });
    }

    const agencyIds = [
      ...new Set(
        (linksRes.data || [])
          .map((l) => Number(l.agency_profile_id))
          .filter(Boolean)
      ),
    ];
    let agencyNames: Record<number, string> = {};
    if (agencyIds.length) {
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, agency_type')
        .in('profile_id', agencyIds);
      for (const a of ag || []) {
        agencyNames[Number(a.profile_id)] = String(a.agency_name);
      }
    }

    const links = (linksRes.data || []).map((l) => ({
      ...l,
      agency_name:
        agencyNames[Number(l.agency_profile_id)] ||
        `Agency ${l.agency_profile_id}`,
    }));

    return NextResponse.json({
      success: true,
      role: 'school',
      school,
      links,
      agencies: dirRes.data || [],
      isAgency: Boolean(myAgency),
      myAgency: myAgency || null,
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
    const action = String(body.action || '');

    // Register this company as DBE / PEU / provincial agency
    if (action === 'register_agency') {
      const name =
        String(body.agency_name || body.name || '').trim() ||
        'Government agency';
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .upsert(
          {
            profile_id: companyId,
            agency_name: name,
            agency_type: body.agency_type || 'dbe',
            province: body.province || null,
            district: body.district || null,
            contact_name: body.contact_name || null,
            contact_email: body.contact_email || null,
            contact_phone: body.contact_phone || null,
            description: body.description || null,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id' }
        )
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      try {
        await supabase
          .from('profiles')
          .update({
            org_type: 'government',
            trading_name: name,
          })
          .eq('id', companyId);
      } catch {
        /* soft */
      }
      return NextResponse.json({ success: true, agency: data });
    }

    // School joins agency
    if (action === 'join' || action === 'link') {
      const agencyProfileId = Number(body.agency_profile_id);
      if (!Number.isFinite(agencyProfileId)) {
        return NextResponse.json(
          { error: 'agency_profile_id required' },
          { status: 400 }
        );
      }
      const { school, error } = await getOrCreateSchoolProfile(
        supabase,
        companyId
      );
      if (error || !school) {
        return NextResponse.json(
          { error: error || 'No school profile' },
          { status: 503 }
        );
      }

      const { data: agency } = await supabase
        .from('nsnp_agency_profiles')
        .select('id, status, agency_name')
        .eq('profile_id', agencyProfileId)
        .maybeSingle();
      if (!agency || agency.status !== 'active') {
        return NextResponse.json(
          { error: 'Agency not found or inactive' },
          { status: 404 }
        );
      }

      const { data, error: lErr } = await supabase
        .from('school_agency_links')
        .upsert(
          {
            school_profile_id: school.id,
            school_company_id: companyId,
            agency_profile_id: agencyProfileId,
            status: body.status || 'active',
            requested_by: gate.userId || null,
            accepted_at: new Date().toISOString(),
            notes: body.notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'school_profile_id,agency_profile_id' }
        )
        .select('*')
        .single();

      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }

      // Set primary agency if first link
      try {
        await supabase
          .from('school_profiles')
          .update({
            primary_agency_profile_id: agencyProfileId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', school.id)
          .is('primary_agency_profile_id', null);
      } catch {
        /* soft */
      }

      return NextResponse.json({
        success: true,
        link: data,
        agency_name: agency.agency_name,
      });
    }

    // Leave agency
    if (action === 'leave') {
      const agencyProfileId = Number(body.agency_profile_id);
      const { school } = await getOrCreateSchoolProfile(supabase, companyId);
      if (!school) {
        return NextResponse.json({ error: 'No school' }, { status: 503 });
      }
      const { error } = await supabase
        .from('school_agency_links')
        .update({
          status: 'left',
          updated_at: new Date().toISOString(),
        })
        .eq('school_profile_id', school.id)
        .eq('agency_profile_id', agencyProfileId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Agency accepts/suspends school
    if (action === 'set_link_status') {
      const linkId = Number(body.link_id);
      const status = String(body.status || 'active');
      const { error } = await supabase
        .from('school_agency_links')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', linkId)
        .eq('agency_profile_id', companyId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
