import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

/**
 * POST multipart — upload a company document via service-role Supabase storage,
 * then optionally persist the URL onto the profiles row.
 *
 * Form fields:
 *  - file (required)
 *  - companyId (required)
 *  - privyUserId (required)
 *  - kind (optional, path segment e.g. registration | vat | bee | logo)
 *  - profileField (optional, column to PATCH e.g. bee_certificate_url)
 */
const DOC_BUCKETS = ['company-documents', 'product-documents', 'contractor-documents'];
const IMAGE_BUCKETS = ['company-documents', 'product-images', 'container-photos'];

const PROFILE_URL_FIELDS = new Set([
  'logo_url',
  'registration_certificate_url',
  'vat_certificate_url',
  'bee_certificate_url',
  'bank_confirmation_url',
  'import_license_url',
  'export_license_url',
]);

function safeName(name?: string) {
  return (name || 'file').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const companyId = Number(form.get('companyId'));
    const privyUserId = String(form.get('privyUserId') || '');
    const kind = String(form.get('kind') || 'document').slice(0, 40);
    const profileField = String(form.get('profileField') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 15MB' }, { status: 400 });
    }

    const isLogo = kind === 'logo' || profileField === 'logo_url';
    if (isLogo && file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Logo must be an image (JPG, PNG, WebP)' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || (isLogo ? 'png' : 'pdf');
    const filePath = `${companyId}/profile/${safeName(kind)}-${Date.now()}.${ext}`;
    const buckets = isLogo ? IMAGE_BUCKETS : DOC_BUCKETS;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';

    const supabase = getSupabaseServer();
    let publicUrl: string | null = null;
    let usedBucket: string | null = null;
    const errors: string[] = [];

    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType,
      });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        publicUrl = data.publicUrl;
        usedBucket = bucket;
        break;
      }
      errors.push(`${bucket}: ${error.message}`);
    }

    if (!publicUrl) {
      return NextResponse.json(
        {
          error: 'Storage upload failed',
          hint: `Create a public bucket "${buckets[0]}" in Supabase Storage (or allow service-role uploads).`,
          details: errors,
        },
        { status: 502 }
      );
    }

    let profile: Record<string, unknown> | null = null;
    if (profileField && PROFILE_URL_FIELDS.has(profileField)) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('profiles')
        .update({ [profileField]: publicUrl, updated_at: now })
        .eq('id', companyId)
        .select('*')
        .maybeSingle();

      if (error) {
        // Column may not exist yet — still return URL so client can save via full PATCH
        console.warn('business/upload profile field update failed:', error.message);
        return NextResponse.json({
          success: true,
          url: publicUrl,
          bucket: usedBucket,
          fileName: file.name,
          profileField,
          profileSynced: false,
          profileError: error.message,
          hint: 'URL uploaded; click Save profile if the column is missing or failed to update.',
        });
      }
      profile = (data as Record<string, unknown>) || null;
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      bucket: usedBucket,
      fileName: file.name,
      profileField: profileField || null,
      profileSynced: Boolean(profileField && profile),
      profile,
    });
  } catch (e: unknown) {
    console.error('business/upload error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
