import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('profile_id', companyId)
      .order('name');

    if (error) {
      return NextResponse.json({ success: true, carriers: [], warning: error.message });
    }

    // shipment counts
    const { data: ships } = await supabase
      .from('shipments')
      .select('carrier_id, status')
      .eq('profile_id', companyId);

    const counts: Record<number, { total: number; active: number }> = {};
    for (const s of ships || []) {
      if (!s.carrier_id) continue;
      if (!counts[s.carrier_id]) counts[s.carrier_id] = { total: 0, active: 0 };
      counts[s.carrier_id].total++;
      if (
        !['delivered', 'cancelled'].includes(s.status) &&
        s.status !== 'planned'
      ) {
        counts[s.carrier_id].active++;
      }
    }

    return NextResponse.json({
      success: true,
      carriers: (data || []).map((c) => ({
        ...c,
        shipment_total: counts[c.id]?.total || 0,
        shipment_active: counts[c.id]?.active || 0,
      })),
    });
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
    if (!Number.isFinite(companyId) || !body.name) {
      return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      name: String(body.name).trim(),
      code: body.code ? String(body.code).trim().toUpperCase() : null,
      carrier_type: body.carrier_type || '3pl',
      modes: Array.isArray(body.modes) ? body.modes : body.mode ? [body.mode] : ['road'],
      service_level: body.service_level || 'standard',
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      scac_code: body.scac_code || null,
      coverage_regions: body.coverage_regions || null,
      website: body.website || null,
      notes: body.notes || null,
      is_active: body.is_active !== false,
      status: body.status || 'active',
      rating: body.rating != null ? Number(body.rating) : null,
      otif_pct: body.otif_pct != null ? Number(body.otif_pct) : null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('carriers').insert(payload).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, carrier: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'name',
      'code',
      'carrier_type',
      'modes',
      'service_level',
      'contact_email',
      'contact_phone',
      'scac_code',
      'coverage_regions',
      'website',
      'notes',
      'is_active',
      'status',
      'rating',
      'otif_pct',
      'avg_transit_days',
    ]) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const { data, error } = await supabase
      .from('carriers')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, carrier: data });
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
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('carriers')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
