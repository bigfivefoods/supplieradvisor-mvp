import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { buildGoldenPath, type PathCounts } from '@/lib/schools/golden-path';
import {
  applyApprovedProductClaimIncentive,
  CLAIM_APPROVED_MIN_PCT,
} from '@/lib/schools/incentives';
import { fetchAgencySchoolLinks } from '@/lib/schools/supabase-page';
import { computeClaimAmount, countWeekdays } from '@/lib/schools/process';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Schools ops hub — Sprint A/B/C
 * GET ?companyId=&view=path|fulfil|exceptions|districts|shopping|match|audit
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

    const view = String(sp.get('view') || 'path').toLowerCase();
    const supabase = getSupabaseServer();

    const { data: agency } = await supabase
      .from('nsnp_agency_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();
    const { data: isp } = await supabase
      .from('nsnp_isp_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    const role: 'school' | 'isp' | 'agency' = agency
      ? 'agency'
      : isp
        ? 'isp'
        : 'school';

    if (view === 'path' || view === 'home') {
      return NextResponse.json(await pathView(supabase, companyId, role));
    }
    if (view === 'fulfil') {
      if (role !== 'isp') {
        return NextResponse.json(
          { error: 'SP fulfil queue is for service providers' },
          { status: 403 }
        );
      }
      return NextResponse.json(await fulfilView(supabase, companyId));
    }
    if (view === 'exceptions' || view === 'cockpit') {
      if (role !== 'agency') {
        return NextResponse.json(
          { error: 'Exception cockpit is for DBE / PEU' },
          { status: 403 }
        );
      }
      return NextResponse.json(await exceptionsView(supabase, companyId));
    }
    if (view === 'districts' || view === 'clusters') {
      if (role !== 'agency') {
        return NextResponse.json(
          { error: 'District/cluster ops is for DBE' },
          { status: 403 }
        );
      }
      return NextResponse.json(await districtView(supabase, companyId));
    }
    if (view === 'shopping') {
      return NextResponse.json(await shoppingView(supabase, companyId, role));
    }
    if (view === 'match') {
      const from = sp.get('from') || monthAgo();
      const to = sp.get('to') || today();
      return NextResponse.json(
        await threeWayMatch(supabase, companyId, role, from, to)
      );
    }
    if (view === 'audit') {
      const from = sp.get('from') || monthAgo();
      const to = sp.get('to') || today();
      return NextResponse.json(
        await auditPack(supabase, companyId, role, from, to)
      );
    }
    if (view === 'sim' || view === 'funding') {
      const from = sp.get('from') || monthAgo();
      const to = sp.get('to') || today();
      return NextResponse.json(
        await fundingSim(supabase, companyId, from, to)
      );
    }

    return NextResponse.json({
      success: true,
      role,
      views: [
        'path',
        'fulfil',
        'exceptions',
        'districts',
        'shopping',
        'match',
        'audit',
        'sim',
      ],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error', success: false },
      { status: 500 }
    );
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

async function pathView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: 'school' | 'isp' | 'agency'
) {
  const counts = await gatherCounts(supabase, companyId, role);
  const path = buildGoldenPath(role, counts);
  return { success: true, role, path, counts };
}

async function gatherCounts(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: 'school' | 'isp' | 'agency'
): Promise<PathCounts> {
  const c: PathCounts = {
    openPos: 0,
    openDns: 0,
    dispatched: 0,
    withPod: 0,
    awaitingReceive: 0,
    receivedThisWeek: 0,
    serveToday: false,
    claimsReady: false,
    claimsBlocked: false,
    lateDeliveries: 0,
    openRiads: 0,
    probationSps: 0,
  };
  const wk = weekStart();
  const todayStr = today();

  if (role === 'isp') {
    const { data: pos } = await supabase
      .from('school_purchase_orders')
      .select('id, status')
      .eq('isp_profile_id', companyId)
      .in('status', ['submitted', 'confirmed', 'open', 'dispatched'])
      .limit(100);
    c.openPos = (pos || []).length;

    const { data: dels } = await supabase
      .from('school_nsnp_deliveries')
      .select('id, status, metadata, expected_date, otif')
      .eq('isp_profile_id', companyId)
      .in('status', ['draft', 'confirmed', 'dispatched', 'delivered'])
      .limit(200);
    const list = dels || [];
    c.openDns = list.filter((d) =>
      ['draft', 'confirmed'].includes(String(d.status))
    ).length;
    c.dispatched = list.filter((d) =>
      ['dispatched', 'delivered'].includes(String(d.status))
    ).length;
    c.awaitingReceive = list.filter((d) =>
      ['dispatched', 'delivered'].includes(String(d.status))
    ).length;
    c.withPod = list.filter(
      (d) => (d.metadata as { has_pod_photo?: boolean })?.has_pod_photo
    ).length;
    c.lateDeliveries = list.filter((d) => {
      if (!d.expected_date) return false;
      return (
        String(d.expected_date).slice(0, 10) < todayStr &&
        ['dispatched', 'delivered', 'confirmed'].includes(String(d.status))
      );
    }).length;
  } else if (role === 'school') {
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (!school) return c;
    const sid = Number(school.id);

    const { data: pos } = await supabase
      .from('school_purchase_orders')
      .select('id')
      .eq('school_profile_id', sid)
      .in('status', ['submitted', 'confirmed', 'open', 'dispatched'])
      .limit(50);
    c.openPos = (pos || []).length;

    const { data: dels } = await supabase
      .from('school_nsnp_deliveries')
      .select('id, status, metadata, received_at')
      .eq('school_profile_id', sid)
      .limit(100);
    const list = dels || [];
    c.openDns = list.filter((d) =>
      ['draft', 'confirmed', 'dispatched', 'delivered'].includes(String(d.status))
    ).length;
    c.dispatched = list.filter((d) =>
      ['dispatched', 'delivered'].includes(String(d.status))
    ).length;
    c.awaitingReceive = list.filter((d) =>
      ['dispatched', 'delivered', 'confirmed'].includes(String(d.status))
    ).length;
    c.withPod = list.filter(
      (d) => (d.metadata as { has_pod_photo?: boolean })?.has_pod_photo
    ).length;
    c.receivedThisWeek = list.filter(
      (d) =>
        d.status === 'received' &&
        d.received_at &&
        String(d.received_at).slice(0, 10) >= wk
    ).length;

    const { data: feed } = await supabase
      .from('school_feeding_days')
      .select('id')
      .eq('school_profile_id', sid)
      .eq('feed_date', todayStr)
      .maybeSingle();
    c.serveToday = Boolean(feed);

    // soft claim readiness from recent receipts
    const { data: recs } = await supabase
      .from('school_kitchen_receipts')
      .select('compliance_ok')
      .eq('school_profile_id', sid)
      .gte('received_at', wk)
      .limit(50);
    const bad = (recs || []).filter((r) => r.compliance_ok === false).length;
    c.claimsBlocked = bad > 0 && (recs || []).length > 0;
    c.claimsReady = c.serveToday && !c.claimsBlocked && c.receivedThisWeek > 0;
  } else {
    // agency
    const links = await fetchAgencySchoolLinks(supabase, companyId, [
      'active',
      'pending',
    ]).catch(() => []);
    const schoolIds = links
      .map((l) => Number(l.school_profile_id))
      .filter(Boolean);

    const { data: claims } = await supabase
      .from('nsnp_claim_packs')
      .select('id')
      .eq('agency_profile_id', companyId)
      .eq('status', 'submitted')
      .limit(50);
    c.claimsReady = (claims || []).length > 0;
    c.openPos = (claims || []).length; // reuse as submitted claims count in metrics

    // late / awaiting approximate
    if (schoolIds.length) {
      const slice = schoolIds.slice(0, 200);
      const { data: dels } = await supabase
        .from('school_nsnp_deliveries')
        .select('id, status, expected_date, metadata')
        .in('school_profile_id', slice)
        .in('status', ['dispatched', 'delivered'])
        .limit(300);
      c.awaitingReceive = (dels || []).length;
      c.lateDeliveries = (dels || []).filter(
        (d) =>
          d.expected_date &&
          String(d.expected_date).slice(0, 10) < todayStr
      ).length;
      c.withPod = (dels || []).filter(
        (d) => (d.metadata as { has_pod_photo?: boolean })?.has_pod_photo
      ).length;
    }

    // open RIADs raised by agency (metadata) — soft
    try {
      const { data: riads } = await supabase
        .from('riad_logs')
        .select('id, status')
        .contains('metadata', { raised_by_agency_profile_id: companyId })
        .limit(100);
      c.openRiads = (riads || []).filter(
        (r) => !['closed', 'resolved'].includes(String(r.status || '').toLowerCase())
      ).length;
    } catch {
      c.openRiads = 0;
    }

    // probation SPs
    try {
      const { data: ispLinks } = await supabase
        .from('nsnp_isp_agency_links')
        .select('isp_profile_id, status')
        .eq('agency_profile_id', companyId)
        .eq('status', 'active')
        .limit(200);
      // soft: mark none without full compute
      c.probationSps = 0;
      void ispLinks;
    } catch {
      /* soft */
    }
  }

  return c;
}

/** Sprint A — SP fulfil queue */
async function fulfilView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
) {
  const { data: pos } = await supabase
    .from('school_purchase_orders')
    .select(
      'id, po_number, status, order_date, expected_date, total_amount, school_profile_id, lines, profile_id'
    )
    .eq('isp_profile_id', companyId)
    .in('status', [
      'submitted',
      'confirmed',
      'open',
      'dispatched',
      'partially_received',
    ])
    .order('expected_date', { ascending: true, nullsFirst: false })
    .limit(80);

  const schoolIds = [
    ...new Set(
      (pos || []).map((p) => Number(p.school_profile_id)).filter(Boolean)
    ),
  ];
  const names: Record<number, string> = {};
  if (schoolIds.length) {
    const { data: schools } = await supabase
      .from('school_profiles')
      .select('id, school_name, district')
      .in('id', schoolIds);
    for (const s of schools || []) {
      names[Number(s.id)] = String(s.school_name);
    }
  }

  const { data: existingDns } = await supabase
    .from('school_nsnp_deliveries')
    .select('id, po_id, status, metadata, expected_date, delivery_number')
    .eq('isp_profile_id', companyId)
    .in('status', ['draft', 'confirmed', 'dispatched', 'delivered'])
    .limit(100);
  const dnByPo = new Map<number, Record<string, unknown>>();
  for (const d of existingDns || []) {
    if (d.po_id) dnByPo.set(Number(d.po_id), d as Record<string, unknown>);
  }

  const queue = (pos || []).map((p) => {
    const dn = dnByPo.get(Number(p.id));
    const expected = p.expected_date
      ? String(p.expected_date).slice(0, 10)
      : null;
    const late =
      expected &&
      expected < today() &&
      !['received', 'cancelled'].includes(String(dn?.status || p.status));
    return {
      po_id: p.id,
      po_number: p.po_number,
      status: p.status,
      order_date: p.order_date,
      expected_date: expected,
      total_amount: p.total_amount,
      school_profile_id: p.school_profile_id,
      school_name: names[Number(p.school_profile_id)] || `School ${p.school_profile_id}`,
      line_count: Array.isArray(p.lines) ? p.lines.length : 0,
      delivery_id: dn?.id || null,
      delivery_number: dn?.delivery_number || null,
      delivery_status: dn?.status || null,
      has_pod: Boolean(
        (dn?.metadata as { has_pod_photo?: boolean } | undefined)?.has_pod_photo
      ),
      late: Boolean(late),
      action: !dn
        ? 'create_dn'
        : ['draft', 'confirmed'].includes(String(dn.status))
          ? 'dispatch'
          : String(dn.status) === 'dispatched'
            ? 'mark_delivered'
            : String(dn.status) === 'delivered'
              ? 'await_school'
              : 'done',
    };
  });

  // Sort late first, then by expected date
  queue.sort((a, b) => {
    if (a.late !== b.late) return a.late ? -1 : 1;
    return String(a.expected_date || '9999').localeCompare(
      String(b.expected_date || '9999')
    );
  });

  const path = buildGoldenPath(
    'isp',
    await gatherCounts(supabase, companyId, 'isp')
  );

  return {
    success: true,
    role: 'isp',
    path,
    queue,
    summary: {
      total: queue.length,
      need_dn: queue.filter((q) => q.action === 'create_dn').length,
      need_dispatch: queue.filter((q) => q.action === 'dispatch').length,
      late: queue.filter((q) => q.late).length,
      missing_pod: queue.filter((q) => q.delivery_id && !q.has_pod).length,
    },
  };
}

/** Sprint B — DBE exception cockpit */
async function exceptionsView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
) {
  const links = await fetchAgencySchoolLinks(supabase, companyId, [
    'active',
    'pending',
  ]).catch(() => []);
  const schoolIds = [
    ...new Set(
      links.map((l) => Number(l.school_profile_id)).filter(Boolean)
    ),
  ];

  const exceptions: Array<Record<string, unknown>> = [];

  // Pending school joins
  for (const l of links.filter((x) => x.status === 'pending').slice(0, 30)) {
    exceptions.push({
      kind: 'school_pending',
      severity: 'medium',
      title: `School join pending`,
      subject_id: l.school_profile_id,
      href: '/dashboard/schools/join',
      age_hint: l.created_at || l.updated_at,
    });
  }

  // Claims inbox
  const { data: claims } = await supabase
    .from('nsnp_claim_packs')
    .select('id, school_profile_id, status, created_at, claim_amount, period_from, period_to')
    .eq('agency_profile_id', companyId)
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })
    .limit(40);
  for (const c of claims || []) {
    exceptions.push({
      kind: 'claim_submitted',
      severity: 'high',
      title: `Claim awaiting DBE approval`,
      subject_id: c.school_profile_id,
      claim_id: c.id,
      amount: c.claim_amount,
      period: `${c.period_from} → ${c.period_to}`,
      href: '/dashboard/schools/agency-report?report=claims',
      created_at: c.created_at,
    });
  }

  // Late / stuck deliveries
  if (schoolIds.length) {
    for (let i = 0; i < Math.min(schoolIds.length, 400); i += 100) {
      const slice = schoolIds.slice(i, i + 100);
      const { data: dels } = await supabase
        .from('school_nsnp_deliveries')
        .select(
          'id, school_profile_id, isp_profile_id, status, expected_date, delivery_number, metadata, updated_at'
        )
        .in('school_profile_id', slice)
        .in('status', ['dispatched', 'delivered', 'confirmed'])
        .limit(200);
      for (const d of dels || []) {
        const late =
          d.expected_date &&
          String(d.expected_date).slice(0, 10) < today();
        const noPod = !(d.metadata as { has_pod_photo?: boolean })
          ?.has_pod_photo;
        const stuckHours =
          d.updated_at
            ? (Date.now() - new Date(String(d.updated_at)).getTime()) /
              36e5
            : 0;
        if (late || (stuckHours > 48 && d.status !== 'received')) {
          exceptions.push({
            kind: late ? 'delivery_late' : 'delivery_stuck',
            severity: late ? 'high' : 'medium',
            title: late
              ? `Late delivery ${d.delivery_number || d.id}`
              : `Delivery not received >48h ${d.delivery_number || d.id}`,
            school_profile_id: d.school_profile_id,
            isp_profile_id: d.isp_profile_id,
            delivery_id: d.id,
            no_pod: noPod,
            href: '/dashboard/schools/ops',
          });
        }
      }

      // Off-catalogue GRNs last 14 days
      const from14 = new Date();
      from14.setDate(from14.getDate() - 14);
      const { data: recs } = await supabase
        .from('school_kitchen_receipts')
        .select('id, school_profile_id, isp_profile_id, compliance_ok, received_at')
        .in('school_profile_id', slice)
        .eq('compliance_ok', false)
        .gte('received_at', from14.toISOString().slice(0, 10))
        .limit(100);
      for (const r of recs || []) {
        exceptions.push({
          kind: 'off_catalogue_grn',
          severity: 'high',
          title: 'Off-catalogue kitchen GRN',
          school_profile_id: r.school_profile_id,
          isp_profile_id: r.isp_profile_id,
          receipt_id: r.id,
          href: '/dashboard/schools/registry-report',
          action: 'riad',
        });
      }
    }
  }

  // Open RIADs
  try {
    const { data: riads } = await supabase
      .from('riad_logs')
      .select('id, title, status, created_at, stakeholder_name, metadata, priority')
      .contains('metadata', { raised_by_agency_profile_id: companyId })
      .order('created_at', { ascending: true })
      .limit(50);
    for (const r of riads || []) {
      if (['closed', 'resolved'].includes(String(r.status || '').toLowerCase()))
        continue;
      const ageDays = r.created_at
        ? Math.floor(
            (Date.now() - new Date(String(r.created_at)).getTime()) / 864e5
          )
        : 0;
      exceptions.push({
        kind: 'open_riad',
        severity: ageDays > 14 ? 'critical' : 'medium',
        title: String(r.title || 'Open RIAD'),
        subject: r.stakeholder_name,
        riad_id: r.id,
        age_days: ageDays,
        href: '/dashboard/schools/agency-report?report=riad',
      });
    }
  } catch {
    /* soft */
  }

  // Pending SP joins
  const { data: ispPending } = await supabase
    .from('nsnp_isp_agency_links')
    .select('id, isp_profile_id, status, requested_at')
    .eq('agency_profile_id', companyId)
    .eq('status', 'pending')
    .limit(40);
  for (const l of ispPending || []) {
    exceptions.push({
      kind: 'sp_pending',
      severity: 'medium',
      title: 'SP association pending approval',
      isp_profile_id: l.isp_profile_id,
      href: '/dashboard/schools/join',
    });
  }

  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  exceptions.sort(
    (a, b) =>
      (severityRank[String(a.severity)] ?? 9) -
      (severityRank[String(b.severity)] ?? 9)
  );

  const path = buildGoldenPath(
    'agency',
    await gatherCounts(supabase, companyId, 'agency')
  );

  return {
    success: true,
    role: 'agency',
    path,
    exceptions: exceptions.slice(0, 100),
    summary: {
      total: exceptions.length,
      critical: exceptions.filter((e) => e.severity === 'critical').length,
      high: exceptions.filter((e) => e.severity === 'high').length,
      claims: exceptions.filter((e) => e.kind === 'claim_submitted').length,
      deliveries: exceptions.filter((e) =>
        String(e.kind).startsWith('delivery')
      ).length,
      riads: exceptions.filter((e) => e.kind === 'open_riad').length,
      off_catalogue: exceptions.filter((e) => e.kind === 'off_catalogue_grn')
        .length,
    },
  };
}

/** Sprint C — district / cluster ops */
async function districtView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
) {
  const links = await fetchAgencySchoolLinks(supabase, companyId, [
    'active',
  ]).catch(() => []);
  const schoolIds = links
    .map((l) => Number(l.school_profile_id))
    .filter(Boolean);

  const schools =
    schoolIds.length > 0
      ? await import('@/lib/schools/supabase-page').then(({ fetchByIds }) =>
          fetchByIds(
            supabase,
            'school_profiles',
            'id, school_name, district, province, learner_count_enrolled',
            schoolIds
          )
        )
      : [];

  const byDistrict = new Map<
    string,
    { district: string; schools: number; learners: number }
  >();
  for (const s of schools) {
    const d = String(s.district || 'Unknown');
    const row = byDistrict.get(d) || {
      district: d,
      schools: 0,
      learners: 0,
    };
    row.schools += 1;
    row.learners += Number(s.learner_count_enrolled || 0);
    byDistrict.set(d, row);
  }

  // SPs by district/cluster
  const { data: ispLinks } = await supabase
    .from('nsnp_isp_agency_links')
    .select('isp_profile_id, status')
    .eq('agency_profile_id', companyId)
    .eq('status', 'active')
    .limit(500);
  const ispIds = [
    ...new Set(
      (ispLinks || []).map((l) => Number(l.isp_profile_id)).filter(Boolean)
    ),
  ];
  let sps: Array<Record<string, unknown>> = [];
  if (ispIds.length) {
    const { data } = await supabase
      .from('nsnp_isp_profiles')
      .select(
        'profile_id, trading_name, district, cluster_allocation, csd_number, compliance_status'
      )
      .in('profile_id', ispIds.slice(0, 300));
    sps = data || [];
  }

  const byCluster = new Map<
    string,
    { cluster: string; sps: number; districts: Set<string> }
  >();
  for (const s of sps) {
    const cl = String(s.cluster_allocation || 'Unallocated');
    const row = byCluster.get(cl) || {
      cluster: cl,
      sps: 0,
      districts: new Set<string>(),
    };
    row.sps += 1;
    if (s.district) row.districts.add(String(s.district));
    byCluster.set(cl, row);
  }

  // Allocation gaps: districts with schools but no SP listing that district
  const spDistricts = new Set(
    sps.map((s) => String(s.district || '')).filter(Boolean)
  );
  const gaps = [...byDistrict.values()]
    .filter((d) => d.district !== 'Unknown' && !spDistricts.has(d.district))
    .map((d) => ({
      district: d.district,
      schools: d.schools,
      issue: 'Schools present — no SP with this district on register',
    }));

  return {
    success: true,
    role: 'agency',
    byDistrict: [...byDistrict.values()].sort((a, b) => b.schools - a.schools),
    byCluster: [...byCluster.values()].map((c) => ({
      cluster: c.cluster,
      sps: c.sps,
      districts: [...c.districts],
    })),
    gaps,
    kpis: {
      schools: schools.length,
      sps: sps.length,
      districts: byDistrict.size,
      clusters: byCluster.size,
      allocation_gaps: gaps.length,
    },
  };
}

/** Sprint C — menu → shopping list */
async function shoppingView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: string
) {
  const { school } = await getOrCreateSchoolProfile(supabase, companyId);
  let agencyId: number | null = null;
  let schoolId: number | null = school ? Number(school.id) : null;

  if (role === 'agency') {
    agencyId = companyId;
  } else if (school) {
    const { data: link } = await supabase
      .from('school_agency_links')
      .select('agency_profile_id')
      .eq('school_profile_id', school.id)
      .eq('status', 'active')
      .maybeSingle();
    agencyId = link ? Number(link.agency_profile_id) : null;
  }

  // Load menu cycle for next 7 days
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  let menuRows: Array<Record<string, unknown>> = [];
  if (agencyId) {
    const { data } = await supabase
      .from('school_menu_cycles')
      .select('*')
      .eq('agency_profile_id', agencyId)
      .limit(50);
    menuRows = data || [];
  }
  if (!menuRows.length && schoolId) {
    const { data } = await supabase
      .from('school_menu_cycles')
      .select('*')
      .eq('school_profile_id', schoolId)
      .limit(20);
    menuRows = data || [];
  }

  // Aggregate product ids / names from menu JSON shapes
  const items = new Map<
    string,
    {
      name: string;
      brand?: string | null;
      approved_product_id?: number | null;
      days: string[];
      qty_hint: number;
    }
  >();

  for (const m of menuRows) {
    const cycle =
      (m.cycle_json as Record<string, unknown>) ||
      (m.days as Record<string, unknown>) ||
      (m.menu as Record<string, unknown>) ||
      m;
    // Support array of dishes or weekday map
    const buckets: unknown[] = [];
    if (Array.isArray(cycle)) buckets.push(...cycle);
    else if (cycle && typeof cycle === 'object') {
      for (const [k, v] of Object.entries(cycle)) {
        if (Array.isArray(v)) {
          for (const dish of v) buckets.push({ ...(dish as object), _day: k });
        } else if (v && typeof v === 'object') {
          buckets.push({ ...(v as object), _day: k });
        }
      }
    }
    // Also scan known fields
    for (const key of ['breakfast', 'lunch', 'items', 'products', 'lines']) {
      const v = (m as Record<string, unknown>)[key];
      if (Array.isArray(v)) buckets.push(...v);
    }

    for (const raw of buckets) {
      if (!raw || typeof raw !== 'object') continue;
      const d = raw as Record<string, unknown>;
      const name = String(
        d.product_name || d.name || d.dish || d.title || ''
      ).trim();
      if (!name) continue;
      const pid = d.approved_product_id
        ? Number(d.approved_product_id)
        : null;
      const key = pid ? `id:${pid}` : `n:${name.toLowerCase()}`;
      const row = items.get(key) || {
        name,
        brand: d.brand_name ? String(d.brand_name) : null,
        approved_product_id: pid && Number.isFinite(pid) ? pid : null,
        days: [] as string[],
        qty_hint: 0,
      };
      const day = String(d._day || d.weekday || d.day || '');
      if (day && !row.days.includes(day)) row.days.push(day);
      row.qty_hint += Number(d.qty || d.portion_kg || 1) || 1;
      items.set(key, row);
    }
  }

  // Learner count for qty scaling
  let learners = school
    ? Number(
        school.learner_count_nsnp_eligible ||
          school.learner_count_enrolled ||
          0
      )
    : 0;
  if (!learners && schoolId) {
    const { count } = await supabase
      .from('school_learners')
      .select('*', { count: 'exact', head: true })
      .eq('school_profile_id', schoolId)
      .eq('status', 'active');
    learners = count || 0;
  }

  const shopping_list = [...items.values()].map((it) => ({
    ...it,
    suggested_qty:
      Math.round(
        (it.qty_hint || 1) * Math.max(1, Math.ceil(learners / 100)) * 10
      ) / 10,
    learners_basis: learners,
  }));

  return {
    success: true,
    role,
    shopping_list,
    menu_rows: menuRows.length,
    learners,
    tip:
      shopping_list.length === 0
        ? 'No menu products found — DBE should publish a menu cycle with product lines, or add approved products manually on Orders.'
        : 'Review quantities, then create a PO on Orders using only approved products.',
    href_order: '/dashboard/schools/orders',
  };
}

/** Sprint B — three-way match PO · POD · GRN · feed */
async function threeWayMatch(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: string,
  from: string,
  to: string
) {
  const { school } = await getOrCreateSchoolProfile(supabase, companyId);
  if (!school && role !== 'agency') {
    return { success: false, error: 'School profile required' };
  }
  const schoolId = school ? Number(school.id) : null;
  if (!schoolId) {
    return { success: true, matches: [], tip: 'Select a school company' };
  }

  const [pos, dels, recs, feed] = await Promise.all([
    supabase
      .from('school_purchase_orders')
      .select('id, po_number, status, total_amount, order_date, lines, isp_profile_id')
      .eq('school_profile_id', schoolId)
      .gte('order_date', from)
      .lte('order_date', to)
      .limit(100),
    supabase
      .from('school_nsnp_deliveries')
      .select('id, po_id, status, metadata, delivery_number, lines')
      .eq('school_profile_id', schoolId)
      .limit(100),
    supabase
      .from('school_kitchen_receipts')
      .select('id, po_id, compliance_ok, lines, received_at, isp_profile_id')
      .eq('school_profile_id', schoolId)
      .gte('received_at', from)
      .lte('received_at', to)
      .limit(100),
    supabase
      .from('school_feeding_days')
      .select('feed_date, served_meals')
      .eq('school_profile_id', schoolId)
      .gte('feed_date', from)
      .lte('feed_date', to)
      .limit(100),
  ]);

  const delByPo = new Map<number, Record<string, unknown>>();
  for (const d of dels.data || []) {
    if (d.po_id) delByPo.set(Number(d.po_id), d as Record<string, unknown>);
  }
  const recByPo = new Map<number, Record<string, unknown>>();
  for (const r of recs.data || []) {
    if (r.po_id) recByPo.set(Number(r.po_id), r as Record<string, unknown>);
  }

  const feedDays = (feed.data || []).length;
  const meals = (feed.data || []).reduce(
    (n, f) => n + Number(f.served_meals || 0),
    0
  );

  const matches = (pos.data || []).map((p) => {
    const d = delByPo.get(Number(p.id));
    const r = recByPo.get(Number(p.id));
    const hasPod = Boolean(
      (d?.metadata as { has_pod_photo?: boolean } | undefined)?.has_pod_photo
    );
    const poOk = true;
    const dnOk = Boolean(d);
    const podOk = hasPod;
    const grnOk = Boolean(r);
    const grnClean = r ? r.compliance_ok !== false : false;
    // Invoice = delivery file kind invoice (soft via metadata)
    const invoiceOk = Boolean(
      (d?.metadata as { has_invoice?: boolean } | undefined)?.has_invoice
    );

    const poQty = sumQty(p.lines as unknown[]);
    const grnQty = sumQty(r?.lines as unknown[]);
    const variance_pct =
      poQty > 0 && grnQty > 0
        ? Math.round((Math.abs(grnQty - poQty) / poQty) * 1000) / 10
        : null;

    const score =
      (poOk ? 1 : 0) +
      (dnOk ? 1 : 0) +
      (podOk ? 1 : 0) +
      (grnOk ? 1 : 0) +
      (grnClean ? 1 : 0);
    const status =
      score >= 5 && (variance_pct == null || variance_pct <= 10)
        ? 'matched'
        : score >= 3
          ? 'partial'
          : 'gap';

    return {
      po_id: p.id,
      po_number: p.po_number,
      po_amount: p.total_amount,
      checks: {
        po: poOk,
        delivery_note: dnOk,
        photo_pod: podOk,
        grn: grnOk,
        grn_approved: grnClean,
        invoice: invoiceOk,
      },
      variance_pct,
      po_qty: poQty,
      grn_qty: grnQty,
      status,
      delivery_id: d?.id || null,
      receipt_id: r?.id || null,
    };
  });

  const matched = matches.filter((m) => m.status === 'matched').length;
  const fundingReady =
    matched > 0 && feedDays > 0 && meals > 0;

  return {
    success: true,
    period: { from, to },
    matches,
    feeding: { days: feedDays, meals },
    summary: {
      pos: matches.length,
      matched,
      partial: matches.filter((m) => m.status === 'partial').length,
      gaps: matches.filter((m) => m.status === 'gap').length,
      funding_path_ready: fundingReady,
    },
    policy:
      'Three-way match: PO + delivery note + photo POD + approved GRN (+ feed days for claim). Invoice optional but recommended.',
  };
}

function sumQty(lines: unknown[] | undefined): number {
  if (!Array.isArray(lines)) return 0;
  let n = 0;
  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue;
    const l = raw as Record<string, unknown>;
    n += Number(l.qty_received ?? l.qty_delivered ?? l.qty ?? 0) || 0;
  }
  return n;
}

/** Sprint B — claim funding simulator */
async function fundingSim(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  from: string,
  to: string
) {
  const { school } = await getOrCreateSchoolProfile(supabase, companyId);
  if (!school) {
    return { success: false, error: 'School only' };
  }
  const schoolId = Number(school.id);

  const [feedingRes, receiptsRes, ordersRes] = await Promise.all([
    supabase
      .from('school_feeding_days')
      .select('served_meals, feed_date, cost_amount')
      .eq('school_profile_id', schoolId)
      .gte('feed_date', from)
      .lte('feed_date', to)
      .limit(500),
    supabase
      .from('school_kitchen_receipts')
      .select('compliance_ok, lines')
      .eq('school_profile_id', schoolId)
      .gte('received_at', from)
      .lte('received_at', to)
      .limit(500),
    supabase
      .from('school_purchase_orders')
      .select('total_amount')
      .eq('school_profile_id', schoolId)
      .gte('order_date', from)
      .lte('order_date', to)
      .limit(500),
  ]);

  const feeding = feedingRes.data || [];
  const meals = feeding.reduce((n, f) => n + Number(f.served_meals || 0), 0);
  const spendOrders = (ordersRes.data || []).reduce(
    (n, o) => n + Number(o.total_amount || 0),
    0
  );
  const spendFeed = feeding.reduce(
    (n, f) => n + Number((f as { cost_amount?: number }).cost_amount || 0),
    0
  );
  const spend = spendFeed > 0 ? spendFeed : spendOrders;

  let approvedLines = 0;
  let totalLines = 0;
  for (const r of receiptsRes.data || []) {
    for (const line of (Array.isArray(r.lines) ? r.lines : []) as Array<{
      approved?: boolean;
    }>) {
      totalLines += 1;
      if (line.approved !== false) approvedLines += 1;
    }
  }
  const approvedBrandPct =
    totalLines > 0
      ? Math.round((approvedLines / totalLines) * 1000) / 10
      : 100;

  // tariff
  let tariff: number | null = null;
  const { data: link } = await supabase
    .from('school_agency_links')
    .select('agency_profile_id')
    .eq('school_profile_id', schoolId)
    .eq('status', 'active')
    .maybeSingle();
  if (link) {
    const { data: ag } = await supabase
      .from('nsnp_agency_profiles')
      .select('meal_tariff_zar, meal_tariff_lunch_zar')
      .eq('profile_id', link.agency_profile_id)
      .maybeSingle();
    if (ag) {
      tariff =
        Number(ag.meal_tariff_lunch_zar) > 0
          ? Number(ag.meal_tariff_lunch_zar)
          : Number(ag.meal_tariff_zar) || null;
    }
  }

  const claim = computeClaimAmount({
    mealsServed: meals,
    foodSpend: spend,
    tariffZar: tariff,
  });
  const incentive = applyApprovedProductClaimIncentive({
    claimAmount: claim.claimAmount,
    approvedBrandPct,
  });

  // Scenarios
  const fullIfClean = applyApprovedProductClaimIncentive({
    claimAmount: claim.claimAmount,
    approvedBrandPct: 100,
  });

  return {
    success: true,
    period: { from, to },
    inputs: {
      meals_served: meals,
      food_spend: Math.round(spend * 100) / 100,
      approved_brand_pct: approvedBrandPct,
      tariff_zar: claim.tariff,
      school_days: countWeekdays(from, to),
      days_fed: new Set(feeding.map((f) => String(f.feed_date))).size,
    },
    simulation: {
      if_submit_now: {
        claim_amount: incentive.claim_amount,
        claim_amount_full: incentive.claim_amount_full,
        clawback_pct: incentive.clawback_pct,
        eligible_full: incentive.eligible_full,
        block_reason: incentive.block_reason,
        note: incentive.incentive_note,
      },
      if_100_pct_approved: {
        claim_amount: fullIfClean.claim_amount,
        gain_vs_now: Math.round(
          (fullIfClean.claim_amount - incentive.claim_amount) * 100
        ) / 100,
      },
      min_approved_pct: CLAIM_APPROVED_MIN_PCT,
    },
    tip:
      approvedBrandPct >= CLAIM_APPROVED_MIN_PCT
        ? 'You are at full funding threshold — submit claim when feed days are complete.'
        : `Raise approved GRN share to ≥${CLAIM_APPROVED_MIN_PCT}% to unlock full claim (currently ${approvedBrandPct}%).`,
  };
}

/** Sprint C — audit pack JSON (exportable) */
async function auditPack(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: string,
  from: string,
  to: string
) {
  const { school } = await getOrCreateSchoolProfile(supabase, companyId);
  if (!school) {
    return { success: false, error: 'School company required for audit pack' };
  }
  const schoolId = Number(school.id);

  const [pos, dels, files, recs, feed, claims] = await Promise.all([
    supabase
      .from('school_purchase_orders')
      .select(
        'id, po_number, status, order_date, total_amount, isp_profile_id, lines, compliance_ok'
      )
      .eq('school_profile_id', schoolId)
      .gte('order_date', from)
      .lte('order_date', to)
      .limit(200),
    supabase
      .from('school_nsnp_deliveries')
      .select(
        'id, po_id, delivery_number, status, expected_date, metadata, lines, otif, isp_profile_id'
      )
      .eq('school_profile_id', schoolId)
      .limit(200),
    supabase
      .from('school_nsnp_delivery_files')
      .select('id, delivery_id, kind, file_url, file_name, uploaded_by_role, created_at')
      .eq('school_profile_id', schoolId)
      .limit(300),
    supabase
      .from('school_kitchen_receipts')
      .select(
        'id, po_id, receipt_number, compliance_ok, lines, received_at, isp_profile_id, notes'
      )
      .eq('school_profile_id', schoolId)
      .gte('received_at', from)
      .lte('received_at', to)
      .limit(200),
    supabase
      .from('school_feeding_days')
      .select(
        'feed_date, served_meals, planned_meals, learners_present, cost_amount'
      )
      .eq('school_profile_id', schoolId)
      .gte('feed_date', from)
      .lte('feed_date', to)
      .limit(200),
    supabase
      .from('nsnp_claim_packs')
      .select(
        'id, status, period_from, period_to, claim_amount, approved_brand_pct, created_at'
      )
      .eq('school_profile_id', schoolId)
      .limit(20),
  ]);

  const match = await threeWayMatch(supabase, companyId, role, from, to);
  const sim = await fundingSim(supabase, companyId, from, to);

  const pack = {
    generated_at: new Date().toISOString(),
    school: {
      id: schoolId,
      name: school.school_name,
      emis: school.emis_number,
      natemis: (school as { natemis?: string }).natemis,
      district: school.district,
      province: school.province,
    },
    period: { from, to },
    purchase_orders: pos.data || [],
    deliveries: dels.data || [],
    delivery_files: files.data || [],
    kitchen_receipts: recs.data || [],
    feeding_days: feed.data || [],
    claims: claims.data || [],
    three_way_match: match,
    funding_simulation: sim,
  };

  // Content hash for seal
  const raw = JSON.stringify(pack);
  let hash = 'sha256:';
  try {
    const { createHash } = await import('crypto');
    hash += createHash('sha256').update(raw).digest('hex');
  } catch {
    hash += String(raw.length);
  }

  return {
    success: true,
    pack,
    content_hash: hash,
    export: {
      filename: `NSNP_Audit_${school.emis_number || schoolId}_${from}_${to}.json`,
      mime: 'application/json',
    },
    tip: 'Download JSON for auditors. Includes PO, DN, POD files, GRN, feed days, three-way match and funding simulation.',
  };
}
