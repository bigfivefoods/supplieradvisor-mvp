import { NextRequest, NextResponse } from 'next/server';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { buildCreditApplicationPdf } from '@/lib/customers/credit-application-pdf';
import {
  creditDocumentBytes,
  getCreditApplication,
  loadPortalCreditApplication,
} from '@/lib/customers/credit-application-store';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export const runtime = 'nodejs';

function fileResponse(name: string, body: Buffer, contentType: string) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/** The applicant downloads their own application PDF or a document they attached. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token || '').trim();
    const guest = await resolveGuestViewer(token);
    if (!guest.ok) {
      return NextResponse.json({ error: guest.error }, { status: guest.status });
    }
    const { portal, viewer } = guest.ctx;
    if (portal.kind !== 'customer' || !viewer.customer_id) {
      return NextResponse.json({ error: 'Customer portal only' }, { status: 403 });
    }
    const application = await loadPortalCreditApplication({
      companyId: portal.profile_id,
      customerId: viewer.customer_id,
    });
    if (!application) {
      return NextResponse.json({ error: 'No credit application yet' }, { status: 404 });
    }
    const doc = String(body.doc || 'pdf');
    if (doc === 'pdf') {
      const full = await getCreditApplication({
        companyId: portal.profile_id,
        id: application.id,
      });
      if (!full || full.customer_id !== viewer.customer_id) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      const seller = await sellerName(portal.profile_id);
      const pdf = await buildCreditApplicationPdf({ sellerName: seller, application: full });
      return fileResponse(`credit-application-${full.id}.pdf`, pdf, 'application/pdf');
    }
    const file = await creditDocumentBytes({
      companyId: portal.profile_id,
      applicationId: application.id,
      documentId: doc,
    });
    if (!file) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return fileResponse(file.name, file.body, file.contentType);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not open the file' },
      { status: 500 }
    );
  }
}

async function sellerName(companyId: number): Promise<string> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('trading_name, legal_name')
    .eq('id', companyId)
    .maybeSingle();
  const row = (data || {}) as { trading_name?: string | null; legal_name?: string | null };
  return String(row.trading_name || row.legal_name || 'Seller');
}
