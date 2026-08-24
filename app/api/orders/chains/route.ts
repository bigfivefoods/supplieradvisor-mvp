import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { customerVisibleProductionStatus } from '@/lib/orders/order-links';
import { isMissingRelation } from '@/lib/business/company-data';

/**
 * GET /api/orders/chains?companyId=&privyUserId=&filter=linked|independent|all
 * Commercial + operational view of order chains for Operations tower.
 * BFF-only: includes cost (supplier paid) vs revenue (customer invoiced).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = Number(searchParams.get('companyId'));
    const privyUserId = searchParams.get('privyUserId');
    const filter = (searchParams.get('filter') || 'linked').toLowerCase();

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        return NextResponse.json({ error: mem.error }, { status: mem.status });
      }
    }

    const supabase = getSupabaseServer();

    // Active links owned by this company
    const { data: links, error: linkErr } = await supabase
      .from('order_links')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200);

    if (linkErr) {
      if (isMissingRelation(linkErr)) {
        return NextResponse.json({
          success: true,
          chains: [],
          independentPos: [],
          warning:
            'Order-link tables are not on this database yet. Run supabase/migrations/20260828_order_links_and_cascade.sql in the Supabase SQL editor, then refresh.',
        });
      }
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    const soIds = [
      ...new Set(
        (links || [])
          .filter((l) => l.source_order_type === 'sales_order')
          .map((l) => Number(l.source_order_id))
      ),
    ];
    const poIds = [
      ...new Set(
        (links || [])
          .filter((l) => l.target_order_type === 'purchase_order')
          .map((l) => Number(l.target_order_id))
      ),
    ];

    const soMap = new Map<number, Record<string, unknown>>();
    const poMap = new Map<number, Record<string, unknown>>();
    const invBySo = new Map<number, Record<string, unknown>[]>();
    const payByPo = new Map<number, number>();

    if (soIds.length) {
      const { data: sos } = await supabase
        .from('sales_orders')
        .select(
          'id, order_number, status, customer_name, total_amount, currency, production_status, confirmed_qty, promised_date, actual_completion_date, invoice_id, origin'
        )
        .eq('profile_id', companyId)
        .in('id', soIds);
      for (const s of sos || []) soMap.set(Number(s.id), s as Record<string, unknown>);

      const { data: invs } = await supabase
        .from('customer_invoices')
        .select(
          'id, order_id, source_order_id, invoice_number, status, total_amount, amount_paid, currency'
        )
        .eq('profile_id', companyId)
        .or(
          `order_id.in.(${soIds.join(',')}),source_order_id.in.(${soIds.join(',')})`
        )
        .limit(300);
      for (const inv of invs || []) {
        const sid = Number(inv.source_order_id || inv.order_id);
        if (!sid) continue;
        const list = invBySo.get(sid) || [];
        list.push(inv as Record<string, unknown>);
        invBySo.set(sid, list);
      }
    }

    if (poIds.length) {
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select(
          'id, status, supplier_name, total_amount, currency, production_status, confirmed_qty, promised_date, actual_completion_date, payment_status, amount_paid, supplier_profile_id'
        )
        .eq('buyer_profile_id', companyId)
        .in('id', poIds);
      for (const p of pos || []) poMap.set(Number(p.id), p as Record<string, unknown>);

      const { data: pays } = await supabase
        .from('supplier_payments')
        .select('po_id, amount, status')
        .eq('company_id', companyId)
        .in('po_id', poIds)
        .neq('status', 'void');
      for (const p of pays || []) {
        const id = Number(p.po_id);
        payByPo.set(id, (payByPo.get(id) || 0) + (Number(p.amount) || 0));
      }
    }

    const chains = (links || []).map((l) => {
      const so = soMap.get(Number(l.source_order_id));
      const po = poMap.get(Number(l.target_order_id));
      const invoices = invBySo.get(Number(l.source_order_id)) || [];
      const revenue = invoices.reduce(
        (s, inv) => s + (Number(inv.total_amount) || 0),
        0
      );
      const revenuePaid = invoices.reduce(
        (s, inv) => s + (Number(inv.amount_paid) || 0),
        0
      );
      const costPaid =
        payByPo.get(Number(l.target_order_id)) ??
        Number(po?.amount_paid || 0);
      const costCommitted = Number(po?.total_amount || 0);
      const margin = revenue - costCommitted;

      return {
        linkId: l.id,
        linkType: l.link_type,
        linkedAt: l.created_at,
        salesOrder: so
          ? {
              id: so.id,
              number: so.order_number,
              status: so.status,
              customerName: so.customer_name,
              total: so.total_amount,
              currency: so.currency,
              productionStatus: so.production_status,
              productionLabel: customerVisibleProductionStatus(
                so.production_status as string
              ),
              confirmedQty: so.confirmed_qty,
              origin: so.origin,
            }
          : { id: l.source_order_id },
        purchaseOrder: po
          ? {
              id: po.id,
              status: po.status,
              supplierName: po.supplier_name,
              total: po.total_amount,
              currency: po.currency,
              productionStatus: po.production_status,
              paymentStatus: po.payment_status,
              amountPaid: costPaid,
            }
          : { id: l.target_order_id },
        invoices: invoices.map((inv) => ({
          id: inv.id,
          number: inv.invoice_number,
          status: inv.status,
          total: inv.total_amount,
          amountPaid: inv.amount_paid,
        })),
        commercial: {
          revenue,
          revenuePaid,
          costCommitted,
          costPaid,
          margin,
          currency:
            (so?.currency as string) || (po?.currency as string) || 'ZAR',
        },
      };
    });

    // Optional independent POs (no link)
    let independentPos: unknown[] = [];
    if (filter === 'independent' || filter === 'all') {
      const { data: allPos } = await supabase
        .from('purchase_orders')
        .select(
          'id, status, supplier_name, total_amount, currency, production_status, payment_status, amount_paid, created_at'
        )
        .eq('buyer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);
      const linkedPoSet = new Set(poIds);
      independentPos = (allPos || [])
        .filter((p) => !linkedPoSet.has(Number(p.id)))
        .map((p) => ({
          ...p,
          kind: 'independent_po',
        }));
    }

    const result =
      filter === 'independent'
        ? { chains: [], independentPos }
        : filter === 'all'
          ? { chains, independentPos }
          : { chains, independentPos: [] };

    return NextResponse.json({
      success: true,
      filter,
      count: chains.length,
      ...result,
    });
  } catch (e: unknown) {
    console.error('[orders/chains GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
