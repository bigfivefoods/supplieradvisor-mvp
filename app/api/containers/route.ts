import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { normalizeTags } from '@/lib/containers/types';

/** GET /api/containers?companyId= */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    // Fallback: if no profile-scoped rows, return all (legacy) then client can re-save
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = data || [];
    if (rows.length === 0) {
      const { data: legacy } = await supabase
        .from('containers')
        .select('*')
        .is('profile_id', null)
        .order('updated_at', { ascending: false });
      rows = legacy || [];
    }

    return NextResponse.json({ success: true, containers: rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to list containers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/containers — create */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId ?? body.profile_id);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    if (!body.container_code || !body.name) {
      return NextResponse.json({ error: 'container_code and name are required' }, { status: 400 });
    }

    const tags = normalizeTags(body.tags);
    const payload = {
      profile_id: companyId,
      container_code: String(body.container_code).trim(),
      name: String(body.name).trim(),
      type: body.type || 'Retail',
      status: body.status || 'active',
      container_type: body.container_type || '40ft',
      continent: body.continent || null,
      country: body.country || 'South Africa',
      province: body.province || null,
      city: body.city || null,
      address: body.address || null,
      latitude: body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null,
      longitude: body.longitude != null && body.longitude !== '' ? Number(body.longitude) : null,
      deployed_date: body.deployed_date || null,
      purchase_date: body.purchase_date || null,
      cost: body.cost != null && body.cost !== '' ? Number(body.cost) : null,
      assigned_contractor: body.assigned_contractor || null,
      contractor_id: body.contractor_id ? Number(body.contractor_id) : null,
      tags,
      photo_url: body.photo_url || null,
      notes: body.notes || null,
      is_active: body.is_active !== false,
      wifi_portal_url: body.wifi_portal_url || null,
      capacity_units: body.capacity_units != null ? Number(body.capacity_units) : null,
      monthly_target: body.monthly_target != null ? Number(body.monthly_target) : null,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('containers').insert(payload).select('*').single();

    if (error) {
      // Retry without optional columns if schema is thinner
      const minimal = {
        profile_id: companyId,
        container_code: payload.container_code,
        name: payload.name,
        type: payload.type,
        status: payload.status,
        country: payload.country,
        province: payload.province,
        city: payload.city,
        address: payload.address,
        latitude: payload.latitude,
        longitude: payload.longitude,
        notes: payload.notes,
        photo_url: payload.photo_url,
        assigned_contractor: payload.assigned_contractor,
        contractor_id: payload.contractor_id,
      };
      const retry = await supabase.from('containers').insert(minimal).select('*').single();
      if (retry.error) {
        return NextResponse.json({ error: retry.error.message, details: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, container: retry.data });
    }

    return NextResponse.json({ success: true, container: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create container';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
