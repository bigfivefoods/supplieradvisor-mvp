import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * SP report: linked schools + which have ordered, with required delivery dates.
 * GET ?companyId=&from=&to=&schoolProfileId=&status=&q=
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

    const supabase = getSupabaseServer();
    const { data: isp } = await supabase
      .from('nsnp_isp_profiles')
      .select('id, profile_id, trading_name, compliance_status')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (!isp) {
      return NextResponse.json(
        {
          error: 'Service provider profile required',
          success: false,
        },
        { status: 403 }
      );
    }

    const from = sp.get('from') || '';
    const to = sp.get('to') || '';
    const status = String(sp.get('status') || '').trim();
    const schoolFilter = sp.get('schoolProfileId')
      ? Number(sp.get('schoolProfileId'))
      : null;
    const q = String(sp.get('q') || '')
      .trim()
      .toLowerCase();

    // Linked schools (active claims)
    const { data: links } = await supabase
      .from('school_isp_links')
      .select('id, school_profile_id, status, created_at, preferred')
      .eq('isp_profile_id', companyId)
      .in('status', ['active', 'pending', 'accepted'])
      .limit(500);

    const linkedIds = [
      ...new Set(
        (links || [])
          .map((l) => Number(l.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];

    // All POs for this SP
    let poQ = supabase
      .from('school_purchase_orders')
      .select(
        'id, po_number, status, order_date, expected_date, total_amount, school_profile_id, lines, notes, currency, created_at, compliance_ok'
      )
      .eq('isp_profile_id', companyId)
      .order('expected_date', { ascending: true, nullsFirst: false })
      .limit(1000);

    if (from) poQ = poQ.gte('order_date', from);
    if (to) poQ = poQ.lte('order_date', to);
    if (status && status !== 'all') poQ = poQ.eq('status', status);
    if (schoolFilter && Number.isFinite(schoolFilter)) {
      poQ = poQ.eq('school_profile_id', schoolFilter);
    }

    const { data: pos, error: poErr } = await poQ;
    if (poErr) {
      return NextResponse.json({ error: poErr.message }, { status: 400 });
    }

    const schoolIds = [
      ...new Set([
        ...linkedIds,
        ...(pos || [])
          .map((o) => Number(o.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0),
      ]),
    ];

    type SchoolRow = {
      id: number;
      school_name?: string | null;
      emis_number?: string | null;
      district?: string | null;
      circuit?: string | null;
      province?: string | null;
      quintile?: number | null;
    };
    const schoolMap = new Map<number, SchoolRow>();
    if (schoolIds.length) {
      const { data: schools } = await supabase
        .from('school_profiles')
        .select(
          'id, school_name, emis_number, district, circuit, province, quintile'
        )
        .in('id', schoolIds);
      for (const s of (schools || []) as SchoolRow[]) {
        schoolMap.set(Number(s.id), s);
      }
    }

    const linkBySchool = new Map<
      number,
      { status: string; preferred?: boolean }
    >();
    for (const l of links || []) {
      linkBySchool.set(Number(l.school_profile_id), {
        status: String(l.status),
        preferred: Boolean((l as { preferred?: boolean }).preferred),
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    let orders = (pos || []).map((o) => {
      const sid = Number(o.school_profile_id);
      const sch = schoolMap.get(sid);
      const expected = o.expected_date
        ? String(o.expected_date).slice(0, 10)
        : null;
      const late =
        Boolean(expected) &&
        expected! < today &&
        !['received', 'cancelled', 'closed'].includes(String(o.status || ''));
      return {
        id: Number(o.id),
        po_number: o.po_number,
        status: o.status,
        order_date: o.order_date ? String(o.order_date).slice(0, 10) : null,
        required_delivery_date: expected,
        expected_date: expected,
        total_amount: o.total_amount,
        currency: o.currency || 'ZAR',
        notes: o.notes,
        line_count: Array.isArray(o.lines) ? o.lines.length : 0,
        lines: o.lines,
        school_profile_id: sid,
        school_name: sch?.school_name || `School ${sid}`,
        emis_number: sch?.emis_number || null,
        district: sch?.district || null,
        circuit: sch?.circuit || null,
        province: sch?.province || null,
        quintile: sch?.quintile ?? null,
        link_status: linkBySchool.get(sid)?.status || 'ordered_only',
        late,
        compliance_ok: o.compliance_ok !== false,
      };
    });

    if (q) {
      orders = orders.filter((o) => {
        const hay = [
          o.school_name,
          o.emis_number,
          o.district,
          o.po_number,
          o.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // Per-school rollup (linked schools + any that ordered)
    const orderedSchoolIds = new Set(orders.map((o) => o.school_profile_id));
    const schoolsReport = schoolIds
      .map((sid) => {
        const sch = schoolMap.get(sid);
        const link = linkBySchool.get(sid);
        const schoolOrders = orders.filter((o) => o.school_profile_id === sid);
        const openOrders = schoolOrders.filter(
          (o) =>
            !['received', 'cancelled', 'closed'].includes(String(o.status || ''))
        );
        const lateOrders = schoolOrders.filter((o) => o.late);
        const nextDue = openOrders
          .map((o) => o.required_delivery_date)
          .filter(Boolean)
          .sort()[0] as string | undefined;
        return {
          school_profile_id: sid,
          school_name: sch?.school_name || `School ${sid}`,
          emis_number: sch?.emis_number || null,
          district: sch?.district || null,
          circuit: sch?.circuit || null,
          province: sch?.province || null,
          quintile: sch?.quintile ?? null,
          link_status: link?.status || (orderedSchoolIds.has(sid) ? 'ordered_only' : 'none'),
          linked: Boolean(link && ['active', 'accepted'].includes(link.status)),
          preferred: Boolean(link?.preferred),
          has_ordered: schoolOrders.length > 0,
          order_count: schoolOrders.length,
          open_order_count: openOrders.length,
          late_order_count: lateOrders.length,
          total_ordered_value: schoolOrders.reduce(
            (n, o) => n + Number(o.total_amount || 0),
            0
          ),
          next_required_delivery_date: nextDue || null,
          last_order_date:
            schoolOrders
              .map((o) => o.order_date)
              .filter(Boolean)
              .sort()
              .reverse()[0] || null,
        };
      })
      .filter((s) => {
        if (schoolFilter && s.school_profile_id !== schoolFilter) return false;
        if (q) {
          const hay = [
            s.school_name,
            s.emis_number,
            s.district,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Late first, then open, then name
        if (b.late_order_count !== a.late_order_count)
          return b.late_order_count - a.late_order_count;
        if (b.open_order_count !== a.open_order_count)
          return b.open_order_count - a.open_order_count;
        return a.school_name.localeCompare(b.school_name);
      });

    const linkedActive = schoolsReport.filter((s) => s.linked).length;
    const orderedCount = schoolsReport.filter((s) => s.has_ordered).length;
    const neverOrdered = schoolsReport.filter(
      (s) => s.linked && !s.has_ordered
    ).length;

    const summary = {
      linked_schools: linkedActive,
      schools_that_ordered: orderedCount,
      linked_never_ordered: neverOrdered,
      total_orders: orders.length,
      open_orders: orders.filter(
        (o) =>
          !['received', 'cancelled', 'closed'].includes(String(o.status || ''))
      ).length,
      late_orders: orders.filter((o) => o.late).length,
      with_required_date: orders.filter((o) => o.required_delivery_date).length,
      total_value: Math.round(
        orders.reduce((n, o) => n + Number(o.total_amount || 0), 0) * 100
      ) / 100,
    };

    return NextResponse.json({
      success: true,
      role: 'isp',
      isp: {
        trading_name: isp.trading_name,
        compliance_status: isp.compliance_status,
      },
      summary,
      schools: schoolsReport,
      orders,
      process:
        'Linked schools place catalogue POs with a required delivery date. You source from wholesalers, fulfil DN + POD by that date.',
      filters: {
        from: from || null,
        to: to || null,
        status: status || 'all',
        schoolProfileId: schoolFilter,
        q: q || null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
