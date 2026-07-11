import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertContractorContainerAccess } from '@/lib/contractor/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/** GET ?companyId=&containerId=&privyUserId=&email= */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const containerId = request.nextUrl.searchParams.get('containerId');
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const email = request.nextUrl.searchParams.get('email');

    if (!Number.isFinite(companyId) && !privyUserId) {
      return NextResponse.json({ error: 'companyId or privyUserId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    let profileId = companyId;

    if (containerId && privyUserId) {
      const access = await assertContractorContainerAccess(
        Number(containerId),
        privyUserId,
        email
      );
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      if (access.container.profile_id) profileId = access.container.profile_id;
    }

    if (!Number.isFinite(profileId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    let q = supabase.from('container_inventory').select('*').eq('profile_id', profileId);
    if (containerId) q = q.eq('container_id', Number(containerId));
    const { data, error } = await q.order('product_name');

    if (error) {
      // Table may not exist yet
      return NextResponse.json({
        success: true,
        items: [],
        warning: error.message.includes('does not exist') || error.code === '42P01'
          ? 'Run supabase/migrations/20260709_container_ops.sql in the SQL Editor'
          : error.message,
      });
    }

    return NextResponse.json({ success: true, items: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** POST — upsert/adjust inventory or create product line */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let companyId = Number(body.companyId);
    const containerId = Number(body.containerId);
    const action = body.action || 'upsert'; // upsert | receive | adjust

    if (!Number.isFinite(containerId) || !body.product_name) {
      return NextResponse.json(
        { error: 'containerId and product_name are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    if (body.privyUserId) {
      const access = await assertContractorContainerAccess(
        containerId,
        body.privyUserId,
        body.email
      );
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      if (access.container.profile_id) companyId = access.container.profile_id;
    }

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const qty = Number(body.quantity ?? body.qty_on_hand ?? 0);

    if (action === 'receive' || action === 'adjust') {
      // Find existing line
      const { data: existing } = await supabase
        .from('container_inventory')
        .select('*')
        .eq('container_id', containerId)
        .eq('product_name', body.product_name)
        .maybeSingle();

      if (existing) {
        const nextQty =
          action === 'receive'
            ? Number(existing.qty_on_hand) + qty
            : qty; // adjust sets absolute if body.absolute else add
        const finalQty = body.absolute ? qty : action === 'adjust' && body.delta != null
          ? Number(existing.qty_on_hand) + Number(body.delta)
          : action === 'receive'
            ? nextQty
            : qty;

        const { data, error } = await supabase
          .from('container_inventory')
          .update({
            qty_on_hand: finalQty,
            last_received_at: action === 'receive' ? new Date().toISOString() : existing.last_received_at,
            updated_at: new Date().toISOString(),
            unit: body.unit || existing.unit,
            reorder_level: body.reorder_level ?? existing.reorder_level,
            sku: body.sku ?? existing.sku,
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, item: data });
      }
    }

    const payload = {
      profile_id: companyId,
      container_id: containerId,
      product_name: String(body.product_name).trim(),
      sku: body.sku || null,
      qty_on_hand: qty,
      unit: body.unit || 'unit',
      reorder_level: body.reorder_level != null ? Number(body.reorder_level) : 0,
      unit_cost: body.unit_cost != null ? Number(body.unit_cost) : 0,
      last_received_at: action === 'receive' ? new Date().toISOString() : null,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('container_inventory')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({
        error: error.message,
        hint: error.message.includes('does not exist')
          ? 'Run supabase/migrations/20260709_container_ops.sql in Supabase SQL Editor'
          : undefined,
      }, { status: 500 });
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
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('container_inventory').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
