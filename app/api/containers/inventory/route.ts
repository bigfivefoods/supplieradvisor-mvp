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

    const productId =
      body.product_id != null && Number.isFinite(Number(body.product_id))
        ? Number(body.product_id)
        : null;

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

    // Resolve product from central inventory catalogue when product_id given
    let productName = body.product_name ? String(body.product_name).trim() : '';
    let sku = body.sku != null ? String(body.sku) : null;
    let unit = body.unit || 'unit';
    let reorderLevel =
      body.reorder_level != null ? Number(body.reorder_level) : 0;
    let unitCost = body.unit_cost != null ? Number(body.unit_cost) : 0;

    if (productId) {
      const { data: prod } = await supabase
        .from('products')
        .select(
          'id, name, sku, uom, reorder_level, cost_price, product_type, profile_id, status'
        )
        .eq('id', productId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (prod) {
        productName = productName || String(prod.name || '').trim();
        sku = sku || (prod.sku != null ? String(prod.sku) : null);
        unit = body.unit || prod.uom || unit || 'unit';
        if (body.reorder_level == null && prod.reorder_level != null) {
          reorderLevel = Number(prod.reorder_level) || 0;
        }
        if (body.unit_cost == null && prod.cost_price != null) {
          unitCost = Number(prod.cost_price) || 0;
        }
      }
    }

    if (!productName) {
      return NextResponse.json(
        { error: 'Select a product from inventory or enter a product name' },
        { status: 400 }
      );
    }

    const qty = Number(body.quantity ?? body.qty_on_hand ?? 0);

    // Match existing line by product_id first, then product_name
    let existing: Record<string, unknown> | null = null;
    if (productId) {
      const byId = await supabase
        .from('container_inventory')
        .select('*')
        .eq('container_id', containerId)
        .eq('product_id', productId)
        .maybeSingle();
      if (!byId.error && byId.data) existing = byId.data as Record<string, unknown>;
    }
    if (!existing) {
      const byName = await supabase
        .from('container_inventory')
        .select('*')
        .eq('container_id', containerId)
        .eq('product_name', productName)
        .maybeSingle();
      if (!byName.error && byName.data) existing = byName.data as Record<string, unknown>;
    }

    if (action === 'receive' || action === 'adjust' || existing) {
      if (existing) {
        const nextQty =
          action === 'receive'
            ? Number(existing.qty_on_hand) + qty
            : qty;
        const finalQty =
          body.absolute
            ? qty
            : action === 'adjust' && body.delta != null
              ? Number(existing.qty_on_hand) + Number(body.delta)
              : action === 'receive'
                ? nextQty
                : qty;

        const updatePayload: Record<string, unknown> = {
          qty_on_hand: finalQty,
          last_received_at:
            action === 'receive'
              ? new Date().toISOString()
              : existing.last_received_at,
          updated_at: new Date().toISOString(),
          unit: unit || existing.unit,
          reorder_level:
            body.reorder_level != null
              ? reorderLevel
              : existing.reorder_level,
          sku: sku ?? existing.sku,
          product_name: productName,
        };
        if (productId) updatePayload.product_id = productId;
        if (body.unit_cost != null || unitCost) {
          updatePayload.unit_cost = unitCost || existing.unit_cost;
        }

        let { data, error } = await supabase
          .from('container_inventory')
          .update(updatePayload)
          .eq('id', existing.id)
          .select('*')
          .single();

        if (error && /product_id|column/i.test(error.message)) {
          delete updatePayload.product_id;
          const retry = await supabase
            .from('container_inventory')
            .update(updatePayload)
            .eq('id', existing.id)
            .select('*')
            .single();
          data = retry.data;
          error = retry.error;
        }

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, item: data });
      }
    }

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      container_id: containerId,
      product_name: productName,
      sku: sku || null,
      qty_on_hand: qty,
      unit: unit || 'unit',
      reorder_level: reorderLevel,
      unit_cost: unitCost,
      last_received_at: action === 'receive' ? new Date().toISOString() : null,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };
    if (productId) payload.product_id = productId;

    let { data, error } = await supabase
      .from('container_inventory')
      .insert(payload)
      .select('*')
      .single();

    if (error && /product_id|column/i.test(error.message)) {
      delete payload.product_id;
      const retry = await supabase
        .from('container_inventory')
        .insert(payload)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

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
