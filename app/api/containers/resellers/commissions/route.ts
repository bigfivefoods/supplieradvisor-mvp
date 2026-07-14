import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { normalizeCommissionType } from '@/lib/containers/resellers';

/**
 * GET ?companyId=&resellerId= — list commission rates
 * POST — upsert rate
 * DELETE ?companyId=&id=
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const resellerId = request.nextUrl.searchParams.get('resellerId');
    const supabase = getSupabaseServer();
    let q = supabase
      .from('reseller_commission_rates')
      .select('*')
      .eq('profile_id', companyId)
      .order('product_name', { ascending: true });

    // Include company defaults + optional reseller-specific
    if (resellerId) {
      q = q.or(`reseller_id.is.null,reseller_id.eq.${Number(resellerId)}`);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        rates: [],
        warning: error.message,
      });
    }
    return NextResponse.json({ success: true, rates: data || [] });
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
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const productName = String(body.product_name || '').trim();
    if (!productName && !body.product_id) {
      return NextResponse.json(
        { error: 'product_name or product_id required' },
        { status: 400 }
      );
    }

    const row = {
      profile_id: companyId,
      product_id: body.product_id ? Number(body.product_id) : null,
      product_name: productName || null,
      sku: body.sku || null,
      reseller_id: body.reseller_id ? Number(body.reseller_id) : null,
      commission_type: normalizeCommissionType(body.commission_type),
      commission_value: Number(body.commission_value ?? 10),
      currency: body.currency || 'ZAR',
      is_active: body.is_active !== false,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();

    if (body.id) {
      const { data, error } = await supabase
        .from('reseller_commission_rates')
        .update(row)
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, rate: data });
    }

    const { data, error } = await supabase
      .from('reseller_commission_rates')
      .insert({ ...row, created_at: new Date().toISOString() })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run 20260714_container_resellers.sql',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, rate: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('reseller_commission_rates')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
