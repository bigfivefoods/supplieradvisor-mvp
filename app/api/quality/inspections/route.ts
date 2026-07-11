import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import {
  isInspectionStatus,
  isInspectionType,
} from '@/lib/quality/types';

/**
 * GET ?companyId=&privyUserId=&status=&lot=
 * POST create inspection
 * PATCH update status / notes
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        return NextResponse.json({ error: mem.error }, { status: mem.status });
      }
    }

    const supabase = getSupabaseServer();
    let q = supabase
      .from('quality_inspections')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);

    const status = sp.get('status');
    if (status && status !== 'all') q = q.eq('status', status);
    const lot = sp.get('lot');
    if (lot) q = q.ilike('lot_number', `%${lot}%`);

    const { data, error } = await q;
    if (error) {
      // Table may not exist yet
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          inspections: [],
          warning:
            'quality_inspections table missing — run migration 20260711_quality_inspections.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich product names
    const productIds = [
      ...new Set(
        (data || [])
          .map((r) => r.product_id)
          .filter((id): id is number => id != null && Number.isFinite(Number(id)))
      ),
    ];
    let nameMap: Record<number, string> = {};
    if (productIds.length) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);
      for (const p of products || []) {
        nameMap[p.id] = p.name || p.sku || `#${p.id}`;
      }
    }

    const inspections = (data || []).map((r) => ({
      ...r,
      product_name: r.product_id ? nameMap[r.product_id] || null : null,
    }));

    return NextResponse.json({ success: true, inspections });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const inspection_type = isInspectionType(body.inspection_type)
      ? body.inspection_type
      : 'incoming';
    const status = isInspectionStatus(body.status) ? body.status : 'open';

    const row = {
      profile_id: companyId,
      product_id:
        body.product_id != null && Number.isFinite(Number(body.product_id))
          ? Number(body.product_id)
          : null,
      lot_number: body.lot_number != null ? String(body.lot_number).trim() || null : null,
      warehouse_id:
        body.warehouse_id != null && Number.isFinite(Number(body.warehouse_id))
          ? Number(body.warehouse_id)
          : null,
      purchase_order_id:
        body.purchase_order_id != null && Number.isFinite(Number(body.purchase_order_id))
          ? Number(body.purchase_order_id)
          : null,
      inspection_type,
      status,
      result_grade: body.result_grade != null ? String(body.result_grade) : null,
      sample_size:
        body.sample_size != null && Number.isFinite(Number(body.sample_size))
          ? Number(body.sample_size)
          : null,
      defects_found:
        body.defects_found != null && Number.isFinite(Number(body.defects_found))
          ? Number(body.defects_found)
          : 0,
      inspector_name: body.inspector_name != null ? String(body.inspector_name) : null,
      notes: body.notes != null ? String(body.notes) : null,
      checklist: Array.isArray(body.checklist) ? body.checklist : [],
      inspected_at: body.inspected_at || (status !== 'open' ? new Date().toISOString() : null),
      released_at: status === 'passed' ? new Date().toISOString() : null,
      created_by: mem.userId,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('quality_inspections')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              'quality_inspections table missing — run supabase/migrations/20260711_quality_inspections.sql',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inspection: data }, { status: 201 });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status != null) {
      if (!isInspectionStatus(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
      if (body.status === 'passed') updates.released_at = new Date().toISOString();
      if (body.status !== 'open') {
        updates.inspected_at = body.inspected_at || new Date().toISOString();
      }
    }
    if (body.notes != null) updates.notes = String(body.notes);
    if (body.defects_found != null) updates.defects_found = Number(body.defects_found);
    if (body.inspector_name != null) updates.inspector_name = String(body.inspector_name);
    if (body.result_grade != null) updates.result_grade = String(body.result_grade);
    if (body.checklist != null) updates.checklist = body.checklist;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('quality_inspections')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, inspection: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
