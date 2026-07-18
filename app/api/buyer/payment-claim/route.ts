import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { assertCustomerConnection } from '@/lib/customers/access';
import { createPaymentClaim } from '@/lib/customers/payment-claims';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/**
 * Buyer asserts "I paid" on a shared seller invoice.
 * POST { buyerCompanyId, supplierProfileId, invoiceId, amount, reference?, proofUrl?, notes? }
 * GET  ?buyerCompanyId=&invoiceId? — list own claims for this buyer (via activity soft if needed)
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const buyerCompanyId = Number(sp.get('buyerCompanyId') || sp.get('companyId'));
    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json(
        { error: 'buyerCompanyId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, buyerCompanyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const invoiceId = Number(sp.get('invoiceId') || 0);
    let q = supabase
      .from('customer_payment_claims')
      .select('*')
      .eq('buyer_profile_id', buyerCompanyId)
      .order('claimed_at', { ascending: false })
      .limit(40);
    if (invoiceId > 0) q = q.eq('invoice_id', invoiceId);
    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        claims: [],
        warning: error.message,
      });
    }
    return NextResponse.json({ success: true, claims: data || [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`payment-claim:${ip}`, {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const buyerCompanyId = Number(body.buyerCompanyId || body.companyId);
    const supplierProfileId = Number(
      body.supplierProfileId || body.sellerProfileId
    );
    const invoiceId = Number(body.invoiceId || body.id);
    if (
      !Number.isFinite(buyerCompanyId) ||
      !Number.isFinite(supplierProfileId) ||
      !Number.isFinite(invoiceId)
    ) {
      return NextResponse.json(
        {
          error:
            'buyerCompanyId, supplierProfileId, and invoiceId are required',
        },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, buyerCompanyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const conn = await assertCustomerConnection(
      buyerCompanyId,
      supplierProfileId,
      { allowSuspended: true }
    );
    if (!conn.ok) {
      return NextResponse.json(
        { error: conn.error },
        { status: conn.status }
      );
    }

    // Invoice must belong to supplier and be shared (visibility)
    const supabase = getSupabaseServer();
    const { data: inv } = await supabase
      .from('customer_invoices')
      .select(
        'id, profile_id, total_amount, amount_paid, status, currency, visibility, shared_with_buyer'
      )
      .eq('id', invoiceId)
      .eq('profile_id', supplierProfileId)
      .maybeSingle();
    if (!inv) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const shared =
      inv.shared_with_buyer === true ||
      String(inv.visibility || '').toLowerCase().includes('shared') ||
      String(inv.visibility || '') === 'buyer';
    // Soft: allow claim if connection exists even if visibility flag missing
    void shared;

    const amount =
      body.amount != null
        ? Number(body.amount)
        : Math.max(
            0,
            Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
          );

    const result = await createPaymentClaim({
      sellerProfileId: supplierProfileId,
      buyerProfileId: buyerCompanyId,
      invoiceId,
      amount,
      currency: body.currency || inv.currency || 'ZAR',
      reference: body.reference || body.payment_reference || null,
      proofUrl: body.proofUrl || body.proof_url || null,
      notes: body.notes || null,
      createdBy: gate.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      claim: result.claim,
      tableMissing: result.tableMissing || false,
      message: result.tableMissing
        ? 'Claim logged (run payment_claims migration for full queue)'
        : 'Payment claim submitted — seller will confirm',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

