import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&privyUserId= — load leadership_progress from profiles
 * POST body: companyId, privyUserId, progress — save Super-Cube assessment
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, leadership_progress')
      .eq('id', companyId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({
        success: true,
        progress: null,
        warning: error.message,
      });
    }
    return NextResponse.json({
      success: true,
      progress: data?.leadership_progress ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const progress = body.progress ?? null;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        leadership_progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select('id, leadership_progress')
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'leadership_progress column on profiles' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, progress: data.leadership_progress });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
