import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  buildGoldenPath,
  emptyPathCounts,
  type PathCounts,
} from '@/lib/schools/golden-path';
import {
  applyApprovedProductClaimIncentive,
  CLAIM_APPROVED_MIN_PCT,
} from '@/lib/schools/incentives';
import { fetchAgencySchoolLinks } from '@/lib/schools/supabase-page';
import { computeClaimAmount, countWeekdays } from '@/lib/schools/process';
import { computeOtifRisk } from '@/lib/schools/brand-pick-gate';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Schools ops hub — Sprint A/B/C
 * GET ?companyId=&view=path|fulfil|exceptions|districts|shopping|match|audit|consistency|buylist
 * GET view=audit&format=pdf · sealed audit pack PDF
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
    const format = String(sp.get('format') || 'json').toLowerCase();
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
    if (view === 'today') {
      return NextResponse.json(await todayBoardView(supabase, companyId, role));
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
      return NextResponse.json(
        await exceptionsView(supabase, companyId, {
          lite: sp.get('lite') === '1' || sp.get('lite') === 'true',
        })
      );
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
    if (view === 'shopping' || view === 'buylist' || view === 'buy-list') {
      return NextResponse.json(await shoppingView(supabase, companyId, role));
    }
    if (view === 'consistency' || view === 'catalogue_health') {
      if (role !== 'agency') {
        return NextResponse.json(
          { error: 'Consistency report is for DBE / PEU' },
          { status: 403 }
        );
      }
      return NextResponse.json(await consistencyView(supabase, companyId));
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
      const pack = await auditPack(supabase, companyId, role, from, to);
      if (
        (format === 'pdf' || format === 'print' || format === 'download') &&
        pack.success &&
        pack.pack
      ) {
        const { buildAuditPackPdf, auditPackPdfFilename } = await import(
          '@/lib/schools/audit-pack-pdf'
        );
        const pdf = await buildAuditPackPdf(pack.pack, pack.content_hash);
        const filename = auditPackPdfFilename(pack.pack, from, to);
        const disposition =
          format === 'download' ? 'attachment' : 'inline';
        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${disposition}; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Content-Hash': String(pack.content_hash || ''),
          },
        });
      }
      return NextResponse.json(pack);
    }
    if (view === 'sim' || view === 'funding') {
      const from = sp.get('from') || monthAgo();
      const to = sp.get('to') || today();
      return NextResponse.json(
        await fundingSim(supabase, companyId, from, to)
      );
    }
    if (view === 'day_plan' || view === 'route_plan') {
      if (role !== 'isp') {
        return NextResponse.json(
          { error: 'Day plan is for service providers' },
          { status: 403 }
        );
      }
      return NextResponse.json(await dayPlanView(supabase, companyId));
    }
    if (view === 'budget_burn' || view === 'budgets') {
      return NextResponse.json(
        await budgetBurnView(supabase, companyId, role, sp)
      );
    }
    if (view === 'provincial_export' || view === 'export_pack') {
      if (role !== 'agency') {
        return NextResponse.json(
          { error: 'Provincial export is for DBE / PEU' },
          { status: 403 }
        );
      }
      const from = sp.get('from') || monthAgo();
      const to = sp.get('to') || today();
      return NextResponse.json(
        await provincialExportView(supabase, companyId, from, to)
      );
    }

    return NextResponse.json({
      success: true,
      role,
      views: [
        'path',
        'today',
        'fulfil',
        'day_plan',
        'budget_burn',
        'provincial_export',
        'exceptions',
        'districts',
        'shopping',
        'buylist',
        'consistency',
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

/** Priority 1 — School / SP / DBE "Today" board */
async function todayBoardView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: 'school' | 'isp' | 'agency'
) {
  if (role === 'school') {
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (!school) {
      return { success: false, error: 'School profile required' };
    }
    const { buildSchoolTodayBoard } = await import(
      '@/lib/schools/today-board'
    );
    const board = await buildSchoolTodayBoard(supabase, {
      companyId,
      schoolProfileId: Number(school.id),
      schoolName: String(school.school_name || ''),
    });
    const path = buildGoldenPath(
      'school',
      await gatherCounts(supabase, companyId, 'school')
    );
    return { success: true, role, board, path };
  }

  if (role === 'isp') {
    // Compact SP today from fulfil queue signals
    const fulfil = await fulfilView(supabase, companyId);
    const queue = (fulfil.queue || []) as Array<Record<string, unknown>>;
    const cards = [
      {
        id: 'need_dn',
        severity: 'high' as const,
        title: `${fulfil.summary?.need_dn ?? 0} PO(s) need DN`,
        href: '/dashboard/schools/ops',
        cta: 'Fulfil queue',
        count: Number(fulfil.summary?.need_dn || 0),
      },
      {
        id: 'late',
        severity: 'critical' as const,
        title: `${fulfil.summary?.late ?? 0} late vs required date`,
        href: '/dashboard/schools/orders',
        cta: 'SP inbox',
        count: Number(fulfil.summary?.late || 0),
      },
      {
        id: 'at_risk',
        severity: 'medium' as const,
        title: `${fulfil.summary?.at_risk ?? 0} at OTIF risk`,
        href: '/dashboard/schools/ops',
        cta: 'Open queue',
        count: Number(fulfil.summary?.at_risk || 0),
      },
    ].filter((c) => (c.count || 0) > 0);
    return {
      success: true,
      role,
      board: {
        date: today(),
        cards:
          cards.length > 0
            ? cards
            : [
                {
                  id: 'clear',
                  severity: 'done' as const,
                  title: 'No urgent fulfil items',
                  href: '/dashboard/schools/ops',
                  cta: 'Fulfil queue',
                },
              ],
        summary: fulfil.summary,
        next: cards[0] || null,
        open_queue: queue.length,
      },
      path: fulfil.path,
    };
  }

  // agency
  const ex = await exceptionsView(supabase, companyId);
  const list = (ex.exceptions || []) as Array<Record<string, unknown>>;
  const cards = list.slice(0, 8).map((e, i) => ({
    id: `ex-${i}`,
    severity: String(e.severity || 'medium') as
      | 'critical'
      | 'high'
      | 'medium'
      | 'low',
    title: String(e.title || e.kind),
    detail: e.kind ? String(e.kind).replace(/_/g, ' ') : undefined,
    href: String(e.href || '/dashboard/schools/ops'),
    cta: 'Open',
  }));
  return {
    success: true,
    role,
    board: {
      date: today(),
      cards,
      summary: ex.summary,
      next: cards[0] || null,
    },
    path: ex.path,
  };
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
  const c: PathCounts = emptyPathCounts();
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

    // Kitchen stock vs cover / zero — drives "check stock vs DBE menu"
    try {
      const { data: stock } = await supabase
        .from('school_kitchen_stock')
        .select('id, qty_on_hand, reorder_level, metadata')
        .eq('school_profile_id', sid)
        .limit(500);
      const rows = stock || [];
      c.stockShort = rows.filter((s) => {
        const qty = Number(s.qty_on_hand || 0);
        const reorder = Number(
          (s as { reorder_level?: number }).reorder_level ?? 0
        );
        if (reorder > 0) return qty <= reorder;
        return qty <= 0;
      }).length;
      c.stockOk = c.stockShort === 0 && rows.length > 0;
      // No stock rows yet → still need a stock check
      if (rows.length === 0) {
        c.stockOk = false;
        c.stockShort = 0;
      }
    } catch {
      c.stockOk = false;
    }

    const { data: pos } = await supabase
      .from('school_purchase_orders')
      .select('id')
      .eq('school_profile_id', sid)
      .in('status', ['submitted', 'confirmed', 'open', 'dispatched', 'draft'])
      .limit(50);
    c.openPos = (pos || []).length;

    const { data: dels } = await supabase
      .from('school_nsnp_deliveries')
      .select('id, status, metadata, received_at, expected_date')
      .eq('school_profile_id', sid)
      .limit(100);
    const list = dels || [];
    c.openDns = list.filter((d) =>
      ['draft', 'confirmed', 'dispatched', 'delivered'].includes(String(d.status))
    ).length;
    c.dispatched = list.filter((d) =>
      ['dispatched', 'delivered'].includes(String(d.status))
    ).length;
    // School receives (GRN) when SP has dispatched/delivered
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
    c.lateDeliveries = list.filter((d) => {
      if (!d.expected_date) return false;
      return (
        String(d.expected_date).slice(0, 10) < todayStr &&
        ['dispatched', 'delivered', 'confirmed'].includes(String(d.status))
      );
    }).length;

    const { data: feed } = await supabase
      .from('school_feeding_days')
      .select('id')
      .eq('school_profile_id', sid)
      .eq('feed_date', todayStr)
      .maybeSingle();
    c.serveToday = Boolean(feed);

    // Kitchen CoA / R638 passport risk (drives golden-path safety step)
    try {
      const {
        readKitchenPassport,
        evaluateKitchenRisk,
      } = await import('@/lib/schools/kitchen-safety');
      const smeta =
        school.metadata && typeof school.metadata === 'object'
          ? (school.metadata as Record<string, unknown>)
          : {};
      const risk = evaluateKitchenRisk(readKitchenPassport(smeta));
      c.kitchenSafetyBand = risk.band;
      c.kitchenSafetyOk =
        risk.band === 'green' ||
        (risk.coa_status === 'valid' && risk.band !== 'red');
    } catch {
      c.kitchenSafetyOk = undefined;
    }

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
    // agency (DBE / PEU) — programme governance counts only.
    // Do NOT map openPos / awaitingReceive as if DBE orders or receives food.
    const links = await fetchAgencySchoolLinks(supabase, companyId, [
      'active',
      'pending',
    ]).catch(() => []);
    c.pendingAssociations = links.filter((l) => l.status === 'pending').length;
    c.activeSchools = links.filter((l) => l.status === 'active').length;
    const schoolIds = links
      .map((l) => Number(l.school_profile_id))
      .filter(Boolean);

    // Pending SP joins (same desk)
    try {
      const { data: ispPending } = await supabase
        .from('nsnp_isp_agency_links')
        .select('id')
        .eq('agency_profile_id', companyId)
        .eq('status', 'pending')
        .limit(100);
      c.pendingAssociations += (ispPending || []).length;
    } catch {
      /* soft */
    }

    const { data: claims } = await supabase
      .from('nsnp_claim_packs')
      .select('id')
      .eq('agency_profile_id', companyId)
      .eq('status', 'submitted')
      .limit(50);
    c.submittedClaims = (claims || []).length;
    c.claimsReady = c.submittedClaims > 0;

    // Approved catalogue (agency-owned products)
    try {
      const { count } = await supabase
        .from('nsnp_approved_products')
        .select('id', { count: 'exact', head: true })
        .eq('agency_profile_id', companyId);
      c.catalogueProducts = count ?? 0;
    } catch {
      try {
        // Fallback column name on older catalogues
        const { data: products } = await supabase
          .from('nsnp_approved_products')
          .select('id')
          .eq('profile_id', companyId)
          .limit(500);
        c.catalogueProducts = (products || []).length;
      } catch {
        c.catalogueProducts = 0;
      }
    }

    // Menu cycle mandated by agency (school_menu_cycles.agency_profile_id)
    try {
      const { data: menus } = await supabase
        .from('school_menu_cycles')
        .select('id')
        .eq('agency_profile_id', companyId)
        .limit(1);
      c.menuConfigured = (menus || []).length > 0;
    } catch {
      c.menuConfigured = false;
    }

    // Recipes / BOMs (nsnp_recipes)
    try {
      const { data: recipes } = await supabase
        .from('nsnp_recipes')
        .select('id')
        .eq('agency_profile_id', companyId)
        .limit(1);
      c.recipesConfigured = (recipes || []).length > 0;
    } catch {
      c.recipesConfigured = false;
    }

    // Feeding calendar (nsnp_feeding_calendars)
    try {
      const { data: cal } = await supabase
        .from('nsnp_feeding_calendars')
        .select('id')
        .eq('agency_profile_id', companyId)
        .limit(1);
      c.calendarConfigured = (cal || []).length > 0;
    } catch {
      c.calendarConfigured = false;
    }

    // Kitchen CoA / R638 at-risk schools (golden-path + register signal)
    try {
      const {
        readKitchenPassport,
        evaluateKitchenRisk,
      } = await import('@/lib/schools/kitchen-safety');
      const activeIds = schoolIds.slice(0, 200);
      let atRisk = 0;
      for (let i = 0; i < activeIds.length; i += 80) {
        const slice = activeIds.slice(i, i + 80);
        const { data: schools } = await supabase
          .from('school_profiles')
          .select('id, metadata')
          .in('id', slice)
          .limit(100);
        for (const s of schools || []) {
          const meta =
            s.metadata && typeof s.metadata === 'object'
              ? (s.metadata as Record<string, unknown>)
              : {};
          const risk = evaluateKitchenRisk(readKitchenPassport(meta));
          if (
            risk.band === 'red' ||
            risk.coa_status === 'none' ||
            risk.coa_status === 'expired'
          ) {
            atRisk += 1;
          }
        }
      }
      c.kitchenCoaAtRisk = atRisk;
    } catch {
      c.kitchenCoaAtRisk = 0;
    }

    // Oversight only: late deliveries in network (DBE monitors, does not GRN)
    if (schoolIds.length) {
      const slice = schoolIds.slice(0, 200);
      const { data: dels } = await supabase
        .from('school_nsnp_deliveries')
        .select('id, status, expected_date')
        .in('school_profile_id', slice)
        .in('status', ['dispatched', 'delivered', 'confirmed'])
        .limit(300);
      c.lateDeliveries = (dels || []).filter(
        (d) =>
          d.expected_date &&
          String(d.expected_date).slice(0, 10) < todayStr
      ).length;
    }

    try {
      const { data: riads } = await supabase
        .from('riad_logs')
        .select('id, status')
        .contains('metadata', { raised_by_agency_profile_id: companyId })
        .limit(100);
      c.openRiads = (riads || []).filter(
        (r) =>
          !['closed', 'resolved'].includes(
            String(r.status || '').toLowerCase()
          )
      ).length;
    } catch {
      c.openRiads = 0;
    }

    try {
      const { data: ispLinks } = await supabase
        .from('nsnp_isp_agency_links')
        .select('isp_profile_id, status, metadata')
        .eq('agency_profile_id', companyId)
        .eq('status', 'active')
        .limit(200);
      c.probationSps = (ispLinks || []).filter((l) => {
        const meta = (l.metadata || {}) as { probation?: boolean; tier?: string };
        return (
          meta.probation === true ||
          String(meta.tier || '').toLowerCase() === 'probation'
        );
      }).length;
    } catch {
      c.probationSps = 0;
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
    const done = ['received', 'cancelled'].includes(
      String(dn?.status || p.status)
    );
    const risk = computeOtifRisk({
      requiredDate: expected,
      fulfilled: done && String(dn?.status || p.status) === 'received',
      cancelled: String(p.status) === 'cancelled',
    });
    const late = risk.otif_risk === 'late';
    return {
      po_id: p.id,
      po_number: p.po_number,
      status: p.status,
      order_date: p.order_date,
      expected_date: expected,
      required_delivery_date: expected,
      days_to_required: risk.days_to_required,
      otif_risk: risk.otif_risk,
      otif_risk_label: risk.otif_risk_label,
      total_amount: p.total_amount,
      school_profile_id: p.school_profile_id,
      school_name:
        names[Number(p.school_profile_id)] ||
        `School ${p.school_profile_id}`,
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

  // Sort: late → at_risk → due_soon → on_track, then by expected date
  const riskRank: Record<string, number> = {
    late: 0,
    at_risk: 1,
    due_soon: 2,
    on_track: 3,
    unknown: 4,
    done: 5,
  };
  queue.sort((a, b) => {
    const ra = riskRank[String(a.otif_risk)] ?? 9;
    const rb = riskRank[String(b.otif_risk)] ?? 9;
    if (ra !== rb) return ra - rb;
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
      at_risk: queue.filter((q) =>
        ['at_risk', 'due_soon'].includes(String(q.otif_risk))
      ).length,
      missing_pod: queue.filter((q) => q.delivery_id && !q.has_pod).length,
    },
  };
}

/** Sprint B — DBE exception cockpit */
async function exceptionsView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  opts?: { lite?: boolean }
) {
  if (opts?.lite) {
    const {
      loadAgencyLinkSummary,
      fetchPendingAgencyLinks,
    } = await import('@/lib/schools/supabase-page');
    const [summary, pendingLinks, claims] = await Promise.all([
      loadAgencyLinkSummary(supabase, companyId),
      fetchPendingAgencyLinks(supabase, companyId, 40).catch(() => []),
      supabase
        .from('nsnp_claim_packs')
        .select('id', { count: 'exact', head: true })
        .eq('agency_profile_id', companyId)
        .eq('status', 'submitted'),
    ]);
    const exceptions: Array<Record<string, unknown>> = [
      {
        kind: 'network_scope',
        severity: 'low',
        title: `${summary.activeLinks.toLocaleString('en-ZA')} active school link(s) · ${summary.pendingLinks.toLocaleString('en-ZA')} pending · ${summary.schoolCount.toLocaleString('en-ZA')} total on book`,
        href: '/dashboard/schools/agency',
        schools_active: summary.activeLinks,
        schools_pending: summary.pendingLinks,
        schools_total: summary.schoolCount,
      },
    ];
    if (summary.pendingLinks) {
      exceptions.push({
        kind: 'school_pending_rollup',
        severity: summary.pendingLinks > 50 ? 'high' : 'medium',
        title: `${summary.pendingLinks.toLocaleString('en-ZA')} school join(s) awaiting DBE approval`,
        href: '/dashboard/schools/join',
        count: summary.pendingLinks,
      });
    }
    const submitted = Number(claims.count || 0);
    if (submitted) {
      exceptions.push({
        kind: 'claims_submitted',
        severity: 'medium',
        title: `${submitted} claim(s) awaiting review`,
        href: '/dashboard/schools/ops',
        count: submitted,
      });
    }
    return {
      success: true,
      role: 'agency',
      lite: true,
      exceptions,
      summary: {
        schools_active: summary.activeLinks,
        schools_pending: summary.pendingLinks,
        claims_submitted: submitted,
      },
    };
  }

  const { fetchByIds } = await import('@/lib/schools/supabase-page');
  const links = await fetchAgencySchoolLinks(supabase, companyId, [
    'active',
    'pending',
    'suspended',
  ]).catch(() => []);
  const schoolIds = [
    ...new Set(
      links
        .map((l) => Number(l.school_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  const activeIds = [
    ...new Set(
      links
        .filter((x) => x.status === 'active')
        .map((l) => Number(l.school_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  const pendingLinks = links.filter((x) => x.status === 'pending');

  const exceptions: Array<Record<string, unknown>> = [];

  // Network size context (always surface for DBE)
  exceptions.push({
    kind: 'network_scope',
    severity: 'low',
    title: `${activeIds.length.toLocaleString('en-ZA')} active school link(s) · ${pendingLinks.length.toLocaleString('en-ZA')} pending · ${schoolIds.length.toLocaleString('en-ZA')} total on book`,
    href: '/dashboard/schools/agency',
    schools_active: activeIds.length,
    schools_pending: pendingLinks.length,
    schools_total: schoolIds.length,
  });

  // Pending school joins (count all; list sample)
  if (pendingLinks.length) {
    exceptions.push({
      kind: 'school_pending_rollup',
      severity: pendingLinks.length > 50 ? 'high' : 'medium',
      title: `${pendingLinks.length.toLocaleString('en-ZA')} school join(s) awaiting DBE approval`,
      href: '/dashboard/schools/join',
      count: pendingLinks.length,
    });
  }
  for (const l of pendingLinks.slice(0, 40)) {
    exceptions.push({
      kind: 'school_pending',
      severity: 'medium',
      title: `School join pending`,
      subject_id: l.school_profile_id,
      href: '/dashboard/schools/join',
      age_hint: l.created_at || l.updated_at,
    });
  }

  // Kitchen food safety (CoA / R638) across **all** active schools (not a 200 sample)
  const kitchenCounts = {
    scanned: 0,
    coa_missing: 0,
    coa_expired: 0,
    r638_red: 0,
    peu_noncompliant: 0,
    ok: 0,
  };
  const kitchenSamples: Array<Record<string, unknown>> = [];
  try {
    const {
      readKitchenPassport,
      evaluateKitchenRisk,
    } = await import('@/lib/schools/kitchen-safety');

    // Chunked full-network load via fetchByIds (handles 5k+ schools)
    for (let i = 0; i < activeIds.length; i += 200) {
      const slice = activeIds.slice(i, i + 200);
      let schools: Array<Record<string, unknown>> = [];
      try {
        schools = await fetchByIds(
          supabase,
          'school_profiles',
          'id, school_name, metadata, member_type',
          slice
        );
      } catch {
        const { data } = await supabase
          .from('school_profiles')
          .select('id, school_name, metadata, member_type')
          .in('id', slice)
          .limit(250);
        schools = (data || []) as Array<Record<string, unknown>>;
      }
      for (const s of schools) {
        const mt = String(s.member_type || 'school');
        if (['hospital', 'clinic', 'shelter'].includes(mt)) continue;
        kitchenCounts.scanned += 1;
        const meta =
          s.metadata && typeof s.metadata === 'object'
            ? (s.metadata as Record<string, unknown>)
            : {};
        const risk = evaluateKitchenRisk(readKitchenPassport(meta));
        const peuNon = risk.reasons.some((r) =>
          r.toLowerCase().includes('peu')
        );
        const flag =
          risk.band === 'red' ||
          risk.coa_status === 'none' ||
          risk.coa_status === 'expired' ||
          peuNon;
        if (!flag) {
          kitchenCounts.ok += 1;
          continue;
        }
        let kind = 'kitchen_r638_red';
        if (risk.coa_status === 'none') {
          kind = 'kitchen_coa_missing';
          kitchenCounts.coa_missing += 1;
        } else if (risk.coa_status === 'expired') {
          kind = 'kitchen_coa_expired';
          kitchenCounts.coa_expired += 1;
        } else if (peuNon) {
          kind = 'kitchen_peu_noncompliant';
          kitchenCounts.peu_noncompliant += 1;
        } else {
          kitchenCounts.r638_red += 1;
        }
        // Keep a drill-down sample so the list stays readable at 5k scale
        if (kitchenSamples.length < 80) {
          kitchenSamples.push({
            kind,
            severity:
              risk.coa_status === 'none' || risk.band === 'red'
                ? 'critical'
                : 'high',
            title: `${s.school_name || 'School'}: ${risk.label}`,
            school_profile_id: s.id,
            reasons: risk.reasons.slice(0, 3),
            href: '/dashboard/schools/kitchen-safety',
          });
        }
      }
    }

    const kitchenIssues =
      kitchenCounts.coa_missing +
      kitchenCounts.coa_expired +
      kitchenCounts.r638_red +
      kitchenCounts.peu_noncompliant;

    if (kitchenCounts.scanned > 0) {
      exceptions.push({
        kind: 'kitchen_compliance_rollup',
        severity:
          kitchenCounts.coa_missing > 0 || kitchenCounts.r638_red > 0
            ? 'critical'
            : kitchenIssues > 0
              ? 'high'
              : 'low',
        title:
          kitchenIssues > 0
            ? `${kitchenIssues.toLocaleString('en-ZA')} of ${kitchenCounts.scanned.toLocaleString('en-ZA')} schools need kitchen compliance (CoA / R638 / PEU)`
            : `Kitchen compliance OK across ${kitchenCounts.scanned.toLocaleString('en-ZA')} schools`,
        href: '/dashboard/schools/ops',
        count: kitchenIssues,
        schools_scanned: kitchenCounts.scanned,
        coa_missing: kitchenCounts.coa_missing,
        coa_expired: kitchenCounts.coa_expired,
        r638_red: kitchenCounts.r638_red,
        peu_noncompliant: kitchenCounts.peu_noncompliant,
        ok: kitchenCounts.ok,
      });
    }
    if (kitchenCounts.coa_missing > 0) {
      exceptions.push({
        kind: 'kitchen_coa_missing_rollup',
        severity: 'critical',
        title: `${kitchenCounts.coa_missing.toLocaleString('en-ZA')} school(s) have no Certificate of Acceptability (CoA)`,
        href: '/dashboard/schools/kitchen-safety',
        count: kitchenCounts.coa_missing,
      });
    }
    if (kitchenCounts.coa_expired > 0) {
      exceptions.push({
        kind: 'kitchen_coa_expired_rollup',
        severity: 'critical',
        title: `${kitchenCounts.coa_expired.toLocaleString('en-ZA')} school(s) have expired CoA`,
        href: '/dashboard/schools/kitchen-safety',
        count: kitchenCounts.coa_expired,
      });
    }
    if (kitchenCounts.r638_red > 0) {
      exceptions.push({
        kind: 'kitchen_r638_red_rollup',
        severity: 'critical',
        title: `${kitchenCounts.r638_red.toLocaleString('en-ZA')} school(s) on R638 red band`,
        href: '/dashboard/schools/kitchen-safety',
        count: kitchenCounts.r638_red,
      });
    }
    for (const sample of kitchenSamples) {
      exceptions.push(sample);
    }
  } catch {
    /* soft */
  }

  // SP probation / compliance risk (network)
  try {
    const { data: isps } = await supabase
      .from('nsnp_isp_profiles')
      .select('profile_id, trading_name, name, compliance_status, preferred, metadata')
      .limit(80);
    for (const isp of isps || []) {
      const st = String(isp.compliance_status || '').toLowerCase();
      const meta =
        isp.metadata && typeof isp.metadata === 'object'
          ? (isp.metadata as Record<string, unknown>)
          : {};
      const probation =
        st === 'probation' ||
        meta.sp_tier === 'probation' ||
        meta.preferred === false && st.includes('prob');
      if (probation || st === 'suspended') {
        exceptions.push({
          kind: 'sp_probation',
          severity: st === 'suspended' ? 'critical' : 'high',
          title: `SP ${isp.trading_name || isp.name || isp.profile_id} on ${st || 'probation'}`,
          isp_profile_id: isp.profile_id,
          href: '/dashboard/schools/isp-sla',
        });
      }
    }
  } catch {
    /* soft */
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

  // Late / stuck deliveries + off-catalogue GRNs — full linked network (chunked)
  let deliveryIssueCount = 0;
  let offCatalogueCount = 0;
  if (schoolIds.length) {
    const from14 = new Date();
    from14.setDate(from14.getDate() - 14);
    const from14Str = from14.toISOString().slice(0, 10);
    for (let i = 0; i < schoolIds.length; i += 100) {
      const slice = schoolIds.slice(i, i + 100);
      const { data: dels } = await supabase
        .from('school_nsnp_deliveries')
        .select(
          'id, school_profile_id, isp_profile_id, status, expected_date, delivery_number, metadata, updated_at'
        )
        .in('school_profile_id', slice)
        .in('status', ['dispatched', 'delivered', 'confirmed'])
        .limit(500);
      for (const d of dels || []) {
        const late =
          d.expected_date &&
          String(d.expected_date).slice(0, 10) < today();
        const noPod = !(d.metadata as { has_pod_photo?: boolean })
          ?.has_pod_photo;
        const stuckHours = d.updated_at
          ? (Date.now() - new Date(String(d.updated_at)).getTime()) / 36e5
          : 0;
        if (late || (stuckHours > 48 && d.status !== 'received')) {
          deliveryIssueCount += 1;
          if (deliveryIssueCount <= 60) {
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
      }

      const { data: recs } = await supabase
        .from('school_kitchen_receipts')
        .select(
          'id, school_profile_id, isp_profile_id, compliance_ok, received_at'
        )
        .in('school_profile_id', slice)
        .eq('compliance_ok', false)
        .gte('received_at', from14Str)
        .limit(300);
      for (const r of recs || []) {
        offCatalogueCount += 1;
        if (offCatalogueCount <= 40) {
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
    if (deliveryIssueCount > 0) {
      exceptions.push({
        kind: 'delivery_issues_rollup',
        severity: 'high',
        title: `${deliveryIssueCount.toLocaleString('en-ZA')} late / stuck delivery issue(s) across network`,
        href: '/dashboard/schools/ops',
        count: deliveryIssueCount,
      });
    }
    if (offCatalogueCount > 0) {
      exceptions.push({
        kind: 'off_catalogue_rollup',
        severity: 'high',
        title: `${offCatalogueCount.toLocaleString('en-ZA')} off-catalogue GRN(s) in last 14 days`,
        href: '/dashboard/schools/registry-report',
        count: offCatalogueCount,
      });
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

  // Sprint C1 — disputed deliveries + open credit notes (full network, sample list)
  let disputedCount = 0;
  if (schoolIds.length) {
    for (let i = 0; i < schoolIds.length; i += 100) {
      const slice = schoolIds.slice(i, i + 100);
      const { data: disputed } = await supabase
        .from('school_nsnp_deliveries')
        .select(
          'id, school_profile_id, isp_profile_id, status, delivery_number, metadata, dispute_reason, updated_at'
        )
        .in('school_profile_id', slice)
        .eq('status', 'disputed')
        .limit(200);
      for (const d of disputed || []) {
        disputedCount += 1;
        if (disputedCount > 40) continue;
        const meta = (d.metadata || {}) as Record<string, unknown>;
        const cnStatus = String(meta.credit_note_status || '');
        exceptions.push({
          kind:
            cnStatus === 'requested' || meta.credit_note_requested
              ? 'credit_note_open'
              : 'delivery_disputed',
          severity: 'high',
          title:
            cnStatus === 'issued'
              ? `Credit note issued · ${d.delivery_number || d.id}`
              : meta.credit_note_requested
                ? `Credit note requested · ${d.delivery_number || d.id}`
                : `Disputed delivery ${d.delivery_number || d.id}`,
          school_profile_id: d.school_profile_id,
          isp_profile_id: d.isp_profile_id,
          delivery_id: d.id,
          reason: d.dispute_reason,
          href: '/dashboard/schools/deliveries',
        });
      }
    }
    if (disputedCount > 0) {
      exceptions.push({
        kind: 'delivery_disputed_rollup',
        severity: 'high',
        title: `${disputedCount.toLocaleString('en-ZA')} disputed delivery(ies) / credit-note cases`,
        href: '/dashboard/schools/deliveries',
        count: disputedCount,
      });
    }
  }

  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  // Prefer roll-ups first within same severity
  const isRollup = (e: Record<string, unknown>) =>
    String(e.kind || '').includes('rollup') || e.kind === 'network_scope';
  exceptions.sort((a, b) => {
    const sa = severityRank[String(a.severity)] ?? 9;
    const sb = severityRank[String(b.severity)] ?? 9;
    if (sa !== sb) return sa - sb;
    const ra = isRollup(a) ? 0 : 1;
    const rb = isRollup(b) ? 0 : 1;
    return ra - rb;
  });

  const path = buildGoldenPath(
    'agency',
    await gatherCounts(supabase, companyId, 'agency')
  );

  const kitchenIssueTotal =
    kitchenCounts.coa_missing +
    kitchenCounts.coa_expired +
    kitchenCounts.r638_red +
    kitchenCounts.peu_noncompliant;

  // Open issues count for summary: use roll-up metrics, not raw sample row count
  const openIssues =
    kitchenIssueTotal +
    pendingLinks.length +
    deliveryIssueCount +
    offCatalogueCount +
    disputedCount +
    exceptions.filter((e) => e.kind === 'claim_submitted').length +
    exceptions.filter((e) => e.kind === 'open_riad').length +
    exceptions.filter((e) => e.kind === 'sp_probation' || e.kind === 'sp_pending')
      .length;

  return {
    success: true,
    role: 'agency',
    path,
    // List: roll-ups + samples (cap keeps payload sane at 5k schools)
    exceptions: exceptions.slice(0, 120),
    summary: {
      total: openIssues,
      // Critical = kitchen compliance gaps (full network) + aged RIADs
      critical:
        kitchenIssueTotal +
        exceptions.filter(
          (e) => e.kind === 'open_riad' && e.severity === 'critical'
        ).length,
      high:
        deliveryIssueCount +
        offCatalogueCount +
        disputedCount +
        pendingLinks.length +
        exceptions.filter((e) => e.kind === 'claim_submitted').length,
      claims: exceptions.filter((e) => e.kind === 'claim_submitted').length,
      deliveries: deliveryIssueCount,
      riads: exceptions.filter((e) => e.kind === 'open_riad').length,
      off_catalogue: offCatalogueCount,
      disputed: disputedCount,
      schools_active: activeIds.length,
      schools_pending: pendingLinks.length,
      schools_total: schoolIds.length,
      schools_scanned: kitchenCounts.scanned,
      kitchen_coa_missing: kitchenCounts.coa_missing,
      kitchen_coa_expired: kitchenCounts.coa_expired,
      kitchen_r638_red: kitchenCounts.r638_red,
      kitchen_peu_noncompliant: kitchenCounts.peu_noncompliant,
      kitchen_ok: kitchenCounts.ok,
      kitchen_issues: kitchenIssueTotal,
    },
  };
}

/** Sprint A3 — DBE catalogue / menu / recipe consistency */
async function consistencyView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
) {
  const issues: Array<Record<string, unknown>> = [];

  const { data: products } = await supabase
    .from('nsnp_approved_products')
    .select('id, name, brand_name, category, active, metadata')
    .eq('agency_profile_id', companyId)
    .limit(1000);
  const active = (products || []).filter((p) => p.active !== false);
  const inactive = (products || []).filter((p) => p.active === false);
  const byId = new Map(
    (products || []).map((p) => [Number(p.id), p as Record<string, unknown>])
  );

  // Menu product ids
  const menuIds = new Set<number>();
  const { data: menus } = await supabase
    .from('school_menu_cycles')
    .select('id, name, weekly_approved_product_ids, cycle_json, metadata, active')
    .eq('agency_profile_id', companyId)
    .limit(50);
  for (const m of menus || []) {
    const ids = Array.isArray(m.weekly_approved_product_ids)
      ? m.weekly_approved_product_ids
      : [];
    for (const raw of ids) {
      const id = Number(raw);
      if (!Number.isFinite(id)) continue;
      menuIds.add(id);
      const prod = byId.get(id);
      if (!prod) {
        issues.push({
          kind: 'menu_unknown_product',
          severity: 'high',
          title: `Menu references product #${id} not on catalogue`,
          menu_id: m.id,
          product_id: id,
        });
      } else if (prod.active === false) {
        issues.push({
          kind: 'menu_inactive_product',
          severity: 'medium',
          title: `Menu includes inactive product: ${prod.name}`,
          menu_id: m.id,
          product_id: id,
        });
      }
    }
  }

  // Recipe lines
  const { data: recipes } = await supabase
    .from('nsnp_recipes')
    .select('id, name, active')
    .eq('agency_profile_id', companyId)
    .limit(100);
  const recipeIds = (recipes || []).map((r) => Number(r.id));
  const recipeName = new Map(
    (recipes || []).map((r) => [Number(r.id), String(r.name || r.id)])
  );
  if (recipeIds.length) {
    const { data: lines } = await supabase
      .from('nsnp_recipe_lines')
      .select('id, recipe_id, approved_product_id, product_name, category')
      .in('recipe_id', recipeIds)
      .limit(800);
    for (const l of lines || []) {
      const pid = l.approved_product_id ? Number(l.approved_product_id) : null;
      if (!pid) {
        issues.push({
          kind: 'recipe_line_no_product',
          severity: 'medium',
          title: `BOM line without product: ${l.product_name || l.id}`,
          recipe_id: l.recipe_id,
          recipe_name: recipeName.get(Number(l.recipe_id)),
          line_id: l.id,
        });
        continue;
      }
      const prod = byId.get(pid);
      if (!prod) {
        issues.push({
          kind: 'recipe_unknown_product',
          severity: 'high',
          title: `Recipe BOM product #${pid} not on catalogue`,
          recipe_id: l.recipe_id,
          recipe_name: recipeName.get(Number(l.recipe_id)),
          product_id: pid,
        });
      } else if (prod.active === false) {
        issues.push({
          kind: 'recipe_inactive_product',
          severity: 'medium',
          title: `Recipe uses inactive product: ${prod.name}`,
          recipe_id: l.recipe_id,
          recipe_name: recipeName.get(Number(l.recipe_id)),
          product_id: pid,
        });
      }
    }
  }

  // Orphan catalogue products (not on menu and not on any recipe) — info only
  const usedIds = new Set<number>(menuIds);
  if (recipeIds.length) {
    const { data: lines2 } = await supabase
      .from('nsnp_recipe_lines')
      .select('approved_product_id')
      .in('recipe_id', recipeIds)
      .limit(800);
    for (const l of lines2 || []) {
      if (l.approved_product_id) usedIds.add(Number(l.approved_product_id));
    }
  }
  let orphanCount = 0;
  for (const p of active) {
    if (!usedIds.has(Number(p.id))) orphanCount += 1;
  }

  // Breakfast/lunch tags coverage (metadata fallback)
  let missingMealTag = 0;
  for (const p of active) {
    const meta =
      p.metadata && typeof p.metadata === 'object'
        ? (p.metadata as Record<string, unknown>)
        : {};
    const hasB =
      meta.for_breakfast === true ||
      meta.for_breakfast === 'true' ||
      meta.meal_slot === 'breakfast' ||
      meta.meal_slots === 'breakfast' ||
      (Array.isArray(meta.meal_slots) &&
        meta.meal_slots.includes('breakfast'));
    const hasL =
      meta.for_lunch === true ||
      meta.for_lunch === 'true' ||
      meta.meal_slot === 'lunch' ||
      (Array.isArray(meta.meal_slots) && meta.meal_slots.includes('lunch'));
    if (!hasB && !hasL) missingMealTag += 1;
  }
  if (missingMealTag > 0 && active.length > 0) {
    issues.push({
      kind: 'missing_meal_tags',
      severity: 'low',
      title: `${missingMealTag} active product(s) lack breakfast/lunch tags`,
      count: missingMealTag,
      href: '/dashboard/schools/approved-list',
    });
  }

  const severityRank: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  issues.sort(
    (a, b) =>
      (severityRank[String(a.severity)] ?? 9) -
      (severityRank[String(b.severity)] ?? 9)
  );

  return {
    success: true,
    role: 'agency',
    issues: issues.slice(0, 100),
    summary: {
      catalogue_active: active.length,
      catalogue_inactive: inactive.length,
      menus: (menus || []).length,
      recipes: (recipes || []).length,
      issues: issues.length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      orphan_products: orphanCount,
      missing_meal_tags: missingMealTag,
    },
    tip:
      issues.length === 0
        ? 'Catalogue, menus and recipes look consistent.'
        : 'Fix high issues first — menu/recipe products must exist and be active on the approved list.',
    hrefs: {
      catalogue: '/dashboard/schools/approved-list',
      menu: '/dashboard/schools/menu',
      recipes: '/dashboard/schools/recipes',
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

/** Sprint C — menu → shopping list · SP wholesale buy-list from open school POs */
async function shoppingView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: string
) {
  // Sprint C2 — SP buy-list: aggregate open school PO lines for wholesale buy
  if (role === 'isp') {
    const { data: pos } = await supabase
      .from('school_purchase_orders')
      .select(
        'id, po_number, status, expected_date, school_profile_id, lines, total_amount'
      )
      .eq('isp_profile_id', companyId)
      .in('status', [
        'submitted',
        'confirmed',
        'open',
        'dispatched',
        'partially_received',
      ])
      .limit(120);

    const schoolIds = [
      ...new Set(
        (pos || []).map((p) => Number(p.school_profile_id)).filter(Boolean)
      ),
    ];
    const names: Record<number, string> = {};
    if (schoolIds.length) {
      const { data: schools } = await supabase
        .from('school_profiles')
        .select('id, school_name')
        .in('id', schoolIds);
      for (const s of schools || []) {
        names[Number(s.id)] = String(s.school_name);
      }
    }

    // Already shipped qty per product from received/partial DNs
    const poIds = (pos || []).map((p) => Number(p.id));
    const shippedByKey = new Map<string, number>();
    if (poIds.length) {
      const { data: dns } = await supabase
        .from('school_nsnp_deliveries')
        .select('po_id, status, lines')
        .eq('isp_profile_id', companyId)
        .in('po_id', poIds.slice(0, 100))
        .limit(200);
      for (const d of dns || []) {
        if (String(d.status) === 'cancelled') continue;
        const dLines = Array.isArray(d.lines)
          ? (d.lines as Array<Record<string, unknown>>)
          : [];
        for (const l of dLines) {
          const pid = l.approved_product_id
            ? Number(l.approved_product_id)
            : null;
          const key = pid
            ? `id:${pid}`
            : `n:${String(l.product_name || '').toLowerCase()}`;
          const qty = Number(
            l.qty_delivered ?? l.qty_ordered ?? l.qty ?? 0
          );
          // Only count as shipped if left school warehouse (dispatched+)
          if (
            ['dispatched', 'delivered', 'received', 'partially_received'].includes(
              String(d.status)
            )
          ) {
            shippedByKey.set(key, (shippedByKey.get(key) || 0) + qty);
          }
        }
      }
    }

    type BuyLine = {
      key: string;
      approved_product_id: number | null;
      product_name: string;
      brand_name: string;
      uom: string;
      qty_ordered: number;
      qty_shipped: number;
      qty_to_buy: number;
      po_count: number;
      schools: string[];
      earliest_required: string | null;
    };
    const agg = new Map<string, BuyLine>();

    for (const p of pos || []) {
      const schoolName =
        names[Number(p.school_profile_id)] || `School ${p.school_profile_id}`;
      const expected = p.expected_date
        ? String(p.expected_date).slice(0, 10)
        : null;
      const lines = Array.isArray(p.lines)
        ? (p.lines as Array<Record<string, unknown>>)
        : [];
      for (const l of lines) {
        const pid = l.approved_product_id
          ? Number(l.approved_product_id)
          : null;
        const name = String(l.product_name || 'Product');
        const key = pid ? `id:${pid}` : `n:${name.toLowerCase()}`;
        const qty = Number(l.qty || 0);
        if (!(qty > 0)) continue;
        const row = agg.get(key) || {
          key,
          approved_product_id: pid && Number.isFinite(pid) ? pid : null,
          product_name: name,
          brand_name: String(l.brand_name || ''),
          uom: String(l.uom || 'kg'),
          qty_ordered: 0,
          qty_shipped: 0,
          qty_to_buy: 0,
          po_count: 0,
          schools: [] as string[],
          earliest_required: null as string | null,
        };
        row.qty_ordered += qty;
        row.po_count += 1;
        if (!row.schools.includes(schoolName)) row.schools.push(schoolName);
        if (
          expected &&
          (!row.earliest_required || expected < row.earliest_required)
        ) {
          row.earliest_required = expected;
        }
        agg.set(key, row);
      }
    }

    const buy_list = [...agg.values()]
      .map((row) => {
        const shipped = shippedByKey.get(row.key) || 0;
        const toBuy = Math.max(0, Math.round((row.qty_ordered - shipped) * 1000) / 1000);
        return {
          ...row,
          qty_shipped: shipped,
          qty_to_buy: toBuy,
          otif_risk: computeOtifRisk({
            requiredDate: row.earliest_required,
            fulfilled: toBuy <= 0,
          }),
        };
      })
      .filter((r) => r.qty_to_buy > 0)
      .sort((a, b) => {
        const da = a.earliest_required || '9999';
        const db = b.earliest_required || '9999';
        return da.localeCompare(db);
      });

    return {
      success: true,
      role: 'isp',
      mode: 'wholesale_buy_list',
      buy_list,
      shopping_list: buy_list.map((b) => ({
        name: b.product_name,
        brand: b.brand_name,
        approved_product_id: b.approved_product_id,
        suggested_qty: b.qty_to_buy,
        uom: b.uom,
        days: b.earliest_required ? [b.earliest_required] : [],
        schools: b.schools,
        po_count: b.po_count,
      })),
      open_pos: (pos || []).length,
      tip:
        buy_list.length === 0
          ? 'No open school PO lines to buy — when schools order, aggregate here for wholesale.'
          : 'Buy these quantities from wholesalers to cover open school POs (remaining after DNs already dispatched).',
      href_fulfil: '/dashboard/schools/ops',
      href_orders: '/dashboard/schools/orders',
      href_wholesalers: '/dashboard/schools/wholesalers',
    };
  }

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

  // Kitchen food safety (R638 / CoA) + monthly audit trail for auditors
  let kitchen_safety: Record<string, unknown> | null = null;
  try {
    const {
      readKitchenPassport,
      evaluateKitchenRisk,
      readSelfAudits,
      readMonthlyAudits,
      monthlyAuditStats,
      refreshMonthlyAuditStatuses,
    } = await import('@/lib/schools/kitchen-safety');
    const smeta =
      school.metadata && typeof school.metadata === 'object'
        ? (school.metadata as Record<string, unknown>)
        : {};
    const passport = readKitchenPassport(smeta);
    const risk = evaluateKitchenRisk(passport);
    const monthly = refreshMonthlyAuditStatuses(readMonthlyAudits(smeta));
    kitchen_safety = {
      passport,
      risk,
      monthly_stats: monthlyAuditStats(monthly, { from, to }),
      monthly_audits: monthly
        .filter((m) => m.status !== 'cancelled')
        .slice(0, 18),
      recent_self_audits: readSelfAudits(smeta).slice(0, 6),
      note:
        'Regulation R638 / Certificate of Acceptability — school kitchen legal food-handling status. Monthly audits are calendar-scheduled with checklist saved on the planned/completed day.',
    };
    (pack as Record<string, unknown>).kitchen_safety = kitchen_safety;
  } catch {
    /* soft */
  }

  // Re-hash including kitchen safety
  try {
    const { createHash } = await import('crypto');
    hash = 'sha256:';
    hash += createHash('sha256')
      .update(JSON.stringify(pack))
      .digest('hex');
  } catch {
    /* keep prior hash */
  }

  return {
    success: true,
    pack,
    kitchen_safety,
    content_hash: hash,
    export: {
      filename: `NSNP_Audit_${school.emis_number || schoolId}_${from}_${to}.json`,
      mime: 'application/json',
    },
    tip: 'Download JSON for auditors. Includes PO, DN, POD, GRN, feed days, kitchen CoA/R638 passport, monthly audit calendar results, three-way match and funding simulation.',
  };
}

/** SP multi-school day plan — cluster open POs by district + required date */
async function dayPlanView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
) {
  const fulfil = await fulfilView(supabase, companyId);
  const queue = (fulfil.queue || []) as Array<Record<string, unknown>>;

  // Enrich district from schools
  const schoolIds = [
    ...new Set(
      queue.map((q) => Number(q.school_profile_id)).filter(Boolean)
    ),
  ];
  const districts = new Map<number, string>();
  if (schoolIds.length) {
    const { data: schools } = await supabase
      .from('school_profiles')
      .select('id, district, school_name')
      .in('id', schoolIds);
    for (const s of schools || []) {
      districts.set(Number(s.id), String(s.district || 'Unknown'));
    }
  }

  type DayBucket = {
    required_date: string;
    districts: Array<{
      district: string;
      schools: Array<Record<string, unknown>>;
      po_count: number;
      line_count: number;
    }>;
    po_count: number;
    late: number;
  };
  const byDate = new Map<string, DayBucket>();

  for (const q of queue) {
    const d = q.expected_date
      ? String(q.expected_date).slice(0, 10)
      : 'unscheduled';
    const bucket = byDate.get(d) || {
      required_date: d,
      districts: [],
      po_count: 0,
      late: 0,
    };
    const dist = districts.get(Number(q.school_profile_id)) || 'Unknown';
    let distRow = bucket.districts.find((x) => x.district === dist);
    if (!distRow) {
      distRow = { district: dist, schools: [], po_count: 0, line_count: 0 };
      bucket.districts.push(distRow);
    }
    distRow.schools.push({
      school_name: q.school_name,
      po_id: q.po_id,
      po_number: q.po_number,
      line_count: q.line_count,
      otif_risk: q.otif_risk,
      action: q.action,
      late: q.late,
    });
    distRow.po_count += 1;
    distRow.line_count += Number(q.line_count || 0);
    bucket.po_count += 1;
    if (q.late) bucket.late += 1;
    byDate.set(d, bucket);
  }

  const days = [...byDate.values()].sort((a, b) =>
    String(a.required_date).localeCompare(String(b.required_date))
  );
  for (const day of days) {
    day.districts.sort((a, b) => b.po_count - a.po_count);
  }

  return {
    success: true,
    role: 'isp',
    days,
    summary: {
      days: days.length,
      open_pos: queue.length,
      late: queue.filter((q) => q.late).length,
    },
    tip: 'Plan one truck run per district on each required date. Create DNs from fulfil queue.',
    href_buy: '/dashboard/schools/ops?tab=buy',
    href_fulfil: '/dashboard/schools/ops',
  };
}

/** Budget burn vs remaining feeding days */
async function budgetBurnView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  role: string,
  sp: URLSearchParams
) {
  const from = sp.get('from') || monthAgo();
  const to = sp.get('to') || today();
  let agencyId: number | null = null;
  let schoolId: number | null = null;

  if (role === 'agency') {
    agencyId = companyId;
  } else {
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (school) {
      schoolId = Number(school.id);
      const { data: link } = await supabase
        .from('school_agency_links')
        .select('agency_profile_id')
        .eq('school_profile_id', school.id)
        .eq('status', 'active')
        .maybeSingle();
      agencyId = link ? Number(link.agency_profile_id) : null;
    }
  }
  if (!agencyId) {
    return {
      success: false,
      error: 'Join a DBE / PEU to see category budget burn',
    };
  }
  const { buildBudgetBurn } = await import('@/lib/schools/budget-burn');
  const burn = await buildBudgetBurn(supabase, {
    agencyProfileId: agencyId,
    schoolProfileId: role === 'school' ? schoolId : null,
    from,
    to,
  });
  return {
    success: true,
    role,
    period: { from, to },
    ...burn,
  };
}

/** Provincial monthly export pack (JSON index + audit-ready sections) */
async function provincialExportView(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  from: string,
  to: string
) {
  const ex = await exceptionsView(supabase, companyId);
  const dist = await districtView(supabase, companyId);
  const cons = await consistencyView(supabase, companyId);

  const links = await fetchAgencySchoolLinks(supabase, companyId, [
    'active',
  ]).catch(() => []);
  const schoolIds = [
    ...new Set(
      links.map((l) => Number(l.school_profile_id)).filter(Boolean)
    ),
  ];

  // Sample schools for claim readiness (cap)
  const sampleIds = schoolIds.slice(0, 40);
  const schoolRows: Array<Record<string, unknown>> = [];
  if (sampleIds.length) {
    const { data: schools } = await supabase
      .from('school_profiles')
      .select('id, school_name, emis_number, district, province')
      .in('id', sampleIds);
    for (const s of schools || []) {
      const { count: feedDays } = await supabase
        .from('school_feeding_days')
        .select('*', { count: 'exact', head: true })
        .eq('school_profile_id', s.id)
        .gte('feed_date', from)
        .lte('feed_date', to);
      schoolRows.push({
        id: s.id,
        name: s.school_name,
        emis: s.emis_number,
        district: s.district,
        province: s.province,
        feed_days_in_period: feedDays || 0,
      });
    }
  }

  const { data: claims } = await supabase
    .from('nsnp_claim_packs')
    .select(
      'id, school_profile_id, status, claim_amount, period_from, period_to, approved_brand_pct, created_at'
    )
    .eq('agency_profile_id', companyId)
    .gte('period_from', from)
    .lte('period_to', to)
    .limit(200);

  const pack = {
    generated_at: new Date().toISOString(),
    programme: 'NSNP',
    agency_profile_id: companyId,
    period: { from, to },
    kpis: {
      schools: schoolIds.length,
      districts: (dist.kpis as { districts?: number } | undefined)?.districts,
      exceptions: (ex.summary as { total?: number } | undefined)?.total,
      claims: (claims || []).length,
      consistency_issues: (cons.summary as { issues?: number } | undefined)
        ?.issues,
    },
    districts: dist.byDistrict || [],
    exceptions_summary: ex.summary,
    consistency_summary: cons.summary,
    claims: claims || [],
    schools_sample: schoolRows,
  };

  let hash = 'sha256:';
  try {
    const { createHash } = await import('crypto');
    hash += createHash('sha256').update(JSON.stringify(pack)).digest('hex');
  } catch {
    hash += String(JSON.stringify(pack).length);
  }

  return {
    success: true,
    role: 'agency',
    pack,
    content_hash: hash,
    export: {
      filename: `NSNP_Provincial_${from}_${to}.json`,
      mime: 'application/json',
      note: 'Download JSON for PEU / Treasury. Pair with school audit pack PDFs for full evidence.',
    },
    tip: 'Share with PEU / Treasury. For each school needing deep audit, open Ops → Audit pack PDF.',
  };
}
