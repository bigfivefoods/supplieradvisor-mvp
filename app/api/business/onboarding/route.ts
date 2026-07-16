import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  ONBOARDING_STEPS,
  progressPercent,
  inferOnboardingSteps,
  mergeOnboardingSteps,
  getPartnerCount,
  INVITE_PARTNERS_GOAL,
  type OnboardingStepId,
} from '@/lib/onboarding/checklist';

/**
 * GET ?companyId= — golden path checklist + progress (merged with live inference)
 * POST { companyId, stepId, done? } — mark step complete
 * POST { companyId, action: 'sync' } — re-infer and persist
 * POST { companyId, action: 'dismiss' } — hide checklist (completed_at = now)
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

    const inferred = await inferOnboardingSteps(companyId);
    let stored: Record<string, boolean> = {};
    let completedAt: string | null = null;
    let tableMissing = false;

    try {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from('company_onboarding_progress')
        .select('steps, completed_at')
        .eq('profile_id', companyId)
        .maybeSingle();

      if (error && /relation|does not exist/i.test(error.message)) {
        tableMissing = true;
      } else if (data) {
        stored = (data.steps || {}) as Record<string, boolean>;
        completedAt = data.completed_at || null;
      }
    } catch {
      tableMissing = true;
    }

    const steps = mergeOnboardingSteps(stored, inferred);
    const pct = progressPercent(steps);
    const partnerCount = await getPartnerCount(companyId);

    // Soft-persist inference when table exists and something newly true
    if (!tableMissing) {
      const needsWrite = ONBOARDING_STEPS.some(
        (s) => steps[s.id] && !stored[s.id]
      );
      if (needsWrite) {
        void persistSteps(companyId, steps, pct).catch(() => undefined);
      }
    }

    return NextResponse.json({
      success: true,
      companyId,
      steps: ONBOARDING_STEPS.map((s) => ({
        ...s,
        done: Boolean(steps[s.id]),
        inferred: Boolean(inferred[s.id]),
        manual: Boolean(stored[s.id]),
        ...(s.id === 'invite_partners'
          ? {
              partnerCount,
              partnerGoal: INVITE_PARTNERS_GOAL,
            }
          : {}),
      })),
      progressPercent: pct,
      partnerCount,
      partnerGoal: INVITE_PARTNERS_GOAL,
      completedAt: completedAt || (pct >= 100 ? new Date().toISOString() : null),
      inferred: true,
      warning: tableMissing
        ? 'Run 20260716_platform_improvements.sql to persist checklist progress'
        : undefined,
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
    const action = String(body.action || 'mark').toLowerCase();

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    if (action === 'dismiss') {
      const { data: existing } = await supabase
        .from('company_onboarding_progress')
        .select('steps')
        .eq('profile_id', companyId)
        .maybeSingle();
      const steps = (existing?.steps || {}) as Record<string, boolean>;
      const { error } = await supabase.from('company_onboarding_progress').upsert(
        {
          profile_id: companyId,
          steps,
          completed_at: now,
          updated_at: now,
          created_at: now,
        },
        { onConflict: 'profile_id' }
      );
      if (error && /relation|does not exist/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          dismissed: true,
          warning: error.message,
        });
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, dismissed: true, completedAt: now });
    }

    if (action === 'sync') {
      const inferred = await inferOnboardingSteps(companyId);
      const { data: existing } = await supabase
        .from('company_onboarding_progress')
        .select('steps, completed_at')
        .eq('profile_id', companyId)
        .maybeSingle();
      const stored = (existing?.steps || {}) as Record<string, boolean>;
      const steps = mergeOnboardingSteps(stored, inferred);
      const pct = progressPercent(steps);
      const completed_at =
        existing?.completed_at || (pct >= 100 ? now : null);
      await persistSteps(companyId, steps, pct, completed_at);
      return NextResponse.json({
        success: true,
        steps: ONBOARDING_STEPS.map((s) => ({
          ...s,
          done: Boolean(steps[s.id]),
          inferred: Boolean(inferred[s.id]),
        })),
        progressPercent: pct,
        completedAt: completed_at,
      });
    }

    // Default: mark step
    const stepId = String(body.stepId || '') as OnboardingStepId;
    const done = body.done !== false;

    if (!ONBOARDING_STEPS.some((s) => s.id === stepId)) {
      return NextResponse.json({ error: 'Invalid stepId' }, { status: 400 });
    }

    const { data: existing, error: loadErr } = await supabase
      .from('company_onboarding_progress')
      .select('steps')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (loadErr && /relation|does not exist/i.test(loadErr.message)) {
      return NextResponse.json(
        {
          error: loadErr.message,
          hint: 'Run supabase/migrations/20260716_platform_improvements.sql',
        },
        { status: 503 }
      );
    }

    const steps = {
      ...((existing?.steps || {}) as Record<string, boolean>),
      [stepId]: done,
    };
    // Merge live inference so we don't lose auto progress
    const inferred = await inferOnboardingSteps(companyId);
    const merged = mergeOnboardingSteps(steps, inferred);
    const pct = progressPercent(merged);
    const completed_at = pct >= 100 ? now : null;

    const { error } = await supabase.from('company_onboarding_progress').upsert(
      {
        profile_id: companyId,
        steps: merged,
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
        done: Boolean(merged[s.id]),
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

async function persistSteps(
  companyId: number,
  steps: Record<string, boolean>,
  pct: number,
  completedAt?: string | null
): Promise<void> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  await supabase.from('company_onboarding_progress').upsert(
    {
      profile_id: companyId,
      steps,
      completed_at: completedAt ?? (pct >= 100 ? now : null),
      updated_at: now,
      created_at: now,
    },
    { onConflict: 'profile_id' }
  );
}
