import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import { isCustomerPoEscrowEnabled } from '@/lib/procurement/types';

/**
 * POST /api/buyer/purchase-orders/[id]/onchain
 *
 * Trust-then-audit: client reports { onchain_tx, onchain_po_id, supplier_wallet?, kind? }
 * after buyer wallet writeContract(createPO|fundPO). Server checks membership +
 * PO ownership only — does NOT eth_getTransactionReceipt / parse PO_Created logs,
 * and does NOT call POEscrowService (no server private key signing).
 *
 * A malicious client could spoof chain refs while CUSTOMER_PO_ESCROW_ENABLED is on.
 * Acceptable for MVP; later verify receipt + event before update.
 *
 * kind:
 * - create (default): sets onchain_tx + onchain_po_id (create hash is the durable create ref)
 * - fund: does NOT overwrite an existing onchain_tx (preserves create hash); logs fund tx in activity;
 *   may set status → funded when current status is sent|accepted
 */
type Ctx = { params: Promise<{ id: string }> };

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const POSITIVE_INT_RE = /^[1-9]\d*$/;

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
    const kind = body.kind === 'fund' ? 'fund' : 'create';
    const onchainTx = body.onchain_tx != null ? String(body.onchain_tx).trim() : '';
    const onchainPoIdRaw = body.onchain_po_id;
    const supplierWalletRaw =
      body.supplier_wallet != null && String(body.supplier_wallet).trim()
        ? String(body.supplier_wallet).trim()
        : null;

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }
    if (!TX_HASH_RE.test(onchainTx)) {
      return NextResponse.json(
        { error: 'onchain_tx must be a 0x-prefixed 32-byte hex transaction hash' },
        { status: 400 }
      );
    }
    if (onchainPoIdRaw === undefined || onchainPoIdRaw === null || onchainPoIdRaw === '') {
      return NextResponse.json({ error: 'onchain_po_id is required' }, { status: 400 });
    }
    // Schema column is text; require positive integer string
    const onchainPoId = String(onchainPoIdRaw).trim();
    if (!POSITIVE_INT_RE.test(onchainPoId)) {
      return NextResponse.json(
        { error: 'onchain_po_id must be a positive integer' },
        { status: 400 }
      );
    }
    if (supplierWalletRaw && !ADDRESS_RE.test(supplierWalletRaw)) {
      return NextResponse.json(
        { error: 'supplier_wallet must be a 0x-prefixed 20-byte address' },
        { status: 400 }
      );
    }
    const supplierWallet = supplierWalletRaw;

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

    // Immutable after first link: refuse re-pointing to a different chain PO id
    const existingPoId =
      po.onchain_po_id != null && String(po.onchain_po_id).trim() !== ''
        ? String(po.onchain_po_id).trim()
        : null;
    if (existingPoId && existingPoId !== onchainPoId) {
      return NextResponse.json(
        {
          error: `onchain_po_id is already set to ${existingPoId} and cannot be changed to ${onchainPoId}`,
          code: 'ONCHAIN_PO_ID_IMMUTABLE',
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      onchain_po_id: onchainPoId,
      updated_at: now,
    };

    // Preserve createPO hash: fund path does not clobber existing onchain_tx
    const hasCreateTx = po.onchain_tx != null && String(po.onchain_tx).trim() !== '';
    if (kind === 'create' || !hasCreateTx) {
      updates.onchain_tx = onchainTx;
    }

    if (supplierWallet) {
      updates.supplier_wallet = supplierWallet;
    }

    // Intentional app/chain status sync for fund (seller may still PATCH further)
    const statusNow = String(po.status ?? '').toLowerCase();
    if (kind === 'fund' && (statusNow === 'sent' || statusNow === 'accepted')) {
      updates.status = 'funded';
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
      console.warn('PO onchain update retry without optional columns:', error.message);
      const minimal: Record<string, unknown> = {
        onchain_po_id: onchainPoId,
        updated_at: now,
      };
      if (kind === 'create' || !hasCreateTx) {
        minimal.onchain_tx = onchainTx;
      }
      if (updates.status) minimal.status = updates.status;
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
      action:
        kind === 'fund' ? 'po.onchain.funded.by_customer' : 'po.onchain.linked.by_customer',
      entity_type: 'purchase_order',
      entity_id: String(poId),
      summary:
        kind === 'fund'
          ? `Buyer funded on-chain escrow for PO #${poId} (fund tx ${onchainTx})`
          : `Buyer linked on-chain escrow refs for PO #${poId}`,
      metadata: {
        kind,
        onchain_tx: onchainTx,
        onchain_po_id: onchainPoId,
        supplier_wallet: supplierWallet,
        preserved_create_tx: kind === 'fund' && hasCreateTx,
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
