import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { fetchAllPaged, fetchByIds } from '@/lib/schools/supabase-page';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * DBE service provider register — SPs linked to the department.
 * GET ?companyId=&status=active|pending|all&district=&q=
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
          error: 'Only a registered DBE / PEU can view the SP register',
          success: false,
        },
        { status: 403 }
      );
    }

    const linkStatus = String(sp.get('status') || 'all').toLowerCase();
    const filterDistrict = String(sp.get('district') || '').trim();
    const q = String(sp.get('q') || '').trim().toLowerCase();

    const statuses =
      linkStatus === 'active'
        ? ['active']
        : linkStatus === 'pending'
          ? ['pending']
          : ['active', 'pending', 'suspended', 'rejected'];

    let links: Array<Record<string, unknown>>;
    let linksTotal = 0;
    try {
      const [countRes, pagedLinks] = await Promise.all([
        supabase
          .from('nsnp_isp_agency_links')
          .select('id', { count: 'exact', head: true })
          .eq('agency_profile_id', companyId)
          .in('status', statuses),
        fetchAllPaged(
          supabase,
          'nsnp_isp_agency_links',
          'id, isp_profile_id, agency_profile_id, status, accepted_at, requested_at, notes, updated_at',
          (qb) =>
            qb
              .eq('agency_profile_id', companyId)
              .in('status', statuses)
              .order('updated_at', { ascending: false }),
          500,
          500
        ),
      ]);
      linksTotal = Number(countRes.count || 0);
      links = pagedLinks;
    } catch (e: unknown) {
      return NextResponse.json({
        success: true,
        sps: [],
        kpis: emptyKpis(),
        warning: e instanceof Error ? e.message : 'Could not load SP links',
      });
    }

    const ispIds = [
      ...new Set(
        links
          .map((l) => Number(l.isp_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];

    if (!ispIds.length) {
      return NextResponse.json({
        success: true,
        generated_at: new Date().toISOString(),
        agency: {
          profile_id: companyId,
          name: agency.agency_name || 'Department',
          type: agency.agency_type,
        },
        kpis: emptyKpis(),
        byDistrict: [],
        byCluster: [],
        byStatus: [],
        sps: [],
        facets: { districts: [], clusters: [] },
      });
    }

    const [ispRows, profiles] = await Promise.all([
      fetchByIds(
        supabase,
        'nsnp_isp_profiles',
        'profile_id, trading_name, provinces, district, cluster_allocation, csd_number, compliance_status, registry_source, registry_imported_at, contact_name, contact_phone, contact_email, food_handling_cert, approved_at',
        ispIds,
        'profile_id'
      ).catch(() =>
        fetchByIds(
          supabase,
          'nsnp_isp_profiles',
          'profile_id, trading_name, provinces, compliance_status',
          ispIds,
          'profile_id'
        )
      ),
      fetchByIds(
        supabase,
        'profiles',
        'id, trading_name, legal_name, city, province, status',
        ispIds
      ).catch(() => [] as Array<Record<string, unknown>>),
    ]);

    const ispById = new Map(
      ispRows.map((r) => [Number(r.profile_id), r] as const)
    );
    const profById = new Map(profiles.map((p) => [Number(p.id), p] as const));
    const linkByIsp = new Map(
      links.map((l) => [Number(l.isp_profile_id), l] as const)
    );

    // Count school connections per SP (active links under this agency's schools is heavy — skip full graph; use global school_isp_links count per SP)
    const schoolLinkCounts = new Map<number, number>();
    for (let i = 0; i < ispIds.length; i += 100) {
      const slice = ispIds.slice(i, i + 100);
      const { data } = await supabase
        .from('school_isp_links')
        .select('isp_profile_id, status')
        .in('isp_profile_id', slice)
        .eq('status', 'active');
      for (const row of data || []) {
        const id = Number(row.isp_profile_id);
        schoolLinkCounts.set(id, (schoolLinkCounts.get(id) || 0) + 1);
      }
    }

    let sps = ispIds.map((id) => {
      const isp = ispById.get(id) || {};
      const prof = profById.get(id) || {};
      const link = linkByIsp.get(id) || {};
      const name =
        String(isp.trading_name || '') ||
        String(prof.trading_name || '') ||
        String(prof.legal_name || '') ||
        `SP ${id}`;
      const provinces = Array.isArray(isp.provinces)
        ? (isp.provinces as string[])
        : [];
      return {
        isp_profile_id: id,
        company_id: id,
        name,
        csd_number: isp.csd_number ? String(isp.csd_number) : null,
        district: isp.district
          ? String(isp.district)
          : prof.city
            ? String(prof.city)
            : null,
        cluster_allocation: isp.cluster_allocation
          ? String(isp.cluster_allocation)
          : null,
        province:
          provinces[0] ||
          (prof.province ? String(prof.province) : null) ||
          null,
        provinces,
        compliance_status: String(
          isp.compliance_status || 'pending'
        ).toLowerCase(),
        link_status: String(link.status || 'pending').toLowerCase(),
        registry_source: isp.registry_source
          ? String(isp.registry_source)
          : null,
        contact_name: isp.contact_name ? String(isp.contact_name) : null,
        contact_phone: isp.contact_phone ? String(isp.contact_phone) : null,
        contact_email: isp.contact_email ? String(isp.contact_email) : null,
        food_handling_cert: Boolean(isp.food_handling_cert),
        schools_linked: schoolLinkCounts.get(id) || 0,
        accepted_at: link.accepted_at || null,
        updated_at: link.updated_at || null,
      };
    });

    if (filterDistrict) {
      sps = sps.filter(
        (s) =>
          (s.district || '').toLowerCase() === filterDistrict.toLowerCase()
      );
    }
    if (q) {
      sps = sps.filter((s) => {
        const hay = [
          s.name,
          s.csd_number,
          s.district,
          s.cluster_allocation,
          s.province,
          s.contact_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    sps.sort((a, b) => {
      const d = (a.district || '').localeCompare(b.district || '');
      if (d) return d;
      return a.name.localeCompare(b.name);
    });

    const kpis = {
      sps: !filterDistrict && !q ? linksTotal || sps.length : sps.length,
      active: sps.filter((s) => s.link_status === 'active').length,
      pending: sps.filter((s) => s.link_status === 'pending').length,
      with_csd: sps.filter((s) => s.csd_number).length,
      from_registry: sps.filter((s) => s.registry_source === 'xlsx_import')
        .length,
      districts: new Set(sps.map((s) => s.district).filter(Boolean)).size,
      clusters: new Set(
        sps.map((s) => s.cluster_allocation).filter(Boolean)
      ).size,
      schools_connected: sps.reduce((n, s) => n + s.schools_linked, 0),
      compliant: sps.filter((s) => s.compliance_status === 'compliant')
        .length,
    };

    const byDistrict = rollup(sps, (s) => s.district || 'Unknown');
    const byCluster = rollup(
      sps,
      (s) => s.cluster_allocation || 'Unallocated'
    );
    const byStatus = rollup(sps, (s) => s.link_status || 'unknown');

    const facets = {
      districts: [
        ...new Set(sps.map((s) => s.district).filter(Boolean) as string[]),
      ].sort(),
      clusters: [
        ...new Set(
          sps.map((s) => s.cluster_allocation).filter(Boolean) as string[]
        ),
      ].sort(),
    };

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      agency: {
        profile_id: companyId,
        name: agency.agency_name || 'Department',
        type: agency.agency_type,
      },
      kpis,
      truncated: linksTotal > links.length,
      total: linksTotal,
      byDistrict,
      byCluster,
      byStatus,
      sps,
      facets,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Error',
        success: false,
      },
      { status: 500 }
    );
  }
}

function emptyKpis() {
  return {
    sps: 0,
    active: 0,
    pending: 0,
    with_csd: 0,
    from_registry: 0,
    districts: 0,
    clusters: 0,
    schools_connected: 0,
    compliant: 0,
  };
}

function rollup<T>(
  rows: T[],
  keyFn: (r: T) => string
): Array<{ key: string; sps: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r) || 'Unknown';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, sps: count }))
    .sort((a, b) => b.sps - a.sps || a.key.localeCompare(b.key));
}
