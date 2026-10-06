import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  parseStorageRef,
  resolveStoredDoc,
  signSensitiveRef,
  toStorageRef,
} from '@/lib/storage/private-docs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function companyOwnsStoredDoc(companyId: number, urlOrRef: string): Promise<boolean> {
  const ref = parseStorageRef(urlOrRef);
  if (ref?.path?.startsWith(`${companyId}/`)) return true;

  const supabase = getSupabaseServer();

  const profile = await supabase
    .from('profiles')
    .select(
      'registration_document_url,registration_certificate_url,vat_document_url,vat_certificate_url,bee_certificate_url,bank_confirmation_url,import_document_url,import_license_url,export_document_url,export_license_url,tax_document_url'
    )
    .eq('id', companyId)
    .maybeSingle();
  if (!profile.error && profile.data) {
    for (const value of Object.values(profile.data)) {
      if (value && String(value).trim() === urlOrRef) return true;
    }
  }

  const claim = await supabase
    .from('customer_payment_claims')
    .select('id')
    .eq('profile_id', companyId)
    .eq('proof_url', urlOrRef)
    .limit(1)
    .maybeSingle();
  if (!claim.error && claim.data?.id) return true;

  const contractor = await supabase
    .from('container_contractors')
    .select('id')
    .eq('profile_id', companyId)
    .eq('id_document_url', urlOrRef)
    .limit(1)
    .maybeSingle();
  if (!contractor.error && contractor.data?.id) return true;

  const productDirect = await supabase
    .from('products')
    .select('id')
    .eq('profile_id', companyId)
    .eq('specs_sheet_url', urlOrRef)
    .limit(1)
    .maybeSingle();
  if (!productDirect.error && productDirect.data?.id) return true;

  const productUpstream = await supabase
    .from('products')
    .select('id')
    .eq('profile_id', companyId)
    .eq('upstream_specs_sheet_url', urlOrRef)
    .limit(1)
    .maybeSingle();
  if (!productUpstream.error && productUpstream.data?.id) return true;

  const training = await supabase
    .from('training_records')
    .select('id')
    .eq('profile_id', companyId)
    .eq('certificate_url', urlOrRef)
    .limit(1)
    .maybeSingle();
  if (!training.error && training.data?.id) return true;

  const imports = await supabase
    .from('bank_import_batches')
    .select('metadata')
    .eq('profile_id', companyId)
    .order('id', { ascending: false })
    .limit(250);
  if (!imports.error && Array.isArray(imports.data)) {
    for (const row of imports.data) {
      const meta = row?.metadata;
      if (!meta || typeof meta !== 'object') continue;
      const asRecord = meta as Record<string, unknown>;
      if (String(asRecord.public_url || '').trim() === urlOrRef) return true;
      if (String(asRecord.storage_ref || '').trim() === urlOrRef) return true;
      if (String(asRecord.storage_path || '').trim() === urlOrRef) return true;
    }
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const ref = String(request.nextUrl.searchParams.get('ref') || '').trim();
    const asJson = request.nextUrl.searchParams.get('json') === '1';

    if (!Number.isFinite(companyId) || companyId <= 0 || !ref) {
      return NextResponse.json({ error: 'companyId and ref are required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    let resolved;
    try {
      resolved = resolveStoredDoc(ref);
    } catch {
      return NextResponse.json({ error: 'Unknown storage reference' }, { status: 404 });
    }

    const ownedByPrefix =
      resolved.candidates.some((c) => c.path.startsWith(`${companyId}/`)) ||
      parseStorageRef(ref)?.path.startsWith(`${companyId}/`) === true;

    const storedRef =
      parseStorageRef(ref) != null
        ? ref
        : toStorageRef({ bucket: resolved.candidates[0].bucket, path: resolved.candidates[0].path });

    let ownedByRow = ownedByPrefix;
    if (!ownedByRow) {
      ownedByRow = await companyOwnsStoredDoc(companyId, ref);
    }
    if (!ownedByRow && storedRef !== ref) {
      ownedByRow = await companyOwnsStoredDoc(companyId, storedRef);
    }

    if (!ownedByPrefix && !ownedByRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    for (const candidate of resolved.candidates) {
      try {
        const signed = await signSensitiveRef(
          toStorageRef({ bucket: candidate.bucket, path: candidate.path }),
          300
        );
        if (asJson) return NextResponse.json({ ok: true, url: signed }, { status: 200 });
        return NextResponse.redirect(signed, 302);
      } catch {
        // try next candidate
      }
    }

    return NextResponse.json({ error: 'Document not available' }, { status: 404 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to open document' },
      { status: 500 }
    );
  }
}
