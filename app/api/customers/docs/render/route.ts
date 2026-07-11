import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  extractBankFromProfile,
  renderCommercialDocumentHtml,
} from '@/lib/customers/invoice-document';
import { normalizeItems } from '@/lib/customers/documents';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

const TABLES = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
} as const;

const NUM_FIELD = {
  quote: 'quote_number',
  order: 'order_number',
  invoice: 'invoice_number',
} as const;

/**
 * GET ?companyId=&type=invoice&id=
 * Returns print-ready HTML (use browser Print → Save as PDF).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    const type = String(sp.get('type') || 'invoice').toLowerCase() as keyof typeof TABLES;
    if (!Number.isFinite(companyId) || !Number.isFinite(id) || !TABLES[type]) {
      return NextResponse.json({ error: 'companyId, type, id required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const [{ data: doc, error }, { data: profile }] = await Promise.all([
      supabase
        .from(TABLES[type])
        .select('*')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle(),
      supabase.from('profiles').select('*').eq('id', companyId).maybeSingle(),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const items = normalizeItems(doc.items);
    const html = renderCommercialDocumentHtml({
      kind: type,
      number: String(doc[NUM_FIELD[type]] || id),
      status: doc.status,
      currency: doc.currency,
      issuedAt: doc.created_at || doc.issued_at,
      dueDate: doc.due_date,
      validUntil: doc.valid_until,
      customerName: doc.customer_name,
      contactName: doc.contact_name,
      contactEmail: doc.contact_email,
      contactPhone: doc.contact_phone,
      notes: doc.notes,
      items,
      subtotal: Number(doc.subtotal || 0),
      taxRate: Number(doc.tax_rate || 0),
      taxAmount: Number(doc.tax_amount || 0),
      totalAmount: Number(doc.total_amount || 0),
      seller: extractBankFromProfile((profile || {}) as Record<string, unknown>),
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
