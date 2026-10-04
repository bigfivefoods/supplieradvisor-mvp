import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import type { OrderType } from '@/lib/orders/order-links';

/**
 * GET  /api/orders/batches?companyId=&orderId=&orderType=
 * POST /api/orders/batches
 *   Body: { companyId, privyUserId, orderId, orderType?, batches: [{ batch_number, qty, ... }] }
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = Number(searchParams.get('companyId'));
    const orderId = Number(searchParams.get('orderId'));
    const orderType = (searchParams.get('orderType') || 'purchase_order') as OrderType;

    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'companyId and orderId required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(req, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(req),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('order_batches')
      .select('*')
      .eq('company_id', companyId)
      .eq('order_id', orderId)
      .eq('order_type', orderType)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ batches: data || [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const orderId = Number(body.orderId);
    const orderType = (body.orderType || 'purchase_order') as OrderType;
    const batchesIn = Array.isArray(body.batches) ? body.batches : [];

    if (
      !Number.isFinite(companyId) ||
      companyId <= 0 ||
      !Number.isFinite(orderId) ||
      orderId <= 0
    ) {
      return NextResponse.json(
        { error: 'companyId and orderId required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(req, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(req, body),
    });
    if (!gate.ok) return gate.response;

    if (!batchesIn.length) {
      return NextResponse.json({ error: 'batches[] required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const rows = [];
    for (const b of batchesIn) {
      if (!b?.batch_number) continue;
      rows.push({
        company_id: companyId,
        order_id: orderId,
        order_type: orderType,
        order_line_index:
          b.order_line_index != null ? Number(b.order_line_index) : null,
        batch_number: String(b.batch_number).trim(),
        qty: Number(b.qty) || 0,
        uom: b.uom || 'ea',
        produced_at: b.produced_at || null,
        manufacturer_profile_id: b.manufacturer_profile_id
          ? Number(b.manufacturer_profile_id)
          : null,
        notes: b.notes || null,
        created_by: gate.userId,
      });
    }

    if (!rows.length) {
      return NextResponse.json(
        { error: 'No valid batch rows (batch_number required)' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('order_batches')
      .insert(rows)
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ batches: data || [], created: data?.length || 0 }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
