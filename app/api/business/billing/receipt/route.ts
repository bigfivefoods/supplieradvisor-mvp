import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { findLedgerEntry } from '@/lib/billing/billing-ledger';
import {
  buildBillingReceiptPdf,
  billingReceiptFilename,
} from '@/lib/billing/receipt-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/business/billing/receipt?companyId=&ref=PAYSTACK_REF|invoiceNumber
 * PDF receipt for a ledger payment.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const ref = String(sp.get('ref') || sp.get('invoice') || '').trim();
    if (!Number.isFinite(companyId) || !ref) {
      return NextResponse.json(
        { error: 'companyId and ref required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: prof } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, email, registration_number, metadata'
      )
      .eq('id', companyId)
      .maybeSingle();
    if (!prof) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const meta =
      prof.metadata && typeof prof.metadata === 'object'
        ? (prof.metadata as Record<string, unknown>)
        : {};
    let entry = findLedgerEntry(meta, ref);

    // Fallback: synthesize from last subscription ref
    if (!entry && prof) {
      const { data: subRow } = await supabase
        .from('profiles')
        .select(
          'subscription_paystack_ref, subscription_amount_zar, subscription_plan'
        )
        .eq('id', companyId)
        .maybeSingle();
      if (
        subRow?.subscription_paystack_ref &&
        String(subRow.subscription_paystack_ref) === ref
      ) {
        entry = {
          id: 'legacy',
          at: new Date().toISOString(),
          kind: 'core',
          ref,
          amountZar: Number(subRow.subscription_amount_zar || 0),
          amountCents: Math.round(Number(subRow.subscription_amount_zar || 0) * 100),
          currency: 'ZAR',
          invoiceNumber: `SA-${companyId}-LEGACY`,
          planCode: subRow.subscription_plan
            ? String(subRow.subscription_plan)
            : null,
        };
      }
    }

    if (!entry) {
      return NextResponse.json(
        { error: 'Receipt not found for this reference' },
        { status: 404 }
      );
    }

    const buf = await buildBillingReceiptPdf({
      companyName: String(
        prof.trading_name || prof.legal_name || `Company ${companyId}`
      ),
      companyId,
      billingEmail: prof.email ? String(prof.email) : null,
      registrationNumber: prof.registration_number
        ? String(prof.registration_number)
        : null,
      entry,
    });
    const filename = billingReceiptFilename(entry);
    const download = sp.get('download') === '1' || sp.get('download') === 'true';

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Content-Length': String(buf.byteLength),
        'Cache-Control': 'private, max-age=120',
      },
    });
  } catch (e: unknown) {
    console.error('[billing receipt]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Receipt failed' },
      { status: 500 }
    );
  }
}

/**
 * GET list via ?companyId=&list=1
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Use GET with companyId and ref' },
    { status: 405 }
  );
}

// Also support list on GET with list=1
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
