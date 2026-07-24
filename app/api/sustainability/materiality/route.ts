import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  MIGRATION_HINT,
  MATERIALITY_TOPICS_SEED,
} from '@/lib/sustainability/types';

function priorityFromScores(impact: number, financial: number): string {
  const max = Math.max(impact, financial);
  const avg = (impact + financial) / 2;
  if (max >= 5 || avg >= 4.5) return 'critical';
  if (avg >= 3.5) return 'high';
  if (avg >= 2.5) return 'medium';
  return 'low';
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_materiality')
      .select('*')
      .eq('profile_id', companyId)
      .order('impact_score', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        topics: [],
        seed: MATERIALITY_TOPICS_SEED,
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    return NextResponse.json({
      success: true,
      topics: data || [],
      seed: MATERIALITY_TOPICS_SEED,
      summary: {
        total: (data || []).length,
        critical: (data || []).filter((t) => t.priority === 'critical').length,
        high: (data || []).filter((t) => t.priority === 'high').length,
      },
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    // Seed all default topics
    if (body.action === 'seed') {
      const { data: existing } = await supabase
        .from('esg_materiality')
        .select('topic')
        .eq('profile_id', companyId);
      const have = new Set((existing || []).map((t) => t.topic));
      const rows = MATERIALITY_TOPICS_SEED.filter((s) => !have.has(s.topic)).map(
        (s) => ({
          profile_id: companyId,
          topic: s.topic,
          pillar: s.pillar,
          impact_score: 3,
          financial_score: 3,
          priority: 'medium',
          created_by: mem.userId,
          updated_at: new Date().toISOString(),
        })
      );
      if (!rows.length) {
        return NextResponse.json({ success: true, seeded: 0, message: 'Already seeded' });
      }
      const { data, error } = await supabase
        .from('esg_materiality')
        .insert(rows)
        .select('id');
      if (error) {
        return NextResponse.json(
          { error: error.message, hint: MIGRATION_HINT },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: true, seeded: data?.length || 0 });
    }

    if (!String(body.topic || '').trim()) {
      return NextResponse.json({ error: 'topic required' }, { status: 400 });
    }

    const impact = Math.min(5, Math.max(1, Number(body.impact_score) || 3));
    const financial = Math.min(5, Math.max(1, Number(body.financial_score) || 3));

    const { data, error } = await supabase
      .from('esg_materiality')
      .insert({
        profile_id: companyId,
        topic: String(body.topic).trim(),
        pillar: body.pillar || 'environment',
        impact_score: impact,
        financial_score: financial,
        priority: body.priority || priorityFromScores(impact, financial),
        notes: body.notes || null,
        framework_tags: Array.isArray(body.framework_tags)
          ? body.framework_tags
          : [],
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: MIGRATION_HINT },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, topic: data }, { status: 201 });
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
    const id = Number(body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'topic',
      'pillar',
      'impact_score',
      'financial_score',
      'priority',
      'notes',
      'framework_tags',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (
      (body.impact_score !== undefined || body.financial_score !== undefined) &&
      body.priority === undefined
    ) {
      const impact = Number(body.impact_score) || 3;
      const financial = Number(body.financial_score) || 3;
      updates.priority = priorityFromScores(impact, financial);
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_materiality')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, topic: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
