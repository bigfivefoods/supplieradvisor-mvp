/**
 * GET/POST /api/schools/field-tokens?companyId=
 * Issue serve-day + PEU field PWA tokens for the school company.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { ensureFieldTokensInMeta } from '@/lib/schools/ensure-packaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    // Prefer school company; agencies can still issue when linked via school profile of self
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (!school) {
      return NextResponse.json(
        { error: 'School profile required for field tokens' },
        { status: 400 }
      );
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();
    const meta0 =
      prof?.metadata && typeof prof.metadata === 'object'
        ? { ...(prof.metadata as Record<string, unknown>) }
        : {};
    const issued = ensureFieldTokensInMeta(meta0, companyId);
    if (issued.changed) {
      await supabase
        .from('profiles')
        .update({
          metadata: issued.meta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);
    }

    // Also stamp on school_profiles.metadata for public resolve
    const schoolMeta =
      school.metadata && typeof school.metadata === 'object'
        ? { ...(school.metadata as Record<string, unknown>) }
        : {};
    const schoolTokens = ensureFieldTokensInMeta(
      {
        ...schoolMeta,
        schooladvisor_field_tokens: {
          serve_day: issued.serve_token,
          peu_visit: issued.peu_token,
        },
      },
      companyId
    );
    if (school.id) {
      await supabase
        .from('school_profiles')
        .update({
          metadata: {
            ...schoolTokens.meta,
            company_profile_id: companyId,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', school.id);
    }

    return NextResponse.json({
      success: true,
      serve_token: issued.serve_token,
      peu_token: issued.peu_token,
      serve_path: `/s/serve/${encodeURIComponent(issued.serve_token)}`,
      peu_path: `/s/peu/${encodeURIComponent(issued.peu_token)}`,
      school_profile_id: school.id,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
