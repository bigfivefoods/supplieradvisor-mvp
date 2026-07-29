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
      const orders = (data || []).map((o) => ({
        ...o,
        school_name:
          nameMap.get(Number(o.school_profile_id)) ||
          `School ${o.school_profile_id}`,
        isp_name: String(ispRow.trading_name || 'Your SP'),
        role: 'isp',
      }));
      return NextResponse.json({
        success: true,
        role: 'isp',
        orders,
        process:
          'Schools order approved catalogue products from you. Buy from wholesalers, create a DN, dispatch with POD, school receives into kitchen.',
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

    // Enrich SP display names for school list
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
        .select('profile_id, trading_name')
        .in('profile_id', ispIds);
      for (const i of isps || []) {
        ispNames.set(
          Number(i.profile_id),
          String(i.trading_name || `SP ${i.profile_id}`)
        );
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
            String(p.trading_name || p.legal_name || `SP ${p.id}`)
          );
        }
      }
    }

    const orders = (data || []).map((o) => ({
      ...o,
      isp_name:
        ispNames.get(Number(o.isp_profile_id)) ||
        (o.isp_profile_id ? `SP ${o.isp_profile_id}` : '—'),
      school_name: String(
        (school as { school_name?: string }).school_name || 'School'
      ),
    }));

    return NextResponse.json({
      success: true,
      role: 'school',
      orders,
      process:
        'Order only DBE-approved products from your linked SP. The SP sources from wholesalers and delivers to your school with POD.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
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

  let ispParty: PoParty = {
    kind: 'isp',
    name: ispProfileId ? `Service provider ${ispProfileId}` : 'Service provider',
  };
  if (ispProfileId) {
    // Prefer full SP registry row (name + CSD)
    let isp: Record<string, unknown> | null = null;
    {
      const { data } = await supabase
        .from('nsnp_isp_profiles')
        .select(
          'profile_id, trading_name, contact_name, contact_phone, contact_email, csd_number, province, district, metadata'
        )
        .eq('profile_id', ispProfileId)
        .maybeSingle();
      isp = data as Record<string, unknown> | null;
    }
    const { data: ispProf } = await supabase
      .from('profiles')
      .select(
        'trading_name, legal_name, city, province, phone, email, address, contact_name, contact_phone'
      )
      .eq('id', ispProfileId)
      .maybeSingle();

    const meta =
      isp?.metadata && typeof isp.metadata === 'object'
        ? (isp.metadata as Record<string, unknown>)
        : {};
    const metaName = [
      meta.trading_name,
      meta.name,
      meta.registered_name,
      meta.company_name,
    ]
      .map((v) => (v != null ? String(v).trim() : ''))
      .find((v) => v.length > 0);

    const spName =
      [
        isp?.trading_name,
        ispProf?.trading_name,
        ispProf?.legal_name,
        metaName,
      ]
        .map((v) => (v != null ? String(v).trim() : ''))
        .find((v) => v.length > 0) || `Service provider ${ispProfileId}`;

    const csdRaw =
      isp?.csd_number != null
        ? String(isp.csd_number).trim()
        : meta.csd_number != null
          ? String(meta.csd_number).trim()
          : meta.csd != null
            ? String(meta.csd).trim()
            : '';

    ispParty = {
      kind: 'isp',
      name: spName,
      trading_name:
        isp?.trading_name != null
          ? String(isp.trading_name)
          : ispProf?.trading_name != null
            ? String(ispProf.trading_name)
            : null,
      legal_name:
        ispProf?.legal_name != null ? String(ispProf.legal_name) : null,
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
        isp?.contact_name != null
          ? String(isp.contact_name)
          : ispProf?.contact_name != null
            ? String(ispProf.contact_name)
            : null,
      contact_phone:
        isp?.contact_phone != null
          ? String(isp.contact_phone)
          : ispProf?.phone != null
            ? String(ispProf.phone)
            : ispProf?.contact_phone != null
              ? String(ispProf.contact_phone)
              : null,
      contact_email:
        isp?.contact_email != null
          ? String(isp.contact_email)
          : ispProf?.email != null
            ? String(ispProf.email)
            : null,
    };
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

    // Schools/clinics under a programme must be agency-linked to order
    if (!catalogue.agencyProfileId) {
      return NextResponse.json(
        {
          error:
            'Join and get approved by your DBE / PEU / DoH before ordering. Orders only use that department’s approved foods list.',
          catalogue: { source: catalogue.source },
        },
        { status: 400 }
      );
    }

    const productIds = rawLines
      .map((l: { approved_product_id?: number }) => Number(l.approved_product_id))
      .filter((n: number) => Number.isFinite(n));

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
        qty,
        unit_price: Number(l.unit_price || 0),
        uom: String(l.uom || prod.uom || 'kg'),
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
    const poNumber =
      body.po_number ||
      `NSNP-PO-${school.id}-${Date.now().toString(36).toUpperCase()}`;

    // Required delivery date — SP must see this on their orders report
    let expectedDate =
      body.expected_date != null && String(body.expected_date).trim()
        ? String(body.expected_date).slice(0, 10)
        : null;
    if (!expectedDate) {
      return NextResponse.json(
        {
          error:
            'Required delivery date is mandatory so your service provider can plan wholesale sourcing and delivery.',
          hard_block: true,
        },
        { status: 400 }
      );
    }

    const { data, error: iErr } = await supabase
      .from('school_purchase_orders')
      .insert({
        school_profile_id: school.id,
        profile_id: companyId,
        isp_profile_id: ispProfileId,
        po_number: poNumber,
        status: body.status || 'submitted',
        order_date: body.order_date || new Date().toISOString().slice(0, 10),
        expected_date: expectedDate,
        total_amount: Math.round(total * 100) / 100,
        currency: body.currency || 'ZAR',
        lines,
        compliance_ok: true,
        notes: body.notes || null,
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
