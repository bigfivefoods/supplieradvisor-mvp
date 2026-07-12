import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { auditLog } from '@/lib/audit/log';
import { CAPA_STATUSES, formatRef, isOneOf, SEVERITIES } from '@/lib/sheq/types';

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
      .from('sheq_capas')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    const status = sp.get('status');
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          capas: [],
          warning: 'Run supabase/migrations/20260712_sheq_module.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, capas: data || [] });
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

    const now = new Date().toISOString();
    const ncrId =
      body.ncr_id != null && Number.isFinite(Number(body.ncr_id))
        ? Number(body.ncr_id)
        : null;
    const incidentId =
      body.incident_id != null && Number.isFinite(Number(body.incident_id))
        ? Number(body.incident_id)
        : null;

    const row = {
      profile_id: companyId,
      ncr_id: ncrId,
      incident_id: incidentId,
      title,
      description: body.description != null ? String(body.description) : null,
      root_cause: body.root_cause != null ? String(body.root_cause) : null,
      corrective_action:
        body.corrective_action != null ? String(body.corrective_action) : null,
      preventive_action:
        body.preventive_action != null ? String(body.preventive_action) : null,
      status: isOneOf(body.status, CAPA_STATUSES) ? body.status : 'open',
      priority: isOneOf(body.priority, SEVERITIES) ? body.priority : 'medium',
      owner_name: body.owner_name != null ? String(body.owner_name) : null,
      due_date: body.due_date || null,
      created_by: gate.userId,
      updated_at: now,
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sheq_capas')
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

    const public_ref = formatRef('CAPA', Number(data.id));
    await supabase.from('sheq_capas').update({ public_ref }).eq('id', data.id);

    if (ncrId) {
      await supabase
        .from('sheq_ncrs')
        .update({
          capa_id: data.id,
          status: 'capa_linked',
          updated_at: now,
        })
        .eq('id', ncrId)
        .eq('profile_id', companyId);
    }
    if (incidentId) {
      await supabase
        .from('sheq_incidents')
        .update({
          capa_id: data.id,
          status: 'awaiting_capa',
          updated_at: now,
        })
        .eq('id', incidentId)
        .eq('profile_id', companyId);
    }

    void auditLog({
      companyId,
      actorUserId: gate.userId,
      action: 'sheq.capa.create',
      entityType: 'sheq_capa',
      entityId: data.id,
      summary: `CAPA ${public_ref}: ${title}`,
      metadata: { ncrId, incidentId },
    });

    return NextResponse.json(
      { success: true, capa: { ...data, public_ref } },
      { status: 201 }
    );
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
      'description',
      'root_cause',
      'corrective_action',
      'preventive_action',
      'owner_name',
      'effectiveness_check',
      'effectiveness_result',
      'due_date',
    ] as const) {
      if (body[key] != null) updates[key] = String(body[key]);
    }
    if (body.priority != null && isOneOf(body.priority, SEVERITIES)) {
      updates.priority = body.priority;
    }
    if (body.status != null && isOneOf(body.status, CAPA_STATUSES)) {
      updates.status = body.status;
      if (body.status === 'closed' || body.status === 'effective') {
        updates.closed_at = new Date().toISOString();
        if (body.status === 'effective') {
          updates.verified_at = new Date().toISOString();
        }
      }
    }
    if (body.ncr_id != null) updates.ncr_id = Number(body.ncr_id) || null;
    if (body.incident_id != null) updates.incident_id = Number(body.incident_id) || null;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sheq_capas')
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
      action: 'sheq.capa.update',
      entityType: 'sheq_capa',
      entityId: data.id,
      summary: `CAPA ${data.public_ref || data.id} → ${data.status}`,
    });

    return NextResponse.json({ success: true, capa: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
