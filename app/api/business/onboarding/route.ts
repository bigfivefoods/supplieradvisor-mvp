import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  ONBOARDING_STEPS,
  progressPercent,
  type OnboardingStepId,
} from '@/lib/onboarding/checklist';

/**
 * GET ?companyId= — golden path checklist + progress
 * POST { companyId, stepId, done? } — mark step complete
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('company_onboarding_progress')
      .select('steps, completed_at')
      .eq('profile_id', companyId)
      .maybeSingle();

    const steps = (data?.steps || {}) as Record<string, boolean>;
    const pct = progressPercent(steps);

    return NextResponse.json({
      success: true,
      companyId,
      steps: ONBOARDING_STEPS.map((s) => ({
        ...s,
        done: Boolean(steps[s.id]),
      })),
      progressPercent: pct,
      completedAt: data?.completed_at || null,
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
    const stepId = String(body.stepId || '') as OnboardingStepId;
    const done = body.done !== false;

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!ONBOARDING_STEPS.some((s) => s.id === stepId)) {
      return NextResponse.json({ error: 'Invalid stepId' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: existing } = await supabase
      .from('company_onboarding_progress')
      .select('steps')
      .eq('profile_id', companyId)
      .maybeSingle();

    const steps = {
      ...((existing?.steps || {}) as Record<string, boolean>),
      [stepId]: done,
    };
    const pct = progressPercent(steps);
    const now = new Date().toISOString();
    const completed_at = pct >= 100 ? now : null;

    const { error } = await supabase.from('company_onboarding_progress').upsert(
      {
        profile_id: companyId,
        steps,
        completed_at,
        updated_at: now,
        created_at: now,
      },
      { onConflict: 'profile_id' }
    );

    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260716_platform_improvements.sql',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      steps: ONBOARDING_STEPS.map((s) => ({
        ...s,
        done: Boolean(steps[s.id]),
      })),
      progressPercent: pct,
      completedAt: completed_at,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
