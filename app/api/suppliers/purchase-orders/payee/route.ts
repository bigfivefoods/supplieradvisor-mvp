import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { disclosePayeeWallet } from '@/lib/business/company-wallet';
import { loadStoredCompanyWallet } from '@/lib/business/company-wallet-server';
import { logActivity } from '@/lib/customers/access';

/**
 * GET ?companyId=&poId= | supplierProfileId=
 * Full payout address only for the paying buyer, at on-chain PO payment.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const poId = Number(request.nextUrl.searchParams.get('poId'));
    const supplierProfileId = Number(
      request.nextUrl.searchParams.get('supplierProfileId')
    );
    const intent = request.nextUrl.searchParams.get('intent');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    if (intent !== 'onchain_payment') {
      return NextResponse.json(
        { error: 'Payee wallet is only disclosed for an on-chain payment' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let supplierId = Number.isFinite(supplierProfileId) ? supplierProfileId : 0;

    if (Number.isFinite(poId) && poId > 0) {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .select('id, buyer_profile_id, supplier_profile_id')
        .eq('id', poId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!po || Number(po.buyer_profile_id) !== companyId) {
        return NextResponse.json(
          { error: 'Only the paying buyer can load this payout wallet' },
          { status: 403 }
        );
      }
      supplierId = Number(po.supplier_profile_id);
    } else if (!(supplierId > 0)) {
      return NextResponse.json(
        { error: 'poId or supplierProfileId is required' },
        { status: 400 }
      );
    } else {
      const { data: connRows } = await supabase
        .from('business_connections')
        .select('id')
        .or(
          `and(requester_profile_id.eq.${companyId},requestee_profile_id.eq.${supplierId}),and(requester_profile_id.eq.${supplierId},requestee_profile_id.eq.${companyId})`
        )
        .eq('status', 'accepted')
        .limit(1);
      if (!connRows?.length) {
        return NextResponse.json(
          { error: 'Only a connected paying buyer can load this payout wallet' },
          { status: 403 }
        );
      }
    }

    if (!(supplierId > 0) || supplierId === companyId) {
      return NextResponse.json({ error: 'Supplier company not found' }, { status: 404 });
    }

    const stored = await loadStoredCompanyWallet(supplierId);
    const disclosed = disclosePayeeWallet({
      callerIsPayingBuyer: true,
      atOnchainPayment: true,
      stored,
    });
    await logActivity({
      profile_id: companyId,
      actor_user_id: gate.userId,
      action: 'company.wallet_disclosed_for_payment',
      entity_type: 'profiles',
      entity_id: String(supplierId),
      summary: 'Payout wallet disclosed to the paying buyer for an on-chain PO',
      metadata: { po_id: poId > 0 ? poId : null, supplier_profile_id: supplierId },
    });
    return NextResponse.json({ success: true, ...disclosed });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
