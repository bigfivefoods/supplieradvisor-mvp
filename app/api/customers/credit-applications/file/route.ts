import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { assertCustomersAccess } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { buildCreditApplicationPdf } from '@/lib/customers/credit-application-pdf';
import {
  creditDocumentBytes,
  getCreditApplication,
} from '@/lib/customers/credit-application-store';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export const runtime = 'nodejs';

function download(name: string, body: Buffer, contentType: string) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/** Seller download of the application PDF or one supporting document. */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const view = await assertCustomersAccess(gate.userId, companyId, 'view');
    if (!view.ok) {
      return NextResponse.json({ error: view.error }, { status: view.status });
    }
    const doc = request.nextUrl.searchParams.get('doc') || 'pdf';
    if (doc === 'pdf') {
      const application = await getCreditApplication({ companyId, id });
      if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      const supabase = getSupabaseServer();
      const { data } = await supabase
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle();
      const row = (data || {}) as { trading_name?: string | null; legal_name?: string | null };
      const pdf = await buildCreditApplicationPdf({
        sellerName: String(row.trading_name || row.legal_name || 'Seller'),
        application,
      });
      return download(`credit-application-${id}.pdf`, pdf, 'application/pdf');
    }
    const file = await creditDocumentBytes({
      companyId,
      applicationId: id,
      documentId: doc,
    });
    if (!file) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return download(file.name, file.body, file.contentType);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not open the file' },
      { status: 500 }
    );
  }
}
