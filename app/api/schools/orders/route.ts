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

/**
 * School NSNP POs — every line must be on the approved product list.
 * GET: schools see their POs; SPs see orders placed on them (wholesale supply inbox).
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

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
    return NextResponse.json({
      success: true,
      role: 'school',
      orders: data || [],
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
