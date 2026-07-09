import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import { isCustomerPoEscrowEnabled } from '@/lib/procurement/types';

/**
 * POST /api/buyer/purchase-orders/[id]/onchain
 *
 * Trust-then-audit: client reports { onchain_tx, onchain_po_id, supplier_wallet? }
 * after buyer wallet writeContract(createPO|fundPO). Server checks membership +
 * PO ownership only — does NOT eth_getTransactionReceipt / parse POCreated logs,
 * and does NOT call POEscrowService (no server private key signing).
 *
 * A malicious client could spoof chain refs while CUSTOMER_PO_ESCROW_ENABLED is on.
 * Acceptable for MVP; later verify receipt + event before update.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    if (!isCustomerPoEscrowEnabled()) {
      return NextResponse.json(
        { error: 'Customer PO escrow is disabled', code: 'CUSTOMER_PO_ESCROW_DISABLED' },
        { status: 503 }
      );
    }

    const { id } = await ctx.params;
    const poId = Number(id);
    if (!Number.isFinite(poId) || poId <= 0) {
      return NextResponse.json({ error: 'Valid purchase order id is required' }, { status: 400 });
    }

    const body = await request.json();
    const buyerCompanyId = Number(body.buyerCompanyId);
    const privyUserId = body.privyUserId;
    const onchainTx = body.onchain_tx != null ? String(body.onchain_tx).trim() : '';
    const onchainPoIdRaw = body.onchain_po_id;
    const supplierWallet =
      body.supplier_wallet != null && String(body.supplier_wallet).trim()
        ? String(body.supplier_wallet).trim()
        : null;

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }
    if (!onchainTx) {
      return NextResponse.json({ error: 'onchain_tx is required' }, { status: 400 });
    }
    if (onchainPoIdRaw === undefined || onchainPoIdRaw === null || onchainPoIdRaw === '') {
      return NextResponse.json({ error: 'onchain_po_id is required' }, { status: 400 });
    }
    // Schema column is text; accept number or string
    const onchainPoId = String(onchainPoIdRaw).trim();
    if (!onchainPoId) {
      return NextResponse.json({ error: 'onchain_po_id is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: po, error: loadErr } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id, status, onchain_tx, onchain_po_id, supplier_wallet')
      .eq('id', poId)
      .maybeSingle();

    if (loadErr) {
      console.error('POST buyer PO onchain load:', loadErr);
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    if (Number(po.buyer_profile_id) !== buyerCompanyId) {
      return NextResponse.json(
        { error: 'You can only attach on-chain refs to purchase orders owned by your company' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      onchain_tx: onchainTx,
      onchain_po_id: onchainPoId,
      updated_at: now,
    };
    if (supplierWallet) {
      updates.supplier_wallet = supplierWallet;
    }

    let { data, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', poId)
      .eq('buyer_profile_id', buyerCompanyId)
      .select('*')
      .maybeSingle();

    // Retry without optional columns if schema cache is behind
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      console.warn('PO onchain update retry without supplier_wallet:', error.message);
      const minimal = {
        onchain_tx: onchainTx,
        onchain_po_id: onchainPoId,
        updated_at: now,
      };
      const retry = await supabase
        .from('purchase_orders')
        .update(minimal)
        .eq('id', poId)
        .eq('buyer_profile_id', buyerCompanyId)
        .select('*')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('POST buyer PO onchain update:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Purchase order not found or not owned' }, { status: 404 });
    }

    await logActivity({
      profile_id: buyerCompanyId,
      actor_user_id: member.userId,
      action: 'po.onchain.linked.by_customer',
      entity_type: 'purchase_order',
      entity_id: String(poId),
      summary: `Buyer linked on-chain escrow refs for PO #${poId}`,
      metadata: {
        onchain_tx: onchainTx,
        onchain_po_id: onchainPoId,
        supplier_wallet: supplierWallet,
        // trust-then-audit: no receipt verification
        trust_then_audit: true,
      },
    });

    return NextResponse.json({ success: true, purchaseOrder: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
