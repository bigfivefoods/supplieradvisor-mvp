import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/suppliers/access';
import { computeTrustScore } from '@/lib/suppliers/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId= — aggregate ratings from po_reviews for suppliers linked to buyer
 * POST — submit a standalone supplier rating (stored as po_reviews without PO if allowed,
 *        or metadata note on srm_suppliers when no PO). Prefer po_reviews when PO provided.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();

    // Reviews where we are reviewer (buyer rating supplier) or reviewee
    const { data: reviews, error } = await supabase
      .from('po_reviews')
      .select('*')
      .or(`reviewer_profile_id.eq.${companyId},reviewee_profile_id.eq.${companyId}`)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      return NextResponse.json({
        success: true,
        reviews: [],
        bySupplier: [],
        warning: error.message,
        hint: 'Run 20260709_po_reviews.sql',
      });
    }

    const list = reviews || [];
    // Aggregate ratings we gave to suppliers (reviewer = us)
    const given = list.filter((r) => Number(r.reviewer_profile_id) === companyId);
    const map = new Map<
      number,
      { supplier_profile_id: number; count: number; sum: number; dims: Record<string, number[]> }
    >();

    for (const r of given) {
      const sid = Number(r.reviewee_profile_id);
      if (!Number.isFinite(sid)) continue;
      if (!map.has(sid)) {
        map.set(sid, {
          supplier_profile_id: sid,
          count: 0,
          sum: 0,
          dims: { quality: [], delivery: [], communication: [], value: [] },
        });
      }
      const m = map.get(sid)!;
      m.count += 1;
      const overall = Number(r.overall_rating ?? r.rating ?? 0);
      m.sum += overall;
      for (const d of ['quality', 'delivery', 'communication', 'value'] as const) {
        const key = `${d}_rating`;
        if (r[key] != null) m.dims[d].push(Number(r[key]));
      }
    }

    const ids = [...map.keys()];
    const nameMap: Record<number, string> = {};
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, trading_name')
        .in('id', ids);
      for (const p of profiles || []) nameMap[Number(p.id)] = p.trading_name || 'Supplier';
    }

    const bySupplier = Array.from(map.values()).map((m) => {
      const avg = m.count ? m.sum / m.count : 0;
      const dimAvg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      return {
        supplier_profile_id: m.supplier_profile_id,
        name: nameMap[m.supplier_profile_id] || 'Supplier',
        rating_avg: Math.round(avg * 10) / 10,
        rating_count: m.count,
        quality: dimAvg(m.dims.quality),
        delivery: dimAvg(m.dims.delivery),
        communication: dimAvg(m.dims.communication),
        value: dimAvg(m.dims.value),
      };
    });

    // Sync to srm_suppliers
    for (const row of bySupplier) {
      const trust = computeTrustScore({
        otifef: null,
        ratingAvg: row.rating_avg,
        verified: null,
      });
      await supabase
        .from('srm_suppliers')
        .update({
          rating_avg: row.rating_avg,
          rating_count: row.rating_count,
          trust_score: trust,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', companyId)
        .eq('linked_profile_id', row.supplier_profile_id);
    }

    return NextResponse.json({
      success: true,
      reviews: list,
      bySupplier,
      summary: {
        reviewCount: list.length,
        givenCount: given.length,
        suppliersRated: bySupplier.length,
        avgRating:
          bySupplier.length > 0
            ? bySupplier.reduce((a, b) => a + b.rating_avg, 0) / bySupplier.length
            : 0,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST body: companyId, privyUserId, supplierProfileId, purchaseOrderId?,
 * overall (1-5), quality?, delivery?, communication?, value?, comment?
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const supplierProfileId = Number(body.supplierProfileId || body.reviewee_profile_id);
    const overall = Number(body.overall ?? body.rating ?? body.overall_rating);

    if (!Number.isFinite(companyId) || !Number.isFinite(supplierProfileId)) {
      return NextResponse.json(
        { error: 'companyId and supplierProfileId required' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(overall) || overall < 1 || overall > 5 || !Number.isInteger(overall)) {
      return NextResponse.json({ error: 'overall rating must be integer 1–5' }, { status: 400 });
    }

    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    const supabase = getSupabaseServer();
    const payload: Record<string, unknown> = {
      reviewer_profile_id: companyId,
      reviewee_profile_id: supplierProfileId,
      overall_rating: overall,
      quality_rating: body.quality ?? body.quality_rating ?? null,
      delivery_rating: body.delivery ?? body.delivery_rating ?? null,
      communication_rating: body.communication ?? body.communication_rating ?? null,
      value_rating: body.value ?? body.value_rating ?? null,
      comment: body.comment || body.notes || null,
      status: 'published',
      updated_at: new Date().toISOString(),
    };
    if (body.purchaseOrderId || body.purchase_order_id) {
      payload.purchase_order_id = Number(body.purchaseOrderId || body.purchase_order_id);
    }

    let { data, error } = await supabase.from('po_reviews').insert(payload).select('*').single();

    if (error && /unique|duplicate/i.test(error.message) && payload.purchase_order_id) {
      const retry = await supabase
        .from('po_reviews')
        .update(payload)
        .eq('purchase_order_id', payload.purchase_order_id)
        .eq('reviewer_profile_id', companyId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_po_reviews.sql' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, review: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
