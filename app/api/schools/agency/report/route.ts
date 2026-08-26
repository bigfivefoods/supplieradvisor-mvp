import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

import {
  fetchAgencySchoolLinks,
  fetchAgencySchoolLinksSlice,
  fetchByIds,
  loadAgencyGeoRollup,
  loadAgencyLinkSummary,
} from '@/lib/schools/supabase-page';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * DBE / PEU multi-member programme reports.
 * Only **approved** (status=active) school associations are included.
 *
 * GET ?companyId=&from=&to=&report=overview|province|district|quintile|prizes|feeding|learners|compliance|map
 *     &province=&district=&status=active (default active only)
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

    const to = sp.get('to') || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setMonth(fromDefault.getMonth() - 3);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);
    const report = String(sp.get('report') || 'overview');
    const filterProvince = String(sp.get('province') || '').trim();
    const filterDistrict = String(sp.get('district') || '').trim();
    // default: only agency-approved (active) members
    const linkStatus = String(sp.get('status') || 'active').toLowerCase();

    const supabase = getSupabaseServer();

    const { data: agency, error: aErr } = await supabase
      .from('nsnp_agency_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (aErr && /does not exist|schema cache/i.test(aErr.message)) {
      return NextResponse.json({
        success: true,
        warning: 'Run agency migrations',
        members: [],
        kpis: {},
      });
    }
    if (!agency) {
      return NextResponse.json(
        {
          error:
            'This company is not registered as a DBE/PEU agency. Register under Schools → DBE first.',
        },
        { status: 403 }
      );
    }

    const needFullMembers = new Set([
      'members',
      'map',
      'register',
      'prizes',
      'feeding',
      'learners',
      'compliance',
    ]);
    const wantFullList =
      needFullMembers.has(report) ||
      sp.get('all') === '1' ||
      sp.get('all') === 'true';

    let links: Array<Record<string, unknown>>;
    const [summaryCounts, geoRollup] = await Promise.all([
      loadAgencyLinkSummary(supabase, companyId).catch(() => null),
      loadAgencyGeoRollup(supabase, companyId),
    ]);
    try {
      const statuses =
        linkStatus === 'all'
          ? ['active', 'pending', 'suspended']
          : linkStatus === 'pending'
            ? ['pending']
            : ['active'];
      links = wantFullList
        ? await fetchAgencySchoolLinks(supabase, companyId, statuses)
        : await fetchAgencySchoolLinksSlice(supabase, companyId, {
            statuses,
            limit: 250,
          });
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : 'Failed to load school links',
        },
        { status: 400 }
      );
    }

    const schoolIds = [
      ...new Set(
        links
          .map((l) => Number(l.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];

    // SP coverage is independent of school members — always load for DBE
    const ispCoverage = await loadIspCoverage(supabase, companyId, schoolIds);

    if (!schoolIds.length) {
      return NextResponse.json({
        success: true,
        period: { from, to },
        report,
        agency: {
          id: agency.id,
          name: agency.agency_name,
          type: agency.agency_type,
          province: agency.province,
        },
        kpis: {
          ...emptyKpis(),
          isps: ispCoverage.summary.total,
          isps_active: ispCoverage.summary.active,
          isps_pending: ispCoverage.summary.pending,
        },
        members: [],
        byProvince: [],
        byDistrict: [],
        byCircuit: [],
        byQuintile: [],
        schoolsByProvince: [],
        schoolsByDistrict: [],
        schoolsByCircuit: [],
        isps: ispCoverage.isps,
        ispsByProvince: ispCoverage.byProvince,
        ispsByDistrict: ispCoverage.byDistrict,
        coverageByProvince: ispCoverage.byProvince.map((r) => ({
          key: r.key,
          schools: 0,
          learners: 0,
          isps: r.isps,
          isps_active: r.isps_active,
          isps_pending: r.isps_pending,
        })),
        coverageByDistrict: [],
        prizeLeaderboard: [],
        feedingTrend: [],
        facets: {
          provinces: ispCoverage.facets.provinces,
          districts: ispCoverage.facets.districts,
        },
        warnings: ['No approved organisations linked yet'],
      });
    }

    let schools: Array<Record<string, unknown>> = [];
    try {
      schools = await fetchByIds(
        supabase,
        'school_profiles',
        'id, profile_id, school_name, emis_number, province, district, circuit, quintile, urban_rural, city, lat, lng, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, staff_count, status, feeding_lunch, feeding_breakfast, member_type',
        schoolIds
      );
    } catch (e: unknown) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Failed to load schools' },
        { status: 400 }
      );
    }

    const filterCircuit = String(sp.get('circuit') || '').trim();
    const filterQuintile = String(sp.get('quintile') || '').trim();

    let filtered = schools;
    if (filterProvince) {
      filtered = filtered.filter(
        (s) =>
          String(s.province || '').toLowerCase() ===
          filterProvince.toLowerCase()
      );
    }
    if (filterDistrict) {
      filtered = filtered.filter(
        (s) =>
          String(s.district || '').toLowerCase() ===
          filterDistrict.toLowerCase()
      );
    }
    if (filterCircuit) {
      filtered = filtered.filter(
        (s) =>
          String(s.circuit || '').toLowerCase() === filterCircuit.toLowerCase()
      );
    }
    if (filterQuintile) {
      const qn = Number(filterQuintile);
      filtered = filtered.filter((s) => Number(s.quintile) === qn);
    }

    const filteredIds = filtered.map((s) => Number(s.id));
    const linkBySchool = new Map(
      links.map((l) => [Number(l.school_profile_id), l])
    );

    // Skip heavy feeding/prize history for geo/register-style reports (5k+ schools)
    const lightReport = new Set([
      'overview',
      'hierarchy',
      'coverage',
      'province',
      'district',
      'circuit',
      'quintile',
      'members',
      'map',
      'isps',
      'register',
    ]);
    const needOps = !lightReport.has(report);

    const feedingBySchool = new Map<
      number,
      { days: number; planned: number; served: number; waste: number }
    >();
    const attendanceBySchool = new Map<
      number,
      { days: number; present: number; enrolled: number }
    >();
    const receiptsBySchool = new Map<
      number,
      { count: number; nonApproved: number; approvedLines: number; totalLines: number }
    >();
    const ordersBySchool = new Map<
      number,
      { count: number; spend: number }
    >();
    const prizeBySchool = new Map<number, Record<string, unknown>>();
    const complianceBySchool = new Map<number, number>();

    if (needOps) {
      for (let i = 0; i < filteredIds.length; i += 100) {
        const chunk = filteredIds.slice(i, i + 100);
        const [feedRes, attRes, recRes, ordRes] = await Promise.all([
          supabase
            .from('school_feeding_days')
            .select(
              'school_profile_id, feed_date, planned_meals, served_meals, waste_meals'
            )
            .in('school_profile_id', chunk)
            .gte('feed_date', from)
            .lte('feed_date', to)
            .limit(10000),
          supabase
            .from('school_attendance_days')
            .select('school_profile_id, attendance_date, present, enrolled')
            .in('school_profile_id', chunk)
            .gte('attendance_date', from)
            .lte('attendance_date', to)
            .limit(10000),
          supabase
            .from('school_kitchen_receipts')
            .select('school_profile_id, compliance_ok, lines, received_at')
            .in('school_profile_id', chunk)
            .gte('received_at', from)
            .lte('received_at', to)
            .limit(10000),
          supabase
            .from('school_purchase_orders')
            .select('school_profile_id, total_amount, order_date, status')
            .in('school_profile_id', chunk)
            .gte('order_date', from)
            .lte('order_date', to)
            .limit(10000),
        ]);

        for (const f of feedRes.data || []) {
          const sid = Number(f.school_profile_id);
          if (!feedingBySchool.has(sid)) {
            feedingBySchool.set(sid, {
              days: 0,
              planned: 0,
              served: 0,
              waste: 0,
            });
          }
          const m = feedingBySchool.get(sid)!;
          m.days += 1;
          m.planned += Number(f.planned_meals || 0);
          m.served += Number(f.served_meals || 0);
          m.waste += Number(f.waste_meals || 0);
        }
        for (const a of attRes.data || []) {
          const sid = Number(a.school_profile_id);
          if (!attendanceBySchool.has(sid)) {
            attendanceBySchool.set(sid, {
              days: 0,
              present: 0,
              enrolled: 0,
            });
          }
          const m = attendanceBySchool.get(sid)!;
          m.days += 1;
          m.present += Number(a.present || 0);
          m.enrolled += Number(a.enrolled || 0);
        }
        for (const r of recRes.data || []) {
          const sid = Number(r.school_profile_id);
          if (!receiptsBySchool.has(sid)) {
            receiptsBySchool.set(sid, {
              count: 0,
              nonApproved: 0,
              approvedLines: 0,
              totalLines: 0,
            });
          }
          const m = receiptsBySchool.get(sid)!;
          m.count += 1;
          if (r.compliance_ok === false) m.nonApproved += 1;
          const lines = Array.isArray(r.lines) ? r.lines : [];
          for (const line of lines as Array<{ approved?: boolean }>) {
            m.totalLines += 1;
            if (line.approved !== false) m.approvedLines += 1;
          }
        }
        for (const o of ordRes.data || []) {
          const sid = Number(o.school_profile_id);
          if (!ordersBySchool.has(sid)) {
            ordersBySchool.set(sid, { count: 0, spend: 0 });
          }
          const m = ordersBySchool.get(sid)!;
          m.count += 1;
          m.spend += Number(o.total_amount || 0);
        }
      }

      for (let i = 0; i < filteredIds.length; i += 200) {
        const chunk = filteredIds.slice(i, i + 200);
        const { data: scores } = await supabase
          .from('nsnp_prize_scores')
          .select(
            'school_profile_id, total_score, approved_brand_pct, feeding_completeness_pct, data_quality_pct, stock_discipline_pct, computed_at'
          )
          .in('school_profile_id', chunk)
          .order('computed_at', { ascending: false })
          .limit(2000);
        for (const sc of scores || []) {
          const sid = Number(sc.school_profile_id);
          if (!prizeBySchool.has(sid)) {
            prizeBySchool.set(sid, sc as Record<string, unknown>);
          }
        }
      }

      for (let i = 0; i < filteredIds.length; i += 200) {
        const chunk = filteredIds.slice(i, i + 200);
        const { data: comps } = await supabase
          .from('school_compliance_events')
          .select('school_profile_id, status')
          .in('school_profile_id', chunk)
          .in('status', ['open', 'in_progress'])
          .limit(5000);
        for (const c of comps || []) {
          const sid = Number(c.school_profile_id);
          complianceBySchool.set(sid, (complianceBySchool.get(sid) || 0) + 1);
        }
      }
    }

    type MemberRow = {
      member_type: string;
      school_profile_id: number;
      company_id: number | null;
      name: string;
      emis: string | null;
      province: string | null;
      district: string | null;
      circuit: string | null;
      quintile: number | null;
      lat: number | null;
      lng: number | null;
      link_status: string;
      learners_enrolled: number;
      learners_verified: number;
      learners_eligible: number;
      staff: number;
      meals_served: number;
      meals_planned: number;
      meals_waste: number;
      feeding_days: number;
      attendance_days: number;
      present_total: number;
      po_spend: number;
      po_count: number;
      approved_brand_pct: number | null;
      non_approved_receipts: number;
      prize_score: number | null;
      open_compliance: number;
      verify_pct: number;
    };

    const members: MemberRow[] = filtered.map((s) => {
      const sid = Number(s.id);
      const feed = feedingBySchool.get(sid);
      const att = attendanceBySchool.get(sid);
      const rec = receiptsBySchool.get(sid);
      const ord = ordersBySchool.get(sid);
      const prize = prizeBySchool.get(sid);
      const enrolled = Number(s.learner_count_enrolled || 0);
      const verified = Number(s.learner_count_verified || 0);
      const approvedPct =
        rec && rec.totalLines > 0
          ? Math.round((rec.approvedLines / rec.totalLines) * 1000) / 10
          : prize?.approved_brand_pct != null
            ? Number(prize.approved_brand_pct)
            : null;
      const link = linkBySchool.get(sid);
      return {
        member_type: String(s.member_type || 'school'),
        school_profile_id: sid,
        company_id: s.profile_id != null ? Number(s.profile_id) : null,
        name: String(s.school_name || `Facility ${sid}`),
        emis: s.emis_number != null ? String(s.emis_number) : null,
        province: s.province != null ? String(s.province) : null,
        district: s.district != null ? String(s.district) : null,
        circuit: s.circuit != null ? String(s.circuit) : null,
        quintile: s.quintile != null ? Number(s.quintile) : null,
        lat: s.lat != null ? Number(s.lat) : null,
        lng: s.lng != null ? Number(s.lng) : null,
        link_status: link ? String(link.status) : 'active',
        learners_enrolled: enrolled,
        learners_verified: verified,
        learners_eligible: Number(s.learner_count_nsnp_eligible || 0),
        staff: Number(s.staff_count || 0),
        meals_served: feed?.served || 0,
        meals_planned: feed?.planned || 0,
        meals_waste: feed?.waste || 0,
        feeding_days: feed?.days || 0,
        attendance_days: att?.days || 0,
        present_total: att?.present || 0,
        po_spend: Math.round((ord?.spend || 0) * 100) / 100,
        po_count: ord?.count || 0,
        approved_brand_pct: approvedPct,
        non_approved_receipts: rec?.nonApproved || 0,
        prize_score:
          prize?.total_score != null ? Number(prize.total_score) : null,
        open_compliance: complianceBySchool.get(sid) || 0,
        verify_pct:
          enrolled > 0
            ? Math.round((verified / enrolled) * 1000) / 10
            : 0,
      };
    });

    // Sort by learners desc for overview
    members.sort((a, b) => b.learners_enrolled - a.learners_enrolled);

    const schoolMembers = members.filter(
      (m) => !['hospital', 'clinic', 'shelter'].includes(m.member_type)
    );
    const kpis = {
      organisations: summaryCounts?.activeLinks ?? schoolMembers.length,
      schools: summaryCounts?.activeLinks ?? schoolMembers.length,
      // legacy key kept for UI compatibility — always 0 (schools module only)
      hospitals: 0,
      other_orgs: 0,
      totalLearners:
        summaryCounts?.totalLearners ??
        members.reduce((n, m) => n + m.learners_enrolled, 0),
      totalVerified:
        summaryCounts?.totalVerified ??
        members.reduce((n, m) => n + m.learners_verified, 0),
      totalEligible: members.reduce((n, m) => n + m.learners_eligible, 0),
      totalStaff: members.reduce((n, m) => n + m.staff, 0),
      mealsServed: members.reduce((n, m) => n + m.meals_served, 0),
      mealsPlanned: members.reduce((n, m) => n + m.meals_planned, 0),
      mealsWaste: members.reduce((n, m) => n + m.meals_waste, 0),
      wastePct: (() => {
        const s = members.reduce((n, m) => n + m.meals_served, 0);
        const w = members.reduce((n, m) => n + m.meals_waste, 0);
        return s > 0 ? Math.round((w / s) * 1000) / 10 : 0;
      })(),
      poSpend: Math.round(
        members.reduce((n, m) => n + m.po_spend, 0) * 100
      ) / 100,
      poCount: members.reduce((n, m) => n + m.po_count, 0),
      nonApprovedReceipts: members.reduce(
        (n, m) => n + m.non_approved_receipts,
        0
      ),
      openCompliance: members.reduce((n, m) => n + m.open_compliance, 0),
      avgPrizeScore: avg(
        members.map((m) => m.prize_score).filter((n): n is number => n != null)
      ),
      avgApprovedBrandPct: avg(
        members
          .map((m) => m.approved_brand_pct)
          .filter((n): n is number => n != null)
      ),
      avgVerifyPct: avg(members.map((m) => m.verify_pct)),
      withGps: members.filter(
        (m) => m.lat != null && m.lng != null && Number.isFinite(m.lat)
      ).length,
      pendingApprovals:
        summaryCounts?.pendingLinks ??
        links.filter((l) => l.status === 'pending').length,
      isps: ispCoverage.summary.total,
      isps_active: ispCoverage.summary.active,
      isps_pending: ispCoverage.summary.pending,
      provinces_with_schools:
        geoRollup.byProvince.filter((r) => r.key !== 'Unknown').length ||
        new Set(members.map((m) => m.province).filter(Boolean)).size,
      districts_with_schools:
        geoRollup.byDistrict.filter((r) => r.key !== 'Unknown').length ||
        new Set(members.map((m) => m.district).filter(Boolean)).size,
    };

    // Groupings — schools by geography (SQL rollup is complete at 5k; member sample is not)
    const byProvince = geoRollup.byProvince.length
      ? geoRollup.byProvince.map((r) => ({
          key: r.key,
          organisations: r.schools,
          learners: r.learners,
          verified: r.verified,
          meals_served: 0,
          po_spend: 0,
          avg_prize: null as number | null,
        }))
      : groupSum(members, (m) => m.province || 'Unknown');
    const byDistrict = geoRollup.byDistrict.length
      ? geoRollup.byDistrict.map((r) => ({
          key: r.key,
          organisations: r.schools,
          learners: r.learners,
          verified: r.verified,
          meals_served: 0,
          po_spend: 0,
          avg_prize: null as number | null,
        }))
      : groupSum(
          members,
          (m) =>
            [m.district, m.province].filter(Boolean).join(', ') || 'Unknown'
        );
    const byCircuit = groupSum(members, (m) => {
      if (m.circuit) {
        return [m.circuit, m.district, m.province].filter(Boolean).join(', ');
      }
      return [m.district, m.province].filter(Boolean).join(', ') || 'Unknown';
    });
    const byQuintile = groupSum(members, (m) =>
      m.quintile != null ? `Q${m.quintile}` : 'Unspecified'
    );

    // Explicit school counts (same data, clearer labels for coverage report)
    const schoolsByProvince = byProvince.map((r) => ({
      key: r.key,
      schools: r.organisations,
      organisations: r.organisations,
      learners: r.learners,
      verified: r.verified,
      meals_served: r.meals_served,
      po_spend: r.po_spend,
      avg_prize: r.avg_prize,
    }));
    const schoolsByDistrict = byDistrict.map((r) => ({
      key: r.key,
      schools: r.organisations,
      organisations: r.organisations,
      learners: r.learners,
      verified: r.verified,
      meals_served: r.meals_served,
      po_spend: r.po_spend,
      avg_prize: r.avg_prize,
    }));
    const schoolsByCircuit = byCircuit.map((r) => ({
      key: r.key,
      schools: r.organisations,
      organisations: r.organisations,
      learners: r.learners,
      verified: r.verified,
      meals_served: r.meals_served,
      po_spend: r.po_spend,
      avg_prize: r.avg_prize,
    }));

    // Combined coverage: schools + SPs per province / district
    const schoolProvMap = new Map(
      schoolsByProvince.map((r) => [r.key, r] as const)
    );
    const ispProvMap = new Map(
      ispCoverage.byProvince.map((r) => [r.key, r] as const)
    );
    const allProvKeys = [
      ...new Set([
        ...schoolProvMap.keys(),
        ...ispProvMap.keys(),
      ]),
    ].sort((a, b) => a.localeCompare(b));
    const coverageByProvince = allProvKeys.map((key) => {
      const s = schoolProvMap.get(key);
      const i = ispProvMap.get(key);
      return {
        key,
        schools: s?.schools ?? 0,
        learners: s?.learners ?? 0,
        verified: s?.verified ?? 0,
        meals_served: s?.meals_served ?? 0,
        po_spend: s?.po_spend ?? 0,
        isps: i?.isps ?? 0,
        isps_active: i?.isps_active ?? 0,
        isps_pending: i?.isps_pending ?? 0,
      };
    }).sort((a, b) => b.schools - a.schools || b.isps - a.isps);

    const schoolDistMap = new Map(
      schoolsByDistrict.map((r) => [r.key, r] as const)
    );
    const ispDistMap = new Map(
      ispCoverage.byDistrict.map((r) => [r.key, r] as const)
    );
    const allDistKeys = [
      ...new Set([...schoolDistMap.keys(), ...ispDistMap.keys()]),
    ];
    const coverageByDistrict = allDistKeys
      .map((key) => {
        const s = schoolDistMap.get(key);
        const i = ispDistMap.get(key);
        return {
          key,
          schools: s?.schools ?? 0,
          learners: s?.learners ?? 0,
          verified: s?.verified ?? 0,
          meals_served: s?.meals_served ?? 0,
          po_spend: s?.po_spend ?? 0,
          isps: i?.isps ?? 0,
          isps_active: i?.isps_active ?? 0,
          isps_pending: i?.isps_pending ?? 0,
        };
      })
      .sort((a, b) => b.schools - a.schools || b.isps - a.isps);

    const prizeLeaderboard = [...members]
      .filter((m) => m.prize_score != null)
      .sort((a, b) => (b.prize_score || 0) - (a.prize_score || 0))
      .slice(0, 50)
      .map((m, i) => ({
        rank: i + 1,
        name: m.name,
        province: m.province,
        district: m.district,
        prize_score: m.prize_score,
        approved_brand_pct: m.approved_brand_pct,
        learners_enrolled: m.learners_enrolled,
      }));

    // Feeding trend — only when ops are loaded (skip for hierarchy/coverage geo)
    const monthlyFeed: Record<
      string,
      { served: number; planned: number; waste: number }
    > = {};
    if (needOps) {
      for (let i = 0; i < filteredIds.length; i += 100) {
        const chunk = filteredIds.slice(i, i + 100);
        const { data: feedRows } = await supabase
          .from('school_feeding_days')
          .select('feed_date, planned_meals, served_meals, waste_meals')
          .in('school_profile_id', chunk)
          .gte('feed_date', from)
          .lte('feed_date', to)
          .limit(20000);
        for (const f of feedRows || []) {
          const ym = String(f.feed_date || '').slice(0, 7);
          if (!ym) continue;
          if (!monthlyFeed[ym]) {
            monthlyFeed[ym] = { served: 0, planned: 0, waste: 0 };
          }
          monthlyFeed[ym].served += Number(f.served_meals || 0);
          monthlyFeed[ym].planned += Number(f.planned_meals || 0);
          monthlyFeed[ym].waste += Number(f.waste_meals || 0);
        }
      }
    }
    const feedingTrend = Object.keys(monthlyFeed)
      .sort()
      .map((ym) => ({ month: ym, ...monthlyFeed[ym] }));

    // Risk flags
    const risks = {
      lowVerify: members
        .filter((m) => m.learners_enrolled >= 50 && m.verify_pct < 50)
        .slice(0, 20),
      lowApprovedBrand: members
        .filter(
          (m) =>
            m.approved_brand_pct != null && m.approved_brand_pct < 80
        )
        .sort(
          (a, b) =>
            (a.approved_brand_pct || 0) - (b.approved_brand_pct || 0)
        )
        .slice(0, 20),
      highWaste: members
        .filter((m) => {
          if (m.meals_served < 100) return false;
          return m.meals_waste / m.meals_served > 0.1;
        })
        .slice(0, 20),
      openCompliance: members
        .filter((m) => m.open_compliance > 0)
        .sort((a, b) => b.open_compliance - a.open_compliance)
        .slice(0, 20),
      noFeedingLogged: members
        .filter((m) => m.feeding_days === 0)
        .slice(0, 30),
    };

    const provinces = [
      ...new Set([
        ...members
          .map((m) => m.province)
          .filter((x): x is string => Boolean(x)),
        ...ispCoverage.facets.provinces,
      ]),
    ].sort();
    const districts = [
      ...new Set([
        ...members
          .map((m) => m.district)
          .filter((x): x is string => Boolean(x)),
        ...ispCoverage.facets.districts,
      ]),
    ].sort();

    // Claims inbox for agency review (submitted → approve/reject/paid)
    const { data: claimRows } = await supabase
      .from('nsnp_claim_packs')
      .select(
        'id, school_profile_id, period_from, period_to, meals_served, days_fed, claim_amount, food_spend, cost_per_meal, approved_brand_pct, status, created_at, pack_json'
      )
      .eq('agency_profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    const claimSchoolIds = [
      ...new Set(
        (claimRows || []).map((c) => Number(c.school_profile_id)).filter(Boolean)
      ),
    ];
    const claimSchoolNames: Record<number, string> = {};
    if (claimSchoolIds.length) {
      const { data: sch } = await supabase
        .from('school_profiles')
        .select('id, school_name, emis_number, province, district')
        .in('id', claimSchoolIds);
      for (const s of sch || []) {
        claimSchoolNames[Number(s.id)] = String(s.school_name || `School ${s.id}`);
      }
    }
    const claims = (claimRows || []).map((c) => ({
      ...c,
      school_name:
        claimSchoolNames[Number(c.school_profile_id)] ||
        `School ${c.school_profile_id}`,
    }));
    const claimsInbox = claims.filter((c) => c.status === 'submitted');
    (kpis as Record<string, number>).submittedClaims = claimsInbox.length;
    (kpis as Record<string, number>).totalClaims = claims.length;

    // Hierarchy: Agency → SPs → facilities each SP supplies
    const {
      programmeHierarchyBlurb,
      familyForAgencyType,
      facilityLabel,
    } = await import('@/lib/entities/programme-hierarchy');
    const hierarchyMeta = programmeHierarchyBlurb(agency.agency_type);
    const facilityById = new Map(
      members.map((m) => [m.school_profile_id, m] as const)
    );

    // Map SP → school_profile_ids in this network
    const ispToFacilities = new Map<number, number[]>();
    for (const isp of ispCoverage.isps) {
      const ispId = Number(isp.isp_profile_id);
      ispToFacilities.set(ispId, []);
    }
    if (filteredIds.length && ispCoverage.isps.length) {
      for (let i = 0; i < filteredIds.length; i += 200) {
        const chunk = filteredIds.slice(i, i + 200);
        const { data: sil } = await supabase
          .from('school_isp_links')
          .select('school_profile_id, isp_profile_id, status')
          .in('school_profile_id', chunk)
          .eq('status', 'active')
          .limit(5000);
        for (const l of sil || []) {
          const ispId = Number(l.isp_profile_id);
          const sid = Number(l.school_profile_id);
          if (!ispToFacilities.has(ispId)) continue;
          ispToFacilities.get(ispId)!.push(sid);
        }
      }
    }

    const linkedToAnySp = new Set<number>();
    for (const ids of ispToFacilities.values()) {
      for (const id of ids) linkedToAnySp.add(id);
    }
    const unlinkedAll = members
      .filter((m) => !linkedToAnySp.has(m.school_profile_id))
      .map((m) => ({
        school_profile_id: m.school_profile_id,
        name: m.name,
        member_type: m.member_type,
        member_label: facilityLabel(m.member_type),
        province: m.province,
        district: m.district,
        learners_enrolled: m.learners_enrolled,
      }));

    // District roll-up for hierarchy (full counts even when list is sampled)
    const unlinkedByDistrictMap = new Map<
      string,
      { key: string; schools: number; learners: number }
    >();
    for (const f of unlinkedAll) {
      const key =
        [f.district, f.province].filter(Boolean).join(', ') || 'Unknown';
      if (!unlinkedByDistrictMap.has(key)) {
        unlinkedByDistrictMap.set(key, { key, schools: 0, learners: 0 });
      }
      const g = unlinkedByDistrictMap.get(key)!;
      g.schools += 1;
      g.learners += Number(f.learners_enrolled || 0);
    }
    const unlinkedByDistrict = [...unlinkedByDistrictMap.values()].sort(
      (a, b) => b.schools - a.schools
    );

    const hierarchyTree = {
      agency: {
        name: agency.agency_name,
        type: agency.agency_type,
        family: hierarchyMeta.family,
        chain: hierarchyMeta.chain,
        description: hierarchyMeta.description,
      },
      totals: {
        facilities: members.length,
        learners: members.reduce((n, m) => n + m.learners_enrolled, 0),
        isps: ispCoverage.isps.length,
        linked_to_sp: linkedToAnySp.size,
        unlinked_to_sp: unlinkedAll.length,
        provinces: new Set(members.map((m) => m.province).filter(Boolean)).size,
        districts: new Set(members.map((m) => m.district).filter(Boolean)).size,
      },
      isps: ispCoverage.isps.map((isp) => {
        const ispId = Number(isp.isp_profile_id);
        const facIds = [...new Set(ispToFacilities.get(ispId) || [])];
        const facilities = facIds
          .map((id) => facilityById.get(id))
          .filter(Boolean)
          .map((m) => ({
            school_profile_id: m!.school_profile_id,
            name: m!.name,
            member_type: m!.member_type,
            member_label: facilityLabel(m!.member_type),
            province: m!.province,
            district: m!.district,
            learners_enrolled: m!.learners_enrolled,
            link_status: m!.link_status,
          }));
        return {
          isp_profile_id: ispId,
          name: isp.name,
          status: isp.status,
          provinces: isp.provinces,
          facility_count: facilities.length,
          // Cap per-SP list in hierarchy payload for large networks
          facilities: facilities.slice(0, 50),
          facilities_truncated: facilities.length > 50,
        };
      }),
      unlinked_count: unlinkedAll.length,
      unlinked_by_district: unlinkedByDistrict,
      // Sample only — full directory is on School register report
      unlinked_facilities: unlinkedAll.slice(0, 100),
      unlinked_truncated: unlinkedAll.length > 100,
    };

    const byMemberType = groupSum(members, (m: GroupableMember) =>
      facilityLabel(m.member_type, { plural: true })
    );

    return NextResponse.json({
      success: true,
      period: { from, to },
      report,
      agency: {
        id: agency.id,
        name: agency.agency_name,
        type: agency.agency_type,
        province: agency.province,
        family: familyForAgencyType(agency.agency_type),
        hierarchy: hierarchyMeta.chain,
        facility_plural: hierarchyMeta.facilityPlural,
      },
      hierarchy: hierarchyMeta,
      hierarchyTree,
      kpis,
      members,
      members_total: summaryCounts?.activeLinks || members.length,
      members_sampled: !wantFullList,
      byProvince,
      byDistrict,
      byCircuit,
      byQuintile,
      byMemberType,
      schoolsByProvince,
      schoolsByDistrict,
      schoolsByCircuit,
      isps: ispCoverage.isps,
      ispsByProvince: ispCoverage.byProvince,
      ispsByDistrict: ispCoverage.byDistrict,
      coverageByProvince,
      coverageByDistrict,
      prizeLeaderboard,
      feedingTrend,
      risks,
      claims,
      claimsInbox,
      facets: {
        provinces,
        districts,
        circuits: [
          ...new Set(
            members
              .map((m) => m.circuit)
              .filter((x): x is string => Boolean(x))
          ),
        ].sort((a, b) => a.localeCompare(b)),
        quintiles: [1, 2, 3, 4, 5].filter((q) =>
          members.some((m) => m.quintile === q)
        ),
      },
      memberTypesSupported: ['school', 'ecd', 'organisation'],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * SP associations for this DBE/PEU, rolled up by province and by district.
 * Province comes from SP.provinces[]; district is derived from schools they
 * supply in this agency network (POs / school_isp_links).
 */
async function loadIspCoverage(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyProfileId: number,
  networkSchoolIds: number[]
): Promise<{
  isps: Array<Record<string, unknown>>;
  byProvince: Array<{
    key: string;
    isps: number;
    isps_active: number;
    isps_pending: number;
  }>;
  byDistrict: Array<{
    key: string;
    isps: number;
    isps_active: number;
    isps_pending: number;
  }>;
  summary: { total: number; active: number; pending: number; suspended: number };
  facets: { provinces: string[]; districts: string[] };
}> {
  const empty = {
    isps: [] as Array<Record<string, unknown>>,
    byProvince: [] as Array<{
      key: string;
      isps: number;
      isps_active: number;
      isps_pending: number;
    }>,
    byDistrict: [] as Array<{
      key: string;
      isps: number;
      isps_active: number;
      isps_pending: number;
    }>,
    summary: { total: 0, active: 0, pending: 0, suspended: 0 },
    facets: { provinces: [] as string[], districts: [] as string[] },
  };

  const { data: links, error } = await supabase
    .from('nsnp_isp_agency_links')
    .select('*')
    .eq('agency_profile_id', agencyProfileId)
    .in('status', ['pending', 'active', 'suspended'])
    .limit(2000);

  if (error || !links?.length) {
    // Soft-fallback: legacy global approved_by this agency
    const { data: legacy } = await supabase
      .from('nsnp_isp_profiles')
      .select(
        'profile_id, trading_name, provinces, compliance_status, approved_by_agency_profile_id'
      )
      .eq('approved_by_agency_profile_id', agencyProfileId)
      .limit(500);
    if (!legacy?.length) return empty;

    return buildIspCoverageFromRows(
      supabase,
      legacy.map((i) => ({
        isp_profile_id: Number(i.profile_id),
        status:
          String(i.compliance_status) === 'compliant' ? 'active' : 'pending',
        trading_name: i.trading_name,
        provinces: Array.isArray(i.provinces) ? i.provinces : [],
        compliance_status: i.compliance_status,
      })),
      networkSchoolIds
    );
  }

  const ispIds = [
    ...new Set(
      links
        .map((l) => Number(l.isp_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];

  const { data: ispRows } = await supabase
    .from('nsnp_isp_profiles')
    .select(
      'profile_id, trading_name, provinces, compliance_status, food_handling_cert, contact_name, contact_phone, contact_email'
    )
    .in('profile_id', ispIds);

  const byId = new Map(
    (ispRows || []).map((i) => [Number(i.profile_id), i] as const)
  );

  // Display names from profiles if trading_name missing
  const missingNames = ispIds.filter(
    (id) => !byId.get(id)?.trading_name
  );
  const nameById: Record<number, string> = {};
  if (missingNames.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .in('id', missingNames);
    for (const p of profs || []) {
      nameById[Number(p.id)] =
        p.trading_name || p.legal_name || `SP ${p.id}`;
    }
  }

  const rows = links.map((l) => {
    const isp = byId.get(Number(l.isp_profile_id));
    const provinces = Array.isArray(isp?.provinces)
      ? (isp!.provinces as string[])
      : [];
    return {
      isp_profile_id: Number(l.isp_profile_id),
      status: String(l.status || 'pending'),
      trading_name:
        isp?.trading_name ||
        nameById[Number(l.isp_profile_id)] ||
        `SP ${l.isp_profile_id}`,
      provinces,
      compliance_status: isp?.compliance_status || null,
      food_handling_cert: isp?.food_handling_cert ?? null,
      link_id: l.id,
      requested_at: l.requested_at,
      accepted_at: l.accepted_at,
    };
  });

  return buildIspCoverageFromRows(supabase, rows, networkSchoolIds);
}

async function buildIspCoverageFromRows(
  supabase: ReturnType<typeof getSupabaseServer>,
  rows: Array<{
    isp_profile_id: number;
    status: string;
    trading_name: string | null | undefined;
    provinces: string[];
    compliance_status?: string | null;
    food_handling_cert?: boolean | null;
    link_id?: unknown;
    requested_at?: unknown;
    accepted_at?: unknown;
  }>,
  networkSchoolIds: number[]
) {
  // Districts served: schools in this agency network linked to each SP
  const ispDistricts = new Map<number, Set<string>>();
  const ispSchoolCounts = new Map<number, number>();

  if (networkSchoolIds.length) {
    const schoolMeta = new Map<
      number,
      { province: string | null; district: string | null }
    >();
    for (let i = 0; i < networkSchoolIds.length; i += 200) {
      const chunk = networkSchoolIds.slice(i, i + 200);
      const { data: sch } = await supabase
        .from('school_profiles')
        .select('id, province, district')
        .in('id', chunk);
      for (const s of sch || []) {
        schoolMeta.set(Number(s.id), {
          province: s.province != null ? String(s.province) : null,
          district: s.district != null ? String(s.district) : null,
        });
      }
    }

    for (let i = 0; i < networkSchoolIds.length; i += 200) {
      const chunk = networkSchoolIds.slice(i, i + 200);
      const { data: sil } = await supabase
        .from('school_isp_links')
        .select('school_profile_id, isp_profile_id, status')
        .in('school_profile_id', chunk)
        .eq('status', 'active')
        .limit(5000);
      for (const link of sil || []) {
        const ispId = Number(link.isp_profile_id);
        const sid = Number(link.school_profile_id);
        if (!Number.isFinite(ispId)) continue;
        ispSchoolCounts.set(ispId, (ispSchoolCounts.get(ispId) || 0) + 1);
        const meta = schoolMeta.get(sid);
        if (!meta?.district && !meta?.province) continue;
        const label =
          [meta.district, meta.province].filter(Boolean).join(', ') ||
          'Unknown';
        if (!ispDistricts.has(ispId)) ispDistricts.set(ispId, new Set());
        ispDistricts.get(ispId)!.add(label);
      }
    }
  }

  const isps = rows.map((r) => ({
    isp_profile_id: r.isp_profile_id,
    name: r.trading_name || `SP ${r.isp_profile_id}`,
    status: r.status,
    compliance_status: r.compliance_status || null,
    provinces: r.provinces,
    schools_linked: ispSchoolCounts.get(r.isp_profile_id) || 0,
    districts_served: [...(ispDistricts.get(r.isp_profile_id) || [])].sort(),
    food_handling_cert: r.food_handling_cert ?? null,
  }));

  // Province rollup: an SP listing a province counts once there
  const provMap = new Map<
    string,
    { key: string; isps: number; isps_active: number; isps_pending: number; ids: Set<number> }
  >();
  for (const r of rows) {
    const provs =
      r.provinces.length > 0 ? r.provinces : (['Unspecified'] as string[]);
    for (const p of provs) {
      const key = String(p || 'Unspecified').trim() || 'Unspecified';
      if (!provMap.has(key)) {
        provMap.set(key, {
          key,
          isps: 0,
          isps_active: 0,
          isps_pending: 0,
          ids: new Set(),
        });
      }
      const g = provMap.get(key)!;
      if (g.ids.has(r.isp_profile_id)) continue;
      g.ids.add(r.isp_profile_id);
      g.isps += 1;
      if (r.status === 'active') g.isps_active += 1;
      else if (r.status === 'pending') g.isps_pending += 1;
    }
  }

  // District rollup from schools served
  const distMap = new Map<
    string,
    { key: string; isps: number; isps_active: number; isps_pending: number; ids: Set<number> }
  >();
  for (const r of rows) {
    const dists = ispDistricts.get(r.isp_profile_id);
    if (!dists || dists.size === 0) continue;
    for (const d of dists) {
      if (!distMap.has(d)) {
        distMap.set(d, {
          key: d,
          isps: 0,
          isps_active: 0,
          isps_pending: 0,
          ids: new Set(),
        });
      }
      const g = distMap.get(d)!;
      if (g.ids.has(r.isp_profile_id)) continue;
      g.ids.add(r.isp_profile_id);
      g.isps += 1;
      if (r.status === 'active') g.isps_active += 1;
      else if (r.status === 'pending') g.isps_pending += 1;
    }
  }

  const byProvince = [...provMap.values()]
    .map(({ key, isps, isps_active, isps_pending }) => ({
      key,
      isps,
      isps_active,
      isps_pending,
    }))
    .sort((a, b) => b.isps - a.isps);

  const byDistrict = [...distMap.values()]
    .map(({ key, isps, isps_active, isps_pending }) => ({
      key,
      isps,
      isps_active,
      isps_pending,
    }))
    .sort((a, b) => b.isps - a.isps);

  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
  };

  return {
    isps,
    byProvince,
    byDistrict,
    summary,
    facets: {
      provinces: byProvince.map((r) => r.key).filter((k) => k !== 'Unspecified'),
      districts: byDistrict
        .map((r) => r.key.split(',')[0]?.trim() || r.key)
        .filter(Boolean),
    },
  };
}

function emptyKpis() {
  return {
    organisations: 0,
    schools: 0,
    hospitals: 0,
    other_orgs: 0,
    totalLearners: 0,
    totalVerified: 0,
    totalEligible: 0,
    totalStaff: 0,
    mealsServed: 0,
    mealsPlanned: 0,
    mealsWaste: 0,
    wastePct: 0,
    poSpend: 0,
    poCount: 0,
    nonApprovedReceipts: 0,
    openCompliance: 0,
    avgPrizeScore: null as number | null,
    avgApprovedBrandPct: null as number | null,
    avgVerifyPct: null as number | null,
    withGps: 0,
    pendingApprovals: 0,
    isps: 0,
    isps_active: 0,
    isps_pending: 0,
    provinces_with_schools: 0,
    districts_with_schools: 0,
  };
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/** Shape required for geographic / member-type rollups (not full MemberRow). */
type GroupableMember = {
  province?: string | null;
  district?: string | null;
  circuit?: string | null;
  member_type?: string | null;
  quintile?: number | null;
  learners_enrolled: number;
  learners_verified: number;
  meals_served: number;
  po_spend: number;
  prize_score: number | null;
};

function groupSum(
  members: GroupableMember[],
  keyFn: (m: GroupableMember) => string
) {
  const map = new Map<
    string,
    {
      key: string;
      organisations: number;
      learners: number;
      verified: number;
      meals_served: number;
      po_spend: number;
      prize_sum: number;
      prize_n: number;
    }
  >();
  for (const m of members) {
    const key = keyFn(m);
    if (!map.has(key)) {
      map.set(key, {
        key,
        organisations: 0,
        learners: 0,
        verified: 0,
        meals_served: 0,
        po_spend: 0,
        prize_sum: 0,
        prize_n: 0,
      });
    }
    const g = map.get(key)!;
    g.organisations += 1;
    g.learners += m.learners_enrolled;
    g.verified += m.learners_verified;
    g.meals_served += m.meals_served;
    g.po_spend += m.po_spend;
    if (m.prize_score != null) {
      g.prize_sum += m.prize_score;
      g.prize_n += 1;
    }
  }
  return [...map.values()]
    .map((g) => ({
      key: g.key,
      organisations: g.organisations,
      learners: g.learners,
      verified: g.verified,
      meals_served: g.meals_served,
      po_spend: Math.round(g.po_spend * 100) / 100,
      avg_prize:
        g.prize_n > 0
          ? Math.round((g.prize_sum / g.prize_n) * 10) / 10
          : null,
    }))
    .sort((a, b) => b.learners - a.learners);
}
