import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';
import {
  buildCommercialDocumentPdf,
  commercialPdfFilename,
} from '@/lib/customers/commercial-doc-pdf';

/**
 * GET ?buyerCompanyId=&supplierProfileId=&type=invoice&id=&format=pdf
 * Buyer-safe PDF for invoices/quotes/orders shared with this company.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const buyerCompanyId = Number(sp.get('buyerCompanyId'));
    const supplierProfileId = Number(sp.get('supplierProfileId'));
    const id = Number(sp.get('id'));
    const type = String(sp.get('type') || 'invoice').toLowerCase() as
      | 'quote'
      | 'order'
      | 'invoice';
    const format = String(sp.get('format') || 'pdf').toLowerCase();

    if (
      !Number.isFinite(buyerCompanyId) ||
      !Number.isFinite(supplierProfileId) ||
      !Number.isFinite(id)
    ) {
      return NextResponse.json(
        { error: 'buyerCompanyId, supplierProfileId, id required' },
        { status: 400 }
      );
    }
    if (!['quote', 'order', 'invoice'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, buyerCompanyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    // Must be accepted connection (or still readable if suspended — shared docs stay)
    const { data: edge } = await supabase
      .from('business_connections')
      .select('id, status')
      .or(
        `and(requester_profile_id.eq.${buyerCompanyId},recipient_profile_id.eq.${supplierProfileId}),and(requester_profile_id.eq.${supplierProfileId},recipient_profile_id.eq.${buyerCompanyId})`
      )
      .limit(1)
      .maybeSingle();

    if (!edge?.id) {
      return NextResponse.json(
        { error: 'No connection with this supplier' },
        { status: 403 }
      );
    }

    // Doc must be shared and linked to a CRM customer owned by supplier that maps to buyer
    const table =
      type === 'quote'
        ? 'customer_quotes'
        : type === 'order'
          ? 'customer_orders'
          : 'customer_invoices';

    const { data: doc, error } = await supabase
      .from(table)
      .select('id, profile_id, customer_id, visibility, status')
      .eq('id', id)
      .eq('profile_id', supplierProfileId)
      .maybeSingle();

    if (error || !doc) {
      return NextResponse.json(
        { error: error?.message || 'Document not found' },
        { status: 404 }
      );
    }
    if (String(doc.visibility || '') !== 'shared') {
      return NextResponse.json(
        { error: 'Document is not shared with you' },
        { status: 403 }
      );
    }

    // Confirm customer is linked to this buyer when linked_profile_id exists
    const custId = Number(doc.customer_id);
    if (Number.isFinite(custId) && custId > 0) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id, linked_profile_id')
        .eq('id', custId)
        .eq('profile_id', supplierProfileId)
        .maybeSingle();
      const linked = Number(cust?.linked_profile_id);
      if (
        Number.isFinite(linked) &&
        linked > 0 &&
        linked !== buyerCompanyId
      ) {
        return NextResponse.json(
          { error: 'Document not linked to your company' },
          { status: 403 }
        );
      }
    }

    const loaded = await loadCommercialDocument({
      companyId: supplierProfileId,
      type,
      id,
    });
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error || 'Could not load document' },
        { status: loaded.status || 500 }
      );
    }

    if (format === 'pdf') {
      const pdf = await buildCommercialDocumentPdf(loaded.input);
      const filename = commercialPdfFilename(loaded.input);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    return new NextResponse(loaded.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
