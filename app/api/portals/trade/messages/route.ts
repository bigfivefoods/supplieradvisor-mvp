import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { ensureTradePortal } from '@/lib/portals/trade-portal';
import {
  messageMatchesPo,
  poBelongsToSupplierViewer,
  stripMissingMessageColumn,
  tradePortalMessageInsertRow,
} from '@/lib/portals/supplier-portal-party';
import { srmIdFromPo } from '@/lib/procurement/po-email';

/**
 * Host thread for a purchase order (same rows as the supplier portal card).
 * GET  ?companyId=&purchaseOrderId=
 * POST { companyId, purchaseOrderId, body }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const poId = Number(request.nextUrl.searchParams.get('purchaseOrderId'));
    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(poId) || poId <= 0) {
      return NextResponse.json(
        { error: 'companyId and purchaseOrderId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const supabase = getSupabaseServer();
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id, supplier_id, supplier_profile_id, metadata')
      .eq('id', poId)
      .eq('buyer_profile_id', companyId)
      .maybeSingle();
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    let q = await supabase
      .from('trade_portal_messages')
      .select('id, author, body, created_at, purchase_order_id, metadata, viewer_id')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (q.error) {
      q = await supabase
        .from('trade_portal_messages')
        .select('id, author, body, created_at, viewer_id')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: true })
        .limit(200);
    }
    const messages = (q.data || []).filter((row) =>
      messageMatchesPo(row as Record<string, unknown>, poId)
    );
    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: Number(m.id),
        author: m.author === 'host' ? 'host' : 'guest',
        body: String(m.body || ''),
        created_at: String(m.created_at || ''),
      })),
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
    const poId = Number(body.purchaseOrderId || body.purchase_order_id);
    const text = String(body.body || '').trim().slice(0, 4000);
    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(poId) || poId <= 0) {
      return NextResponse.json(
        { error: 'companyId and purchaseOrderId required' },
        { status: 400 }
      );
    }
    if (!text) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const supabase = getSupabaseServer();
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id, supplier_id, supplier_profile_id, metadata')
      .eq('id', poId)
      .eq('buyer_profile_id', companyId)
      .maybeSingle();
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    const ensured = await ensureTradePortal({
      companyId,
      kind: 'supplier',
    });
    if (!ensured.ok) {
      return NextResponse.json(
        { error: ensured.error },
        { status: ensured.missingTable ? 503 : 500 }
      );
    }
    const srmId = srmIdFromPo(po);
    let viewerId: number | null = null;
    if (srmId) {
      const { data: viewers } = await supabase
        .from('trade_portal_viewers')
        .select('id, supplier_id, status')
        .eq('portal_id', ensured.portal.id)
        .eq('supplier_id', srmId)
        .eq('status', 'active')
        .limit(1);
      viewerId = viewers?.[0]?.id != null ? Number(viewers[0].id) : null;
    }
    if (!viewerId) {
      const { data: anyV } = await supabase
        .from('trade_portal_viewers')
        .select('id, supplier_id, status')
        .eq('portal_id', ensured.portal.id)
        .eq('status', 'active')
        .limit(20);
      const match = (anyV || []).find((v) =>
        poBelongsToSupplierViewer(po, {
          supplierId: Number(v.supplier_id),
          linkedProfileId: null,
        })
      );
      viewerId = match?.id != null ? Number(match.id) : null;
    }
    if (!viewerId) {
      return NextResponse.json(
        {
          error:
            'Issue this supplier a portal link first so they can see the thread.',
        },
        { status: 400 }
      );
    }
    let row = tradePortalMessageInsertRow({
      portalId: ensured.portal.id,
      viewerId,
      profileId: companyId,
      author: 'host',
      body: text,
      purchaseOrderId: poId,
    });
    let ins = await supabase
      .from('trade_portal_messages')
      .insert(row)
      .select('id, author, body, created_at')
      .single();
    if (ins.error) {
      const miss =
        /column\s+(?:[\w]+\.)?(\w+)\s+does not exist/i.exec(ins.error.message)?.[1] ||
        /Could not find the ['"](\w+)['"] column/i.exec(ins.error.message)?.[1] ||
        null;
      if (miss) {
        row = stripMissingMessageColumn(row, miss);
        ins = await supabase
          .from('trade_portal_messages')
          .insert(row)
          .select('id, author, body, created_at')
          .single();
      }
    }
    if (ins.error && /metadata/i.test(ins.error.message || '')) {
      const { metadata: _m, ...rest } = row;
      ins = await supabase
        .from('trade_portal_messages')
        .insert(rest)
        .select('id, author, body, created_at')
        .single();
    }
    if (ins.error) {
      return NextResponse.json(
        {
          error: ins.error.message,
          hint: 'Paste RUN_THIS_FOR_BRIEF17.sql in the Supabase SQL editor.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, message: ins.data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
