import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

/**
 * World-class NSNP slice-and-dice report pack.
 * ?companyId=&from=&to=&report=overview|learners|meals|stock|isps|compliance|prizes|district
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

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);

    const [
      learnersRes,
      staffRes,
      feedingRes,
      attendanceRes,
      stockRes,
      receiptsRes,
      ordersRes,
      complianceRes,
      linksRes,
    ] = await Promise.all([
      supabase
        .from('school_learners')
        .select('id, grade, nsnp_eligible, verification_status, status')
        .eq('school_profile_id', schoolId)
        .limit(10000),
      supabase
        .from('school_staff')
        .select('id, role, verification_status, status')
        .eq('school_profile_id', schoolId)
        .limit(2000),
      supabase
        .from('school_feeding_days')
        .select('*')
        .eq('school_profile_id', schoolId)
        .gte('feed_date', from)
        .lte('feed_date', to)
        .limit(1000),
      supabase
        .from('school_attendance_days')
        .select('*')
        .eq('school_profile_id', schoolId)
        .gte('attendance_date', from)
        .lte('attendance_date', to)
        .limit(1000),
      supabase
        .from('school_kitchen_stock')
        .select('*')
        .eq('school_profile_id', schoolId)
        .limit(500),
      supabase
        .from('school_kitchen_receipts')
        .select('*')
        .eq('school_profile_id', schoolId)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(500),
      supabase
        .from('school_purchase_orders')
        .select('*')
        .eq('school_profile_id', schoolId)
        .gte('order_date', from)
        .lte('order_date', to)
        .limit(500),
      supabase
        .from('school_compliance_events')
        .select('*')
        .eq('school_profile_id', schoolId)
        .limit(200),
      supabase
        .from('school_isp_links')
        .select('*')
        .eq('school_profile_id', schoolId),
    ]);

    const learners = learnersRes.data || [];
    const staff = staffRes.data || [];
    const feeding = feedingRes.data || [];
    const attendance = attendanceRes.data || [];
    const stock = stockRes.data || [];
    const receipts = receiptsRes.data || [];
    const orders = ordersRes.data || [];
    const compliance = complianceRes.data || [];
    const links = linksRes.data || [];

    const activeLearners = learners.filter((l) => l.status === 'active');
    const verified = activeLearners.filter((l) =>
      ['school_verified', 'attested'].includes(String(l.verification_status))
    );
    const eligible = activeLearners.filter((l) => l.nsnp_eligible !== false);

    const byGrade: Record<string, number> = {};
    for (const l of activeLearners) {
      const g = String(l.grade || 'Unknown');
      byGrade[g] = (byGrade[g] || 0) + 1;
    }

    let approvedLines = 0;
    let totalLines = 0;
    let nonApprovedReceipts = 0;
    for (const r of receipts) {
      if (r.compliance_ok === false) nonApprovedReceipts += 1;
      for (const line of (Array.isArray(r.lines) ? r.lines : []) as Array<{
        approved?: boolean;
        qty?: number;
      }>) {
        totalLines += 1;
        if (line.approved !== false) approvedLines += 1;
      }
    }
    const approvedBrandPct =
      totalLines > 0
        ? Math.round((approvedLines / totalLines) * 1000) / 10
        : 100;

    const mealsServed = feeding.reduce(
      (s, f) => s + Number(f.served_meals || 0),
      0
    );
    const mealsPlanned = feeding.reduce(
      (s, f) => s + Number(f.planned_meals || 0),
      0
    );
    const mealsWaste = feeding.reduce(
      (s, f) => s + Number(f.waste_meals || 0),
      0
    );

    // Monthly trend
    const monthly: Record<
      string,
      { served: number; planned: number; present: number }
    > = {};
    for (const f of feeding) {
      const ym = String(f.feed_date || '').slice(0, 7);
      if (!ym) continue;
      if (!monthly[ym]) monthly[ym] = { served: 0, planned: 0, present: 0 };
      monthly[ym].served += Number(f.served_meals || 0);
      monthly[ym].planned += Number(f.planned_meals || 0);
      monthly[ym].present += Number(f.learners_present || 0);
    }

    // District roll-up (same district schools — light)
    let districtSchools: Array<Record<string, unknown>> = [];
    if (school.district) {
      const { data: peers } = await supabase
        .from('school_profiles')
        .select(
          'id, school_name, district, province, learner_count_enrolled, learner_count_verified, lat, lng'
        )
        .eq('district', school.district)
        .limit(100);
      districtSchools = peers || [];
    }

    const kpis = {
      learnersEnrolled: activeLearners.length,
      learnersVerified: verified.length,
      learnersEligible: eligible.length,
      verifyPct:
        activeLearners.length > 0
          ? Math.round((verified.length / activeLearners.length) * 1000) / 10
          : 0,
      staffActive: staff.filter((s) => s.status === 'active').length,
      staffVerified: staff.filter((s) =>
        ['school_verified', 'attested'].includes(String(s.verification_status))
      ).length,
      mealsServed,
      mealsPlanned,
      mealsWaste,
      wastePct:
        mealsServed > 0
          ? Math.round((mealsWaste / mealsServed) * 1000) / 10
          : 0,
      feedingDays: feeding.length,
      attendanceDays: attendance.length,
      stockLines: stock.length,
      stockQty: stock.reduce((s, r) => s + Number(r.qty_on_hand || 0), 0),
      receipts: receipts.length,
      approvedBrandPct,
      nonApprovedReceipts,
      openPos: orders.filter((o) =>
        !['received', 'cancelled'].includes(String(o.status))
      ).length,
      poSpend: orders.reduce((s, o) => s + Number(o.total_amount || 0), 0),
      ispLinks: links.length,
      openCompliance: compliance.filter((c) =>
        ['open', 'in_progress'].includes(String(c.status))
      ).length,
    };

    return NextResponse.json({
      success: true,
      period: { from, to },
      report,
      school: {
        id: school.id,
        name: school.school_name,
        emis: school.emis_number,
        province: school.province,
        district: school.district,
        quintile: school.quintile,
        lat: school.lat,
        lng: school.lng,
      },
      kpis,
      byGrade: Object.entries(byGrade)
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => a.grade.localeCompare(b.grade)),
      trend: Object.keys(monthly)
        .sort()
        .map((ym) => ({ month: ym, ...monthly[ym] })),
      stock: stock.slice(0, 100),
      orders: orders.slice(0, 50),
      feeding: feeding.slice(0, 100),
      attendance: attendance.slice(0, 100),
      compliance: compliance.slice(0, 50),
      districtSchools,
      warnings: [
        learnersRes.error?.message,
        feedingRes.error?.message,
        receiptsRes.error?.message,
      ].filter(Boolean),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
