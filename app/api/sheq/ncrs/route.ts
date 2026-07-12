import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { auditLog } from '@/lib/audit/log';
import {
  formatRef,
  isOneOf,
  NCR_DOMAINS,
  NCR_SOURCES,
  NCR_STATUSES,
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
      .from('sheq_ncrs')
      .select('*')
      .eq('profile_id', companyId)
      .order('raised_at', { ascending: false })
      .limit(200);
    const status = sp.get('status');
    if (status && status !== 'all') q = q.eq('status', status);
    const source = sp.get('source');
    if (source && source !== 'all') q = q.eq('source', source);

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          ncrs: [],
          warning: 'Run supabase/migrations/20260712_sheq_module.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, ncrs: data || [] });
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
      source: isOneOf(body.source, NCR_SOURCES) ? body.source : 'manual',
      domain: isOneOf(body.domain, NCR_DOMAINS) ? body.domain : 'quality',
      status: isOneOf(body.status, NCR_STATUSES) ? body.status : 'open',
      severity: isOneOf(body.severity, SEVERITIES) ? body.severity : 'medium',
      title,
      description: body.description != null ? String(body.description) : null,
      lot_number: body.lot_number != null ? String(body.lot_number).trim() || null : null,
      product_id:
        body.product_id != null && Number.isFinite(Number(body.product_id))
          ? Number(body.product_id)
          : null,
      inspection_id:
        body.inspection_id != null && Number.isFinite(Number(body.inspection_id))
          ? Number(body.inspection_id)
          : null,
      incident_id:
        body.incident_id != null && Number.isFinite(Number(body.incident_id))
          ? Number(body.incident_id)
          : null,
      containment: body.containment != null ? String(body.containment) : null,
      disposition: body.disposition != null ? String(body.disposition) : null,
      raised_by: body.raised_by != null ? String(body.raised_by) : gate.userId,
      raised_at: now,
      created_by: gate.userId,
      updated_at: now,
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sheq_ncrs')
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

    const public_ref = formatRef('NCR', Number(data.id));
    await supabase.from('sheq_ncrs').update({ public_ref }).eq('id', data.id);

    void auditLog({
      companyId,
      actorUserId: gate.userId,
      action: 'sheq.ncr.create',
      entityType: 'sheq_ncr',
      entityId: data.id,
      summary: `NCR ${public_ref}: ${title}`,
      metadata: { source: row.source, domain: row.domain },
    });

    return NextResponse.json(
      { success: true, ncr: { ...data, public_ref } },
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
      'lot_number',
      'containment',
      'disposition',
    ] as const) {
      if (body[key] != null) updates[key] = String(body[key]);
    }
    if (body.source != null && isOneOf(body.source, NCR_SOURCES)) updates.source = body.source;
    if (body.domain != null && isOneOf(body.domain, NCR_DOMAINS)) updates.domain = body.domain;
    if (body.severity != null && isOneOf(body.severity, SEVERITIES)) {
      updates.severity = body.severity;
    }
    if (body.status != null && isOneOf(body.status, NCR_STATUSES)) {
      updates.status = body.status;
      if (body.status === 'closed') updates.closed_at = new Date().toISOString();
    }
    if (body.capa_id != null) updates.capa_id = Number(body.capa_id) || null;
    if (body.incident_id != null) updates.incident_id = Number(body.incident_id) || null;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sheq_ncrs')
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
      action: 'sheq.ncr.update',
      entityType: 'sheq_ncr',
      entityId: data.id,
      summary: `NCR ${data.public_ref || data.id} → ${data.status}`,
    });

    return NextResponse.json({ success: true, ncr: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
