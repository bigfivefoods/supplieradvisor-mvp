import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import type { LinkType, OrderType } from '@/lib/orders/order-links';

/**
 * GET  /api/orders/links?companyId=&orderId=&orderType=
 *   List active links for an order (as source or target).
 *
 * POST /api/orders/links
 *   Body: { companyId, privyUserId, sourceOrderId, targetOrderId,
 *           sourceOrderType?, targetOrderType?, linkType?, notes? }
 *   Create an active fulfillment link (idempotent on active pair).
 *
 * DELETE /api/orders/links
 *   Body: { companyId, privyUserId, linkId }
 *   Soft-unlink (status → unlinked) with audit fields.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = Number(searchParams.get('companyId'));
    const orderId = Number(searchParams.get('orderId'));
    const orderType = (searchParams.get('orderType') || 'sales_order') as OrderType;
    const privyUserId = searchParams.get('privyUserId');

    if (!companyId || !orderId) {
      return NextResponse.json(
        { error: 'companyId and orderId are required' },
        { status: 400 }
      );
    }

    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        return NextResponse.json({ error: mem.error }, { status: mem.status });
      }
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('order_links')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .or(
        `and(source_order_id.eq.${orderId},source_order_type.eq.${orderType}),and(target_order_id.eq.${orderId},target_order_type.eq.${orderType})`
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[orders/links GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ links: data || [] });
  } catch (e: any) {
    console.error('[orders/links GET]', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const sourceOrderId = Number(body.sourceOrderId);
    const targetOrderId = Number(body.targetOrderId);
    const sourceOrderType = (body.sourceOrderType || 'sales_order') as OrderType;
    const targetOrderType = (body.targetOrderType || 'purchase_order') as OrderType;
    const linkType = (body.linkType || 'fulfillment') as LinkType;
    const notes = body.notes ? String(body.notes) : null;
    const privyUserId = body.privyUserId as string | undefined;

    if (!companyId || !sourceOrderId || !targetOrderId) {
      return NextResponse.json(
        { error: 'companyId, sourceOrderId and targetOrderId are required' },
        { status: 400 }
      );
    }

    if (sourceOrderId === targetOrderId && sourceOrderType === targetOrderType) {
      return NextResponse.json(
        { error: 'Cannot link an order to itself' },
        { status: 400 }
      );
    }

    if (!privyUserId) {
      return NextResponse.json({ error: 'privyUserId required' }, { status: 400 });
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    // Idempotent: if active link already exists, return it
    const { data: existing } = await supabase
      .from('order_links')
      .select('*')
      .eq('company_id', companyId)
      .eq('source_order_id', sourceOrderId)
      .eq('target_order_id', targetOrderId)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ link: existing, created: false });
    }

    const { data, error } = await supabase
      .from('order_links')
      .insert({
        company_id: companyId,
        source_order_id: sourceOrderId,
        source_order_type: sourceOrderType,
        target_order_id: targetOrderId,
        target_order_type: targetOrderType,
        link_type: linkType,
        status: 'active',
        notes,
        created_by: privyUserId,
        metadata: {},
      })
      .select('*')
      .single();

    if (error) {
      console.error('[orders/links POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Best-effort activity log
    try {
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        action: 'order.link.created',
        entity_type: 'order_link',
        entity_id: String(data.id),
        actor_id: privyUserId,
        metadata: {
          source_order_id: sourceOrderId,
          target_order_id: targetOrderId,
          link_type: linkType,
        },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ link: data, created: true }, { status: 201 });
  } catch (e: any) {
    console.error('[orders/links POST]', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const linkId = Number(body.linkId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!companyId || !linkId || !privyUserId) {
      return NextResponse.json(
        { error: 'companyId, linkId and privyUserId are required' },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('order_links')
      .update({
        status: 'unlinked',
        unlinked_by: privyUserId,
        unlinked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', linkId)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[orders/links DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Active link not found' }, { status: 404 });
    }

    try {
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        action: 'order.link.unlinked',
        entity_type: 'order_link',
        entity_id: String(linkId),
        actor_id: privyUserId,
        metadata: {
          source_order_id: data.source_order_id,
          target_order_id: data.target_order_id,
        },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ link: data, unlinked: true });
  } catch (e: any) {
    console.error('[orders/links DELETE]', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
