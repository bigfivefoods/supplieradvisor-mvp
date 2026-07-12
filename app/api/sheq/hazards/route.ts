import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { auditLog } from '@/lib/audit/log';
import {
  clampScore,
  HAZARD_STATUSES,
  isOneOf,
  riskScore,
} from '@/lib/sheq/types';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(
      request,
      companyId,
      'sheq',
      'view',
      { legacyPrivyUserId: legacyPrivyFrom(request) }
    );
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let q = supabase
      .from('sheq_hazards')
      .select('*')
      .eq('profile_id', companyId)
      .order('risk_score', { ascending: false })
      .limit(200);
    const status = sp.get('status');
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          hazards: [],
          warning: 'Run supabase/migrations/20260712_sheq_module.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, hazards: data || [] });
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
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(
      request,
      companyId,
      'sheq',
      'write',
      { legacyPrivyUserId: legacyPrivyFrom(request, body) }
    );
    if (!gate.ok) return gate.response;

    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const likelihood = clampScore(Number(body.likelihood ?? 3));
    const severity = clampScore(Number(body.severity ?? 3));
    const residual_likelihood =
      body.residual_likelihood != null
        ? clampScore(Number(body.residual_likelihood))
        : null;
    const residual_severity =
      body.residual_severity != null
        ? clampScore(Number(body.residual_severity))
        : null;

    const now = new Date().toISOString();
    const row = {
      profile_id: companyId,
      title,
      category: body.category != null ? String(body.category) : 'general',
      location: body.location != null ? String(body.location) : null,
      description: body.description != null ? String(body.description) : null,
      likelihood,
      severity,
      risk_score: riskScore(likelihood, severity),
      residual_likelihood,
      residual_severity,
      residual_risk_score:
        residual_likelihood != null && residual_severity != null
          ? riskScore(residual_likelihood, residual_severity)
          : null,
      controls: body.controls != null ? String(body.controls) : null,
      residual_controls:
        body.residual_controls != null ? String(body.residual_controls) : null,
      status: isOneOf(body.status, HAZARD_STATUSES) ? body.status : 'open',
      owner_name: body.owner_name != null ? String(body.owner_name) : null,
      review_due: body.review_due || null,
      created_by: gate.userId,
      updated_at: now,
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sheq_hazards')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          {
            error: 'SHEQ tables missing — run 20260712_sheq_module.sql',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void auditLog({
      companyId,
      actorUserId: gate.userId,
      action: 'sheq.hazard.create',
      entityType: 'sheq_hazard',
      entityId: data.id,
      summary: `Hazard risk #${data.id}: ${title} (score ${row.risk_score})`,
      metadata: { risk_score: row.risk_score },
    });

    return NextResponse.json({ success: true, hazard: data }, { status: 201 });
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
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(
      request,
      companyId,
      'sheq',
      'write',
      { legacyPrivyUserId: legacyPrivyFrom(request, body) }
    );
    if (!gate.ok) return gate.response;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of [
      'title',
      'category',
      'location',
      'description',
      'controls',
      'residual_controls',
      'owner_name',
      'review_due',
    ] as const) {
      if (body[key] != null) updates[key] = String(body[key]);
    }
    if (body.likelihood != null) {
      updates.likelihood = clampScore(Number(body.likelihood));
    }
    if (body.severity != null) {
      updates.severity = clampScore(Number(body.severity));
    }
    if (body.likelihood != null || body.severity != null) {
      const L = clampScore(Number(body.likelihood ?? body._likelihood ?? 3));
      const S = clampScore(Number(body.severity ?? body._severity ?? 3));
      // fetch current if partial — recompute from updates after merge is safer
      updates.risk_score = riskScore(
        Number(updates.likelihood ?? body.likelihood ?? 3),
        Number(updates.severity ?? body.severity ?? 3)
      );
      void L;
      void S;
    }
    if (body.residual_likelihood != null) {
      updates.residual_likelihood = clampScore(Number(body.residual_likelihood));
    }
    if (body.residual_severity != null) {
      updates.residual_severity = clampScore(Number(body.residual_severity));
    }
    if (body.residual_likelihood != null || body.residual_severity != null) {
      const rl = body.residual_likelihood != null ? clampScore(Number(body.residual_likelihood)) : null;
      const rs = body.residual_severity != null ? clampScore(Number(body.residual_severity)) : null;
      if (rl != null && rs != null) {
        updates.residual_risk_score = riskScore(rl, rs);
      }
    }
    if (body.status != null && isOneOf(body.status, HAZARD_STATUSES)) {
      updates.status = body.status;
    }

    const supabase = getSupabaseServer();
    // If only one of L/S provided, recompute risk from existing row
    if (body.likelihood != null || body.severity != null) {
      const { data: cur } = await supabase
        .from('sheq_hazards')
        .select('likelihood, severity')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (cur) {
        const L = body.likelihood != null ? clampScore(Number(body.likelihood)) : Number(cur.likelihood);
        const S = body.severity != null ? clampScore(Number(body.severity)) : Number(cur.severity);
        updates.likelihood = L;
        updates.severity = S;
        updates.risk_score = riskScore(L, S);
      }
    }

    const { data, error } = await supabase
      .from('sheq_hazards')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    void auditLog({
      companyId,
      actorUserId: gate.userId,
      action: 'sheq.hazard.update',
      entityType: 'sheq_hazard',
      entityId: data.id,
      summary: `Hazard #${data.id} → ${data.status} (score ${data.risk_score})`,
    });

    return NextResponse.json({ success: true, hazard: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
