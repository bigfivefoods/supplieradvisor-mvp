import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import type { SchoolPoLine } from '@/lib/schools/types';
import {
  filterApprovedProductIds,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';
import {
  buildSchoolPoPdf,
  schoolPoPdfFilename,
  type PoDocumentInput,
  type PoParty,
} from '@/lib/schools/po-document';
import {
  checkSchoolBrandPickGate,
  computeOtifRisk,
} from '@/lib/schools/brand-pick-gate';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * School NSNP POs — every line must be on the approved product list.
 * GET: schools see their POs; SPs see orders placed on them (wholesale supply inbox).
 *      ?id= · single PO detail with school + SP parties (JSON)
 *      ?id=&format=pdf|print · PDF document (inline open / print)
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
    const orderId = sp.get('id') ? Number(sp.get('id')) : null;
    const format = String(sp.get('format') || 'json').toLowerCase();

    // Single PO detail / PDF
    if (orderId && Number.isFinite(orderId)) {
      const detail = await loadPoDetail(supabase, companyId, orderId);
      if (!detail.ok) {
        return NextResponse.json(
          { error: detail.error },
          { status: detail.status }
        );
      }
      if (
        format === 'pdf' ||
        format === 'print' ||
        format === 'download'
      ) {
        const pdf = await buildSchoolPoPdf(detail.doc);
        const filename = schoolPoPdfFilename(detail.doc.po_number);
        const disposition =
          format === 'download' ? 'attachment' : 'inline';
        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${disposition}; filename="${filename}"`,
            'Cache-Control': 'no-store',
          },
        });
      }
      return NextResponse.json({
        success: true,
        role: detail.role,
        order: detail.order,
        school: detail.school,
        isp: detail.isp,
        agency_name: detail.agency_name,
      });
    }

    // SP inbox: POs where this company is the service provider
    const { data: ispRow } = await supabase
      .from('nsnp_isp_profiles')
      .select('id, profile_id, trading_name')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (ispRow) {
      const { data, error: oErr } = await supabase
        .from('school_purchase_orders')
        .select('*')
        .eq('isp_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (oErr) {
        return NextResponse.json({ error: oErr.message }, { status: 400 });
      }
      const schoolIds = [
        ...new Set(
          (data || [])
            .map((o) => Number(o.school_profile_id))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ];
      const poIds = (data || [])
        .map((o) => Number(o.id))
        .filter((n) => Number.isFinite(n));
      const nameMap = new Map<number, string>();
      if (schoolIds.length) {
        const { data: schools } = await supabase
          .from('school_profiles')
          .select('id, school_name, district, emis_number')
          .in('id', schoolIds);
        for (const s of schools || []) {
          nameMap.set(
            Number(s.id),
            String(s.school_name || `School ${s.id}`)
          );
        }
      }

      // SP profile OTIFEF + school ratings for fulfilled orders
      const { data: ispMetrics } = await supabase
        .from('nsnp_isp_profiles')
        .select(
          'profile_id, trading_name, delivery_otifef_pct, otif_on_time_pct, otif_in_full_pct, otif_error_free_pct, avg_school_rating'
        )
        .eq('profile_id', companyId)
        .maybeSingle();

      // GRNs linked to these POs
      const grnByPo = new Map<number, Record<string, unknown>>();
      if (poIds.length) {
        for (let i = 0; i < poIds.length; i += 100) {
          const chunk = poIds.slice(i, i + 100);
          const { data: grns } = await supabase
            .from('school_kitchen_receipts')
            .select('id, po_id, received_at, compliance_ok, lines')
            .in('po_id', chunk)
            .order('received_at', { ascending: false })
            .limit(500);
          for (const g of grns || []) {
            const pid = Number(g.po_id);
            if (!grnByPo.has(pid)) grnByPo.set(pid, g as Record<string, unknown>);
          }
        }
      }

      // Deliveries for OTIF flags
      const dnByPo = new Map<number, Record<string, unknown>>();
      if (poIds.length) {
        for (let i = 0; i < poIds.length; i += 100) {
          const chunk = poIds.slice(i, i + 100);
          const { data: dns } = await supabase
            .from('school_nsnp_deliveries')
            .select(
              'id, po_id, otif, expected_date, delivered_at, received_at, status, compliance_ok, pod_photo_url'
            )
            .in('po_id', chunk)
            .limit(500);
          for (const d of dns || []) {
            const pid = Number(d.po_id);
            if (Number.isFinite(pid) && !dnByPo.has(pid)) {
              dnByPo.set(pid, d as Record<string, unknown>);
            }
          }
        }
      }

      // School ratings of this SP (latest per school + any linked to PO)
      const ratingsBySchool = new Map<number, number>();
      const ratingsByPo = new Map<number, number>();
      if (schoolIds.length) {
        const { data: ratings } = await supabase
          .from('school_isp_ratings')
          .select(
            'school_profile_id, overall_rating, po_id, created_at'
          )
          .eq('isp_profile_id', companyId)
          .in('school_profile_id', schoolIds)
          .order('created_at', { ascending: false })
          .limit(500);
        for (const r of ratings || []) {
          const sid = Number(r.school_profile_id);
          const stars = Number(r.overall_rating);
          if (!Number.isFinite(stars)) continue;
          if (r.po_id != null && Number.isFinite(Number(r.po_id))) {
            const poid = Number(r.po_id);
            if (!ratingsByPo.has(poid)) ratingsByPo.set(poid, stars);
          }
          if (!ratingsBySchool.has(sid)) ratingsBySchool.set(sid, stars);
        }
      }

      const spOtifef =
        ispMetrics?.delivery_otifef_pct != null
          ? Number(ispMetrics.delivery_otifef_pct)
          : null;

      const orders = (data || []).map((o) => {
        const status = String(o.status || '').toLowerCase();
        const fulfilled = [
          'received',
          'partially_received',
          'closed',
          'complete',
        ].includes(status);
        const grn = grnByPo.get(Number(o.id));
        const dn = dnByPo.get(Number(o.id));
        const expected = o.expected_date
          ? String(o.expected_date).slice(0, 10)
          : dn?.expected_date
            ? String(dn.expected_date).slice(0, 10)
            : null;
        const receivedDay = grn?.received_at
          ? String(grn.received_at).slice(0, 10)
          : dn?.received_at
            ? String(dn.received_at).slice(0, 10)
            : dn?.delivered_at
              ? String(dn.delivered_at).slice(0, 10)
              : null;

        // Per-order OTIFEF dimensions
        let on_time: boolean | null = null;
        if (dn?.otif === true || dn?.otif === false) {
          on_time = Boolean(dn.otif);
        } else if (expected && receivedDay) {
          on_time = receivedDay <= expected;
        }

        const orderedQty = Array.isArray(o.lines)
          ? (o.lines as Array<{ qty?: number }>).reduce(
              (n, l) => n + Number(l.qty || 0),
              0
            )
          : 0;
        const receivedQty = grn && Array.isArray(grn.lines)
          ? (grn.lines as Array<{ qty?: number }>).reduce(
              (n, l) => n + Number(l.qty || 0),
              0
            )
          : null;
        let in_full: boolean | null = null;
        if (fulfilled && orderedQty > 0 && receivedQty != null) {
          in_full = receivedQty + 1e-6 >= orderedQty * 0.98;
        } else if (fulfilled) {
          in_full = status === 'received' || status === 'closed';
        }

        let error_free: boolean | null = null;
        if (grn && grn.compliance_ok !== undefined) {
          error_free = grn.compliance_ok !== false;
        } else if (dn && dn.compliance_ok !== undefined) {
          error_free = dn.compliance_ok !== false;
        } else if (o.compliance_ok !== undefined) {
          error_free = o.compliance_ok !== false;
        }

        const dims = [on_time, in_full, error_free].filter(
          (x) => x === true || x === false
        ) as boolean[];
        const order_otifef_pct =
          dims.length > 0
            ? Math.round(
                (dims.filter(Boolean).length / dims.length) * 1000
              ) / 10
            : null;

        const school_rating =
          ratingsByPo.get(Number(o.id)) ??
          ratingsBySchool.get(Number(o.school_profile_id)) ??
          null;

        const risk = computeOtifRisk({
          requiredDate: expected,
          fulfilled,
          cancelled: status === 'cancelled',
        });

        return {
          ...o,
          school_name:
            nameMap.get(Number(o.school_profile_id)) ||
            `School ${o.school_profile_id}`,
          isp_name: String(
            ispMetrics?.trading_name || ispRow.trading_name || 'Your SP'
          ),
          role: 'isp',
          fulfilled,
          action_label: fulfilled ? 'Fulfilled' : 'Fulfil',
          // Per-order OTIFEF
          order_otifef_pct,
          order_on_time: on_time,
          order_in_full: in_full,
          order_error_free: error_free,
          // Sprint A2 — required-date countdown + OTIF risk
          required_delivery_date: expected,
          days_to_required: risk.days_to_required,
          otif_risk: risk.otif_risk,
          otif_risk_label: risk.otif_risk_label,
          // Rolling SP scores (from profile / SLA)
          sp_otifef_pct: spOtifef,
          sp_on_time_pct:
            ispMetrics?.otif_on_time_pct != null
              ? Number(ispMetrics.otif_on_time_pct)
              : null,
          sp_in_full_pct:
            ispMetrics?.otif_in_full_pct != null
              ? Number(ispMetrics.otif_in_full_pct)
              : null,
          sp_error_free_pct:
            ispMetrics?.otif_error_free_pct != null
              ? Number(ispMetrics.otif_error_free_pct)
              : null,
          sp_avg_rating:
            ispMetrics?.avg_school_rating != null
              ? Number(ispMetrics.avg_school_rating)
              : null,
          school_rating,
          received_at: receivedDay,
          has_grn: Boolean(grn),
        };
      });
      return NextResponse.json({
        success: true,
        role: 'isp',
        orders,
        process:
          'Schools order approved catalogue products from you. Buy from wholesalers, create a DN, dispatch with POD, school receives into kitchen. Received orders show Fulfilled with OTIFEF & rating. Countdown shows days to required delivery for OTIF risk.',
        next_href: '/dashboard/schools/ops',
      });
    }

    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const { data, error: oErr } = await supabase
      .from('school_purchase_orders')
      .select('*')
      .eq('school_profile_id', school.id)
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (oErr) {
      return NextResponse.json({ error: oErr.message }, { status: 400 });
    }

    // Enrich SP display names for school list (profile_id or isp row id)
    const ispIds = [
      ...new Set(
        (data || [])
          .map((o) => Number(o.isp_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const ispNames = new Map<number, string>();
    if (ispIds.length) {
      const { data: isps } = await supabase
        .from('nsnp_isp_profiles')
        .select('id, profile_id, trading_name')
        .or(
          `profile_id.in.(${ispIds.join(',')}),id.in.(${ispIds.join(',')})`
        );
      for (const i of isps || []) {
        const name = String(i.trading_name || '').trim();
        if (name) {
          ispNames.set(Number(i.profile_id), name);
          ispNames.set(Number(i.id), name);
        }
      }
      const missing = ispIds.filter((id) => !ispNames.has(id));
      if (missing.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name')
          .in('id', missing);
        for (const p of profs || []) {
          ispNames.set(
            Number(p.id),
            String(p.trading_name || p.legal_name || '').trim() ||
              `SP ${p.id}`
          );
        }
      }
    }

    const orders = (data || []).map((o) => {
      const meta =
        o.metadata && typeof o.metadata === 'object'
          ? (o.metadata as Record<string, unknown>)
          : {};
      const fromMeta =
        meta.isp_name != null ? String(meta.isp_name).trim() : '';
      return {
        ...o,
        isp_name:
          fromMeta ||
          ispNames.get(Number(o.isp_profile_id)) ||
          (o.isp_profile_id ? `SP ${o.isp_profile_id}` : '—'),
        school_name: String(
          meta.school_name ||
            (school as { school_name?: string }).school_name ||
            'School'
        ),
      };
    });

    // Sprint A1 — brand-pick readiness for UI gate
    let brand_pick: Awaited<
      ReturnType<typeof checkSchoolBrandPickGate>
    > | null = null;
    try {
      const catalogue = await resolveCatalogueContext(supabase, companyId, {
        schoolProfileId: Number(school.id),
      });
      if (catalogue.agencyProfileId) {
        brand_pick = await checkSchoolBrandPickGate(supabase, {
          schoolProfileId: Number(school.id),
          agencyProfileId: catalogue.agencyProfileId,
        });
      }
    } catch {
      brand_pick = null;
    }

    return NextResponse.json({
      success: true,
      role: 'school',
      orders,
      brand_pick,
      process:
        'Order only DBE-approved products from your linked SP. The SP sources from wholesalers and delivers to your school with POD. Multi-brand recipe lines must be brand-picked first.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * Next PO number for a school on a given order date.
 * Format: YYYY-MM-DD-NSNP-PO-{n}  e.g. 2026-07-29-NSNP-PO-1
 * n = 1, 2, 3… for that school that day (counts how many POs raised).
 */
async function nextDailySchoolPoNumber(
  supabase: ReturnType<typeof getSupabaseServer>,
  schoolProfileId: number,
  orderDate: string
): Promise<string> {
  const day = orderDate.slice(0, 10);
  const prefix = `${day}-NSNP-PO-`;

  // Prefer rows for this school on this order_date
  const { data: byDate } = await supabase
    .from('school_purchase_orders')
    .select('po_number')
    .eq('school_profile_id', schoolProfileId)
    .eq('order_date', day)
    .limit(500);

  // Also scan any po_numbers already using the prefix (defensive)
  const { data: byPrefix } = await supabase
    .from('school_purchase_orders')
    .select('po_number')
    .eq('school_profile_id', schoolProfileId)
    .like('po_number', `${prefix}%`)
    .limit(500);

  let max = 0;
  const seen = new Set<string>();
  for (const row of [...(byDate || []), ...(byPrefix || [])]) {
    const n = String(row.po_number || '');
    if (seen.has(n)) continue;
    seen.add(n);
    if (n.startsWith(prefix)) {
      const seq = Number(n.slice(prefix.length));
      if (Number.isFinite(seq) && seq > max) max = seq;
    } else {
      // Old or other format on same day still counts as a PO that day
      max = Math.max(max, seen.size);
    }
  }

  // If we only saw non-prefix numbers, max may equal count; use max of seq and count
  const count = seen.size;
  const next = Math.max(max, count) + 1;
  return `${prefix}${next}`;
}

/** Resolve SP display name + CSD by company profile_id or nsnp_isp_profiles.id */
async function resolveIspParty(
  supabase: ReturnType<typeof getSupabaseServer>,
  ispKey: number | null | undefined
): Promise<PoParty> {
  if (!ispKey || !Number.isFinite(Number(ispKey))) {
    return { kind: 'isp', name: 'Service provider' };
  }
  const key = Number(ispKey);

  // 1) Lookup ISP registry by company profile_id
  let isp: Record<string, unknown> | null = null;
  {
    const { data } = await supabase
      .from('nsnp_isp_profiles')
      .select(
        'id, profile_id, trading_name, contact_name, contact_phone, contact_email, csd_number, province, district, metadata'
      )
      .eq('profile_id', key)
      .maybeSingle();
    isp = (data as Record<string, unknown>) || null;
  }
  // 2) Fallback: key might be nsnp_isp_profiles.id (serial), not profile_id
  if (!isp) {
    const { data } = await supabase
      .from('nsnp_isp_profiles')
      .select(
        'id, profile_id, trading_name, contact_name, contact_phone, contact_email, csd_number, province, district, metadata'
      )
      .eq('id', key)
      .maybeSingle();
    isp = (data as Record<string, unknown>) || null;
  }

  const companyId =
    isp?.profile_id != null && Number.isFinite(Number(isp.profile_id))
      ? Number(isp.profile_id)
      : key;

  // 3) Company profile (trading / legal name)
  const { data: ispProf } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, city, province, phone, email, address, contact_name, contact_phone'
    )
    .eq('id', companyId)
    .maybeSingle();

  const meta =
    isp?.metadata && typeof isp.metadata === 'object'
      ? (isp.metadata as Record<string, unknown>)
      : {};

  const pickName = (...vals: unknown[]) => {
    for (const v of vals) {
      const s = v != null ? String(v).trim() : '';
      if (
        s &&
        !/^service provider\s+\d+$/i.test(s) &&
        !/^sp\s+\d+$/i.test(s)
      ) {
        return s;
      }
    }
    return '';
  };

  const spName =
    pickName(
      isp?.trading_name,
      ispProf?.trading_name,
      ispProf?.legal_name,
      meta.trading_name,
      meta.name,
      meta.registered_name,
      meta.company_name,
      meta.supplier_name
    ) || `Service provider ${companyId}`;

  const csdRaw = pickName(
    isp?.csd_number,
    meta.csd_number,
    meta.csd,
    meta.CSD_NUMBER
  );

  return {
    kind: 'isp',
    name: spName,
    trading_name: pickName(isp?.trading_name, ispProf?.trading_name) || null,
    legal_name: pickName(ispProf?.legal_name) || null,
    csd_number: csdRaw || null,
    district: isp?.district != null ? String(isp.district) : null,
    province:
      isp?.province != null
        ? String(isp.province)
        : ispProf?.province != null
          ? String(ispProf.province)
          : null,
    address: ispProf?.address != null ? String(ispProf.address) : null,
    contact_name:
      pickName(isp?.contact_name, ispProf?.contact_name) || null,
    contact_phone:
      pickName(isp?.contact_phone, ispProf?.phone, ispProf?.contact_phone) ||
      null,
    contact_email:
      pickName(isp?.contact_email, ispProf?.email) || null,
  };
}

async function loadPoDetail(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  orderId: number
): Promise<
  | {
      ok: true;
      role: 'school' | 'isp';
      order: Record<string, unknown>;
      school: PoParty;
      isp: PoParty;
      agency_name: string | null;
      doc: PoDocumentInput;
    }
  | { ok: false; error: string; status: number }
> {
  const { data: order, error } = await supabase
    .from('school_purchase_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) {
    return { ok: false, error: error?.message || 'PO not found', status: 404 };
  }

  const schoolProfileId = Number(order.school_profile_id);
  const ispProfileId = Number(order.isp_profile_id);
  const ownerProfileId = Number(order.profile_id);

  // Access: school company, school profile company, or SP on the PO
  let role: 'school' | 'isp' = 'school';
  const isOwner = ownerProfileId === companyId;
  const isSp = ispProfileId === companyId;
  if (!isOwner && !isSp) {
    // School might match via school_profiles.profile_id
    const { data: sch } = await supabase
      .from('school_profiles')
      .select('id, profile_id')
      .eq('id', schoolProfileId)
      .maybeSingle();
    if (!sch || Number(sch.profile_id) !== companyId) {
      return { ok: false, error: 'Not authorised for this PO', status: 403 };
    }
  }
  if (isSp && !isOwner) role = 'isp';

  let schoolRow: Record<string, unknown> | null = null;
  {
    const full = await supabase
      .from('school_profiles')
      .select(
        'id, school_name, emis_number, natemis, district, province, address, city, principal_name, principal_phone, principal_email, nsnp_coordinator_name, nsnp_coordinator_email, profile_id, primary_agency_profile_id'
      )
      .eq('id', schoolProfileId)
      .maybeSingle();
    if (full.error && /natemis|column/i.test(full.error.message)) {
      const soft = await supabase
        .from('school_profiles')
        .select(
          'id, school_name, emis_number, district, province, address, city, principal_name, principal_phone, principal_email, nsnp_coordinator_name, nsnp_coordinator_email, profile_id, primary_agency_profile_id'
        )
        .eq('id', schoolProfileId)
        .maybeSingle();
      schoolRow = (soft.data as Record<string, unknown>) || null;
    } else {
      schoolRow = (full.data as Record<string, unknown>) || null;
    }
  }

  const schoolAddress = [schoolRow?.address, schoolRow?.city]
    .filter(Boolean)
    .map(String)
    .join(', ');

  const natemisVal =
    schoolRow?.natemis != null && String(schoolRow.natemis).trim()
      ? String(schoolRow.natemis).trim()
      : null;

  let schoolParty: PoParty = {
    kind: 'school',
    name: String(schoolRow?.school_name || `School ${schoolProfileId}`),
    emis_number:
      schoolRow?.emis_number != null ? String(schoolRow.emis_number) : null,
    natemis: natemisVal,
    district: schoolRow?.district != null ? String(schoolRow.district) : null,
    province: schoolRow?.province != null ? String(schoolRow.province) : null,
    address: schoolAddress || null,
    contact_name:
      schoolRow?.principal_name != null
        ? String(schoolRow.principal_name)
        : schoolRow?.nsnp_coordinator_name != null
          ? String(schoolRow.nsnp_coordinator_name)
          : null,
    contact_phone:
      schoolRow?.principal_phone != null
        ? String(schoolRow.principal_phone)
        : null,
    contact_email:
      schoolRow?.principal_email != null
        ? String(schoolRow.principal_email)
        : schoolRow?.nsnp_coordinator_email != null
          ? String(schoolRow.nsnp_coordinator_email)
          : null,
  };

  // Fallback school contacts from company profile
  if (schoolRow?.profile_id) {
    const { data: spProf } = await supabase
      .from('profiles')
      .select('trading_name, legal_name, city, province, phone, email, address')
      .eq('id', Number(schoolRow.profile_id))
      .maybeSingle();
    if (spProf) {
      if (!schoolParty.contact_phone && spProf.phone) {
        schoolParty.contact_phone = String(spProf.phone);
      }
      if (!schoolParty.contact_email && spProf.email) {
        schoolParty.contact_email = String(spProf.email);
      }
      if (!schoolParty.address && spProf.address) {
        schoolParty.address = String(spProf.address);
      }
      if (!schoolParty.province && spProf.province) {
        schoolParty.province = String(spProf.province);
      }
    }
  }

  // Snapshot from PO metadata (set at create) wins over live lookup
  const orderMeta =
    order.metadata && typeof order.metadata === 'object'
      ? (order.metadata as Record<string, unknown>)
      : {};

  let ispParty = await resolveIspParty(supabase, ispProfileId);
  if (
    orderMeta.isp_name &&
    String(orderMeta.isp_name).trim() &&
    (!ispParty.name ||
      /^service provider\s+\d+$/i.test(ispParty.name) ||
      /^sp\s+\d+$/i.test(ispParty.name))
  ) {
    ispParty = {
      ...ispParty,
      name: String(orderMeta.isp_name).trim(),
    };
  }
  if (
    orderMeta.isp_csd_number &&
    String(orderMeta.isp_csd_number).trim() &&
    !ispParty.csd_number
  ) {
    ispParty = {
      ...ispParty,
      csd_number: String(orderMeta.isp_csd_number).trim(),
    };
  }
  if (
    orderMeta.school_name &&
    String(orderMeta.school_name).trim()
  ) {
    // keep live school party but fill blank name from snapshot
    if (!schoolParty.name || schoolParty.name.startsWith('School ')) {
      schoolParty.name = String(orderMeta.school_name).trim();
    }
  }
  if (orderMeta.school_natemis && !schoolParty.natemis) {
    schoolParty.natemis = String(orderMeta.school_natemis).trim();
  }

  let agency_name: string | null = null;
  const agencyId = schoolRow?.primary_agency_profile_id
    ? Number(schoolRow.primary_agency_profile_id)
    : null;
  if (agencyId) {
    const { data: ag } = await supabase
      .from('nsnp_agency_profiles')
      .select('agency_name')
      .eq('profile_id', agencyId)
      .maybeSingle();
    if (ag?.agency_name) agency_name = String(ag.agency_name);
  }
  if (!agency_name) {
    const cat = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId,
    });
    agency_name = cat.agencyName;
  }

  const lines = Array.isArray(order.lines) ? order.lines : [];
  const doc: PoDocumentInput = {
    po_number: String(order.po_number || `PO-${order.id}`),
    status: String(order.status || 'submitted'),
    order_date: order.order_date != null ? String(order.order_date) : null,
    expected_date:
      order.expected_date != null ? String(order.expected_date) : null,
    currency: order.currency != null ? String(order.currency) : 'ZAR',
    total_amount:
      order.total_amount != null ? Number(order.total_amount) : null,
    notes: order.notes != null ? String(order.notes) : null,
    compliance_ok: order.compliance_ok !== false,
    lines: lines as PoDocumentInput['lines'],
    school: { ...schoolParty, kind: 'school' },
    isp: { ...ispParty, kind: 'isp' },
    agency_name,
  };

  return {
    ok: true,
    role,
    order: order as Record<string, unknown>,
    school: schoolParty,
    isp: ispParty,
    agency_name,
    doc,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (!rawLines.length) {
      return NextResponse.json({ error: 'At least one line required' }, { status: 400 });
    }

    // Validate every product against DBE/agency approved list for this school
    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: Number(school.id),
    });

    // Schools under a programme must be agency-linked to order
    if (!catalogue.agencyProfileId) {
      return NextResponse.json(
        {
          error:
            'Join and get approved by your DBE / PEU before ordering. Orders only use that department’s approved foods list.',
          catalogue: { source: catalogue.source },
        },
        { status: 400 }
      );
    }

    const productIds = rawLines
      .map((l: { approved_product_id?: number }) => Number(l.approved_product_id))
      .filter((n: number) => Number.isFinite(n) && n > 0);

    // Sprint A1 — brand-pick gate (order-scoped).
    // Products on this PO auto-apply as brand picks for matching multi-brand
    // recipe lines (kitchen suggested PO already chose the brand product).
    // Unrelated multi-brand lines no longer block the PO.
    const brandGate = await checkSchoolBrandPickGate(supabase, {
      schoolProfileId: Number(school.id),
      agencyProfileId: catalogue.agencyProfileId,
      orderedProductIds: productIds,
      companyProfileId: companyId,
      mode: 'order',
    });
    if (!brandGate.ok) {
      return NextResponse.json(
        {
          error: brandGate.message || 'Complete brand picks before ordering',
          brand_pick_gate: true,
          missing_brand_picks: brandGate.missing,
          multi_brand_lines: brandGate.multi_brand_lines,
          auto_applied: brandGate.auto_applied || 0,
          href: brandGate.href || '/dashboard/schools/recipes',
          hard_block: true,
        },
        { status: 400 }
      );
    }

    const byId = await filterApprovedProductIds(
      supabase,
      catalogue.agencyProfileId,
      productIds
    );

    const lines: SchoolPoLine[] = [];
    const rejected: string[] = [];
    const listLabel = catalogue.agencyName
      ? `${catalogue.agencyName} approved foods list`
      : 'department approved foods list';
    for (const l of rawLines) {
      const pid = Number(l.approved_product_id);
      const prod = byId.get(pid);
      if (!prod) {
        rejected.push(
          `Product ${pid || l.product_name || '?'} is not on the ${listLabel}`
        );
        continue;
      }
      const qty = Number(l.qty || 0);
      if (!(qty > 0)) {
        rejected.push(`${String(prod.name)}: qty must be > 0`);
        continue;
      }
      lines.push({
        approved_product_id: pid,
        product_name: String(prod.name),
        brand_name: String(prod.brand_name),
        category: String(prod.category || l.category || 'other'),
        qty,
        unit_price: Number(l.unit_price || 0),
        uom: String(l.uom || prod.uom || 'kg'),
        // School brand choice for SP fidelity scoring
        ordered_product_id: pid,
      });
    }

    // Strict hard-block: entire PO rejected if any line is off-catalogue
    if (rejected.length > 0 || lines.length !== rawLines.length) {
      return NextResponse.json(
        {
          error: `PO rejected — schools may only order products on the ${listLabel}. Off-catalogue lines are hard-blocked (no partial POs).`,
          rejected:
            rejected.length > 0
              ? rejected
              : ['One or more lines missing a valid approved_product_id'],
          catalogue: {
            agencyName: catalogue.agencyName,
            agencyProfileId: catalogue.agencyProfileId,
            source: catalogue.source,
          },
          incentive:
            'Approved-only orders raise prize score (~55% weight) and keep claim funding at 100%.',
          hard_block: true,
        },
        { status: 400 }
      );
    }

    if (!lines.length) {
      return NextResponse.json(
        {
          error: `No approved lines — schools may only buy from the ${listLabel}`,
          rejected,
          hard_block: true,
          catalogue: {
            agencyName: catalogue.agencyName,
            source: catalogue.source,
          },
        },
        { status: 400 }
      );
    }

    // SP is required — no orphan POs without a linked supplier
    const ispProfileId = Number(body.isp_profile_id);
    if (!Number.isFinite(ispProfileId) || ispProfileId <= 0) {
      return NextResponse.json(
        {
          error:
            'Select a service provider. Only SPs with an active link to your school can receive orders.',
          hard_block: true,
        },
        { status: 400 }
      );
    }

    const { ispMaySupplySchool } = await import('@/lib/schools/isp-access');
    const may = await ispMaySupplySchool(
      supabase,
      Number(school.id),
      ispProfileId
    );
    if (!may.ok) {
      return NextResponse.json(
        {
          error:
            may.reason ||
            'Orders only to SPs that joined and were approved by your department.',
          hard_block: true,
        },
        { status: 400 }
      );
    }
    const { data: schoolLink } = await supabase
      .from('school_isp_links')
      .select('id, status')
      .eq('school_profile_id', school.id)
      .eq('isp_profile_id', ispProfileId)
      .eq('status', 'active')
      .maybeSingle();
    if (!schoolLink) {
      return NextResponse.json(
        {
          error:
            'SP must claim this school and you must accept the claim (or link them under Schools → SPs) before ordering.',
          hard_block: true,
        },
        { status: 400 }
      );
    }

    const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

    // Required delivery date — OTIF on-time metric for SP
    const expectedRaw =
      body.expected_date != null ? String(body.expected_date).trim() : '';
    const expectedDate = /^\d{4}-\d{2}-\d{2}$/.test(expectedRaw)
      ? expectedRaw.slice(0, 10)
      : null;
    if (!expectedDate) {
      return NextResponse.json(
        {
          error:
            'Required delivery date is mandatory (YYYY-MM-DD). It drives SP On-Time scoring (OTIFEF) and appears on the SP orders report.',
          hard_block: true,
          field: 'expected_date',
        },
        { status: 400 }
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    if (expectedDate < today) {
      return NextResponse.json(
        {
          error:
            'Required delivery date cannot be in the past — choose today or a future date for on-time planning.',
          hard_block: true,
          field: 'expected_date',
        },
        { status: 400 }
      );
    }

    const orderDate =
      body.order_date != null && String(body.order_date).trim()
        ? String(body.order_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    // Date-first sequential PO: 2026-07-29-NSNP-PO-1, 2026-07-29-NSNP-PO-2, …
    // Sequence is per school per order date so daily volume is visible at a glance.
    const poNumber =
      body.po_number && String(body.po_number).trim()
        ? String(body.po_number).trim()
        : await nextDailySchoolPoNumber(
            supabase,
            Number(school.id),
            orderDate
          );

    // Snapshot school + SP names onto the PO so PDF always shows them
    const ispPartySnap = await resolveIspParty(supabase, ispProfileId);
    const schoolNameSnap = String(
      (school as { school_name?: string }).school_name || 'School'
    );
    const schoolNatemisSnap =
      (school as { natemis?: string | null }).natemis != null
        ? String((school as { natemis?: string }).natemis)
        : null;
    const poMeta = {
      isp_name: ispPartySnap.name,
      isp_csd_number: ispPartySnap.csd_number,
      school_name: schoolNameSnap,
      school_natemis: schoolNatemisSnap,
      school_emis:
        (school as { emis_number?: string | null }).emis_number != null
          ? String((school as { emis_number?: string }).emis_number)
          : null,
    };

    const { data, error: iErr } = await supabase
      .from('school_purchase_orders')
      .insert({
        school_profile_id: school.id,
        profile_id: companyId,
        isp_profile_id: ispProfileId,
        po_number: poNumber,
        status: body.status || 'submitted',
        order_date: orderDate,
        expected_date: expectedDate,
        total_amount: Math.round(total * 100) / 100,
        currency: body.currency || 'ZAR',
        lines,
        compliance_ok: true,
        notes: body.notes || null,
        metadata: poMeta,
        // created_by is bigint on some schemas — never store Privy DID
      })
      .select('*')
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }

    // Notify SP (in-app) — lands on fulfil queue
    try {
      const { logNsnpEvent } = await import('@/lib/schools/events');
      const schoolName = String(
        (school as { school_name?: string }).school_name || 'School'
      );
      await logNsnpEvent(supabase, {
        companyId,
        targetCompanyId: ispProfileId,
        schoolProfileId: Number(school.id),
        kind: 'po_submitted',
        title: `New school PO ${poNumber}`,
        body: `${schoolName} ordered ${lines.length} approved line(s). Source from wholesalers → Create DN → dispatch with POD.`,
        href: '/dashboard/schools/ops',
        metadata: {
          po_id: data.id,
          po_number: poNumber,
          supply_model: 'sp_wholesale_to_school',
        },
      });
    } catch {
      /* soft */
    }

    return NextResponse.json({
      success: true,
      order: data,
      catalogue: {
        agencyName: catalogue.agencyName,
        agencyProfileId: catalogue.agencyProfileId,
      },
      hard_block: true,
      incentive:
        'Approved-only PO logged — counts toward headmaster prize and full claim funding.',
      process:
        'SP receives this PO, buys from wholesalers, delivers to your school with POD; you receive into kitchen.',
      next: {
        label: 'SP fulfil queue',
        href: '/dashboard/schools/ops',
        hint: 'Service provider creates DN, buys stock, dispatches with photo POD',
        po_id: data.id,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.status) patch.status = body.status;
    if (body.notes !== undefined) patch.notes = body.notes;

    const { data, error } = await supabase
      .from('school_purchase_orders')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, order: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
