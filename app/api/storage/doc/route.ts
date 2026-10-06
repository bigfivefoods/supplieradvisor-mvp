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

async function companyOwnsStoredDoc(companyId: number, values: string[]): Promise<boolean> {
  const refs = Array.from(new Set(values.map((v) => String(v || '').trim()).filter(Boolean)));
  if (refs.length === 0) return false;
  for (const candidate of refs) {
    const parsed = parseStorageRef(candidate);
    if (parsed?.path?.startsWith(`${companyId}/`)) return true;
  }

  const supabase = getSupabaseServer();
  const [
    profile,
    claim,
    contractor,
    training,
    imports,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'registration_document_url,registration_certificate_url,vat_document_url,vat_certificate_url,bee_certificate_url,bank_confirmation_url,import_document_url,import_license_url,export_document_url,export_license_url,tax_document_url'
      )
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('customer_payment_claims')
      .select('id')
      .eq('profile_id', companyId)
      .in('proof_url', refs)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('container_contractors')
      .select('id')
      .eq('profile_id', companyId)
      .in('id_document_url', refs)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('training_records')
      .select('id')
      .eq('profile_id', companyId)
      .in('certificate_url', refs)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('bank_import_batches')
      .select('metadata')
      .eq('profile_id', companyId)
      .order('id', { ascending: false })
      .limit(250),
  ]);

  if (!profile.error && profile.data) {
    for (const value of Object.values(profile.data)) {
      if (value && refs.includes(String(value).trim())) return true;
    }
  }
  if (!claim.error && claim.data?.id) return true;
  if (!contractor.error && contractor.data?.id) return true;
  if (!training.error && training.data?.id) return true;
  if (!imports.error && Array.isArray(imports.data)) {
    for (const row of imports.data) {
      const meta = row?.metadata;
      if (!meta || typeof meta !== 'object') continue;
      const asRecord = meta as Record<string, unknown>;
      if (refs.includes(String(asRecord.public_url || '').trim())) return true;
      if (refs.includes(String(asRecord.storage_ref || '').trim())) return true;
      if (refs.includes(String(asRecord.storage_path || '').trim())) return true;
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

    const ownedByRow = ownedByPrefix
      ? true
      : await companyOwnsStoredDoc(companyId, storedRef === ref ? [ref] : [ref, storedRef]);

    if (!ownedByPrefix && !ownedByRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const supabase = getSupabaseServer();
    for (const candidate of resolved.candidates) {
      try {
        const signed =
          candidate.bucket === 'sensitive-documents'
            ? await signSensitiveRef(
                toStorageRef({ bucket: candidate.bucket, path: candidate.path }),
                300
              )
            : null;
        if (!signed) throw new Error('fallback');
        if (asJson) return NextResponse.json({ ok: true, url: signed }, { status: 200 });
        return NextResponse.redirect(signed, 302);
      } catch {
        try {
          const signedHit = await supabase.storage
            .from(candidate.bucket)
            .createSignedUrl(candidate.path, 300);
          const signed = signedHit.data?.signedUrl;
          if (signedHit.error || !signed) throw signedHit.error || new Error('sign failed');
          if (asJson) return NextResponse.json({ ok: true, url: signed }, { status: 200 });
          return NextResponse.redirect(signed, 302);
        } catch {
          // try next candidate
        }
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
