import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireVerifiedUser } from '@/lib/auth/api-auth';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import {
  computeRpn,
  summarizeRiad,
  type ResellerRiadRecord,
} from '@/lib/containers/reseller-riad';

async function resolveReseller(
  request: NextRequest,
  body: Record<string, unknown>
) {
  const auth = await requireVerifiedUser(request, {
    legacyPrivyUserId: body.privyUserId as string | undefined,
  });
  if (!auth.ok) return { error: auth.response as NextResponse };

  const userId = getCanonicalUserId(auth.userId || (body.privyUserId as string));
  const email = body.email ? String(body.email).toLowerCase().trim() : null;
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'privyUserId required' },
        { status: 400 }
      ),
    };
  }

  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(userId);
  let { data: byUser } = await supabase
    .from('container_resellers')
    .select('*')
    .in('user_id', variants);

  let resellers = (byUser || []).filter(
    (r) => r.portal_status !== 'suspended' && r.status !== 'suspended'
  );

  if ((!resellers || !resellers.length) && email) {
    const { data: byEmail } = await supabase
      .from('container_resellers')
      .select('*')
      .eq('email', email)
      .neq('portal_status', 'suspended');
    resellers = byEmail || [];
  }

  if (!resellers.length) {
    return {
      error: NextResponse.json(
        { error: 'Not linked as a reseller' },
        { status: 403 }
      ),
    };
  }

  const wantId = body.resellerId != null ? Number(body.resellerId) : null;
  const reseller =
    wantId && Number.isFinite(wantId)
      ? resellers.find((r) => Number(r.id) === wantId) || resellers[0]
      : resellers[0];

  return {
    supabase,
    userId,
    reseller: reseller as {
      id: number;
      profile_id: number;
      full_name?: string | null;
      primary_container_id?: number | null;
    },
    resellers,
  };
}

function isMissing(msg?: string) {
  const m = String(msg || '').toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache')
  );
}

/**
 * GET — list own RIAD entries (query: privyUserId, email, status, type)
 * POST — create, or { list: true } to list, or { action: 'update', id, ... }
 */
export async function GET(request: NextRequest) {
  try {
    const body = {
      privyUserId: request.nextUrl.searchParams.get('privyUserId'),
      email: request.nextUrl.searchParams.get('email'),
      resellerId: request.nextUrl.searchParams.get('resellerId'),
    };
    const resolved = await resolveReseller(request, body as Record<string, unknown>);
    if ('error' in resolved && resolved.error instanceof NextResponse) {
      return resolved.error;
    }
    const { supabase, reseller } = resolved as {
      supabase: ReturnType<typeof getSupabaseServer>;
      reseller: { id: number };
    };

    const status = request.nextUrl.searchParams.get('status');
    const type = request.nextUrl.searchParams.get('type');

    let q = supabase
      .from('reseller_riad')
      .select('*')
      .eq('reseller_id', reseller.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (type && type !== 'all') q = q.eq('riad_type', type);

    const { data, error } = await q;
    if (error) {
      if (isMissing(error.message)) {
        return NextResponse.json({
          success: true,
          items: [],
          summary: summarizeRiad([]),
          migration_required: true,
          warning:
            'Run supabase/migrations/20260714_reseller_riad.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = (data || []) as ResellerRiadRecord[];
    if (status && status !== 'all') {
      if (status === 'open') {
        items = items.filter((i) =>
          ['open', 'active', 'in_progress', 'on_hold', 'mitigated'].includes(
            String(i.status || '').toLowerCase()
          )
        );
      } else if (status === 'closed') {
        items = items.filter((i) =>
          ['closed', 'resolved'].includes(String(i.status || '').toLowerCase())
        );
      } else {
        items = items.filter(
          (i) => String(i.status || '').toLowerCase() === status.toLowerCase()
        );
      }
    }

    return NextResponse.json({
      success: true,
      items,
      summary: summarizeRiad((data || []) as ResellerRiadRecord[]),
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
    const resolved = await resolveReseller(request, body);
    if ('error' in resolved && resolved.error instanceof NextResponse) {
      return resolved.error;
    }
    const { supabase, userId, reseller } = resolved as {
      supabase: ReturnType<typeof getSupabaseServer>;
      userId: string;
      reseller: {
        id: number;
        profile_id: number;
        full_name?: string | null;
        primary_container_id?: number | null;
      };
    };

    if (body.list === true || body.action === 'list') {
      const { data, error } = await supabase
        .from('reseller_riad')
        .select('*')
        .eq('reseller_id', reseller.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        if (isMissing(error.message)) {
          return NextResponse.json({
            success: true,
            items: [],
            summary: summarizeRiad([]),
            migration_required: true,
            warning:
              'Run supabase/migrations/20260714_reseller_riad.sql',
          });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        items: data || [],
        summary: summarizeRiad((data || []) as ResellerRiadRecord[]),
      });
    }

    if (body.action === 'update' || body.action === 'patch') {
      return updateItem(supabase, reseller.id, body, userId);
    }

    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const riadType = String(body.riad_type || body.type || 'issue').toLowerCase();
    const severity =
      body.severity != null && body.severity !== ''
        ? Number(body.severity)
        : null;
    const likelihood =
      body.likelihood != null && body.likelihood !== ''
        ? Number(body.likelihood)
        : null;
    const timeHorizon =
      body.time_horizon != null && body.time_horizon !== ''
        ? Number(body.time_horizon)
        : null;
    let rpn: number | null = null;
    if (
      riadType === 'risk' &&
      severity != null &&
      likelihood != null &&
      timeHorizon != null
    ) {
      rpn = computeRpn(severity, likelihood, timeHorizon);
    } else if (body.rpn != null) {
      rpn = Number(body.rpn);
    }

    let priority = String(body.priority || 'medium');
    if (rpn != null && !body.priority) {
      if (rpn >= 75) priority = 'critical';
      else if (rpn >= 50) priority = 'high';
      else if (rpn >= 25) priority = 'medium';
      else priority = 'low';
    }

    const insert = {
      profile_id: Number(reseller.profile_id),
      reseller_id: Number(reseller.id),
      container_id:
        body.container_id != null
          ? Number(body.container_id)
          : reseller.primary_container_id != null
            ? Number(reseller.primary_container_id)
            : null,
      product_id:
        body.product_id != null && Number.isFinite(Number(body.product_id))
          ? Number(body.product_id)
          : null,
      product_name: body.product_name
        ? String(body.product_name).trim().slice(0, 200)
        : null,
      sku: body.sku ? String(body.sku).slice(0, 120) : null,
      riad_type: riadType,
      title: title.slice(0, 300),
      description: body.description
        ? String(body.description).trim().slice(0, 4000)
        : null,
      status: body.status || 'open',
      priority,
      category: body.category ? String(body.category).slice(0, 120) : null,
      owner_name:
        body.owner_name ||
        reseller.full_name ||
        body.created_by_name ||
        null,
      severity,
      likelihood,
      time_horizon: timeHorizon,
      rpn,
      mitigation_plan: body.mitigation_plan
        ? String(body.mitigation_plan).trim().slice(0, 4000)
        : null,
      notes: body.notes ? String(body.notes).trim().slice(0, 4000) : null,
      due_date: body.due_date || null,
      created_by: userId,
      created_by_name:
        body.created_by_name || reseller.full_name || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reseller_riad')
      .insert(insert)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissing(error.message)) {
        return NextResponse.json(
          {
            error:
              'RIAD table missing. Run supabase/migrations/20260714_reseller_riad.sql',
            migration_required: true,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item: data,
      message: 'RIAD entry logged',
    });
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
    const resolved = await resolveReseller(request, body);
    if ('error' in resolved && resolved.error instanceof NextResponse) {
      return resolved.error;
    }
    const { supabase, userId, reseller } = resolved as {
      supabase: ReturnType<typeof getSupabaseServer>;
      userId: string;
      reseller: { id: number };
    };
    return updateItem(supabase, Number(reseller.id), body, userId);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function updateItem(
  supabase: ReturnType<typeof getSupabaseServer>,
  resellerId: number,
  body: Record<string, unknown>,
  _userId: string
) {
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
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
    'product_id',
    'product_name',
    'sku',
    'closed_at',
  ] as const;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
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
    !updates.closed_at
  ) {
    updates.closed_at = new Date().toISOString();
  }
  if (
    nextStatus &&
    !['closed', 'resolved'].includes(nextStatus) &&
    body.clear_closed
  ) {
    updates.closed_at = null;
  }

  const { data, error } = await supabase
    .from('reseller_riad')
    .update(updates)
    .eq('id', id)
    .eq('reseller_id', resellerId)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissing(error.message)) {
      return NextResponse.json(
        {
          error:
            'RIAD table missing. Run supabase/migrations/20260714_reseller_riad.sql',
          migration_required: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'RIAD entry not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, item: data });
}
