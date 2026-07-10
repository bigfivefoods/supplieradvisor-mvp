import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { nextOrderNumber } from '@/lib/manufacturing/types';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = request.nextUrl.searchParams.get('id');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    if (id) {
      const { data: bom, error } = await supabase
        .from('manufacturing_boms')
        .select('*')
        .eq('profile_id', companyId)
        .eq('id', Number(id))
        .maybeSingle();
      if (error) {
        return NextResponse.json({ success: true, bom: null, lines: [], warning: error.message });
      }
      const { data: lines } = await supabase
        .from('manufacturing_bom_lines')
        .select('*')
        .eq('bom_id', Number(id))
        .order('line_no');
      return NextResponse.json({ success: true, bom, lines: lines || [] });
    }

    const { data, error } = await supabase
      .from('manufacturing_boms')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: true, boms: [], warning: error.message });
    }

    const boms = data || [];
    const productIds = [...new Set(boms.map((b) => b.product_id).filter(Boolean))];
    let productMap: Record<number, { name: string; sku: string | null }> = {};
    if (productIds.length) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);
      productMap = Object.fromEntries(
        (products || []).map((p) => [p.id, { name: p.name, sku: p.sku }])
      );
    }

    // line counts
    const bomIds = boms.map((b) => b.id);
    let lineCount: Record<number, number> = {};
    if (bomIds.length) {
      const { data: lines } = await supabase
        .from('manufacturing_bom_lines')
        .select('bom_id')
        .in('bom_id', bomIds);
      for (const l of lines || []) {
        lineCount[l.bom_id] = (lineCount[l.bom_id] || 0) + 1;
      }
    }

    const enriched = boms.map((b) => ({
      ...b,
      product_name: b.product_id ? productMap[b.product_id]?.name : null,
      product_sku: b.product_id ? productMap[b.product_id]?.sku : null,
      line_count: lineCount[b.id] || 0,
    }));

    return NextResponse.json({ success: true, boms: enriched });
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
    if (!Number.isFinite(companyId) || !body.name) {
      return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // auto number
    const { count } = await supabase
      .from('manufacturing_boms')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId);

    const bom_number = body.bom_number || nextOrderNumber('BOM', (count || 0) + 1);

    const payload = {
      profile_id: companyId,
      product_id: body.product_id ? Number(body.product_id) : null,
      bom_number,
      name: String(body.name).trim(),
      revision: body.revision || 'A',
      status: body.status || 'draft',
      yield_pct: Number(body.yield_pct ?? 100),
      scrap_pct: Number(body.scrap_pct ?? 0),
      lead_time_days: Number(body.lead_time_days ?? 1),
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('manufacturing_boms')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // optional lines
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length && data?.id) {
      const lineRows = lines.map(
        (
          l: {
            component_product_id: number;
            qty_per?: number;
            uom?: string;
            scrap_pct?: number;
            line_no?: number;
            operation_seq?: number;
          },
          i: number
        ) => ({
          bom_id: data.id,
          profile_id: companyId,
          component_product_id: Number(l.component_product_id),
          qty_per: Number(l.qty_per ?? 1),
          uom: l.uom || 'ea',
          scrap_pct: Number(l.scrap_pct ?? 0),
          line_no: l.line_no ?? (i + 1) * 10,
          operation_seq: l.operation_seq ?? 10,
        })
      );
      await supabase.from('manufacturing_bom_lines').insert(lineRows);
    }

    return NextResponse.json({ success: true, bom: data });
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
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'name',
      'revision',
      'status',
      'yield_pct',
      'scrap_pct',
      'lead_time_days',
      'notes',
      'product_id',
      'effective_from',
      'effective_to',
    ]) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const { data, error } = await supabase
      .from('manufacturing_boms')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // replace lines if provided
    if (Array.isArray(body.lines)) {
      await supabase.from('manufacturing_bom_lines').delete().eq('bom_id', id);
      if (body.lines.length) {
        const lineRows = body.lines.map(
          (
            l: {
              component_product_id: number;
              qty_per?: number;
              uom?: string;
              scrap_pct?: number;
              line_no?: number;
              operation_seq?: number;
              notes?: string;
            },
            i: number
          ) => ({
            bom_id: id,
            profile_id: companyId,
            component_product_id: Number(l.component_product_id),
            qty_per: Number(l.qty_per ?? 1),
            uom: l.uom || 'ea',
            scrap_pct: Number(l.scrap_pct ?? 0),
            line_no: l.line_no ?? (i + 1) * 10,
            operation_seq: l.operation_seq ?? 10,
            notes: l.notes || null,
          })
        );
        await supabase.from('manufacturing_bom_lines').insert(lineRows);
      }
    }

    return NextResponse.json({ success: true, bom: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('manufacturing_boms')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
