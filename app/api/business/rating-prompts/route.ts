import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET ?companyId= — pending rating prompts for this company
 * POST { companyId, action: 'create' | 'dismiss' | 'complete', ... }
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
    const now = new Date().toISOString();
    // Pending + snoozed/dismissed whose due_at has passed (7-day re-prompt)
    const { data, error } = await supabase
      .from('rating_prompts')
      .select('*')
      .eq('profile_id', companyId)
      .in('status', ['pending', 'dismissed', 'snoozed'])
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          prompts: [],
          dueCount: 0,
          warning: 'Run 20260716_platform_improvements.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const prompts = (data || []).filter((p) => {
      const st = String(p.status || '');
      if (st === 'pending') return true;
      // Re-surface dismissed/snoozed after due_at
      const due = p.due_at ? String(p.due_at) : null;
      return due != null && due <= now;
    });

    // Soft: re-open snoozed rows that are due
    for (const p of prompts) {
      if (String(p.status) !== 'pending') {
        try {
          await supabase
            .from('rating_prompts')
            .update({ status: 'pending', updated_at: now })
            .eq('id', p.id)
            .eq('profile_id', companyId);
          p.status = 'pending';
        } catch {
          /* soft */
        }
      }
    }

    return NextResponse.json({
      success: true,
      prompts: prompts.slice(0, 20),
      dueCount: prompts.length,
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
    const action = String(body.action || 'create').toLowerCase();

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    if (action === 'create') {
      const counterpartyId = Number(body.counterpartyProfileId);
      if (!Number.isFinite(counterpartyId) || counterpartyId <= 0) {
        return NextResponse.json(
          { error: 'counterpartyProfileId required' },
          { status: 400 }
        );
      }
      const rateeRole = ['supplier', 'customer', 'partner'].includes(
        String(body.rateeRole || '')
      )
        ? String(body.rateeRole)
        : 'supplier';

      const { data, error } = await supabase
        .from('rating_prompts')
        .insert({
          profile_id: companyId,
          user_id: gate.userId,
          counterparty_profile_id: counterpartyId,
          counterparty_name: body.counterpartyName
            ? String(body.counterpartyName).slice(0, 200)
            : null,
          ratee_role: rateeRole,
          context_type: body.contextType
            ? String(body.contextType).slice(0, 40)
            : 'general',
          context_id: body.contextId ? String(body.contextId) : null,
          status: 'pending',
          due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            note: 'Rate after trade — continuous supplier↔customer feedback',
          },
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single();

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260716_platform_improvements.sql',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, prompt: data });
    }

    if (action === 'dismiss' || action === 'snooze' || action === 'complete') {
      const promptId = Number(body.promptId);
      if (!Number.isFinite(promptId)) {
        return NextResponse.json({ error: 'promptId required' }, { status: 400 });
      }
      const reason =
        body.reason != null ? String(body.reason).trim().slice(0, 200) : null;
      if (
        (action === 'dismiss' || action === 'snooze') &&
        !reason
      ) {
        return NextResponse.json(
          { error: 'reason required to snooze trust prompt' },
          { status: 400 }
        );
      }
      const snoozeDays = Number(body.days || 7);
      const dueAt = new Date(
        Date.now() + Math.max(1, snoozeDays) * 86400000
      ).toISOString();
      const { data, error } = await supabase
        .from('rating_prompts')
        .update({
          status:
            action === 'complete'
              ? 'completed'
              : action === 'snooze' || action === 'dismiss'
                ? 'snoozed'
                : 'dismissed',
          completed_at: action === 'complete' ? now : null,
          due_at: action === 'complete' ? null : dueAt,
          updated_at: now,
          metadata: reason
            ? { snooze_reason: reason, snoozed_at: now }
            : undefined,
        })
        .eq('id', promptId)
        .eq('profile_id', companyId)
        .select('id')
        .maybeSingle();

      if (error) {
        // soft retry without metadata
        const retry = await supabase
          .from('rating_prompts')
          .update({
            status: action === 'complete' ? 'completed' : 'snoozed',
            completed_at: action === 'complete' ? now : null,
            due_at: action === 'complete' ? null : dueAt,
            updated_at: now,
          })
          .eq('id', promptId)
          .eq('profile_id', companyId)
          .select('id')
          .maybeSingle();
        if (retry.error || !retry.data) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          promptId,
          status: action === 'complete' ? 'completed' : 'snoozed',
          due_at: dueAt,
          reason,
        });
      }
      if (!data) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        promptId,
        status: action === 'complete' ? 'completed' : 'snoozed',
        due_at: dueAt,
        reason,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use create | dismiss | complete' },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
