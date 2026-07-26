import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';

/**
 * W3 ISP SLA scorecard for school or agency network.
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
    if (agency) {
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
      const { school } = await getOrCreateSchoolProfile(supabase, companyId);
      if (school) schoolIds = [Number(school.id)];
    }

    if (!schoolIds.length) {
      return NextResponse.json({
        success: true,
        period: { from, to },
        isps: [],
        summary: { deliveries: 0, otifef_pct: null },
      });
    }

    // Pull receipts + orders across schools
    type IspAgg = {
      isp_profile_id: number;
      deliveries: number;
      approved_ok: number;
      wrong_brand: number;
      spend: number;
    };
    const byIsp = new Map<number, IspAgg>();

    for (let i = 0; i < schoolIds.length; i += 100) {
      const chunk = schoolIds.slice(i, i + 100);
      const [recRes, ordRes] = await Promise.all([
        supabase
          .from('school_kitchen_receipts')
          .select('isp_profile_id, compliance_ok, received_at')
          .in('school_profile_id', chunk)
          .gte('received_at', from)
          .lte('received_at', to)
          .limit(5000),
        supabase
          .from('school_purchase_orders')
          .select('isp_profile_id, total_amount, status, order_date, compliance_ok')
          .in('school_profile_id', chunk)
          .gte('order_date', from)
          .lte('order_date', to)
          .limit(5000),
      ]);

      for (const r of recRes.data || []) {
        const id = Number(r.isp_profile_id);
        if (!Number.isFinite(id)) continue;
        if (!byIsp.has(id)) {
          byIsp.set(id, {
            isp_profile_id: id,
            deliveries: 0,
            approved_ok: 0,
            wrong_brand: 0,
            spend: 0,
          });
        }
        const m = byIsp.get(id)!;
        m.deliveries += 1;
        if (r.compliance_ok !== false) m.approved_ok += 1;
        else m.wrong_brand += 1;
      }
      for (const o of ordRes.data || []) {
        const id = Number(o.isp_profile_id);
        if (!Number.isFinite(id)) continue;
        if (!byIsp.has(id)) {
          byIsp.set(id, {
            isp_profile_id: id,
            deliveries: 0,
            approved_ok: 0,
            wrong_brand: 0,
            spend: 0,
          });
        }
        byIsp.get(id)!.spend += Number(o.total_amount || 0);
      }
    }

    const ispIds = [...byIsp.keys()];
    let names: Record<number, string> = {};
    if (ispIds.length) {
      const { data: isps } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id, trading_name')
        .in('profile_id', ispIds);
      for (const i of isps || []) {
        names[Number(i.profile_id)] =
          String(i.trading_name || `ISP ${i.profile_id}`);
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
        const compliance_pct =
          m.deliveries > 0
            ? Math.round((m.approved_ok / m.deliveries) * 1000) / 10
            : 100;
        // OTIFEF proxy: compliance + delivery volume (simplified)
        const otifef_pct = compliance_pct;
        return {
          ...m,
          name: names[m.isp_profile_id] || `ISP ${m.isp_profile_id}`,
          compliance_pct,
          otifef_pct,
          spend: Math.round(m.spend * 100) / 100,
          status:
            compliance_pct >= 95
              ? 'excellent'
              : compliance_pct >= 80
                ? 'ok'
                : compliance_pct >= 60
                  ? 'watch'
                  : 'probation',
        };
      })
      .sort((a, b) => b.deliveries - a.deliveries);

    const totalDel = rows.reduce((n, r) => n + r.deliveries, 0);
    const totalOk = rows.reduce((n, r) => n + r.approved_ok, 0);

    return NextResponse.json({
      success: true,
      period: { from, to },
      isps: rows,
      summary: {
        deliveries: totalDel,
        otifef_pct:
          totalDel > 0
            ? Math.round((totalOk / totalDel) * 1000) / 10
            : null,
        isp_count: rows.length,
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
