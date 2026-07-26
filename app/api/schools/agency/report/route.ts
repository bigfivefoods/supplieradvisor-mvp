import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

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

    let linksQ = supabase
      .from('school_agency_links')
      .select('*')
      .eq('agency_profile_id', companyId)
      .limit(5000);
    if (linkStatus === 'all') {
      linksQ = linksQ.in('status', ['active', 'pending', 'suspended']);
    } else if (linkStatus === 'pending') {
      linksQ = linksQ.eq('status', 'pending');
    } else {
      linksQ = linksQ.eq('status', 'active');
    }

    const { data: links, error: lErr } = await linksQ;
    if (lErr) {
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }

    const schoolIds = [
      ...new Set(
        (links || [])
          .map((l) => Number(l.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];

    if (!schoolIds.length) {
      return NextResponse.json({
        success: true,
        period: { from, to },
        report,
        agency,
        kpis: emptyKpis(),
        members: [],
        byProvince: [],
        byDistrict: [],
        byQuintile: [],
        prizeLeaderboard: [],
        feedingTrend: [],
        warnings: ['No approved organisations linked yet'],
      });
    }

    // Chunk .in() for large sets
    const schools: Array<Record<string, unknown>> = [];
    for (let i = 0; i < schoolIds.length; i += 200) {
      const chunk = schoolIds.slice(i, i + 200);
      const { data } = await supabase
        .from('school_profiles')
        .select(
          'id, profile_id, school_name, emis_number, province, district, circuit, quintile, urban_rural, city, lat, lng, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, staff_count, status, feeding_lunch, feeding_breakfast'
        )
        .in('id', chunk);
      schools.push(...((data || []) as Array<Record<string, unknown>>));
    }

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

    const filteredIds = filtered.map((s) => Number(s.id));
    const linkBySchool = new Map(
      (links || []).map((l) => [Number(l.school_profile_id), l])
    );

    // Aggregate ops data for period across all member schools
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

    // Batch fetch - for many schools, query without school_profile_id filter is bad
    // Use .in() chunks
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

    // Prize scores (latest per school)
    const prizeBySchool = new Map<number, Record<string, unknown>>();
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

    // Open compliance counts
    const complianceBySchool = new Map<number, number>();
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

    type MemberRow = {
      member_type: 'school';
      school_profile_id: number;
      company_id: number | null;
      name: string;
      emis: string | null;
      province: string | null;
      district: string | null;
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
        member_type: 'school' as const,
        school_profile_id: sid,
        company_id: s.profile_id != null ? Number(s.profile_id) : null,
        name: String(s.school_name || `School ${sid}`),
        emis: s.emis_number != null ? String(s.emis_number) : null,
        province: s.province != null ? String(s.province) : null,
        district: s.district != null ? String(s.district) : null,
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

    const kpis = {
      organisations: members.length,
      schools: members.filter((m) => m.member_type === 'school').length,
      hospitals: 0, // reserved for future member types
      other_orgs: 0,
      totalLearners: members.reduce((n, m) => n + m.learners_enrolled, 0),
      totalVerified: members.reduce((n, m) => n + m.learners_verified, 0),
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
      pendingApprovals: (links || []).filter((l) => l.status === 'pending')
        .length,
    };

    // Groupings
    const byProvince = groupSum(members, (m) => m.province || 'Unknown');
    const byDistrict = groupSum(members, (m) =>
      [m.district, m.province].filter(Boolean).join(', ') || 'Unknown'
    );
    const byQuintile = groupSum(members, (m) =>
      m.quintile != null ? `Q${m.quintile}` : 'Unspecified'
    );

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

    // Feeding trend across all members (month buckets from member period data)
    // Rebuild from feeding maps is incomplete for monthly — re-query aggregate if needed
    const monthlyFeed: Record<
      string,
      { served: number; planned: number; waste: number }
    > = {};
    // Use a simplified approach: sum from a second pass isn't available; derive from re-fetch is heavy
    // Instead expose per-member feeding for period and empty trend if not needed
    // Light re-query one month series from first chunk of feeding data via parallel month keys
    // We'll compute from re-fetch of feeding for filtered ids in period only months
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
      ...new Set(
        members.map((m) => m.province).filter((x): x is string => Boolean(x))
      ),
    ].sort();
    const districts = [
      ...new Set(
        members.map((m) => m.district).filter((x): x is string => Boolean(x))
      ),
    ].sort();

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
      kpis,
      members,
      byProvince,
      byDistrict,
      byQuintile,
      prizeLeaderboard,
      feedingTrend,
      risks,
      facets: { provinces, districts },
      // Future: hospitals / other orgs join same association pattern
      memberTypesSupported: ['school', 'hospital', 'organisation'],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
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
  };
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function groupSum(
  members: Array<{
    province?: string | null;
    district?: string | null;
    quintile?: number | null;
    learners_enrolled: number;
    learners_verified: number;
    meals_served: number;
    po_spend: number;
    prize_score: number | null;
  }>,
  keyFn: (m: (typeof members)[0]) => string
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
