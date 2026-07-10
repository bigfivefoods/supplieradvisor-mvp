import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { normalizeProfileRow } from '@/lib/business/types';
import {
  COMPANY_DOC_BUCKETS,
  COMPANY_IMAGE_BUCKETS,
  dbColumnsForAppField,
  APP_DOCUMENT_FIELDS,
} from '@/lib/business/documentFields';

/**
 * POST multipart — upload a company document via service-role Supabase storage,
 * then persist the URL onto all matching profiles columns (app + legacy names).
 *
 * Form fields:
 *  - file (required)
 *  - companyId (required)
 *  - privyUserId (required)
 *  - kind (optional, path segment e.g. registration | vat | bee | logo)
 *  - profileField (optional, app column e.g. registration_certificate_url)
 */
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
    const buckets = isLogo ? [...COMPANY_IMAGE_BUCKETS] : [...COMPANY_DOC_BUCKETS];
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
          hint:
            'Ensure Supabase Storage has a public bucket "company-documents" (or "certificates"). Service role must be able to upload.',
          details: errors,
          bucketsTried: buckets,
        },
        { status: 502 }
      );
    }

    // Persist URL onto all alias columns that exist on profiles
    let profile: Record<string, unknown> | null = null;
    let profileSynced = false;
    let columnsWritten: string[] = [];
    let profileError: string | undefined;

    if (profileField) {
      const cols = dbColumnsForAppField(profileField);
      // Also always include the app field name
      const wantCols = Array.from(new Set([profileField, ...cols]));
      const now = new Date().toISOString();

      // Discover which columns exist on this row
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json(
          {
            success: true,
            url: publicUrl,
            bucket: usedBucket,
            fileName: file.name,
            profileField,
            profileSynced: false,
            profileError: 'Company profile not found for URL write',
          },
          { status: 200 }
        );
      }

      const existingKeys = new Set(Object.keys(existing));
      const patch: Record<string, unknown> = { updated_at: now };
      for (const col of wantCols) {
        if (existingKeys.has(col)) {
          patch[col] = publicUrl;
          columnsWritten.push(col);
        }
      }

      // Fallback: if nothing matched, try well-known legacy names by kind
      if (columnsWritten.length === 0) {
        const kindFallbacks: Record<string, string[]> = {
          registration: ['registration_document_url', 'registration_certificate_url'],
          vat: ['vat_certificate_url', 'vat_document_url'],
          bee: ['bee_certificate_url'],
          bank: ['bank_confirmation_url'],
          logo: ['logo_url'],
          import: ['import_document_url', 'import_license_url'],
          export: ['export_document_url', 'export_license_url'],
        };
        const fb = kindFallbacks[kind] || kindFallbacks[kind.split('-')[0]] || [];
        for (const col of fb) {
          if (existingKeys.has(col)) {
            patch[col] = publicUrl;
            columnsWritten.push(col);
          }
        }
      }

      if (columnsWritten.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', companyId)
          .select('*')
          .maybeSingle();

        if (error) {
          console.warn('business/upload profile field update failed:', error.message);
          profileError = error.message;
        } else {
          profile = (data as Record<string, unknown>) || null;
          profileSynced = true;

          // Verify the written column actually has the URL
          const verified = columnsWritten.some(
            (c) => profile && String(profile[c] || '') === publicUrl
          );
          if (!verified) {
            profileSynced = false;
            profileError =
              'Update returned but document URL not present on profile — check RLS or column names';
          }
        }
      } else {
        profileError = `No matching document columns found for field "${profileField}". Existing keys sample: ${Array.from(existingKeys).filter((k) => /url|doc|cert|license|logo/i.test(k)).join(', ')}`;
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      bucket: usedBucket,
      fileName: file.name,
      profileField: profileField || null,
      profileSynced,
      columnsWritten,
      profileError,
      profile: profile ? normalizeProfileRow(profile) : null,
      appDocumentFields: APP_DOCUMENT_FIELDS,
    });
  } catch (e: unknown) {
    console.error('business/upload error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
