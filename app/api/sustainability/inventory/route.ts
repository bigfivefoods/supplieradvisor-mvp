import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  MIGRATION_HINT,
  computeKgFromActivity,
  GHG_SCOPES,
  categoryLabel,
} from '@/lib/sustainability/types';
import {
  estimateShipmentCo2e,
  formatCo2e,
} from '@/lib/sustainability/carbon';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const scopeFilter = sp.get('scope');
    const supabase = getSupabaseServer();

    let q = supabase
      .from('esg_emissions')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (scopeFilter && ['1', '2', '3'].includes(scopeFilter)) {
      q = q.eq('scope', scopeFilter);
    }

    const { data, error } = await q;

    // Soft fallback: empty if table missing
    let entries = data || [];
    let warning: string | null = null;
    if (error) {
      warning = error.message;
      entries = [];
    }

    // Logistics estimate (Scope 3 transport) from shipments
    let logisticsKg = 0;
    let logisticsCount = 0;
    const { data: ships } = await supabase
      .from('shipments')
      .select(
        'mode, distance_km, weight_tonnes, weight_kg, origin_lat, origin_lng, dest_lat, dest_lng, destination_lat, destination_lng'
      )
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    for (const s of ships || []) {
      const est = estimateShipmentCo2e({
        mode: s.mode,
        distanceKm: s.distance_km != null ? Number(s.distance_km) : null,
        weightTonnes:
          s.weight_tonnes != null
            ? Number(s.weight_tonnes)
            : s.weight_kg != null
              ? Number(s.weight_kg) / 1000
              : null,
        originLat: s.origin_lat != null ? Number(s.origin_lat) : null,
        originLng: s.origin_lng != null ? Number(s.origin_lng) : null,
        destLat:
          s.dest_lat != null
            ? Number(s.dest_lat)
            : s.destination_lat != null
              ? Number(s.destination_lat)
              : null,
        destLng:
          s.dest_lng != null
            ? Number(s.dest_lng)
            : s.destination_lng != null
              ? Number(s.destination_lng)
              : null,
      });
      logisticsKg += est.kgCo2e;
      logisticsCount += 1;
    }

    const byScope: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    const byCategory: Record<string, number> = {};
    for (const e of entries) {
      const sc = String(e.scope || '3');
      const kg = Number(e.amount_kgco2e) || 0;
      byScope[sc] = (byScope[sc] || 0) + kg;
      const cat = String(e.category || 'other');
      byCategory[cat] = (byCategory[cat] || 0) + kg;
    }
    // Include logistics in scope 3 summary (not double-counted as inventory rows)
    const totalInventory = Object.values(byScope).reduce((a, b) => a + b, 0);
    const totalWithLogistics = totalInventory + logisticsKg;

    return NextResponse.json({
      success: true,
      entries: entries.map((e) => ({
        ...e,
        category_label: categoryLabel(String(e.category || '')),
      })),
      summary: {
        by_scope: byScope,
        by_category: byCategory,
        total_kg: Math.round(totalInventory * 100) / 100,
        total_label: formatCo2e(totalInventory),
        logistics_kg: Math.round(logisticsKg * 100) / 100,
        logistics_label: formatCo2e(logisticsKg),
        logistics_shipments: logisticsCount,
        combined_kg: Math.round(totalWithLogistics * 100) / 100,
        combined_label: formatCo2e(totalWithLogistics),
        entry_count: entries.length,
      },
      scopes: GHG_SCOPES,
      warning,
      hint: warning ? MIGRATION_HINT : undefined,
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!String(body.category || '').trim()) {
      return NextResponse.json({ error: 'category required' }, { status: 400 });
    }

    const scope = ['1', '2', '3'].includes(String(body.scope))
      ? String(body.scope)
      : '3';
    let amount =
      body.amount_kgco2e != null ? Number(body.amount_kgco2e) : null;
    if (amount == null || !Number.isFinite(amount)) {
      amount =
        computeKgFromActivity(body.activity_amount, body.emission_factor) ?? 0;
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_emissions')
      .insert({
        profile_id: companyId,
        scope,
        category: String(body.category).trim(),
        activity_label: body.activity_label || null,
        activity_amount:
          body.activity_amount != null ? Number(body.activity_amount) : null,
        activity_unit: body.activity_unit || null,
        emission_factor:
          body.emission_factor != null ? Number(body.emission_factor) : null,
        factor_unit: body.factor_unit || null,
        factor_source: body.factor_source || null,
        amount_kgco2e: amount,
        period_start: body.period_start || null,
        period_end: body.period_end || null,
        facility_name: body.facility_name || null,
        country: body.country || null,
        is_estimate: body.is_estimate !== false,
        data_quality: body.data_quality || 'estimated',
        notes: body.notes || null,
        source_ref: body.source_ref || null,
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: MIGRATION_HINT },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, entry: data }, { status: 201 });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'scope',
      'category',
      'activity_label',
      'activity_amount',
      'activity_unit',
      'emission_factor',
      'factor_unit',
      'factor_source',
      'amount_kgco2e',
      'period_start',
      'period_end',
      'facility_name',
      'country',
      'is_estimate',
      'data_quality',
      'notes',
      'source_ref',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    // Recompute if activity + factor provided without explicit kg
    if (
      body.amount_kgco2e === undefined &&
      (body.activity_amount !== undefined || body.emission_factor !== undefined)
    ) {
      const computed = computeKgFromActivity(
        body.activity_amount,
        body.emission_factor
      );
      if (computed != null) updates.amount_kgco2e = computed;
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_emissions')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, entry: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('esg_emissions')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
