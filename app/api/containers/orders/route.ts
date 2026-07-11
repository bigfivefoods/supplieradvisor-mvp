import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertContractorContainerAccess } from '@/lib/contractor/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const containerId = request.nextUrl.searchParams.get('containerId');
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const email = request.nextUrl.searchParams.get('email');

    // Contractor portal: verify assignment instead of trusting companyId alone
    if (privyUserId && containerId) {
      const access = await assertContractorContainerAccess(
        Number(containerId),
        privyUserId,
        email
      );
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from('container_orders')
        .select('*')
        .eq('container_id', Number(containerId))
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ success: true, orders: [], warning: error.message });
      }
      return NextResponse.json({ success: true, orders: data || [] });
    }

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    let q = supabase.from('container_orders').select('*').eq('profile_id', companyId);
    if (containerId) q = q.eq('container_id', Number(containerId));
    const { data, error } = await q.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        orders: [],
        warning: error.message,
      });
    }
    return NextResponse.json({ success: true, orders: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let companyId = Number(body.companyId);
    const containerId = Number(body.containerId);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!Number.isFinite(containerId) || items.length === 0) {
      return NextResponse.json(
        { error: 'containerId and items are required' },
        { status: 400 }
      );
    }

    // Contractor-scoped order: must prove assignment
    if (body.privyUserId) {
      const access = await assertContractorContainerAccess(
        containerId,
        body.privyUserId,
        body.email
      );
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      companyId = Number(access.container.profile_id);
    }

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const orderNumber = body.order_number || `CO-${Date.now().toString().slice(-8)}`;
    const status = body.status || 'ordered';

    const { data, error } = await supabase
      .from('container_orders')
      .insert({
        profile_id: companyId,
        container_id: containerId,
        order_number: orderNumber,
        status,
        items,
        notes: body.notes || null,
        ordered_by: body.privyUserId || body.ordered_by || null,
        ordered_at: status === 'ordered' || status === 'received' ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      // Retry without ordered_by if column missing
      if (error.message?.includes('ordered_by')) {
        const { data: retry, error: retryErr } = await supabase
          .from('container_orders')
          .insert({
            profile_id: companyId,
            container_id: containerId,
            order_number: orderNumber,
            status,
            items,
            notes: body.notes || null,
            ordered_at:
              status === 'ordered' || status === 'received' ? new Date().toISOString() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .single();
        if (retryErr) {
          return NextResponse.json(
            {
              error: retryErr.message,
              hint: 'Run supabase/migrations/20260709_container_ops.sql if the table is missing',
            },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, order: retry });
      }
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260709_container_ops.sql if the table is missing',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, order: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** PATCH — update status; when received, bump inventory */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Contractors may mark received only for their containers
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

    const supabase = getSupabaseServer();
    const { data: order, error: fetchErr } = await supabase
      .from('container_orders')
      .select('*')
      .eq('id', Number(body.id))
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: fetchErr?.message || 'Order not found' }, { status: 404 });
    }

    const status = body.status || order.status;
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'received') updates.received_at = new Date().toISOString();
    if (status === 'ordered' && !order.ordered_at) updates.ordered_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('container_orders')
      .update(updates)
      .eq('id', order.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (status === 'received' && order.status !== 'received') {
      const items = (order.items || []) as Array<{
        product_name: string;
        sku?: string;
        quantity: number;
        unit?: string;
      }>;

      for (const item of items) {
        if (!item.product_name) continue;
        const { data: existing } = await supabase
          .from('container_inventory')
          .select('id, qty_on_hand')
          .eq('container_id', order.container_id)
          .eq('product_name', item.product_name)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('container_inventory')
            .update({
              qty_on_hand: Number(existing.qty_on_hand || 0) + Number(item.quantity || 0),
              last_received_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('container_inventory').insert({
            profile_id: order.profile_id,
            container_id: order.container_id,
            product_name: item.product_name,
            sku: item.sku || null,
            qty_on_hand: Number(item.quantity || 0),
            unit: item.unit || 'unit',
            last_received_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
