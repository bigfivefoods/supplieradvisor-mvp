import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { auditLog } from '@/lib/audit/log';
import {
  formatRef,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  isOneOf,
  SEVERITIES,
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
      .from('sheq_incidents')
      .select('*')
      .eq('profile_id', companyId)
      .order('occurred_at', { ascending: false })
      .limit(200);
    const status = sp.get('status');
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          incidents: [],
          warning: 'Run supabase/migrations/20260712_sheq_module.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, incidents: data || [] });
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
    const row = {
      profile_id: companyId,
      incident_type: isOneOf(body.incident_type, INCIDENT_TYPES)
        ? body.incident_type
        : 'near_miss',
      severity: isOneOf(body.severity, SEVERITIES) ? body.severity : 'medium',
      status: isOneOf(body.status, INCIDENT_STATUSES) ? body.status : 'open',
      title,
      description: body.description != null ? String(body.description) : null,
      location: body.location != null ? String(body.location) : null,
      site_name: body.site_name != null ? String(body.site_name) : null,
      occurred_at: body.occurred_at || now,
      reported_by: body.reported_by != null ? String(body.reported_by) : gate.userId,
      injured_person:
        body.injured_person != null ? String(body.injured_person) : null,
      immediate_action:
        body.immediate_action != null ? String(body.immediate_action) : null,
      root_cause: body.root_cause != null ? String(body.root_cause) : null,
      investigation_notes:
        body.investigation_notes != null
          ? String(body.investigation_notes)
          : null,
      created_by: gate.userId,
      updated_at: now,
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sheq_incidents')
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

    const public_ref = formatRef('INC', Number(data.id));
    await supabase
      .from('sheq_incidents')
      .update({ public_ref })
      .eq('id', data.id);

    void auditLog({
      companyId,
      actorUserId: gate.userId,
      action: 'sheq.incident.create',
      entityType: 'sheq_incident',
      entityId: data.id,
      summary: `SHEQ incident ${public_ref}: ${title}`,
      metadata: { severity: row.severity, type: row.incident_type },
    });

    return NextResponse.json(
      { success: true, incident: { ...data, public_ref } },
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
      'location',
      'site_name',
      'reported_by',
      'injured_person',
      'immediate_action',
      'root_cause',
      'investigation_notes',
      'occurred_at',
    ] as const) {
      if (body[key] != null) updates[key] = String(body[key]);
    }
    if (body.incident_type != null && isOneOf(body.incident_type, INCIDENT_TYPES)) {
      updates.incident_type = body.incident_type;
    }
    if (body.severity != null && isOneOf(body.severity, SEVERITIES)) {
      updates.severity = body.severity;
    }
    if (body.status != null && isOneOf(body.status, INCIDENT_STATUSES)) {
      updates.status = body.status;
      if (body.status === 'closed') updates.closed_at = new Date().toISOString();
    }
    if (body.ncr_id != null) updates.ncr_id = Number(body.ncr_id) || null;
    if (body.capa_id != null) updates.capa_id = Number(body.capa_id) || null;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sheq_incidents')
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
      action: 'sheq.incident.update',
      entityType: 'sheq_incident',
      entityId: data.id,
      summary: `SHEQ incident ${data.public_ref || data.id} → ${data.status}`,
      metadata: { status: data.status },
    });

    return NextResponse.json({ success: true, incident: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
