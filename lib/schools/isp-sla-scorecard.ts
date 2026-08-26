/**
 * SP SLA + OTIFEF scorecard loader (school, SP, or DBE network).
 * Shared by JSON API and PDF/CSV export for the selected cover period.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import {
  computeIspIncentive,
  ISP_APPROVED_INCENTIVE_COPY,
} from '@/lib/schools/incentives';
import {
  computeOtifefFromDeliveries,
  otifefLabel,
  type DeliveryLike,
} from '@/lib/schools/otifef';

export type IspSlaRole = 'agency' | 'school' | 'isp';

export type IspSlaRow = {
  isp_profile_id: number;
  name: string;
  deliveries: number;
  approved_ok: number;
  wrong_brand: number;
  spend: number;
  compliance_pct: number | null;
  otifef_pct: number | null;
  otifef_label: string;
  on_time_pct: number | null;
  in_full_pct: number | null;
  error_free_pct: number | null;
  incentive_score: number;
  badge: string;
  incentive_note: string;
  pillars?: {
    onCatalogue: number;
    fullCompliance: number;
    podPhotos: number;
    otif: number;
  };
  status: string;
  preferred: boolean;
  avg_school_rating: number | null;
  rating_count: number;
};

export type IspSlaSummary = {
  deliveries: number;
  otifef_pct: number | null;
  compliance_pct: number | null;
  isp_count: number;
  preferred: number;
  probation: number;
};

export type IspSlaScorecard = {
  role: IspSlaRole;
  period: { from: string; to: string };
  isps: IspSlaRow[];
  policy: typeof ISP_APPROVED_INCENTIVE_COPY;
  otifef_legend: {
    on_time: string;
    in_full: string;
    error_free: string;
    composite: string;
  };
  summary: IspSlaSummary;
};

const OTIFEF_LEGEND = {
  on_time: 'Delivered on or before required delivery date',
  in_full: 'Quantity received ≥ 98% of ordered',
  error_free: 'On-catalogue / no compliance reject',
  composite: 'Average of available OTIFEF dimensions',
} as const;

type IspAgg = {
  isp_profile_id: number;
  deliveries: number;
  approved_ok: number;
  wrong_brand: number;
  spend: number;
  deliveryRows: DeliveryLike[];
  ratings: number[];
};

/**
 * Load OTIFEF / SLA metrics for the viewer’s scope over [from, to].
 * Optionally persists rolling OTIFEF on SP profiles (JSON API only).
 */
export async function loadIspSlaScorecard(
  supabase: SupabaseClient,
  companyId: number,
  opts: {
    from: string;
    to: string;
    /** When true, write rolling OTIFEF back onto nsnp_isp_profiles */
    persist?: boolean;
  }
): Promise<IspSlaScorecard> {
  const { from, to } = opts;
  const agency = await getAgencyRegistration(supabase, companyId);

  let role: IspSlaRole = 'school';
  let scopeKind: 'isp' | 'school' = 'school';
  let scopeIds: number[] = [];
  if (agency) {
    role = 'agency';
    scopeKind = 'isp';
    const { data: ispLinks } = await supabase
      .from('nsnp_isp_agency_links')
      .select('isp_profile_id')
      .eq('agency_profile_id', companyId)
      .in('status', ['active', 'approved'])
      .limit(500);
    scopeIds = [
      ...new Set(
        (ispLinks || [])
          .map((l) => Number(l.isp_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
  } else {
    const { data: ispRow } = await supabase
      .from('nsnp_isp_profiles')
      .select('profile_id')
      .eq('profile_id', companyId)
      .maybeSingle();
    if (ispRow) {
      role = 'isp';
      scopeKind = 'isp';
      scopeIds = [companyId];
    } else {
      const { school } = await getOrCreateSchoolProfile(supabase, companyId);
      if (school) {
        scopeKind = 'school';
        scopeIds = [Number(school.id)];
      }
    }
  }

  const emptySummary: IspSlaSummary = {
    deliveries: 0,
    otifef_pct: null,
    compliance_pct: null,
    isp_count: 0,
    preferred: 0,
    probation: 0,
  };

  if (!scopeIds.length) {
    return {
      role,
      period: { from, to },
      isps: [],
      policy: ISP_APPROVED_INCENTIVE_COPY,
      otifef_legend: { ...OTIFEF_LEGEND },
      summary: emptySummary,
    };
  }

  const byIsp = new Map<number, IspAgg>();
  const ensure = (id: number) => {
    if (!byIsp.has(id)) {
      byIsp.set(id, {
        isp_profile_id: id,
        deliveries: 0,
        approved_ok: 0,
        wrong_brand: 0,
        spend: 0,
        deliveryRows: [],
        ratings: [],
      });
    }
    return byIsp.get(id)!;
  };

  const col = scopeKind === 'isp' ? 'isp_profile_id' : 'school_profile_id';
  const chunkSize = scopeKind === 'isp' ? 40 : 80;
  for (let i = 0; i < scopeIds.length; i += chunkSize) {
    const chunk = scopeIds.slice(i, i + chunkSize);
    const [recRes, ordRes, delRes, rateRes] = await Promise.all([
      supabase
        .from('school_kitchen_receipts')
        .select('isp_profile_id, compliance_ok, received_at, lines, po_id')
        .in(col, chunk)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(4000),
      supabase
        .from('school_purchase_orders')
        .select(
          'id, isp_profile_id, total_amount, status, order_date, expected_date, compliance_ok, lines'
        )
        .in(col, chunk)
        .gte('order_date', from)
        .lte('order_date', to)
        .limit(4000),
      supabase
        .from('school_nsnp_deliveries')
        .select(
          'isp_profile_id, otif, expected_date, delivered_at, received_at, status, compliance_ok, pod_photo_url, lines, po_id'
        )
        .in(col, chunk)
        .gte('expected_date', from)
        .lte('expected_date', to)
        .limit(4000),
      supabase
        .from('school_isp_ratings')
        .select('isp_profile_id, overall_rating, created_at')
        .in(col, chunk)
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .limit(2000),
    ]);

    const poById = new Map<number, Record<string, unknown>>();
    for (const o of ordRes.data || []) {
      poById.set(Number(o.id), o as Record<string, unknown>);
      const id = Number(o.isp_profile_id);
      if (!Number.isFinite(id)) continue;
      if (role === 'isp' && id !== companyId) continue;
      ensure(id).spend += Number(o.total_amount || 0);
    }

    for (const r of recRes.data || []) {
      const id = Number(r.isp_profile_id);
      if (!Number.isFinite(id)) continue;
      if (role === 'isp' && id !== companyId) continue;
      const m = ensure(id);
      m.deliveries += 1;
      if (r.compliance_ok !== false) m.approved_ok += 1;
      else m.wrong_brand += 1;

      const po = r.po_id != null ? poById.get(Number(r.po_id)) : null;
      const orderedQty = Array.isArray(po?.lines)
        ? (po!.lines as Array<{ qty?: number }>).reduce(
            (n, l) => n + Number(l.qty || 0),
            0
          )
        : null;
      const deliveredQty = Array.isArray(r.lines)
        ? (r.lines as Array<{ qty?: number }>).reduce(
            (n, l) => n + Number(l.qty || 0),
            0
          )
        : null;

      m.deliveryRows.push({
        expected_date: po?.expected_date ? String(po.expected_date) : null,
        received_at: r.received_at ? String(r.received_at) : null,
        delivered_at: r.received_at ? String(r.received_at) : null,
        compliance_ok: r.compliance_ok !== false,
        status: 'received',
        ordered_qty: orderedQty,
        delivered_qty: deliveredQty,
      });
    }

    for (const d of delRes.data || []) {
      const id = Number(d.isp_profile_id);
      if (!Number.isFinite(id)) continue;
      if (role === 'isp' && id !== companyId) continue;
      const m = ensure(id);
      if (m.deliveryRows.length === 0 || m.deliveries === 0) {
        m.deliveries += 1;
        if (d.compliance_ok !== false) m.approved_ok += 1;
        else m.wrong_brand += 1;
      }
      m.deliveryRows.push({
        otif: d.otif === true || d.otif === false ? Boolean(d.otif) : null,
        expected_date: d.expected_date ? String(d.expected_date) : null,
        delivered_at: d.delivered_at ? String(d.delivered_at) : null,
        received_at: d.received_at ? String(d.received_at) : null,
        compliance_ok: d.compliance_ok !== false,
        status: d.status != null ? String(d.status) : null,
        has_pod: Boolean(d.pod_photo_url),
        pod_photo_url:
          d.pod_photo_url != null ? String(d.pod_photo_url) : null,
      });
    }

    for (const r of rateRes.data || []) {
      const id = Number(r.isp_profile_id);
      if (!Number.isFinite(id)) continue;
      if (role === 'isp' && id !== companyId) continue;
      ensure(id).ratings.push(Number(r.overall_rating) || 0);
    }
  }

  if (role === 'school' && scopeIds[0]) {
    const { data: links } = await supabase
      .from('school_isp_links')
      .select('isp_profile_id')
      .eq('school_profile_id', scopeIds[0])
      .eq('status', 'active')
      .limit(50);
    for (const l of links || []) {
      const id = Number(l.isp_profile_id);
      if (Number.isFinite(id)) ensure(id);
    }
  }

  const ispIds = [...byIsp.keys()];
  const names: Record<number, string> = {};
  if (ispIds.length) {
    const { data: isps } = await supabase
      .from('nsnp_isp_profiles')
      .select('profile_id, trading_name, delivery_otifef_pct, csd_number')
      .in('profile_id', ispIds);
    for (const i of isps || []) {
      names[Number(i.profile_id)] = String(
        i.trading_name || `SP ${i.profile_id}`
      );
    }
    const missing = ispIds.filter((id) => !names[id]);
    if (missing.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .in('id', missing);
      for (const p of profiles || []) {
        names[Number(p.id)] =
          p.trading_name || p.legal_name || `Company ${p.id}`;
      }
    }
  }

  const rows: IspSlaRow[] = [...byIsp.values()]
    .map((m) => {
      const otifef = computeOtifefFromDeliveries(m.deliveryRows);
      const podN = m.deliveryRows.filter(
        (d) => d.has_pod || d.pod_photo_url
      ).length;
      const incentive = computeIspIncentive({
        deliveries: Math.max(m.deliveries, otifef.deliveries),
        approved_ok: m.approved_ok,
        wrong_brand: m.wrong_brand,
        full_compliance_deliveries: m.approved_ok,
        deliveries_with_pod: podN,
        otif_ok: otifef.on_time_ok,
        otif_known: otifef.on_time_known,
      });
      const avgRating =
        m.ratings.length > 0
          ? Math.round(
              (m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length) * 10
            ) / 10
          : null;

      const otifef_pct =
        otifef.otifef_pct != null
          ? otifef.otifef_pct
          : incentive.compliance_pct;

      return {
        isp_profile_id: m.isp_profile_id,
        name: names[m.isp_profile_id] || `SP ${m.isp_profile_id}`,
        deliveries: m.deliveries,
        approved_ok: m.approved_ok,
        wrong_brand: m.wrong_brand,
        spend: Math.round(m.spend * 100) / 100,
        compliance_pct: incentive.compliance_pct,
        otifef_pct,
        otifef_label: otifefLabel(otifef_pct),
        on_time_pct: otifef.on_time_pct,
        in_full_pct: otifef.in_full_pct,
        error_free_pct: otifef.error_free_pct,
        incentive_score: incentive.score,
        badge: incentive.badge,
        incentive_note: incentive.incentive_note,
        pillars: incentive.pillars,
        status: incentive.status,
        preferred: incentive.status === 'preferred',
        avg_school_rating: avgRating,
        rating_count: m.ratings.length,
      };
    })
    .sort(
      (a, b) =>
        (b.otifef_pct ?? 0) - (a.otifef_pct ?? 0) ||
        b.incentive_score - a.incentive_score ||
        b.deliveries - a.deliveries
    );

  if (opts.persist) {
    for (const r of rows) {
      if (r.otifef_pct == null) continue;
      try {
        await supabase
          .from('nsnp_isp_profiles')
          .update({
            delivery_otifef_pct: r.otifef_pct,
            otif_on_time_pct: r.on_time_pct,
            otif_in_full_pct: r.in_full_pct,
            otif_error_free_pct: r.error_free_pct,
            avg_school_rating: r.avg_school_rating,
            otifef_updated_at: new Date().toISOString(),
          })
          .eq('profile_id', r.isp_profile_id);
      } catch {
        /* soft */
      }
    }
  }

  const totalDel = rows.reduce((n, r) => n + r.deliveries, 0);
  const totalOk = rows.reduce((n, r) => n + r.approved_ok, 0);
  const withOtif = rows.filter((r) => r.otifef_pct != null);
  const avgOtifef =
    withOtif.length > 0
      ? Math.round(
          (withOtif.reduce((n, r) => n + Number(r.otifef_pct), 0) /
            withOtif.length) *
            10
        ) / 10
      : totalDel > 0
        ? Math.round((totalOk / totalDel) * 1000) / 10
        : null;

  return {
    role,
    period: { from, to },
    isps: rows,
    policy: ISP_APPROVED_INCENTIVE_COPY,
    otifef_legend: { ...OTIFEF_LEGEND },
    summary: {
      deliveries: totalDel,
      otifef_pct: avgOtifef,
      compliance_pct:
        totalDel > 0
          ? Math.round((totalOk / totalDel) * 1000) / 10
          : null,
      isp_count: rows.length,
      preferred: rows.filter((r) => r.preferred).length,
      probation: rows.filter((r) => r.status === 'probation').length,
    },
  };
}

export function roleLabelForIspSla(role: IspSlaRole): string {
  if (role === 'agency') return 'DBE / PEU';
  if (role === 'isp') return 'Service provider';
  return 'School';
}
