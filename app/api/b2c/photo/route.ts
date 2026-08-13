/**
 * POST /api/b2c/photo — upload a personal SA Member profile photo.
 * No company workspace required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { COMPANY_IMAGE_BUCKETS } from '@/lib/business/documentFields';
import {
  ensureB2cProfile,
  loadB2cProfile,
  saveB2cProfile,
} from '@/lib/b2c/profile-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeSeg(s: string) {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Please choose a JPG, PNG or WebP image' },
        { status: 400 }
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be under 8MB' }, { status: 400 });
    }

    const ext =
      file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
      'jpg';
    const filePath = `b2c/${safeSeg(userId)}/photo-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabaseServer();

    let publicUrl: string | null = null;
    const errors: string[] = [];
    for (const bucket of COMPANY_IMAGE_BUCKETS) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        publicUrl = data.publicUrl;
        break;
      }
      errors.push(`${bucket}: ${error.message}`);
    }

    if (!publicUrl) {
      return NextResponse.json(
        {
          error: 'Could not store photo',
          hint: 'Need a public image bucket (company-documents / certificates).',
          details: errors,
        },
        { status: 502 }
      );
    }

    const profile =
      (await loadB2cProfile(userId)) || (await ensureB2cProfile(userId));
    profile.photo_url = publicUrl;
    await saveB2cProfile(profile);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      profile,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
