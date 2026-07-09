import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { assertContractorContainerAccess } from '@/lib/contractor/access';
import { computeRpn } from '@/lib/containers/riad';

/**
 * GET ?companyId=&containerId=&type=&status=&privyUserId=&email=
 * List container RIADs for a company or contractor-scoped container.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const containerId = sp.get('containerId') ? Number(sp.get('containerId')) : null;
    const type = sp.get('type');
    const status = sp.get('status');
    const privyUserId = sp.get('privyUserId');
    const email = sp.get('email');

    const supabase = getSupabaseServer();
    let profileId = companyId;

    if (privyUserId && containerId) {
      const access = await assertContractorContainerAccess(containerId, privyUserId, email);
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      profileId = Number(access.container.profile_id);
    }

    if (!Number.isFinite(profileId) && !containerId) {
      return NextResponse.json({ error: 'companyId or containerId required' }, { status: 400 });
    }

    let q = supabase.from('riad_logs').select('*').order('created_at', { ascending: false });

    if (Number.isFinite(profileId)) q = q.eq('profile_id', profileId);
    // Prefer container module when filtering company-wide containers hub
    if (sp.get('module') !== 'all') {
      q = q.or('module.eq.containers,module.is.null');
    }
    if (containerId && Number.isFinite(containerId)) q = q.eq('container_id', containerId);
    if (type && type !== 'all') q = q.eq('riad_type', type);
    // status filter applied after fetch for open/closed buckets (legacy "active" etc.)
    const statusFilter = status && status !== 'all' ? status : null;

    const { data, error } = await q.limit(500);

    if (error) {
      return NextResponse.json({
        success: true,
        items: [],
        warning: error.message,
        hint: error.message.includes('does not exist')
          ? 'Run supabase/migrations/20260709_container_riad.sql'
          : undefined,
      });
    }

    const items = data || [];
    // Enrich with container names
    const cids = [...new Set(items.map((i) => i.container_id).filter(Boolean))];
    let nameMap: Record<number, { name: string; container_code: string }> = {};
    if (cids.length) {
      const { data: containers } = await supabase
        .from('containers')
        .select('id, name, container_code')
        .in('id', cids);
      for (const c of containers || []) {
        nameMap[c.id] = { name: c.name, container_code: c.container_code };
      }
    }

    let enriched = items.map((i) => ({
      ...i,
      container_name: i.container_id ? nameMap[i.container_id]?.name : null,
      container_code: i.container_id ? nameMap[i.container_id]?.container_code : null,
    }));

    const norm = (s?: string | null) => String(s || 'open').toLowerCase();
    const isOpenLike = (s?: string | null) =>
      ['open', 'active', 'in_progress', 'on_hold', 'mitigated'].includes(norm(s));
    const isClosedLike = (s?: string | null) =>
      ['closed', 'resolved'].includes(norm(s));

    // Full counts before status filter (so chips stay accurate)
    const allForSummary = enriched;
    const byStatus: Record<string, number> = {};
    for (const i of allForSummary) {
      const s = norm(i.status);
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    const open = allForSummary.filter((i) => isOpenLike(i.status)).length;
    const closed = allForSummary.filter((i) => isClosedLike(i.status)).length;
    const inProgress = allForSummary.filter((i) => norm(i.status) === 'in_progress').length;
    const onHold = allForSummary.filter((i) => norm(i.status) === 'on_hold').length;
    const critical = allForSummary.filter(
      (i) =>
        isOpenLike(i.status) &&
        (i.priority === 'critical' || (i.rpn != null && Number(i.rpn) >= 75))
    ).length;

    if (statusFilter) {
      if (statusFilter === 'open' || statusFilter === 'open_bucket') {
        enriched = enriched.filter((i) => isOpenLike(i.status));
      } else if (statusFilter === 'closed' || statusFilter === 'closed_bucket') {
        enriched = enriched.filter((i) => isClosedLike(i.status));
      } else if (statusFilter === 'critical') {
        enriched = enriched.filter(
          (i) =>
            isOpenLike(i.status) &&
            (i.priority === 'critical' || (i.rpn != null && Number(i.rpn) >= 75))
        );
      } else {
        enriched = enriched.filter((i) => norm(i.status) === statusFilter.toLowerCase());
      }
    }

    return NextResponse.json({
      success: true,
      items: enriched,
      summary: {
        total: allForSummary.length,
        open,
        closed,
        inProgress,
        onHold,
        critical,
        byStatus,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST create RIAD
 * Business: { companyId, containerId?, ... }
 * Contractor: { privyUserId, email, containerId, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let companyId = Number(body.companyId);
    const containerId = body.containerId != null ? Number(body.containerId) : null;
    let contractorId: number | null = null;
    let source = body.source || 'business';
    const userId = getCanonicalUserId(body.privyUserId);

    if (body.privyUserId && containerId) {
      const access = await assertContractorContainerAccess(
        containerId,
        body.privyUserId,
        body.email
      );
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      companyId = Number(access.container.profile_id);
      contractorId = access.contractor.id;
      source = 'contractor';
    }

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const riadType = body.riad_type || body.type || 'risk';
    const severity = body.severity != null ? Number(body.severity) : null;
    const likelihood = body.likelihood != null ? Number(body.likelihood) : null;
    const timeHorizon = body.time_horizon != null ? Number(body.time_horizon) : null;
    const rpn =
      riadType === 'risk' && severity && likelihood && timeHorizon
        ? computeRpn(severity, likelihood, timeHorizon)
        : body.rpn != null
          ? Number(body.rpn)
          : null;

    // Auto priority from RPN if risk
    let priority = body.priority || 'medium';
    if (rpn != null && !body.priority) {
      if (rpn >= 75) priority = 'critical';
      else if (rpn >= 50) priority = 'high';
      else if (rpn >= 25) priority = 'medium';
      else priority = 'low';
    }

    // Legacy DB has NOT NULL on stakeholder_type (and sometimes owner_id) —
    // always send safe defaults so container RIAD create never fails.
    const stakeholderType = body.stakeholder_type || body.stakeholderType || 'internal';
    const ownerId =
      body.owner_id != null && body.owner_id !== ''
        ? Number(body.owner_id)
        : companyId;

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      container_id: containerId,
      contractor_id: contractorId || body.contractor_id || null,
      module: 'containers',
      source,
      riad_type: riadType,
      title: String(body.title).trim(),
      description: body.description || null,
      status: body.status || 'open',
      priority,
      category: body.category || null,
      owner_name: body.owner_name || body.created_by_name || 'Unassigned',
      owner_id: Number.isFinite(ownerId) ? ownerId : companyId,
      stakeholder_type: stakeholderType,
      stakeholder_id: body.stakeholder_id != null ? Number(body.stakeholder_id) : null,
      stakeholder_name: body.stakeholder_name || body.category || 'Container operations',
      severity,
      likelihood,
      time_horizon: timeHorizon,
      rpn,
      residual_rpn: body.residual_rpn != null ? Number(body.residual_rpn) : null,
      mitigation_plan: body.mitigation_plan || null,
      logged_date: body.logged_date || new Date().toISOString().slice(0, 10),
      due_date: body.due_date || null,
      image_url: body.image_url || null,
      notes: body.notes || null,
      resolution: body.resolution || null,
      created_by: userId || body.created_by || null,
      created_by_name: body.created_by_name || null,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();
    let { data, error } = await supabase.from('riad_logs').insert(payload).select('*').single();

    // Retry without optional columns if schema is older / stricter
    if (error && /null value|not-null|column/i.test(error.message)) {
      const minimal = {
        profile_id: companyId,
        owner_id: companyId,
        stakeholder_type: stakeholderType,
        riad_type: riadType,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        severity,
        likelihood,
        time_horizon: timeHorizon,
        rpn,
        logged_date: payload.logged_date,
        container_id: containerId,
        module: 'containers',
        source,
        priority,
        category: payload.category,
        owner_name: payload.owner_name,
        stakeholder_name: payload.stakeholder_name,
        mitigation_plan: payload.mitigation_plan,
        due_date: payload.due_date,
        created_by: payload.created_by,
        created_by_name: payload.created_by_name,
        updated_at: payload.updated_at,
      };
      const retry = await supabase.from('riad_logs').insert(minimal).select('*').single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint:
            'If this persists, in SQL Editor run: ALTER TABLE public.riad_logs ALTER COLUMN stakeholder_type DROP NOT NULL; (or set a default)',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** PATCH update status / fields */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Contractor may only patch items on their container
    if (body.privyUserId && body.containerId) {
      const access = await assertContractorContainerAccess(
        Number(body.containerId),
        body.privyUserId,
        body.email
      );
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
    }

    const allowed = [
      'title',
      'description',
      'status',
      'priority',
      'category',
      'owner_name',
      'mitigation_plan',
      'due_date',
      'notes',
      'resolution',
      'severity',
      'likelihood',
      'time_horizon',
      'rpn',
      'residual_rpn',
      'image_url',
      'closed_at',
      'container_id',
    ] as const;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of allowed) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    if (
      updates.severity != null &&
      updates.likelihood != null &&
      updates.time_horizon != null
    ) {
      updates.rpn = computeRpn(
        Number(updates.severity),
        Number(updates.likelihood),
        Number(updates.time_horizon)
      );
    }

    const nextStatus = String(updates.status ?? body.status ?? '');
    if (
      (nextStatus === 'closed' || nextStatus === 'resolved') &&
      updates.closed_at === undefined
    ) {
      updates.closed_at = body.closed_at || new Date().toISOString();
    }
    // Re-open clears closed_at
    if (['open', 'active', 'in_progress', 'on_hold', 'mitigated'].includes(nextStatus)) {
      updates.closed_at = null;
    }
    if (body.resolution !== undefined) {
      updates.resolution = body.resolution;
    }

    const supabase = getSupabaseServer();
    // Do not force container_id match when null (company-wide items)
    let q = supabase.from('riad_logs').update(updates).eq('id', Number(body.id));
    if (body.containerId != null && Number.isFinite(Number(body.containerId))) {
      q = q.eq('container_id', Number(body.containerId));
    }

    const { data, error } = await q.select('*').single();
    if (error) {
      // Retry without closed_at if column missing
      if (/closed_at|resolution/i.test(error.message)) {
        const soft = { ...updates };
        delete soft.closed_at;
        delete soft.resolution;
        const retry = await supabase
          .from('riad_logs')
          .update(soft)
          .eq('id', Number(body.id))
          .select('*')
          .single();
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
        return NextResponse.json({ success: true, item: retry.data });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, item: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Contractors cannot delete — only business (no privyUserId path)
    if (request.nextUrl.searchParams.get('privyUserId')) {
      return NextResponse.json({ error: 'Contractors cannot delete RIAD entries' }, { status: 403 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase.from('riad_logs').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
