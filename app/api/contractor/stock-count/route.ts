import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { assertContractorContainerAccess } from '@/lib/contractor/access';

/**
 * POST stock count — records count + optionally adjusts inventory to counted qty
 * Body: { privyUserId, email?, containerId, lines: [...], notes?, applyAdjustments? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = getCanonicalUserId(body.privyUserId);
    const containerId = Number(body.containerId);
    const email = body.email ? String(body.email).toLowerCase() : null;
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (!userId || !Number.isFinite(containerId) || lines.length === 0) {
      return NextResponse.json(
        { error: 'privyUserId, containerId, and lines required' },
        { status: 400 }
      );
    }

    const access = await assertContractorContainerAccess(containerId, body.privyUserId, email);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = getSupabaseServer();
    const { data: count, error } = await supabase
      .from('container_stock_counts')
      .insert({
        profile_id: access.container.profile_id,
        container_id: containerId,
        contractor_id: access.contractor.id,
        user_id: userId,
        lines,
        notes: body.notes || null,
        counted_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run 20260709_contractor_portal.sql if stock counts table is missing',
        },
        { status: 500 }
      );
    }

    if (body.applyAdjustments) {
      for (const line of lines) {
        if (!line.product_name || line.counted_qty == null) continue;
        const counted = Number(line.counted_qty);
        if (line.inventory_id) {
          await supabase
            .from('container_inventory')
            .update({
              qty_on_hand: counted,
              updated_at: new Date().toISOString(),
            })
            .eq('id', line.inventory_id)
            .eq('container_id', containerId);
        } else {
          const { data: existing } = await supabase
            .from('container_inventory')
            .select('id')
            .eq('container_id', containerId)
            .eq('product_name', line.product_name)
            .maybeSingle();
          if (existing) {
            await supabase
              .from('container_inventory')
              .update({ qty_on_hand: counted, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
