import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { anchorProductOnChain, getInventoryPassportAddress, getInventoryChain } from '@/lib/inventory/onchain';
import { hashProductIdentity } from '@/lib/inventory/hash';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST { productId, companyId? } — mint/anchor product identity on InventoryPassport (or simulated).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = Number(body.productId || body.id);
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyId = Number(body.companyId || product.profile_id);
    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!_gate.ok) return _gate.response;

    if (Number(product.profile_id) !== companyId) {
      return NextResponse.json({ error: 'Product not in your company' }, { status: 403 });
    }

    let identityHash = product.onchain_hash as string | null;
    if (!identityHash || !product.public_id) {
      identityHash = hashProductIdentity({
        profileId: product.profile_id,
        publicId: product.public_id || String(product.id),
        sku: product.sku,
        name: product.name,
        uom: product.uom,
      });
    }

    const result = await anchorProductOnChain({
      identityHashSha256: identityHash,
      publicId: product.public_id || String(product.id),
      companyWallet: body.companyWallet,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Production: refuse to mark as success if only simulated (unless explicitly allowed)
    const allowSim =
      process.env.ALLOW_SIMULATED_PASSPORT === '1' ||
      process.env.NODE_ENV !== 'production';
    if (result.mode === 'simulated' && !allowSim) {
      return NextResponse.json(
        {
          error:
            'On-chain passport not configured in production. Set INVENTORY_PASSPORT_ADDRESS + PRIVATE_KEY, or ALLOW_SIMULATED_PASSPORT=1 for demos.',
          code: 'PASSPORT_NOT_CONFIGURED',
          note: result.note,
        },
        { status: 503 }
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      onchain_hash: identityHash,
      // 'minted' = real chain tx; 'anchored' = simulated (no passport address / key)
      onchain_status: result.mode === 'onchain' ? 'minted' : 'anchored',
      onchain_tx_hash: result.txHash,
      onchain_token_id: result.tokenId || null,
      onchain_chain:
        getInventoryChain().id === 8453 ? 'base' : 'base-sepolia',
      onchain_anchored_at: now,
      updated_at: now,
    };

    const { data: updated, error: updErr } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select('*')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message, chain: result }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      product: updated,
      chain: {
        mode: result.mode,
        txHash: result.txHash,
        tokenId: result.tokenId,
        chainId: result.chainId,
        contract: getInventoryPassportAddress(),
        note: 'note' in result ? result.note : undefined,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Anchor failed' },
      { status: 500 }
    );
  }
}
