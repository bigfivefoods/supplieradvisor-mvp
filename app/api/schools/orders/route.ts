import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import type { SchoolPoLine } from '@/lib/schools/types';

/**
 * School NSNP POs — every line must be on the approved product list.
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
    return NextResponse.json({ success: true, orders: data || [] });
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

    // Validate every product against approved list
    const productIds = rawLines
      .map((l: { approved_product_id?: number }) => Number(l.approved_product_id))
      .filter((n: number) => Number.isFinite(n));

    const { data: approved } = await supabase
      .from('nsnp_approved_products')
      .select('id, name, brand_name, uom, active')
      .in('id', productIds.length ? productIds : [0])
      .eq('active', true);

    const byId = new Map(
      (approved || []).map((p) => [Number(p.id), p])
    );

    const lines: SchoolPoLine[] = [];
    const rejected: string[] = [];
    for (const l of rawLines) {
      const pid = Number(l.approved_product_id);
      const prod = byId.get(pid);
      if (!prod) {
        rejected.push(
          `Product ${pid || l.product_name || '?'} is not on the NSNP approved list`
        );
        continue;
      }
      const qty = Number(l.qty || 0);
      if (!(qty > 0)) {
        rejected.push(`${prod.name}: qty must be > 0`);
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

    if (!lines.length) {
      return NextResponse.json(
        {
          error: 'No approved lines — strict NSNP list enforced',
          rejected,
        },
        { status: 400 }
      );
    }

    const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
    const poNumber =
      body.po_number ||
      `NSNP-PO-${school.id}-${Date.now().toString(36).toUpperCase()}`;

    const { data, error: iErr } = await supabase
      .from('school_purchase_orders')
      .insert({
        school_profile_id: school.id,
        profile_id: companyId,
        isp_profile_id: body.isp_profile_id
          ? Number(body.isp_profile_id)
          : null,
        po_number: poNumber,
        status: body.status || 'submitted',
        order_date: body.order_date || new Date().toISOString().slice(0, 10),
        expected_date: body.expected_date || null,
        total_amount: Math.round(total * 100) / 100,
        currency: body.currency || 'ZAR',
        lines,
        compliance_ok: rejected.length === 0,
        notes:
          rejected.length > 0
            ? `Partial: ${rejected.join('; ')}`
            : body.notes || null,
        created_by: gate.userId || null,
      })
      .select('*')
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      order: data,
      rejected,
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
