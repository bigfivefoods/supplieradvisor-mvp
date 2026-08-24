import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { isMissingRelation } from '@/lib/business/company-data';
import {
  mapChainSetup,
  parseProductIds,
} from '@/lib/orders/chain-setup';

async function gate(privyUserId: string | null, companyId: number) {
  if (!privyUserId) {
    return { ok: false as const, error: 'Sign in required', status: 401 };
  }
  const mem = await assertCompanyMember(privyUserId, companyId);
  if (!mem.ok) return { ok: false as const, error: mem.error, status: mem.status };
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const mem = await gate(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('order_chain_setups')
      .select('*')
      .eq('profile_id', companyId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      if (isMissingRelation(error)) {
        return NextResponse.json({
          success: true,
          setups: [],
          warning:
            'Run RUN_THIS_FOR_ORDER_CHAINS.sql in the Supabase SQL editor so chain setups can save.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      setups: (data || []).map(mapChainSetup).filter(Boolean),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    const privyUserId = body.privyUserId != null ? String(body.privyUserId) : null;
    const mem = await gate(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    const customerId = Number(body.customer_id);
    const srmId = Number(body.srm_supplier_id);
    const productIds = parseProductIds(body.product_ids);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      return NextResponse.json({ error: 'Select a customer' }, { status: 400 });
    }
    if (!Number.isFinite(srmId) || srmId <= 0) {
      return NextResponse.json({ error: 'Select a supplier' }, { status: 400 });
    }
    if (!productIds.length) {
      return NextResponse.json(
        { error: 'Select at least one product for this chain' },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const row = {
      profile_id: companyId,
      name: body.name != null ? String(body.name).slice(0, 160) : null,
      customer_id: customerId,
      customer_name:
        body.customer_name != null ? String(body.customer_name).slice(0, 160) : null,
      srm_supplier_id: srmId,
      supplier_name:
        body.supplier_name != null ? String(body.supplier_name).slice(0, 160) : null,
      product_ids: productIds,
      status: 'active',
      created_by: privyUserId,
      created_at: now,
      updated_at: now,
    };
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('order_chain_setups')
      .insert(row)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelation(error)) {
        return NextResponse.json(
          {
            error:
              'Chain setups are not on this database yet. Run RUN_THIS_FOR_ORDER_CHAINS.sql in Supabase.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { success: true, setup: mapChainSetup(data) },
      { status: 201 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId != null ? String(body.privyUserId) : null;
    const mem = await gate(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.customer_id !== undefined) {
      const n = Number(body.customer_id);
      updates.customer_id = Number.isFinite(n) && n > 0 ? n : null;
    }
    if (body.customer_name !== undefined) {
      updates.customer_name = body.customer_name
        ? String(body.customer_name).slice(0, 160)
        : null;
    }
    if (body.srm_supplier_id !== undefined) {
      const n = Number(body.srm_supplier_id);
      updates.srm_supplier_id = Number.isFinite(n) && n > 0 ? n : null;
    }
    if (body.supplier_name !== undefined) {
      updates.supplier_name = body.supplier_name
        ? String(body.supplier_name).slice(0, 160)
        : null;
    }
    if (body.product_ids !== undefined) {
      updates.product_ids = parseProductIds(body.product_ids);
    }
    if (body.name !== undefined) {
      updates.name = body.name ? String(body.name).slice(0, 160) : null;
    }
    if (body.status !== undefined) {
      updates.status = String(body.status);
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('order_chain_setups')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, setup: mapChainSetup(data) });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = Number(sp.get('id'));
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    const mem = await gate(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('order_chain_setups')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
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
