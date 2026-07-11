import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { normalizeTags } from '@/lib/containers/types';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { updateContainerTolerant } from '@/lib/containers/db-write';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const supabase = getSupabaseServer();

    let q = supabase.from('containers').select('*').eq('id', Number(id));
    if (Number.isFinite(companyId) && companyId > 0) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;
      q = q.eq('profile_id', companyId);
    }

    const { data, error } = await q.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, container: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const companyId = Number(body.companyId ?? body.profile_id);
    const supabase = getSupabaseServer();

    // Prefer company gate when client sends companyId
    if (Number.isFinite(companyId) && companyId > 0) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!gate.ok) return gate.response;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields = [
      'container_code',
      'name',
      'type',
      'status',
      'container_type',
      'continent',
      'country',
      'province',
      'city',
      'address',
      'deployed_date',
      'purchase_date',
      'photo_url',
      'notes',
      'assigned_contractor',
      'wifi_portal_url',
      'is_active',
    ] as const;

    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (body.latitude !== undefined) {
      updates.latitude =
        body.latitude === '' || body.latitude == null ? null : Number(body.latitude);
    }
    if (body.longitude !== undefined) {
      updates.longitude =
        body.longitude === '' || body.longitude == null ? null : Number(body.longitude);
    }
    if (body.cost !== undefined) {
      updates.cost = body.cost === '' || body.cost == null ? null : Number(body.cost);
    }
    if (body.contractor_id !== undefined) {
      updates.contractor_id = body.contractor_id ? Number(body.contractor_id) : null;
    }
    if (body.tags !== undefined) updates.tags = normalizeTags(body.tags);
    if (body.profile_id !== undefined) updates.profile_id = Number(body.profile_id);
    if (body.capacity_units !== undefined) {
      updates.capacity_units =
        body.capacity_units == null ? null : Number(body.capacity_units);
    }
    if (body.monthly_target !== undefined) {
      updates.monthly_target =
        body.monthly_target == null ? null : Number(body.monthly_target);
    }

    if (updates.contractor_id) {
      const { data: contractor } = await supabase
        .from('container_contractors')
        .select('full_name')
        .eq('id', updates.contractor_id)
        .maybeSingle();
      if (contractor?.full_name) updates.assigned_contractor = contractor.full_name;
    }

    // Scope update to company when known
    if (Number.isFinite(companyId) && companyId > 0) {
      const { data: existing } = await supabase
        .from('containers')
        .select('id, profile_id')
        .eq('id', Number(id))
        .maybeSingle();
      if (existing && existing.profile_id != null && Number(existing.profile_id) !== companyId) {
        return NextResponse.json({ error: 'Container not in this company' }, { status: 403 });
      }
    }

    const result = await updateContainerTolerant(supabase, Number(id), updates);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, container: result.container });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const supabase = getSupabaseServer();

    if (Number.isFinite(companyId) && companyId > 0) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;
    }

    let q = supabase.from('containers').delete().eq('id', Number(id));
    if (Number.isFinite(companyId) && companyId > 0) {
      q = q.eq('profile_id', companyId);
    }
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
