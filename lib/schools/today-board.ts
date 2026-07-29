/**
 * School "Today" board — next actions for the next 10 minutes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkSchoolBrandPickGate } from '@/lib/schools/brand-pick-gate';
import { resolveCatalogueContext } from '@/lib/schools/approved-catalogue';

export type TodayCard = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'done';
  title: string;
  detail?: string;
  href: string;
  cta: string;
  count?: number;
};

export type TodayBoard = {
  date: string;
  cards: TodayCard[];
  summary: {
    urgent: number;
    awaiting_receive: number;
    open_pos: number;
    serve_today: boolean;
    claim_ready: boolean;
    brand_pick_ok: boolean;
    stock_risk: number;
    otif_due_48h: number;
  };
  next: TodayCard | null;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function inHours(isoDate: string | null | undefined, hours: number) {
  if (!isoDate) return false;
  const d = String(isoDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const target = new Date(`${d}T12:00:00`).getTime();
  const now = Date.now();
  const max = now + hours * 3600e3;
  return target >= now - 24 * 3600e3 && target <= max;
}

export async function buildSchoolTodayBoard(
  supabase: SupabaseClient,
  opts: { companyId: number; schoolProfileId: number; schoolName?: string }
): Promise<TodayBoard> {
  const date = todayStr();
  const cards: TodayCard[] = [];
  const sid = opts.schoolProfileId;

  const [
    delsRes,
    posRes,
    feedRes,
    stockRes,
    claimsRes,
  ] = await Promise.all([
    supabase
      .from('school_nsnp_deliveries')
      .select(
        'id, status, expected_date, delivery_number, metadata, po_id'
      )
      .eq('school_profile_id', sid)
      .in('status', [
        'draft',
        'confirmed',
        'dispatched',
        'delivered',
        'disputed',
      ])
      .limit(80),
    supabase
      .from('school_purchase_orders')
      .select('id, status, expected_date, po_number, metadata')
      .eq('school_profile_id', sid)
      .in('status', [
        'submitted',
        'confirmed',
        'open',
        'dispatched',
        'partially_received',
      ])
      .limit(50),
    supabase
      .from('school_feeding_days')
      .select('id, served_meals')
      .eq('school_profile_id', sid)
      .eq('feed_date', date)
      .maybeSingle(),
    supabase
      .from('school_kitchen_stock')
      .select('id, qty_on_hand, reorder_level, product_name, status')
      .eq('school_profile_id', sid)
      .limit(200),
    supabase
      .from('nsnp_claim_packs')
      .select('id, status, period_from, period_to')
      .eq('school_profile_id', sid)
      .in('status', ['draft', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const dels = delsRes.data || [];
  const pos = posRes.data || [];
  const awaiting = dels.filter((d) =>
    ['dispatched', 'delivered', 'confirmed'].includes(String(d.status))
  );
  const disputed = dels.filter((d) => String(d.status) === 'disputed');
  const late = dels.filter((d) => {
    const exp = d.expected_date ? String(d.expected_date).slice(0, 10) : null;
    return (
      exp &&
      exp < date &&
      !['received', 'cancelled'].includes(String(d.status))
    );
  });
  const due48 = [...dels, ...pos].filter((row) => {
    const exp =
      'expected_date' in row && row.expected_date
        ? String(row.expected_date).slice(0, 10)
        : null;
    return inHours(exp, 48);
  });

  if (late.length) {
    cards.push({
      id: 'late_deliveries',
      severity: 'critical',
      title: `${late.length} late delivery(ies)`,
      detail: 'Past required date — receive or dispute now',
      href: '/dashboard/schools/deliveries',
      cta: 'Open deliveries',
      count: late.length,
    });
  }
  if (awaiting.length) {
    cards.push({
      id: 'awaiting_receive',
      severity: 'high',
      title: `${awaiting.length} delivery(ies) to receive`,
      detail: 'SP drop waiting for kitchen GRN',
      href: '/dashboard/schools/deliveries',
      cta: 'Receive GRN',
      count: awaiting.length,
    });
  }
  if (disputed.length) {
    cards.push({
      id: 'disputed',
      severity: 'high',
      title: `${disputed.length} disputed delivery(ies)`,
      detail: 'Await SP credit note or resolve quantities',
      href: '/dashboard/schools/deliveries',
      cta: 'Review disputes',
      count: disputed.length,
    });
  }

  const serveToday = Boolean(feedRes.data);
  if (!serveToday) {
    cards.push({
      id: 'serve_day',
      severity: 'high',
      title: 'Log serve day for today',
      detail: 'Meals served unlock claims and prizes',
      href: '/dashboard/schools/serve-day',
      cta: 'Serve day',
    });
  } else {
    cards.push({
      id: 'serve_done',
      severity: 'done',
      title: `Serve day logged (${Number(feedRes.data?.served_meals || 0)} meals)`,
      href: '/dashboard/schools/serve-day',
      cta: 'View',
    });
  }

  // Stock risk — soft if table shape varies
  let stockRisk = 0;
  for (const s of stockRes.data || []) {
    const qty = Number(s.qty_on_hand || 0);
    const reorder = Number(s.reorder_level || 0);
    const status = String(s.status || '').toLowerCase();
    if (
      status === 'critical' ||
      status === 'reorder' ||
      (reorder > 0 && qty <= reorder) ||
      qty <= 0
    ) {
      stockRisk += 1;
    }
  }
  // Fallback: if no reorder_level column data, ignore empty errors
  if (stockRes.error) stockRisk = 0;
  if (stockRisk > 0) {
    cards.push({
      id: 'stock_risk',
      severity: 'medium',
      title: `${stockRisk} stock line(s) at risk`,
      detail: 'Below reorder or critical — raise PO from kitchen',
      href: '/dashboard/schools/kitchen',
      cta: 'Kitchen stock',
      count: stockRisk,
    });
  }

  const backorders = pos.filter(
    (p) =>
      String(p.status) === 'partially_received' ||
      Boolean(
        (p.metadata as { backorder?: boolean } | null)?.backorder
      )
  );
  if (backorders.length) {
    cards.push({
      id: 'backorders',
      severity: 'medium',
      title: `${backorders.length} open backorder(s)`,
      detail: 'Partial GRN — remaining qty still due from SP',
      href: '/dashboard/schools/orders',
      cta: 'View orders',
      count: backorders.length,
    });
  }

  if (pos.length && !awaiting.length) {
    cards.push({
      id: 'open_pos',
      severity: 'low',
      title: `${pos.length} open PO(s) with SP`,
      detail: 'Track required dates and OTIF',
      href: '/dashboard/schools/orders',
      cta: 'Orders',
      count: pos.length,
    });
  }

  if (due48.length && !late.length) {
    cards.push({
      id: 'otif_48h',
      severity: 'medium',
      title: `${due48.length} due within 48 hours`,
      detail: 'Required delivery date soon — chase SP if no truck',
      href: '/dashboard/schools/deliveries',
      cta: 'Check deliveries',
      count: due48.length,
    });
  }

  // Brand picks
  let brandOk = true;
  try {
    const cat = await resolveCatalogueContext(supabase, opts.companyId, {
      schoolProfileId: sid,
    });
    if (cat.agencyProfileId) {
      const gate = await checkSchoolBrandPickGate(supabase, {
        schoolProfileId: sid,
        agencyProfileId: cat.agencyProfileId,
      });
      brandOk = gate.ok;
      if (!gate.ok) {
        cards.push({
          id: 'brand_picks',
          severity: 'high',
          title: 'Brand picks incomplete',
          detail: gate.message || 'Pick multi-brand recipe lines before PO',
          href: '/dashboard/schools/recipes',
          cta: 'Pick brands',
          count: gate.missing.length,
        });
      }
    }
  } catch {
    /* soft */
  }

  // Claim readiness (this month soft)
  const monthStart = new Date();
  monthStart.setDate(1);
  const from = monthStart.toISOString().slice(0, 10);
  let claimReady = false;
  try {
    const { data: feedMonth } = await supabase
      .from('school_feeding_days')
      .select('id, served_meals')
      .eq('school_profile_id', sid)
      .gte('feed_date', from)
      .lte('feed_date', date)
      .limit(40);
    const meals = (feedMonth || []).reduce(
      (n, f) => n + Number(f.served_meals || 0),
      0
    );
    claimReady = meals > 0 && serveToday && stockRisk === 0;
    if (claimReady) {
      cards.push({
        id: 'claim_ready',
        severity: 'low',
        title: 'Claim path looks ready this month',
        detail: 'Confirm three-way match then submit with declaration',
        href: '/dashboard/schools/claims',
        cta: 'Open claims',
      });
    } else if (meals > 0) {
      cards.push({
        id: 'claim_progress',
        severity: 'low',
        title: 'Build claim pack',
        detail: 'Keep logging serve days and clean GRNs',
        href: '/dashboard/schools/claims',
        cta: 'Claims',
      });
    }
  } catch {
    /* soft */
  }

  const submitted = (claimsRes.data || []).filter(
    (c) => String(c.status) === 'submitted'
  );
  if (submitted.length) {
    cards.push({
      id: 'claim_waiting',
      severity: 'low',
      title: `${submitted.length} claim(s) awaiting DBE`,
      href: '/dashboard/schools/claims',
      cta: 'Track claims',
      count: submitted.length,
    });
  }

  const rank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    done: 9,
  };
  cards.sort(
    (a, b) => (rank[a.severity] ?? 5) - (rank[b.severity] ?? 5)
  );

  const actionable = cards.filter((c) => c.severity !== 'done');
  return {
    date,
    cards,
    summary: {
      urgent: cards.filter((c) =>
        ['critical', 'high'].includes(c.severity)
      ).length,
      awaiting_receive: awaiting.length,
      open_pos: pos.length,
      serve_today: serveToday,
      claim_ready: claimReady,
      brand_pick_ok: brandOk,
      stock_risk: stockRisk,
      otif_due_48h: due48.length,
    },
    next: actionable[0] || cards[0] || null,
  };
}
