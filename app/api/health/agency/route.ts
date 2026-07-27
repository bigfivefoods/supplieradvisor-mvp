import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  familyForAgencyType,
  familyForFacilityType,
  facilityMayJoinAgency,
  programmeHierarchyBlurb,
  AGENCY_TYPES,
  FACILITY_TYPES,
} from '@/lib/entities/programme-hierarchy';
import {
  fetchAgencySchoolLinks,
  fetchByIds,
  fetchAllPaged,
} from '@/lib/schools/supabase-page';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

export const runtime = 'nodejs';
export const maxDuration = 60;

const HEALTH_AGENCY_TYPES = AGENCY_TYPES.filter((a) => a.family === 'health').map(
  (a) => a.id
);
const HEALTH_MEMBER_TYPES = FACILITY_TYPES.filter((f) => f.family === 'health').map(
  (f) => f.id
);

/**
 * DoH / health programme agency API (standalone from Schools/DBE).
 * Reuses school_profiles + agency link tables with health-family filters.
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
    const mode = String(sp.get('mode') || 'facility');

    if (mode === 'directory' || sp.get('directory') === '1') {
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .select('*')
        .eq('status', 'active')
        .order('agency_name')
        .limit(200);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      const agencies = (data || []).filter(
        (a) => familyForAgencyType(String(a.agency_type || '')) === 'health'
      );
      return NextResponse.json({
        success: true,
        agencies,
        programme: 'health',
        agencyTypes: AGENCY_TYPES.filter((a) => a.family === 'health'),
        facilityTypes: FACILITY_TYPES.filter((f) => f.family === 'health'),
      });
    }

    const { data: myAgency } = await supabase
      .from('nsnp_agency_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    const isHealthAgency =
      myAgency &&
      familyForAgencyType(String(myAgency.agency_type || '')) === 'health';

    if (mode === 'agency' || isHealthAgency) {
      if (myAgency && !isHealthAgency) {
        return NextResponse.json(
          {
            error:
              'This company is registered as an education department (DBE). Use the Schools module.',
            redirect: '/dashboard/schools/agency',
            programme: 'education',
          },
          { status: 403 }
        );
      }

      let links: Array<Record<string, unknown>> = [];
      try {
        links = await fetchAgencySchoolLinks(supabase, companyId, [
          'active',
          'pending',
          'suspended',
        ]);
      } catch (e: unknown) {
        return NextResponse.json({
          success: true,
          role: 'agency',
          agency: myAgency,
          facilities: [],
          summary: emptySummary(),
          programme: 'health',
          warning: e instanceof Error ? e.message : 'No links',
        });
      }

      const schoolIds = [
        ...new Set(
          links
            .map((l) => Number(l.school_profile_id))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ];

      let facilities: Array<Record<string, unknown>> = [];
      if (schoolIds.length) {
        try {
          facilities = await fetchByIds(
            supabase,
            'school_profiles',
            'id, profile_id, school_name, emis_number, province, district, circuit, quintile, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, staff_count, lat, lng, status, member_type',
            schoolIds
          );
        } catch {
          facilities = await fetchByIds(
            supabase,
            'school_profiles',
            'id, profile_id, school_name, emis_number, province, district, status, member_type, learner_count_enrolled',
            schoolIds
          );
        }
      }

      // Keep health facilities only (clinics / hospitals / shelters)
      facilities = facilities.filter((f) => {
        const mt = String(f.member_type || 'hospital');
        return familyForFacilityType(mt) === 'health';
      });

      const linkById = new Map(
        links.map((l) => [Number(l.school_profile_id), l] as const)
      );

      const enriched: Array<Record<string, unknown>> = facilities.map((f) => {
        const link = linkById.get(Number(f.id));
        return {
          ...f,
          facility_name: f.school_name,
          link_status: link?.status ?? null,
          linked_at: link?.created_at ?? null,
        };
      });

      enriched.sort((a, b) => {
        const sa = String(a.link_status || '');
        const sb = String(b.link_status || '');
        if (sa === 'pending' && sb !== 'pending') return -1;
        if (sb === 'pending' && sa !== 'pending') return 1;
        return String(a.facility_name || '').localeCompare(
          String(b.facility_name || '')
        );
      });

      const summary = {
        facilityCount: enriched.length,
        activeLinks: links.filter((l) => l.status === 'active').length,
        pendingLinks: links.filter((l) => l.status === 'pending').length,
        suspendedLinks: links.filter((l) => l.status === 'suspended').length,
        totalPatients: enriched.reduce(
          (n, s) => n + Number(s.learner_count_enrolled ?? 0),
          0
        ),
        hospitals: enriched.filter((f) => f.member_type === 'hospital').length,
        clinics: enriched.filter((f) => f.member_type === 'clinic').length,
        other: enriched.filter(
          (f) => !['hospital', 'clinic'].includes(String(f.member_type || ''))
        ).length,
        districts: new Set(
          enriched.map((f) => f.district).filter(Boolean)
        ).size,
      };

      const hierarchy = programmeHierarchyBlurb(
        myAgency ? String(myAgency.agency_type) : 'department_of_health'
      );

      return NextResponse.json({
        success: true,
        role: 'agency',
        programme: 'health',
        agency: myAgency,
        facilities: enriched,
        // alias for UI reuse
        schools: enriched,
        summary: {
          ...summary,
          schoolCount: summary.facilityCount,
          totalLearners: summary.totalPatients,
        },
        hierarchy,
        agencyTypes: AGENCY_TYPES.filter((a) => a.family === 'health'),
        facilityTypes: FACILITY_TYPES.filter((f) => f.family === 'health'),
      });
    }

    // Facility view
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No facility' }, { status: 503 });
    }

    // Ensure health member type for health module users
    const mt = String(
      (school as { member_type?: string }).member_type || 'hospital'
    );
    if (familyForFacilityType(mt) !== 'health') {
      try {
        await supabase
          .from('school_profiles')
          .update({
            member_type: 'hospital',
            updated_at: new Date().toISOString(),
          })
          .eq('id', Number((school as { id: number }).id));
      } catch {
        /* soft */
      }
    }

    const [linksRes, dirRes] = await Promise.all([
      supabase
        .from('school_agency_links')
        .select('*')
        .eq('school_profile_id', Number((school as { id: number }).id)),
      supabase
        .from('nsnp_agency_profiles')
        .select('*')
        .eq('status', 'active')
        .order('agency_name')
        .limit(200),
    ]);

    const healthAgencies = (dirRes.data || []).filter(
      (a) => familyForAgencyType(String(a.agency_type || '')) === 'health'
    );

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
        `Department ${l.agency_profile_id}`,
    }));

    return NextResponse.json({
      success: true,
      role: 'facility',
      programme: 'health',
      facility: school,
      school,
      links,
      agencies: healthAgencies,
      isAgency: Boolean(isHealthAgency),
      myAgency: isHealthAgency ? myAgency : null,
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

    if (action === 'register_agency') {
      const name =
        String(body.agency_name || body.name || '').trim() ||
        'Department of Health';
      let agencyType = String(body.agency_type || 'department_of_health');
      if (familyForAgencyType(agencyType) !== 'health') {
        agencyType = 'department_of_health';
      }
      if (!HEALTH_AGENCY_TYPES.includes(agencyType as (typeof HEALTH_AGENCY_TYPES)[number]) && agencyType !== 'other') {
        // allow only health family
        agencyType = 'department_of_health';
      }

      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .upsert(
          {
            profile_id: companyId,
            agency_name: name,
            agency_type: agencyType,
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
        const { cloneNationalIntoAgency } = await import(
          '@/lib/schools/approved-catalogue'
        );
        await cloneNationalIntoAgency(supabase, companyId);
      } catch {
        /* soft */
      }

      try {
        await supabase
          .from('profiles')
          .update({
            org_type: 'government_health',
            business_type: 'government_health',
            trading_name: name,
            metadata: {
              enabled_modules: {
                health: true,
                schools: false,
                home: true,
                guide: true,
                network: true,
              },
            },
          })
          .eq('id', companyId);
      } catch {
        /* soft */
      }

      return NextResponse.json({
        success: true,
        agency: data,
        programme: 'health',
        hierarchy: programmeHierarchyBlurb(agencyType),
      });
    }

    if (action === 'update_agency') {
      const { data: existing } = await supabase
        .from('nsnp_agency_profiles')
        .select('agency_type')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (
        existing &&
        familyForAgencyType(String(existing.agency_type || '')) !== 'health'
      ) {
        return NextResponse.json(
          { error: 'Not a health department — use Schools → DBE' },
          { status: 403 }
        );
      }
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      for (const k of [
        'agency_name',
        'agency_type',
        'province',
        'district',
        'contact_name',
        'contact_email',
        'contact_phone',
        'description',
        'about',
        'meal_tariff_zar',
        'claims_locked',
      ]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      if (
        patch.agency_type != null &&
        familyForAgencyType(String(patch.agency_type)) !== 'health'
      ) {
        return NextResponse.json(
          { error: 'Health module only accepts DoH / provincial health types' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .update(patch)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, agency: data });
    }

    // Join DoH as facility
    if (action === 'join' || action === 'request_join') {
      const agencyProfileId = Number(body.agency_profile_id || body.agencyId);
      if (!Number.isFinite(agencyProfileId)) {
        return NextResponse.json(
          { error: 'agency_profile_id required' },
          { status: 400 }
        );
      }
      const { data: agency } = await supabase
        .from('nsnp_agency_profiles')
        .select('id, status, agency_name, agency_type')
        .eq('profile_id', agencyProfileId)
        .maybeSingle();
      if (!agency || agency.status === 'inactive') {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }
      if (familyForAgencyType(String(agency.agency_type || '')) !== 'health') {
        return NextResponse.json(
          {
            error:
              'That department is DBE/education. Join it from the Schools module.',
          },
          { status: 400 }
        );
      }

      const { school, error: sErr } = await getOrCreateSchoolProfile(
        supabase,
        companyId
      );
      if (sErr || !school) {
        return NextResponse.json(
          { error: sErr || 'No facility profile' },
          { status: 503 }
        );
      }

      const memberType = String(
        body.member_type ||
          (school as { member_type?: string }).member_type ||
          'hospital'
      );
      const healthType = HEALTH_MEMBER_TYPES.includes(
        memberType as (typeof HEALTH_MEMBER_TYPES)[number]
      )
        ? memberType
        : 'hospital';

      await supabase
        .from('school_profiles')
        .update({
          member_type: healthType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', Number((school as { id: number }).id));

      const may = facilityMayJoinAgency(healthType, agency.agency_type);
      if (!may.ok) {
        return NextResponse.json({ error: may.reason }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { data: link, error } = await supabase
        .from('school_agency_links')
        .upsert(
          {
            school_profile_id: Number((school as { id: number }).id),
            school_company_id: companyId,
            agency_profile_id: agencyProfileId,
            status: 'pending',
            notes: body.notes || 'Health facility join request',
            updated_at: now,
          },
          { onConflict: 'school_profile_id,agency_profile_id' }
        )
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        link,
        hierarchy: programmeHierarchyBlurb(String(agency.agency_type)),
      });
    }

    // Approve / suspend facility link (DoH)
    if (
      action === 'approve' ||
      action === 'suspend' ||
      action === 'reject' ||
      action === 'set_status'
    ) {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_type')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (
        !agencyGate ||
        familyForAgencyType(String(agencyGate.agency_type || '')) !== 'health'
      ) {
        return NextResponse.json(
          { error: 'Only DoH can approve health facilities' },
          { status: 403 }
        );
      }

      const schoolProfileId = Number(
        body.school_profile_id || body.facility_id || body.id
      );
      if (!Number.isFinite(schoolProfileId) || schoolProfileId <= 0) {
        return NextResponse.json(
          { error: 'school_profile_id required' },
          { status: 400 }
        );
      }
      const status =
        action === 'approve'
          ? 'active'
          : action === 'suspend'
            ? 'suspended'
            : action === 'reject'
              ? 'left'
              : String(body.status || 'active');

      const now = new Date().toISOString();
      // Upsert so "Add + approve" works without a prior join request
      const { data: fac } = await supabase
        .from('school_profiles')
        .select('id, profile_id, member_type')
        .eq('id', schoolProfileId)
        .maybeSingle();
      if (!fac) {
        return NextResponse.json(
          { error: 'Facility not found' },
          { status: 404 }
        );
      }
      const { data, error } = await supabase
        .from('school_agency_links')
        .upsert(
          {
            school_profile_id: schoolProfileId,
            school_company_id:
              fac.profile_id != null ? Number(fac.profile_id) : companyId,
            agency_profile_id: companyId,
            status,
            accepted_at: status === 'active' ? now : null,
            notes: 'DoH desk',
            updated_at: now,
          },
          { onConflict: 'school_profile_id,agency_profile_id' }
        )
        .select('*')
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (status === 'active') {
        await supabase
          .from('school_profiles')
          .update({
            primary_agency_profile_id: companyId,
            member_type: ['hospital', 'clinic', 'shelter'].includes(
              String(fac.member_type || '')
            )
              ? fac.member_type
              : 'hospital',
            updated_at: now,
          })
          .eq('id', schoolProfileId);
      }
      return NextResponse.json({ success: true, link: data });
    }

    // List health facilities on platform for DoH add
    if (action === 'list_candidates') {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_type')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (
        !agencyGate ||
        familyForAgencyType(String(agencyGate.agency_type || '')) !== 'health'
      ) {
        return NextResponse.json(
          { error: 'DoH only' },
          { status: 403 }
        );
      }

      const facilityRows = await fetchAllPaged(
        supabase,
        'school_profiles',
        'id, profile_id, school_name, emis_number, province, district, member_type, status, learner_count_enrolled',
        (q) =>
          q
            .in('member_type', ['hospital', 'clinic', 'shelter'])
            .order('school_name', { ascending: true })
      );

      const links = await fetchAgencySchoolLinks(supabase, companyId, [
        'pending',
        'active',
        'suspended',
      ]);
      const linkBySid = new Map(
        links.map((l) => [
          Number(l.school_profile_id),
          { status: String(l.status), link_id: Number(l.id) },
        ])
      );

      const facilities = facilityRows.map((s) => {
        const link = linkBySid.get(Number(s.id));
        return {
          company_id: Number(s.profile_id) || null,
          school_profile_id: Number(s.id),
          name: String(s.school_name || `Facility ${s.id}`),
          member_type: s.member_type || 'hospital',
          province: s.province,
          district: s.district,
          learners: s.learner_count_enrolled,
          link_status: link?.status || null,
          already_linked: Boolean(
            link && ['pending', 'active'].includes(link.status)
          ),
        };
      });

      return NextResponse.json({
        success: true,
        programme: 'health',
        facilities,
        schools: facilities,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function emptySummary() {
  return {
    facilityCount: 0,
    schoolCount: 0,
    activeLinks: 0,
    pendingLinks: 0,
    suspendedLinks: 0,
    totalPatients: 0,
    totalLearners: 0,
    hospitals: 0,
    clinics: 0,
    other: 0,
    districts: 0,
  };
}
