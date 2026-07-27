import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * DBE school register report — counts, geography, enrolments for all linked schools.
 * Lightweight (no feeding/prize history) so 5,000+ schools stay under timeout.
 *
 * GET ?companyId=&status=active|pending|all&province=&district=&municipality=&q=
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json(
        { error: 'companyId required', success: false },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency) {
      return NextResponse.json(
        {
          error:
            'Only a registered DBE / PEU / DoH can view the school register report',
          success: false,
        },
        { status: 403 }
      );
    }

    const linkStatus = String(sp.get('status') || 'active').toLowerCase();
    const filterProvince = String(sp.get('province') || '').trim();
    const filterDistrict = String(sp.get('district') || '').trim();
    const filterMunicipality = String(sp.get('municipality') || '').trim();
    const filterCmc = String(sp.get('cmc') || '').trim();
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const includeSchools =
      sp.get('includeSchools') !== '0' && sp.get('includeSchools') !== 'false';

    const links = await fetchAllLinks(supabase, companyId, linkStatus);
    const schoolIds = [
      ...new Set(
        links
          .map((l) => Number(l.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];

    if (!schoolIds.length) {
      return NextResponse.json({
        success: true,
        generated_at: new Date().toISOString(),
        agency: agencyMeta(agency, companyId),
        kpis: emptyKpis(),
        byProvince: [],
        byDistrict: [],
        byCmc: [],
        byCircuit: [],
        byMunicipality: [],
        byWard: [],
        byQuintile: [],
        byLevel: [],
        byPhase: [],
        topSchoolsByEnrolment: [],
        schools: [],
        facets: {
          provinces: [],
          districts: [],
          municipalities: [],
          cmcs: [],
        },
        message: 'No schools linked yet — import the registry or approve joins.',
      });
    }

    const schoolsRaw = await fetchSchoolProfiles(supabase, schoolIds);
    const linkBySchool = new Map(
      links.map((l) => [Number(l.school_profile_id), l] as const)
    );

    type SchoolRow = ReturnType<typeof mapSchool>;
    let schools: SchoolRow[] = schoolsRaw.map((s) =>
      mapSchool(s, linkBySchool.get(Number(s.id)))
    );

    if (filterProvince) {
      schools = schools.filter(
        (s) =>
          (s.province || '').toLowerCase() === filterProvince.toLowerCase()
      );
    }
    if (filterDistrict) {
      schools = schools.filter(
        (s) =>
          (s.district || '').toLowerCase() === filterDistrict.toLowerCase()
      );
    }
    if (filterMunicipality) {
      schools = schools.filter(
        (s) =>
          (s.local_municipality || '').toLowerCase() ===
          filterMunicipality.toLowerCase()
      );
    }
    if (filterCmc) {
      schools = schools.filter(
        (s) => (s.cmc || '').toLowerCase() === filterCmc.toLowerCase()
      );
    }
    if (q) {
      schools = schools.filter((s) => {
        const hay = [
          s.school_name,
          s.natemis,
          s.emis_number,
          s.district,
          s.circuit,
          s.cmc,
          s.local_municipality,
          s.municipality_ward,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    schools.sort((a, b) => {
      const d = (a.district || '').localeCompare(b.district || '');
      if (d) return d;
      const c = (a.circuit || '').localeCompare(b.circuit || '');
      if (c) return c;
      return a.school_name.localeCompare(b.school_name);
    });

    const kpis = {
      schools: schools.length,
      schools_with_natemis: schools.filter((s) => s.natemis).length,
      schools_with_enrolment: schools.filter(
        (s) => s.learners_enrolled > 0 || s.nsnp_approved_enrol > 0
      ).length,
      total_learners_enrolled: sum(schools, (s) => s.learners_enrolled),
      total_nsnp_eligible: sum(schools, (s) => s.learners_nsnp_eligible),
      total_nsnp_applic: sum(schools, (s) => s.nsnp_applic_enrol),
      total_final_emis: sum(schools, (s) => s.final_emis_enrol),
      total_nsnp_approved: sum(schools, (s) => s.nsnp_approved_enrol),
      avg_learners_per_school: schools.length
        ? Math.round(
            (sum(schools, (s) => s.learners_enrolled) / schools.length) * 10
          ) / 10
        : 0,
      median_learners: median(
        schools.map((s) => s.learners_enrolled).filter((n) => n > 0)
      ),
      provinces: distinctCount(schools, (s) => s.province),
      districts: distinctCount(schools, (s) => s.district),
      cmcs: distinctCount(schools, (s) => s.cmc),
      circuits: distinctCount(schools, (s) => s.circuit),
      municipalities: distinctCount(schools, (s) => s.local_municipality),
      wards: distinctCount(schools, (s) => s.municipality_ward),
      quintile_1: schools.filter((s) => s.quintile === 1).length,
      quintile_2: schools.filter((s) => s.quintile === 2).length,
      quintile_3: schools.filter((s) => s.quintile === 3).length,
      quintile_4: schools.filter((s) => s.quintile === 4).length,
      quintile_5: schools.filter((s) => s.quintile === 5).length,
      quintile_unknown: schools.filter(
        (s) => s.quintile == null || s.quintile < 1 || s.quintile > 5
      ).length,
      link_active: schools.filter((s) => s.link_status === 'active').length,
      link_pending: schools.filter((s) => s.link_status === 'pending').length,
      registry_imported: schools.filter(
        (s) => s.registry_source === 'xlsx_import'
      ).length,
    };

    const byProvince = rollup(schools, (s) => s.province || 'Unknown');
    const byDistrict = rollup(
      schools,
      (s) =>
        [s.district, s.province].filter(Boolean).join(', ') || 'Unknown'
    );
    const byCmc = rollup(
      schools,
      (s) =>
        [s.cmc, s.district, s.province].filter(Boolean).join(', ') ||
        'Unknown'
    );
    const byCircuit = rollup(
      schools,
      (s) =>
        [s.circuit, s.cmc || s.district, s.province]
          .filter(Boolean)
          .join(', ') || 'Unknown'
    );
    const byMunicipality = rollup(
      schools,
      (s) =>
        [s.local_municipality, s.district, s.province]
          .filter(Boolean)
          .join(', ') || 'Unknown'
    );
    const byWard = rollup(
      schools,
      (s) => {
        if (!s.municipality_ward) {
          return (
            [s.local_municipality, s.district].filter(Boolean).join(', ') ||
            'No ward'
          );
        }
        return [
          `Ward ${s.municipality_ward}`,
          s.local_municipality,
          s.district,
        ]
          .filter(Boolean)
          .join(', ');
      }
    );
    const byQuintile = rollup(schools, (s) =>
      s.quintile != null && s.quintile >= 1 && s.quintile <= 5
        ? `Q${s.quintile}`
        : 'Unspecified'
    );
    const byLevel = rollup(schools, (s) => s.level_label || 'Unspecified');
    const byPhase = rollup(schools, (s) => s.phase || 'Unspecified');

    const topSchoolsByEnrolment = [...schools]
      .sort(
        (a, b) =>
          Math.max(b.learners_enrolled, b.nsnp_approved_enrol) -
          Math.max(a.learners_enrolled, a.nsnp_approved_enrol)
      )
      .slice(0, 25)
      .map((s) => ({
        school_name: s.school_name,
        district: s.district,
        local_municipality: s.local_municipality,
        quintile: s.quintile,
        learners_enrolled: s.learners_enrolled,
        nsnp_approved_enrol: s.nsnp_approved_enrol,
        natemis: s.natemis,
      }));

    const facets = {
      provinces: distinctSorted(schools, (s) => s.province),
      districts: distinctSorted(schools, (s) => s.district),
      municipalities: distinctSorted(schools, (s) => s.local_municipality),
      cmcs: distinctSorted(schools, (s) => s.cmc),
    };

    // Cap school list in JSON for UI (full export uses same endpoint with export=1)
    const exportAll = sp.get('export') === '1' || sp.get('export') === 'true';
    const schoolLimit = exportAll ? schools.length : Math.min(schools.length, 500);
    const schoolList = includeSchools ? schools.slice(0, schoolLimit) : [];

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      agency: agencyMeta(agency, companyId),
      filters: {
        status: linkStatus,
        province: filterProvince || null,
        district: filterDistrict || null,
        municipality: filterMunicipality || null,
        cmc: filterCmc || null,
        q: q || null,
      },
      kpis,
      byProvince,
      byDistrict,
      byCmc,
      byCircuit,
      byMunicipality,
      byWard: byWard.slice(0, 200),
      byQuintile,
      byLevel,
      byPhase,
      topSchoolsByEnrolment,
      schools: schoolList,
      schools_total: schools.length,
      schools_returned: schoolList.length,
      schools_truncated: schools.length > schoolList.length,
      facets,
    });
  } catch (e: unknown) {
    console.error('[registry-report]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Report failed',
        success: false,
      },
      { status: 500 }
    );
  }
}

function agencyMeta(agency: Record<string, unknown>, companyId: number) {
  return {
    company_id: companyId,
    name: String(
      agency.agency_name || agency.name || `Department ${companyId}`
    ),
    type: agency.agency_type != null ? String(agency.agency_type) : null,
    province: agency.province != null ? String(agency.province) : null,
  };
}

function emptyKpis() {
  return {
    schools: 0,
    schools_with_natemis: 0,
    schools_with_enrolment: 0,
    total_learners_enrolled: 0,
    total_nsnp_eligible: 0,
    total_nsnp_applic: 0,
    total_final_emis: 0,
    total_nsnp_approved: 0,
    avg_learners_per_school: 0,
    median_learners: 0,
    provinces: 0,
    districts: 0,
    cmcs: 0,
    circuits: 0,
    municipalities: 0,
    wards: 0,
    quintile_1: 0,
    quintile_2: 0,
    quintile_3: 0,
    quintile_4: 0,
    quintile_5: 0,
    quintile_unknown: 0,
    link_active: 0,
    link_pending: 0,
    registry_imported: 0,
  };
}

async function fetchAllLinks(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  linkStatus: string
) {
  const pageSize = 1000;
  const all: Array<Record<string, unknown>> = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from('school_agency_links')
      .select('school_profile_id, status, accepted_at, notes, created_at')
      .eq('agency_profile_id', companyId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (linkStatus === 'all') {
      q = q.in('status', ['active', 'pending', 'suspended']);
    } else if (linkStatus === 'pending') {
      q = q.eq('status', 'pending');
    } else {
      q = q.eq('status', 'active');
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      all.push({ ...(row as object) } as Record<string, unknown>);
    }
    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 50000) break;
  }
  return all;
}

async function fetchSchoolProfiles(
  supabase: ReturnType<typeof getSupabaseServer>,
  schoolIds: number[]
) {
  const all: Array<Record<string, unknown>> = [];
  let useLean = false;

  for (let i = 0; i < schoolIds.length; i += 200) {
    const chunk = schoolIds.slice(i, i + 200);

    // Literal select strings (not a variable) so Supabase client types rows correctly.
    const result = useLean
      ? await supabase
          .from('school_profiles')
          .select(
            'id, profile_id, school_name, emis_number, province, district, circuit, quintile, phase, learner_count_enrolled, learner_count_nsnp_eligible, learner_count_verified, status, member_type'
          )
          .in('id', chunk)
      : await supabase
          .from('school_profiles')
          .select(
            'id, profile_id, school_name, emis_number, natemis, province, district, circuit, cmc, quintile, local_municipality, municipality_ward, level_label, phase, learner_count_enrolled, learner_count_nsnp_eligible, learner_count_verified, nsnp_applic_enrol, final_emis_enrol, final_nsnp_approved_enrol, enrolment_year, registry_source, registry_imported_at, status, member_type, primary_agency_profile_id'
          )
          .in('id', chunk);

    if (result.error) {
      if (
        !useLean &&
        /column|schema cache|does not exist/i.test(result.error.message)
      ) {
        useLean = true;
        i -= 200;
        continue;
      }
      throw new Error(result.error.message);
    }

    for (const row of result.data || []) {
      all.push({ ...(row as object) } as Record<string, unknown>);
    }
  }
  return all;
}

function mapSchool(
  s: Record<string, unknown>,
  link?: Record<string, unknown>
) {
  const enrolled = Number(s.learner_count_enrolled || 0);
  const finalEmis = Number(s.final_emis_enrol || 0);
  const nsnpApproved = Number(s.final_nsnp_approved_enrol || 0);
  const nsnpApplic = Number(s.nsnp_applic_enrol || 0);
  const nsnpEligible = Number(
    s.learner_count_nsnp_eligible || nsnpApproved || nsnpApplic || 0
  );

  return {
    school_profile_id: Number(s.id),
    company_id: s.profile_id != null ? Number(s.profile_id) : null,
    school_name: String(s.school_name || `School ${s.id}`),
    emis_number: s.emis_number != null ? String(s.emis_number) : null,
    natemis: s.natemis != null ? String(s.natemis) : null,
    province: s.province != null ? String(s.province) : null,
    district: s.district != null ? String(s.district) : null,
    circuit: s.circuit != null ? String(s.circuit) : null,
    cmc: s.cmc != null ? String(s.cmc) : null,
    quintile: s.quintile != null ? Number(s.quintile) : null,
    local_municipality:
      s.local_municipality != null ? String(s.local_municipality) : null,
    municipality_ward:
      s.municipality_ward != null ? String(s.municipality_ward) : null,
    level_label: s.level_label != null ? String(s.level_label) : null,
    phase: s.phase != null ? String(s.phase) : null,
    learners_enrolled: enrolled || finalEmis || nsnpApproved || 0,
    learners_nsnp_eligible: nsnpEligible,
    learners_verified: Number(s.learner_count_verified || 0),
    nsnp_applic_enrol: nsnpApplic,
    final_emis_enrol: finalEmis,
    nsnp_approved_enrol: nsnpApproved,
    enrolment_year:
      s.enrolment_year != null ? String(s.enrolment_year) : '2026-27',
    registry_source:
      s.registry_source != null ? String(s.registry_source) : null,
    registry_imported_at:
      s.registry_imported_at != null
        ? String(s.registry_imported_at)
        : null,
    status: s.status != null ? String(s.status) : null,
    member_type: String(s.member_type || 'school'),
    link_status: link ? String(link.status) : 'active',
  };
}

type RollSchool = {
  learners_enrolled: number;
  learners_nsnp_eligible: number;
  nsnp_approved_enrol: number;
  final_emis_enrol: number;
  nsnp_applic_enrol: number;
};

function rollup<T extends RollSchool>(
  schools: T[],
  keyFn: (s: T) => string
) {
  const map = new Map<
    string,
    {
      key: string;
      schools: number;
      learners_enrolled: number;
      learners_nsnp_eligible: number;
      nsnp_approved_enrol: number;
      final_emis_enrol: number;
      nsnp_applic_enrol: number;
    }
  >();
  for (const s of schools) {
    const key = keyFn(s);
    if (!map.has(key)) {
      map.set(key, {
        key,
        schools: 0,
        learners_enrolled: 0,
        learners_nsnp_eligible: 0,
        nsnp_approved_enrol: 0,
        final_emis_enrol: 0,
        nsnp_applic_enrol: 0,
      });
    }
    const g = map.get(key)!;
    g.schools += 1;
    g.learners_enrolled += s.learners_enrolled;
    g.learners_nsnp_eligible += s.learners_nsnp_eligible;
    g.nsnp_approved_enrol += s.nsnp_approved_enrol;
    g.final_emis_enrol += s.final_emis_enrol;
    g.nsnp_applic_enrol += s.nsnp_applic_enrol;
  }
  return [...map.values()].sort(
    (a, b) =>
      b.schools - a.schools || b.learners_enrolled - a.learners_enrolled
  );
}

function sum<T>(arr: T[], fn: (x: T) => number) {
  return arr.reduce((n, x) => n + fn(x), 0);
}

function distinctCount<T>(arr: T[], fn: (x: T) => string | null | undefined) {
  const set = new Set<string>();
  for (const x of arr) {
    const v = fn(x);
    if (v) set.add(v);
  }
  return set.size;
}

function distinctSorted<T>(
  arr: T[],
  fn: (x: T) => string | null | undefined
) {
  const set = new Set<string>();
  for (const x of arr) {
    const v = fn(x);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}
