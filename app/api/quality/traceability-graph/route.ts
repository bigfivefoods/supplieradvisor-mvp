import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { findLotHolds } from '@/lib/quality/holds';

/**
 * GET ?companyId=&lot= optional productId=
 * Build a pedigree graph: product → lots → movements → warehouses → inspections/HACCP
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const lotFilter = (sp.get('lot') || sp.get('lotNumber') || '').trim();
    const productId = sp.get('productId') ? Number(sp.get('productId')) : null;

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    let lotsQ = supabase
      .from('inventory_lots')
      .select('id, lot_number, product_id, quantity, qty_on_hand, status, expiry_date, warehouse_id, created_at')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (lotFilter) lotsQ = lotsQ.ilike('lot_number', `%${lotFilter}%`);
    if (productId && Number.isFinite(productId)) lotsQ = lotsQ.eq('product_id', productId);

    const { data: lots, error: lotsErr } = await lotsQ;
    if (lotsErr) {
      return NextResponse.json({
        success: true,
        nodes: [],
        edges: [],
        warning: lotsErr.message,
        hint: 'Run inventory pedigree migration if lots table missing',
      });
    }

    const lotRows = lots || [];
    const lotNumbers = lotRows.map((l) => String(l.lot_number || '')).filter(Boolean);
    const productIds = [
      ...new Set(lotRows.map((l) => Number(l.product_id)).filter((n) => Number.isFinite(n))),
    ];
    const whIds = [
      ...new Set(lotRows.map((l) => Number(l.warehouse_id)).filter((n) => Number.isFinite(n))),
    ];

    const [productsRes, whRes, movesRes, inspRes, haccpRes, holds] = await Promise.all([
      productIds.length
        ? supabase.from('products').select('id, name, sku, public_id').in('id', productIds)
        : Promise.resolve({ data: [] as { id: number; name: string; sku?: string; public_id?: string }[] }),
      whIds.length
        ? supabase.from('warehouses').select('id, name, code').in('id', whIds)
        : Promise.resolve({ data: [] as { id: number; name: string; code?: string }[] }),
      lotNumbers.length
        ? supabase
            .from('stock_movements')
            .select(
              'id, product_id, movement_type, quantity, lot_number, warehouse_id, from_warehouse_id, to_warehouse_id, reference_type, reference_id, created_at'
            )
            .eq('profile_id', companyId)
            .in('lot_number', lotNumbers)
            .order('created_at', { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      lotNumbers.length
        ? supabase
            .from('quality_inspections')
            .select('id, lot_number, status, inspection_type, defects_found, created_at')
            .eq('profile_id', companyId)
            .in('lot_number', lotNumbers)
            .limit(100)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      lotNumbers.length
        ? supabase
            .from('haccp_monitoring_logs')
            .select('id, lot_number, result, within_limit, measured_value, recorded_at')
            .eq('profile_id', companyId)
            .in('lot_number', lotNumbers)
            .limit(100)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      findLotHolds(companyId, lotNumbers),
    ]);

    type Node = {
      id: string;
      type: string;
      label: string;
      meta?: Record<string, unknown>;
    };
    type Edge = { id: string; from: string; to: string; label?: string };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const seen = new Set<string>();

    const addNode = (n: Node) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      nodes.push(n);
    };

    const pMap = new Map(
      (productsRes.data || []).map((p) => [Number(p.id), p] as const)
    );
    const wMap = new Map((whRes.data || []).map((w) => [Number(w.id), w] as const));
    const holdLots = new Set(holds.map((h) => h.lot_number.toLowerCase()));

    for (const p of productsRes.data || []) {
      addNode({
        id: `product:${p.id}`,
        type: 'product',
        label: p.name || p.sku || `Product ${p.id}`,
        meta: { sku: p.sku, public_id: p.public_id },
      });
    }

    for (const w of whRes.data || []) {
      addNode({
        id: `warehouse:${w.id}`,
        type: 'warehouse',
        label: w.name || w.code || `WH ${w.id}`,
      });
    }

    for (const lot of lotRows) {
      const ln = String(lot.lot_number || lot.id);
      const onHold = holdLots.has(ln.toLowerCase());
      const lotId = `lot:${ln}`;
      addNode({
        id: lotId,
        type: 'lot',
        label: ln,
        meta: {
          quantity: lot.quantity ?? lot.qty_on_hand,
          status: lot.status,
          expiry_date: lot.expiry_date,
          on_hold: onHold,
        },
      });
      if (lot.product_id) {
        edges.push({
          id: `e-p-l-${lot.id}`,
          from: `product:${lot.product_id}`,
          to: lotId,
          label: 'lot of',
        });
      }
      if (lot.warehouse_id) {
        edges.push({
          id: `e-l-w-${lot.id}`,
          from: lotId,
          to: `warehouse:${lot.warehouse_id}`,
          label: 'stored at',
        });
      }
    }

    for (const m of movesRes.data || []) {
      const mid = `move:${m.id}`;
      const ln = String(m.lot_number || '');
      addNode({
        id: mid,
        type: 'movement',
        label: `${m.movement_type} ${m.quantity ?? ''}`,
        meta: {
          movement_type: m.movement_type,
          quantity: m.quantity,
          created_at: m.created_at,
          reference: m.reference_type,
        },
      });
      if (ln) {
        edges.push({
          id: `e-l-m-${m.id}`,
          from: `lot:${ln}`,
          to: mid,
          label: 'moved',
        });
      }
      const toWh = m.to_warehouse_id || m.warehouse_id;
      if (toWh) {
        addNode({
          id: `warehouse:${toWh}`,
          type: 'warehouse',
          label: wMap.get(Number(toWh))?.name || `WH ${toWh}`,
        });
        edges.push({
          id: `e-m-w-${m.id}`,
          from: mid,
          to: `warehouse:${toWh}`,
          label: 'to',
        });
      }
    }

    for (const i of inspRes.data || []) {
      const iid = `insp:${i.id}`;
      addNode({
        id: iid,
        type: 'inspection',
        label: `QA ${i.status}`,
        meta: {
          status: i.status,
          type: i.inspection_type,
          defects: i.defects_found,
        },
      });
      if (i.lot_number) {
        edges.push({
          id: `e-l-i-${i.id}`,
          from: `lot:${i.lot_number}`,
          to: iid,
          label: 'inspected',
        });
      }
    }

    for (const h of haccpRes.data || []) {
      const hid = `haccp:${h.id}`;
      const breach = h.result === 'breach' || h.within_limit === false;
      addNode({
        id: hid,
        type: 'haccp',
        label: breach ? 'HACCP breach' : 'HACCP OK',
        meta: { result: h.result, measured_value: h.measured_value },
      });
      if (h.lot_number) {
        edges.push({
          id: `e-l-h-${h.id}`,
          from: `lot:${h.lot_number}`,
          to: hid,
          label: 'monitored',
        });
      }
    }

    return NextResponse.json({
      success: true,
      filter: { lot: lotFilter || null, productId },
      summary: {
        lots: lotRows.length,
        movements: (movesRes.data || []).length,
        inspections: (inspRes.data || []).length,
        haccp_logs: (haccpRes.data || []).length,
        holds: holds.length,
        nodes: nodes.length,
        edges: edges.length,
      },
      holds,
      nodes,
      edges,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
