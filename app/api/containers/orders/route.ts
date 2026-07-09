import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const containerId = request.nextUrl.searchParams.get('containerId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

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
    const companyId = Number(body.companyId);
    const containerId = Number(body.containerId);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!Number.isFinite(companyId) || !Number.isFinite(containerId) || items.length === 0) {
      return NextResponse.json(
        { error: 'companyId, containerId, and items are required' },
        { status: 400 }
      );
    }

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
        ordered_at: status === 'ordered' || status === 'received' ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({
        error: error.message,
        hint: 'Run supabase/migrations/20260709_container_ops.sql if the table is missing',
      }, { status: 500 });
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

    // Receive into inventory
    if (status === 'received' && order.status !== 'received') {
      const items = (order.items || []) as Array<{
        product_name: string;
        sku?: string;
        quantity: number;
        unit?: string;
      }>;

      for (const item of items) {
        if (!item.product_name || !item.quantity) continue;
        await fetch(new URL('/api/containers/inventory', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: order.profile_id,
            containerId: order.container_id,
            action: 'receive',
            product_name: item.product_name,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit || 'unit',
          }),
        }).catch(() => null);

        // Direct inventory update if internal fetch fails
        const { data: existing } = await supabase
          .from('container_inventory')
          .select('*')
          .eq('container_id', order.container_id)
          .eq('product_name', item.product_name)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('container_inventory')
            .update({
              qty_on_hand: Number(existing.qty_on_hand) + Number(item.quantity),
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
            qty_on_hand: Number(item.quantity),
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
