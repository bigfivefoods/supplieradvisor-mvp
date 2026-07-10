import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';

/**
 * POST — record Paystack payment (R69) for company VerifyNow verification
 * and mark the company as pending / verified.
 *
 * Body: { companyId, privyUserId, paystackReference, email? }
 *
 * Payment amount is R69.00 (6900 cents) via Paystack Inline on the client.
 * Company identity checks are completed via https://www.verifynow.co.za/
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const paystackReference = String(body.paystackReference || body.reference || '').trim();
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!paystackReference) {
      return NextResponse.json({ error: 'paystackReference is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    // Prefer marking verified after successful payment; store payment ref for audit.
    const updates: Record<string, unknown> = {
      updated_at: now,
      verification_status: 'verified',
      is_verified: true,
      verified_at: now,
      verification_payment_ref: paystackReference,
    };

    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', companyId)
      .select('id, trading_name, verification_status, is_verified, verified_at, verification_payment_ref')
      .single();

    if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
      const fallback: Record<string, unknown> = {
        updated_at: now,
        verification_status: 'verified',
        is_verified: true,
        verified_at: now,
      };
      const retry = await supabase
        .from('profiles')
        .update(fallback)
        .eq('id', companyId)
        .select('id, trading_name, verification_status, is_verified, verified_at')
        .single();
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Store payment metadata when verification_payment_ref column missing
    try {
      const { data: row } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', companyId)
        .maybeSingle();
      const meta = (row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
        string,
        unknown
      >;
      await supabase
        .from('profiles')
        .update({
          metadata: {
            ...meta,
            verification: {
              provider: 'verifynow',
              paystack_reference: paystackReference,
              amount_zar: 69,
              paid_at: now,
              dashboard: 'https://dashboard.paystack.com/',
              verifynow: 'https://www.verifynow.co.za/',
            },
          },
        })
        .eq('id', companyId);
    } catch {
      /* metadata optional */
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.verification_paid',
      entity_type: 'profiles',
      entity_id: String(companyId),
      summary: 'Company verification paid (R69 Paystack + VerifyNow)',
      metadata: { paystackReference, amount_zar: 69 },
    });

    return NextResponse.json({
      success: true,
      profile: data,
      message:
        'Payment received. Company marked verified. Documents remain available for audit via VerifyNow.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
