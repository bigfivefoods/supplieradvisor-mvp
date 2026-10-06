import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { creditDocumentPath, uploadCreditDocument, CREDIT_APPLICATION_BUCKET } from '@/lib/credit/storage';
import { sha256BufferHex } from '@/lib/credit/crypto';
import { sniffFileType, validateUploadFile } from '@/lib/credit/validate';

const ALLOWED_DOC_TYPES = new Set([
  'cipc_registration',
  'bank_confirmation',
  'vat_certificate',
  'id_copy',
  'financials',
  'surety_deed',
  'other',
]);

function badToken() {
  return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const token = String(form.get('token') || '').trim();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `portal-credit-upload:${token.slice(0, 24)}:${ip}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const guest = await resolveGuestViewer(token);
    if (!guest.ok) return badToken();
    const { portal, viewer } = guest.ctx;
    if (portal.kind !== 'customer' || !viewer.customer_id) return badToken();

    const applicationId = Number(form.get('applicationId'));
    const docType = String(form.get('docType') || '').trim();
    const principalIdRaw = String(form.get('principalId') || '').trim();
    const principalId = principalIdRaw ? Number(principalIdRaw) : null;
    const file = form.get('file');

    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
    }
    if (!ALLOWED_DOC_TYPES.has(docType)) {
      return NextResponse.json({ error: 'docType invalid' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: application } = await supabase
      .from('credit_applications')
      .select('id, status')
      .eq('id', applicationId)
      .eq('profile_id', portal.profile_id)
      .eq('customer_id', viewer.customer_id)
      .maybeSingle();
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    if (!['draft', 'more_info_needed'].includes(String(application.status || ''))) {
      return NextResponse.json({ error: 'Application is read-only in current status' }, { status: 409 });
    }

    const { count } = await supabase
      .from('credit_application_documents')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', portal.profile_id)
      .eq('application_id', applicationId);
    if ((count || 0) >= 25) {
      return NextResponse.json({ error: 'Application already has 25 documents' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const v = validateUploadFile({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      bytes: new Uint8Array(buf),
    });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    if (!sniffFileType(new Uint8Array(buf))) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    const path = creditDocumentPath({
      profileId: portal.profile_id,
      applicationId,
      docType,
      mimeType: v.mimeType,
    });
    const uploaded = await uploadCreditDocument({
      path,
      body: buf,
      contentType: v.mimeType,
    });
    if (!uploaded.ok) return NextResponse.json({ error: uploaded.error }, { status: 500 });

    const { data: inserted, error } = await supabase
      .from('credit_application_documents')
      .insert({
        application_id: applicationId,
        profile_id: portal.profile_id,
        principal_id: principalId,
        doc_type: docType,
        storage_bucket: CREDIT_APPLICATION_BUCKET,
        storage_path: path,
        file_name: String(file.name || '').slice(0, 180),
        mime_type: v.mimeType,
        size_bytes: file.size,
        sha256: sha256BufferHex(buf),
        uploaded_by_viewer_id: viewer.id,
        uploaded_by_user_id: null,
      })
      .select('id, principal_id, doc_type, file_name, mime_type, size_bytes, sha256, created_at')
      .single();

    if (error || !inserted) {
      return NextResponse.json({ error: error?.message || 'Could not store metadata' }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: inserted });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 500 });
  }
}
