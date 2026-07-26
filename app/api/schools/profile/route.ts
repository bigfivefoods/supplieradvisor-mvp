import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error) return NextResponse.json({ error }, { status: 503 });
    return NextResponse.json({ success: true, school });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { school: existing, error } = await getOrCreateSchoolProfile(
      supabase,
      companyId,
      { schoolName: body.school_name }
    );
    if (error || !existing) {
      return NextResponse.json(
        { error: error || 'School not found' },
        { status: 503 }
      );
    }

    const allowed = [
      'emis_number',
      'school_name',
      'school_type',
      'phase',
      'province',
      'district',
      'circuit',
      'quintile',
      'urban_rural',
      'address',
      'city',
      'postal_code',
      'lat',
      'lng',
      'principal_name',
      'principal_email',
      'principal_phone',
      'nsnp_coordinator_name',
      'nsnp_coordinator_email',
      'has_on_site_kitchen',
      'feeding_breakfast',
      'feeding_lunch',
      'feeding_snack',
      'status',
      'photo_url',
      'photo_urls',
      'motto',
      'about',
      'privacy_mode',
    ] as const;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const { data, error: upErr } = await supabase
      .from('school_profiles')
      .update(patch)
      .eq('id', existing.id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // Keep company trading name in sync when school_name changes
    if (body.school_name) {
      try {
        await supabase
          .from('profiles')
          .update({
            trading_name: String(body.school_name),
            org_type: 'school',
          })
          .eq('id', companyId);
      } catch {
        /* soft */
      }
    }

    return NextResponse.json({ success: true, school: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
