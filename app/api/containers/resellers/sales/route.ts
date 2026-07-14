import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
  requireVerifiedUser,
} from '@/lib/auth/api-auth';
import {
  computeSaleLines,
  pickCommissionRate,
  saleNumber,
  type SaleLineInput,
} from '@/lib/containers/resellers';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';

/**
 * GET ?companyId=&resellerId= — list sales (company)
 * POST — create sale (company on behalf of reseller OR reseller portal)
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
      .from('reseller_sales')
      .select('*')
      .eq('profile_id', companyId)
      .order('sale_date', { ascending: false })
      .limit(200);
    if (resellerId) q = q.eq('reseller_id', Number(resellerId));

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        sales: [],
        warning: error.message,
      });
    }
    return NextResponse.json({ success: true, sales: data || [] });
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
    const resellerId = Number(body.resellerId);
    const lines = (Array.isArray(body.lines) ? body.lines : []) as SaleLineInput[];

    if (!Number.isFinite(resellerId) || !lines.length) {
      return NextResponse.json(
        { error: 'resellerId and lines required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: reseller } = await supabase
      .from('container_resellers')
      .select('*')
      .eq('id', resellerId)
      .maybeSingle();

    if (!reseller) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }

    const profileId = Number(reseller.profile_id);
    const resolvedCompanyId = Number.isFinite(companyId)
      ? companyId
      : profileId;

    // Auth: company staff OR the reseller themselves
    let actor = 'system';
    if (body.portal === true || body.asReseller) {
      const auth = await requireVerifiedUser(request, {
        legacyPrivyUserId: body.privyUserId,
      });
      if (!auth.ok) return auth.response;
      const uid = getCanonicalUserId(auth.userId || body.privyUserId) || '';
      const variants = userIdMatchVariants(uid);
      const email = body.email
        ? String(body.email).toLowerCase().trim()
        : null;
      const okUser =
        reseller.user_id && variants.includes(String(reseller.user_id));
      const okEmail =
        email &&
        reseller.email &&
        String(reseller.email).toLowerCase() === email;
      if (!okUser && !okEmail) {
        return NextResponse.json(
          { error: 'Not authorised as this reseller' },
          { status: 403 }
        );
      }
      actor = uid || email || 'reseller';
    } else {
      const gate = await requireCompanyAccess(request, resolvedCompanyId, {
        legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
      });
      if (!gate.ok) return gate.response;
      actor = gate.userId;
    }

    const vStatus = String(reseller.verification_status || '').toLowerCase();
    if (vStatus !== 'verified' && vStatus !== 'mismatch') {
      return NextResponse.json(
        { error: 'Reseller must be verified before selling' },
        { status: 403 }
      );
    }

    // Load commission rates + inventory
    const [{ data: rates }, { data: invRows }] = await Promise.all([
      supabase
        .from('reseller_commission_rates')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true),
      supabase
        .from('reseller_inventory')
        .select('*')
        .eq('profile_id', profileId)
        .eq('reseller_id', resellerId),
    ]);

    const invList = invRows || [];
    const rateList = rates || [];

    // Validate stock + fill prices from inventory if missing
    const prepared: SaleLineInput[] = [];
    for (const line of lines) {
      const name = String(line.product_name || '').trim();
      const qty = Number(line.quantity);
      if (!name || !(qty > 0)) continue;

      const stock = invList.find(
        (i) =>
          (line.product_id && Number(i.product_id) === Number(line.product_id)) ||
          String(i.product_name || '').toLowerCase() === name.toLowerCase()
      );
      if (!stock) {
        return NextResponse.json(
          { error: `No inventory for "${name}"` },
          { status: 400 }
        );
      }
      if (Number(stock.qty_on_hand || 0) < qty) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${name} (have ${stock.qty_on_hand})`,
          },
          { status: 400 }
        );
      }

      prepared.push({
        product_id: stock.product_id ?? line.product_id ?? null,
        product_name: stock.product_name || name,
        sku: stock.sku || line.sku || null,
        quantity: qty,
        unit_price:
          line.unit_price != null && Number(line.unit_price) > 0
            ? Number(line.unit_price)
            : Number(stock.unit_sell_price || stock.unit_cost || 0),
        unit: stock.unit || line.unit || 'unit',
        commission_type: line.commission_type,
        commission_value: line.commission_value,
      });
    }

    if (!prepared.length) {
      return NextResponse.json({ error: 'No valid sale lines' }, { status: 400 });
    }

    const computed = computeSaleLines(prepared, (line) =>
      pickCommissionRate(rateList, line, resellerId)
    );

    const now = new Date().toISOString();

    // Decrement inventory
    for (const item of computed.items) {
      const stock = invList.find(
        (i) =>
          (item.product_id && Number(i.product_id) === Number(item.product_id)) ||
          String(i.product_name || '').toLowerCase() ===
            item.product_name.toLowerCase()
      );
      if (!stock) continue;
      await supabase
        .from('reseller_inventory')
        .update({
          qty_on_hand: Number(stock.qty_on_hand || 0) - item.quantity,
          updated_at: now,
        })
        .eq('id', stock.id);
    }

    const { data: sale, error } = await supabase
      .from('reseller_sales')
      .insert({
        profile_id: profileId,
        reseller_id: resellerId,
        container_id:
          reseller.primary_container_id ||
          invList[0]?.container_id ||
          null,
        sale_number: saleNumber(),
        sale_date: body.sale_date || now.slice(0, 10),
        currency: 'ZAR',
        subtotal: computed.subtotal,
        total_amount: computed.total_amount,
        commission_total: computed.commission_total,
        payment_method: body.payment_method || 'cash',
        notes: body.notes || null,
        items: computed.items,
        created_by: actor,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sale,
      message: `Sale recorded · commission R${computed.commission_total}`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
