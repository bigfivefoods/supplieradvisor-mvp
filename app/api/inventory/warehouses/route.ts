import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

const OWNER_TYPES = new Set(['own', 'supplier', 'customer']);

function normalizeOwnerType(v: unknown): string {
  const s = String(v || 'own').toLowerCase();
  return OWNER_TYPES.has(s) ? s : 'own';
}

function defaultWarehouseType(ownerType: string, explicit?: string | null) {
  if (explicit) return String(explicit);
  if (ownerType === 'supplier') return 'supplier_dc';
  if (ownerType === 'customer') return 'customer_site';
  return 'warehouse';
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const ownerType = request.nextUrl.searchParams.get('ownerType');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let q = supabase.from('warehouses').select('*').eq('profile_id', companyId).order('name');
    if (ownerType && ownerType !== 'all') q = q.eq('owner_type', ownerType);

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({
        success: true,
        warehouses: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_inventory_world_class.sql and 20260709_warehouses_and_transfer_orders.sql',
      });
    }

    const { data: levels } = await supabase
      .from('stock_levels')
      .select('warehouse_id, qty_on_hand')
      .eq('profile_id', companyId);

    const stats: Record<number, { lines: number; units: number }> = {};
    for (const l of levels || []) {
      const wid = Number(l.warehouse_id) || 0;
      if (!stats[wid]) stats[wid] = { lines: 0, units: 0 };
      stats[wid].lines += 1;
      stats[wid].units += Number(l.qty_on_hand || 0);
    }

    const { data: containers } = await supabase
      .from('containers')
      .select('id, name, container_code, city, status, address')
      .eq('profile_id', companyId)
      .order('name');

    const warehouses = (data || []).map((w) => ({
      ...w,
      owner_type: w.owner_type || 'own',
      stock_lines: stats[w.id]?.lines || 0,
      units_on_hand: stats[w.id]?.units || 0,
    }));

    const counts = {
      own: warehouses.filter((w) => (w.owner_type || 'own') === 'own').length,
      supplier: warehouses.filter((w) => w.owner_type === 'supplier').length,
      customer: warehouses.filter((w) => w.owner_type === 'customer').length,
      total: warehouses.length,
    };

    return NextResponse.json({
      success: true,
      warehouses,
      containers: containers || [],
      counts,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.name) {
      return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const ownerType = normalizeOwnerType(body.owner_type);
    const supabase = getSupabaseServer();

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      name: String(body.name).trim(),
      code: body.code ? String(body.code).trim() : null,
      warehouse_type: defaultWarehouseType(ownerType, body.warehouse_type),
      owner_type: ownerType,
      partner_name: body.partner_name ? String(body.partner_name).trim() : null,
      partner_ref: body.partner_ref ? String(body.partner_ref).trim() : null,
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      notes: body.notes || null,
      allow_stock: body.allow_stock !== false,
      status: body.status || 'active',
      address: body.address || null,
      city: body.city || null,
      country: body.country || null,
      postal_code: body.postal_code || null,
      region: body.region || null,
      lat: body.lat != null && body.lat !== '' ? Number(body.lat) : null,
      lng: body.lng != null && body.lng !== '' ? Number(body.lng) : null,
      container_id: body.container_id || null,
      is_default: !!body.is_default,
      updated_at: new Date().toISOString(),
    };

    // Supplier/customer locations should have a partner name for clarity
    if ((ownerType === 'supplier' || ownerType === 'customer') && !payload.partner_name) {
      payload.partner_name = payload.name;
    }

    let { data, error } = await supabase.from('warehouses').insert(payload).select('*').single();

    // Soft-retry without newer columns if schema not migrated yet
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const soft = { ...payload };
      for (const k of [
        'owner_type',
        'partner_name',
        'partner_ref',
        'contact_name',
        'contact_email',
        'contact_phone',
        'notes',
        'allow_stock',
        'postal_code',
        'region',
        'lat',
        'lng',
      ]) {
        delete soft[k];
      }
      const retry = await supabase.from('warehouses').insert(soft).select('*').single();
      data = retry.data;
      error = retry.error;
      if (!error && data) {
        return NextResponse.json({
          success: true,
          warehouse: data,
          warning:
            'Saved without GPS/partner fields — run 20260709_transfer_physical_endpoints.sql and warehouses migrations',
        });
      }
    }

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run inventory + warehouses_and_transfer_orders migrations',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, warehouse: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = [
      'name',
      'code',
      'warehouse_type',
      'owner_type',
      'partner_name',
      'partner_ref',
      'contact_name',
      'contact_email',
      'contact_phone',
      'notes',
      'allow_stock',
      'status',
      'address',
      'city',
      'country',
      'postal_code',
      'region',
      'lat',
      'lng',
      'container_id',
      'is_default',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (updates.owner_type !== undefined) {
      updates.owner_type = normalizeOwnerType(updates.owner_type);
    }
    const supabase = getSupabaseServer();
    let { data, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const soft = { ...updates };
      for (const k of [
        'owner_type',
        'partner_name',
        'partner_ref',
        'contact_name',
        'contact_email',
        'contact_phone',
        'notes',
        'allow_stock',
        'postal_code',
        'region',
      ]) {
        delete soft[k];
      }
      const retry = await supabase
        .from('warehouses')
        .update(soft)
        .eq('id', Number(body.id))
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, warehouse: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();

    // Soft-block delete if stock remains
    const { data: levels } = await supabase
      .from('stock_levels')
      .select('id, qty_on_hand')
      .eq('warehouse_id', id)
      .limit(50);
    const units = (levels || []).reduce((s, l) => s + Number(l.qty_on_hand || 0), 0);
    if (units > 0.0001) {
      return NextResponse.json(
        {
          error: `Cannot delete: ${units} units still on hand. Transfer or zero stock first.`,
        },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('warehouses').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
