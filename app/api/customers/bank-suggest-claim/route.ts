import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { suggestBankMatchesForPayment } from '@/lib/banking/suggest-for-claim';

/** GET ?companyId=&claimId= — pre-confirm bank match preview for claim drawer */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const claimId = Number(sp.get('claimId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    if (!Number.isFinite(claimId) || claimId <= 0) {
      return NextResponse.json({ error: 'claimId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: claim, error } = await supabase
      .from('customer_payment_claims')
      .select(
        'id, amount, currency, reference, invoice_id, seller_profile_id, claimed_at'
      )
      .eq('id', claimId)
      .eq('seller_profile_id', companyId)
      .maybeSingle();

    if (error || !claim) {
      return NextResponse.json(
        { error: error?.message || 'Claim not found' },
        { status: 404 }
      );
    }

    let invoiceNumber: string | null = null;
    try {
      const { data: inv } = await supabase
        .from('customer_invoices')
        .select('invoice_number')
        .eq('id', claim.invoice_id)
        .eq('profile_id', companyId)
        .maybeSingle();
      invoiceNumber = inv?.invoice_number
        ? String(inv.invoice_number)
        : null;
    } catch {
      /* soft */
    }

    const suggestions = await suggestBankMatchesForPayment({
      profileId: companyId,
      amount: Number(claim.amount),
      reference: claim.reference ? String(claim.reference) : null,
      invoiceNumber,
      paidAt: claim.claimed_at ? String(claim.claimed_at) : null,
    });

    return NextResponse.json({
      success: true,
      suggestions,
      claimId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
