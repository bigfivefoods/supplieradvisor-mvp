import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { signedCreditDocumentUrl } from '@/lib/credit/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const p = await params;
    const id = Number(p.id);
    const docId = Number(p.docId);
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));

    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(id) || id <= 0 || !Number.isFinite(docId) || docId <= 0) {
      return NextResponse.json({ error: 'companyId, id, and docId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: doc } = await supabase
      .from('credit_application_documents')
      .select('id, storage_path')
      .eq('id', docId)
      .eq('application_id', id)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const signed = await signedCreditDocumentUrl(String(doc.storage_path || ''));
    if (!signed.ok) return NextResponse.json({ error: signed.error }, { status: 500 });

    return NextResponse.json({ success: true, url: signed.url, expiresIn: 300 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
