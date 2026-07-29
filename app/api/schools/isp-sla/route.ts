import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
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

/**
 * SP SLA + OTIFEF scorecard (school or agency network).
 * OTIFEF = On-Time · In-Full · Error-Free from deliveries/POs/GRNs.
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

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);

    let schoolIds: number[] = [];
    let role: 'agency' | 'school' | 'isp' = 'school';
    if (agency) {
      role = 'agency';
      const { data: links } = await supabase
        .from('school_agency_links')
        .select('school_profile_id')
        .eq('agency_profile_id', companyId)
        .eq('status', 'active')
        .limit(2000);
      schoolIds = (links || [])
        .map((l) => Number(l.school_profile_id))
        .filter(Boolean);
    } else {
      const { data: ispRow } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (ispRow) {
        role = 'isp';
        // SP sees their own score across schools they supply
        const { data: sl } = await supabase
          .from('school_isp_links')
          .select('school_profile_id')
          .eq('isp_profile_id', companyId)
          .eq('status', 'active')
          .limit(500);
        schoolIds = (sl || [])
          .map((l) => Number(l.school_profile_id))
          .filter(Boolean);
      } else {
        const { school } = await getOrCreateSchoolProfile(supabase, companyId);
        if (school) schoolIds = [Number(school.id)];
      }
    }

    if (!schoolIds.length) {
      return NextResponse.json({
        success: true,
        role,
        period: { from, to },
        isps: [],
        summary: { deliveries: 0, otifef_pct: null },
      });
    }

    type IspAgg = {
      isp_profile_id: number;
      deliveries: number;
      approved_ok: number;
      wrong_brand: number;
      spend: number;
      deliveryRows: DeliveryLike[];
      ratings: number[];
    };
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

    for (let i = 0; i < schoolIds.length; i += 100) {
      const chunk = schoolIds.slice(i, i + 100);
      const [recRes, ordRes, delRes, rateRes] = await Promise.all([
        supabase
          .from('school_kitchen_receipts')
          .select('isp_profile_id, compliance_ok, received_at, lines, po_id')
          .in('school_profile_id', chunk)
          .gte('received_at', from)
          .lte('received_at', to)
          .limit(5000),
        supabase
          .from('school_purchase_orders')
          .select(
            'id, isp_profile_id, total_amount, status, order_date, expected_date, compliance_ok, lines'
          )
          .in('school_profile_id', chunk)
          .gte('order_date', from)
          .lte('order_date', to)
          .limit(5000),
        supabase
          .from('school_nsnp_deliveries')
          .select(
            'isp_profile_id, otif, expected_date, delivered_at, received_at, status, compliance_ok, pod_photo_url, lines, po_id'
          )
          .in('school_profile_id', chunk)
          .gte('expected_date', from)
          .lte('expected_date', to)
          .limit(5000),
        supabase
          .from('school_isp_ratings')
          .select('isp_profile_id, overall_rating, created_at')
          .in('school_profile_id', chunk)
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

        const po =
          r.po_id != null ? poById.get(Number(r.po_id)) : null;
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
          expected_date: po?.expected_date
            ? String(po.expected_date)
            : null,
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
        // Avoid double-count if we already have GRN for same period —
        // still use DN for OTIF if no GRN rows
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
          pod_photo_url: d.pod_photo_url != null ? String(d.pod_photo_url) : null,
        });
      }

      for (const r of rateRes.data || []) {
        const id = Number(r.isp_profile_id);
        if (!Number.isFinite(id)) continue;
        if (role === 'isp' && id !== companyId) continue;
        ensure(id).ratings.push(Number(r.overall_rating) || 0);
      }
    }

    // If school has linked SPs with no activity, still list them
    if (role === 'school' && schoolIds[0]) {
      const { data: links } = await supabase
        .from('school_isp_links')
        .select('isp_profile_id')
        .eq('school_profile_id', schoolIds[0])
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

    const rows = [...byIsp.values()]
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

        // Prefer composite OTIFEF when we have delivery data
        const otifef_pct =
          otifef.otifef_pct != null
            ? otifef.otifef_pct
            : incentive.compliance_pct;

        return {
          ...m,
          name: names[m.isp_profile_id] || `SP ${m.isp_profile_id}`,
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
          spend: Math.round(m.spend * 100) / 100,
          status: incentive.status,
          preferred: incentive.status === 'preferred',
          avg_school_rating: avgRating,
          rating_count: m.ratings.length,
          deliveryRows: undefined,
          ratings: undefined,
        };
      })
      .sort(
        (a, b) =>
          (b.otifef_pct ?? 0) - (a.otifef_pct ?? 0) ||
          b.incentive_score - a.incentive_score ||
          b.deliveries - a.deliveries
      );

    // Persist rolling OTIFEF on SP profiles (best-effort)
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

    return NextResponse.json({
      success: true,
      role,
      period: { from, to },
      isps: rows,
      policy: ISP_APPROVED_INCENTIVE_COPY,
      otifef_legend: {
        on_time: 'Delivered on or before required delivery date',
        in_full: 'Quantity received ≥ 98% of ordered',
        error_free: 'On-catalogue / no compliance reject',
        composite: 'Average of available OTIFEF dimensions',
      },
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
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
