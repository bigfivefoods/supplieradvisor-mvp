import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import { isSupplierPoEscrowEnabled } from '@/lib/procurement/types';

/**
 * POST /api/suppliers/purchase-orders/[id]/onchain
 *
 * Trust-then-audit link of client-signed POEscrowV2 txs (create | fund | release).
 * Mirrors buyer onchain path — no server private key, no receipt re-verify (MVP).
 */
type Ctx = { params: Promise<{ id: string }> };

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const POSITIVE_INT_RE = /^[1-9]\d*$/;

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    if (!isSupplierPoEscrowEnabled()) {
      return NextResponse.json(
        { error: 'Supplier PO escrow is disabled', code: 'SUPPLIER_PO_ESCROW_DISABLED' },
        { status: 503 }
      );
    }

    const { id } = await ctx.params;
    const poId = Number(id);
    if (!Number.isFinite(poId) || poId <= 0) {
      return NextResponse.json({ error: 'Valid purchase order id is required' }, { status: 400 });
    }

    const body = await request.json();
    const companyId = Number(body.companyId);
    const privyUserId = body.privyUserId;
    const kind =
      body.kind === 'fund' ? 'fund' : body.kind === 'release' ? 'release' : 'create';
    const onchainTx = body.onchain_tx != null ? String(body.onchain_tx).trim() : '';
    const onchainPoIdRaw = body.onchain_po_id;
    const supplierWalletRaw =
      body.supplier_wallet != null && String(body.supplier_wallet).trim()
        ? String(body.supplier_wallet).trim()
        : null;

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
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

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: po, error: loadErr } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id, status, onchain_tx, onchain_po_id, supplier_wallet, metadata')
      .eq('id', poId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    if (Number(po.buyer_profile_id) !== companyId) {
      return NextResponse.json(
        { error: 'You can only attach on-chain refs to your company POs' },
        { status: 403 }
      );
    }

    const existingPoId =
      po.onchain_po_id != null && String(po.onchain_po_id).trim() !== ''
        ? String(po.onchain_po_id).trim()
        : null;
    if (existingPoId && existingPoId !== onchainPoId) {
      return NextResponse.json(
        {
          error: `onchain_po_id is already set to ${existingPoId} and cannot be changed`,
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

    const hasCreateTx = po.onchain_tx != null && String(po.onchain_tx).trim() !== '';
    if (kind === 'create' || !hasCreateTx) {
      updates.onchain_tx = onchainTx;
    }
    if (supplierWalletRaw) updates.supplier_wallet = supplierWalletRaw;

    const statusNow = String(po.status ?? '').toLowerCase();
    if (kind === 'fund' && ['sent', 'accepted', 'draft'].includes(statusNow)) {
      updates.status = 'funded';
    }
    if (kind === 'release' && ['funded', 'accepted', 'paid'].includes(statusNow)) {
      updates.status = 'completed';
    }

    // Merge fund/release txs into metadata audit trail
    const prevMeta =
      po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
        ? { ...(po.metadata as Record<string, unknown>) }
        : {};
    const chainLog = Array.isArray(prevMeta.chain_events)
      ? [...(prevMeta.chain_events as unknown[])]
      : [];
    chainLog.push({ kind, tx: onchainTx, onchain_po_id: onchainPoId, at: now });
    prevMeta.chain_events = chainLog;
    prevMeta.use_escrow = true;
    if (kind === 'fund') prevMeta.fund_tx = onchainTx;
    if (kind === 'release') prevMeta.release_tx = onchainTx;
    updates.metadata = prevMeta;

    let { data, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', poId)
      .eq('buyer_profile_id', companyId)
      .select('*')
      .maybeSingle();

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const minimal: Record<string, unknown> = {
        onchain_po_id: onchainPoId,
        updated_at: now,
      };
      if (kind === 'create' || !hasCreateTx) minimal.onchain_tx = onchainTx;
      if (updates.status) minimal.status = updates.status;
      const retry = await supabase
        .from('purchase_orders')
        .update(minimal)
        .eq('id', poId)
        .eq('buyer_profile_id', companyId)
        .select('*')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Purchase order not found or not owned' }, { status: 404 });
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: `po.onchain.${kind}.srm`,
      entity_type: 'purchase_order',
      entity_id: String(poId),
      summary: `SRM on-chain ${kind} for PO #${poId} (tx ${onchainTx})`,
      metadata: {
        kind,
        onchain_tx: onchainTx,
        onchain_po_id: onchainPoId,
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
