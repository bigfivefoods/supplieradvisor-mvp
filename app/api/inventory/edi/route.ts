import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { buildEdiInventoryAdvice, parseBarcode, toGtin14 } from '@/lib/inventory/gs1';

/** GET list EDI messages */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('edi_messages')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      return NextResponse.json({ success: true, messages: [], warning: error.message });
    }
    return NextResponse.json({ success: true, messages: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST generate inventory advice (846) or parse inbound barcode/EDI snippet
 * Body: { companyId, action: 'generate_846' | 'parse', tradingPartner?, raw? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const action = body.action || 'generate_846';

    if (action === 'parse') {
      const parsed = parseBarcode(String(body.raw || ''));
      return NextResponse.json({ success: true, parsed });
    }

    // generate 846 from stock
    const [{ data: levels }, { data: products }] = await Promise.all([
      supabase.from('stock_levels').select('*').eq('profile_id', companyId),
      supabase.from('products').select('id, name, sku, gtin, gtin14, barcode, uom').eq('profile_id', companyId),
    ]);

    const pMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
    const lines = (levels || []).map((l) => {
      const p = pMap[l.product_id];
      return {
        sku: p?.sku,
        gtin: p?.gtin14 || p?.gtin || (p?.barcode ? toGtin14(p.barcode) : null),
        quantity: Number(l.qty_on_hand || 0),
        uom: p?.uom || 'EA',
        lot: l.lot_number,
        warehouse: l.warehouse_id ? String(l.warehouse_id) : 'DEFAULT',
      };
    });

    // Also container stock as virtual warehouse lines
    const { data: cInv } = await supabase
      .from('container_inventory')
      .select('*')
      .eq('profile_id', companyId);
    for (const c of cInv || []) {
      lines.push({
        sku: c.sku,
        gtin: null,
        quantity: Number(c.qty_on_hand || 0),
        uom: c.unit || 'EA',
        lot: null,
        warehouse: `CONTAINER-${c.container_id}`,
      });
    }

    const edi = buildEdiInventoryAdvice({
      companyId,
      tradingPartner: body.tradingPartner,
      lines,
    });

    const { data: msg, error } = await supabase
      .from('edi_messages')
      .insert({
        profile_id: companyId,
        direction: 'outbound',
        standard: edi.standard,
        transaction_set: edi.transactionSet,
        control_number: edi.controlNumber,
        trading_partner: edi.receiver,
        status: 'generated',
        payload: edi,
        raw_text: edi.edifactPreview,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        edi,
        warning: error.message,
        hint: 'Run pedigree/EDI migration to persist messages',
      });
    }

    return NextResponse.json({ success: true, edi, message: msg });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
