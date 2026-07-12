import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { computeBuyerOtifef } from '@/lib/suppliers/otifef';
import { aggregateRatings, type CompanyRatingRow } from '@/lib/ratings/company-rating';

/**
 * GET ?companyId=&from=&to=
 * Supplier report: OTIFEF (objective) + star ratings (subjective) + book KPIs + PO volume.
 */
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

    const to = sp.get('to') || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setFullYear(fromDefault.getFullYear() - 1);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);

    const supabase = getSupabaseServer();

    const [bookRes, poRes, ratingsRes, riadRes, invRes] = await Promise.all([
      supabase
        .from('srm_suppliers')
        .select(
          'id, trading_name, legal_name, status, invite_status, linked_profile_id, otifef_pct, trust_score, rating_avg, rating_count, verified'
        )
        .eq('profile_id', companyId),
      supabase
        .from('purchase_orders')
        .select(
          'id, status, total_amount, currency, supplier_profile_id, promised_date, actual_delivery_date, created_at'
        )
        .eq('buyer_profile_id', companyId)
        .gte('created_at', `${from}T00:00:00.000Z`)
        .lte('created_at', `${to}T23:59:59.999Z`)
        .limit(3000),
      supabase
        .from('company_ratings')
        .select('*')
        .eq('rater_profile_id', companyId)
        .eq('ratee_role', 'supplier')
        .eq('status', 'published')
        .limit(500),
      supabase
        .from('riad_logs')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .in('status', ['open', 'active', 'in_progress', 'on_hold']),
      supabase
        .from('supplier_invitations')
        .select('id, status', { count: 'exact' })
        .eq('profile_id', companyId),
    ]);

    const suppliers = bookRes.data || [];
    const pos = poRes.data || [];
    const ratings = (ratingsRes.data || []) as CompanyRatingRow[];
    const ratingsMissing =
      ratingsRes.error && /does not exist|schema cache/i.test(ratingsRes.error.message);

    const otifef = await computeBuyerOtifef({
      buyerProfileId: companyId,
      fromDate: from,
      toDate: to,
    });

    // PO volume by supplier
    const poBySupplier = new Map<
      number,
      { count: number; spend: number; open: number; completed: number }
    >();
    let totalSpend = 0;
    let openPos = 0;
    for (const p of pos) {
      const sid = Number(p.supplier_profile_id);
      if (!Number.isFinite(sid)) continue;
      if (!poBySupplier.has(sid)) {
        poBySupplier.set(sid, { count: 0, spend: 0, open: 0, completed: 0 });
      }
      const m = poBySupplier.get(sid)!;
      m.count += 1;
      const amt = Number(p.total_amount || 0);
      m.spend += amt;
      totalSpend += amt;
      const st = String(p.status || '').toLowerCase();
      if (['completed', 'paid', 'delivered', 'closed'].includes(st)) m.completed += 1;
      else if (!['cancelled', 'void', 'rejected'].includes(st)) {
        m.open += 1;
        openPos += 1;
      }
    }

    const nameMap: Record<number, string> = {};
    for (const s of suppliers) {
      const id = Number(s.linked_profile_id);
      if (id) {
        nameMap[id] =
          (s.trading_name as string) ||
          (s.legal_name as string) ||
          `Supplier ${id}`;
      }
    }
    const peerIds = [
      ...new Set([
        ...Array.from(poBySupplier.keys()),
        ...ratings.map((r) => Number(r.ratee_profile_id)),
        ...otifef.rows.map((r) => Number(r.supplier_id)),
      ]),
    ].filter((n) => Number.isFinite(n) && !nameMap[n]);

    if (peerIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .in('id', peerIds);
      for (const p of profiles || []) {
        nameMap[Number(p.id)] =
          p.trading_name || p.legal_name || `Company ${p.id}`;
      }
    }

    const ratingAggs = ratingsMissing ? [] : aggregateRatings(ratings, nameMap);
    const ratingById = new Map(ratingAggs.map((a) => [a.ratee_profile_id, a]));
    const otifefById = new Map(
      otifef.rows.map((r) => [Number(r.supplier_id), r])
    );

    const allSupplierIds = new Set<number>([
      ...suppliers.map((s) => Number(s.linked_profile_id)).filter((n) => n > 0),
      ...poBySupplier.keys(),
      ...ratingById.keys(),
      ...otifefById.keys(),
    ]);

    const supplierRows = Array.from(allSupplierIds).map((id) => {
      const book = suppliers.find((s) => Number(s.linked_profile_id) === id);
      const po = poBySupplier.get(id);
      const stars = ratingById.get(id);
      const ot = otifefById.get(id);
      return {
        supplier_profile_id: id,
        name: nameMap[id] || book?.trading_name || ot?.name || `Supplier ${id}`,
        status: book?.status || null,
        invite_status: book?.invite_status || null,
        verified: Boolean(book?.verified),
        trust_score: book?.trust_score != null ? Number(book.trust_score) : null,
        // Objective OTIFEF
        otifef_pct: ot?.overall ?? (book?.otifef_pct != null ? Number(book.otifef_pct) : null),
        otifef_on_time: ot?.ot_percent ?? null,
        otifef_in_full: ot?.if_percent ?? null,
        otifef_error_free: ot?.ef_percent ?? null,
        otifef_po_count: ot?.total_pos ?? null,
        // Subjective stars
        star_avg: stars?.rating_avg ?? (book?.rating_avg != null ? Number(book.rating_avg) : null),
        star_count: stars?.rating_count ?? (book?.rating_count != null ? Number(book.rating_count) : 0),
        star_quality: stars?.quality ?? null,
        star_delivery: stars?.delivery ?? null,
        star_communication: stars?.communication ?? null,
        star_value: stars?.value ?? null,
        // Volume
        po_count: po?.count || 0,
        po_open: po?.open || 0,
        po_completed: po?.completed || 0,
        spend: Math.round((po?.spend || 0) * 100) / 100,
      };
    });

    supplierRows.sort(
      (a, b) => b.spend - a.spend || (b.otifef_pct || 0) - (a.otifef_pct || 0)
    );

    const connected = suppliers.filter(
      (s) => s.invite_status === 'accepted' || s.linked_profile_id
    ).length;
    const preferred = suppliers.filter((s) => s.status === 'preferred').length;
    const verified = suppliers.filter((s) => s.verified).length;
    const starAvgs = supplierRows
      .map((r) => r.star_avg)
      .filter((n): n is number => n != null && n > 0);

    return NextResponse.json({
      success: true,
      period: { from, to },
      kpis: {
        suppliersOnBook: suppliers.length,
        connected,
        preferred,
        verified,
        openPos,
        poCount: pos.length,
        totalSpend: Math.round(totalSpend * 100) / 100,
        openRiads: riadRes.count || 0,
        invitesPending:
          (invRes.data || []).filter((i) => String(i.status) === 'pending').length ||
          invRes.count ||
          0,
        // Objective
        otifefOverall: otifef.summary.overall,
        otifefOnTime: otifef.summary.onTime,
        otifefInFull: otifef.summary.inFull,
        otifefErrorFree: otifef.summary.errorFree,
        // Subjective
        starAvgGiven:
          starAvgs.length > 0
            ? Math.round(
                (starAvgs.reduce((a, b) => a + b, 0) / starAvgs.length) * 10
              ) / 10
            : null,
        companiesStarRated: starAvgs.length,
      },
      suppliers: supplierRows,
      otifefRows: otifef.rows,
      warnings: [
        bookRes.error?.message,
        poRes.error?.message,
        otifef.warning,
        ratingsMissing
          ? 'Run 20260712_company_ratings.sql for peer star ratings'
          : ratingsRes.error?.message,
      ].filter(Boolean),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
