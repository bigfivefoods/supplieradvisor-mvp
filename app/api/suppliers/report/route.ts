import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { computeBuyerOtifef } from '@/lib/suppliers/otifef';
import {
  aggregateRatings,
  type CompanyRatingRow,
} from '@/lib/ratings/company-rating';

/**
 * GET ?companyId=&from=&to=&report=
 *
 * World-class supplier analytics pack:
 *  overview | scorecard | spend | po_ledger | otifef | ratings | risk | status_mix | trend | book
 * Default returns full pack (all sections) for the slice-and-dice UI.
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
    const report = String(sp.get('report') || 'all').toLowerCase();
    const supplierFilter = sp.get('supplierId')
      ? Number(sp.get('supplierId'))
      : null;
    const statusFilter = String(sp.get('status') || '').toLowerCase().trim();

    const supabase = getSupabaseServer();

    let bookRes = await supabase
      .from('srm_suppliers')
      .select(
        'id, trading_name, legal_name, status, invite_status, linked_profile_id, otifef_pct, trust_score, rating_avg, rating_count, verified'
      )
      .eq('profile_id', companyId);

    if (bookRes.error) {
      bookRes = await supabase
        .from('srm_suppliers')
        .select(
          'id, trading_name, legal_name, status, invite_status, linked_profile_id'
        )
        .eq('profile_id', companyId);
    }

    const [poRes, ratingsRes, riadRes, invRes, riadListRes] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select(
          'id, status, total_amount, currency, supplier_profile_id, promised_date, actual_delivery_date, created_at, metadata'
        )
        .eq('buyer_profile_id', companyId)
        .gte('created_at', `${from}T00:00:00.000Z`)
        .lte('created_at', `${to}T23:59:59.999Z`)
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase
        .from('company_ratings')
        .select('*')
        .eq('rater_profile_id', companyId)
        .eq('ratee_role', 'supplier')
        .eq('status', 'published')
        .limit(1000),
      supabase
        .from('riad_logs')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .in('status', ['open', 'active', 'in_progress', 'on_hold']),
      supabase
        .from('supplier_invitations')
        .select('id, status', { count: 'exact' })
        .eq('profile_id', companyId),
      supabase
        .from('riad_logs')
        .select('id, title, status, severity, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    // Soft fallback if some PO columns missing
    let pos = (poRes.data || []) as Array<Record<string, unknown>>;
    if (poRes.error) {
      const retry = await supabase
        .from('purchase_orders')
        .select(
          'id, status, total_amount, currency, supplier_profile_id, promised_date, actual_delivery_date, created_at'
        )
        .eq('buyer_profile_id', companyId)
        .gte('created_at', `${from}T00:00:00.000Z`)
        .lte('created_at', `${to}T23:59:59.999Z`)
        .order('created_at', { ascending: false })
        .limit(5000);
      pos = (retry.data || []) as Array<Record<string, unknown>>;
    }
    // Enrich hub flags from metadata when columns absent
    for (const p of pos) {
      const meta =
        p.metadata && typeof p.metadata === 'object'
          ? (p.metadata as Record<string, unknown>)
          : {};
      if (p.is_hub_order == null && meta.is_hub_order != null) {
        p.is_hub_order = meta.is_hub_order;
      }
      if (p.hub_po_id == null && meta.hub_po_id != null) {
        p.hub_po_id = meta.hub_po_id;
      }
      if (p.order_number == null && meta.order_number != null) {
        p.order_number = meta.order_number;
      }
    }

    if (supplierFilter && Number.isFinite(supplierFilter)) {
      pos = pos.filter(
        (p) => Number(p.supplier_profile_id) === supplierFilter
      );
    }
    if (statusFilter) {
      pos = pos.filter(
        (p) => String(p.status || '').toLowerCase() === statusFilter
      );
    }

    const suppliers = bookRes.data || [];
    const ratings = (ratingsRes.data || []) as CompanyRatingRow[];
    const ratingsMissing =
      ratingsRes.error &&
      /does not exist|schema cache/i.test(ratingsRes.error.message);
    const riads = riadListRes.data || [];

    const otifef = await computeBuyerOtifef({
      buyerProfileId: companyId,
      fromDate: from,
      toDate: to,
    });

    // PO volume by supplier
    const poBySupplier = new Map<
      number,
      {
        count: number;
        spend: number;
        open: number;
        completed: number;
        cancelled: number;
        late: number;
      }
    >();
    const statusMix: Record<string, { count: number; spend: number }> = {};
    const monthly: Record<
      string,
      { spend: number; count: number; open: number; completed: number }
    > = {};
    let totalSpend = 0;
    let openPos = 0;
    let completedPos = 0;
    let cancelledPos = 0;
    let latePos = 0;

    for (const p of pos) {
      const sid = Number(p.supplier_profile_id);
      const st = String(p.status || 'unknown').toLowerCase();
      const amt = Number(p.total_amount || 0);
      const created = String(p.created_at || '').slice(0, 7); // YYYY-MM
      if (created) {
        if (!monthly[created]) {
          monthly[created] = { spend: 0, count: 0, open: 0, completed: 0 };
        }
        monthly[created].spend += amt;
        monthly[created].count += 1;
      }
      if (!statusMix[st]) statusMix[st] = { count: 0, spend: 0 };
      statusMix[st].count += 1;
      statusMix[st].spend += amt;

      if (!Number.isFinite(sid)) continue;
      if (!poBySupplier.has(sid)) {
        poBySupplier.set(sid, {
          count: 0,
          spend: 0,
          open: 0,
          completed: 0,
          cancelled: 0,
          late: 0,
        });
      }
      const m = poBySupplier.get(sid)!;
      m.count += 1;
      m.spend += amt;
      totalSpend += amt;

      const isDone = ['completed', 'paid', 'delivered', 'closed', 'received'].includes(
        st
      );
      const isCancel = ['cancelled', 'void', 'rejected'].includes(st);
      if (isDone) {
        m.completed += 1;
        completedPos += 1;
        if (created) monthly[created].completed += 1;
      } else if (isCancel) {
        m.cancelled += 1;
        cancelledPos += 1;
      } else {
        m.open += 1;
        openPos += 1;
        if (created) monthly[created].open += 1;
      }

      // Late heuristic: promised_date past and not completed
      const promised = p.promised_date ? String(p.promised_date).slice(0, 10) : null;
      const actual = p.actual_delivery_date
        ? String(p.actual_delivery_date).slice(0, 10)
        : null;
      if (promised) {
        if (actual && actual > promised) {
          m.late += 1;
          latePos += 1;
        } else if (!isDone && !isCancel && promised < to) {
          m.late += 1;
          latePos += 1;
        }
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
        ...pos.map((p) => Number(p.supplier_profile_id)),
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
      const spend = Math.round((po?.spend || 0) * 100) / 100;
      const spendShare =
        totalSpend > 0 ? Math.round((spend / totalSpend) * 1000) / 10 : 0;
      return {
        supplier_profile_id: id,
        book_id: book?.id != null ? Number(book.id) : null,
        name: nameMap[id] || book?.trading_name || ot?.name || `Supplier ${id}`,
        status: book?.status || null,
        invite_status: book?.invite_status || null,
        verified: Boolean(book?.verified),
        city: null as string | null,
        country: null as string | null,
        industry: null as string | null,
        trust_score:
          book?.trust_score != null ? Number(book.trust_score) : null,
        otifef_pct:
          ot?.overall ??
          (book?.otifef_pct != null ? Number(book.otifef_pct) : null),
        otifef_on_time: ot?.ot_percent ?? null,
        otifef_in_full: ot?.if_percent ?? null,
        otifef_error_free: ot?.ef_percent ?? null,
        otifef_po_count: ot?.total_pos ?? null,
        star_avg:
          stars?.rating_avg ??
          (book?.rating_avg != null ? Number(book.rating_avg) : null),
        star_count:
          stars?.rating_count ??
          (book?.rating_count != null ? Number(book.rating_count) : 0),
        star_quality: stars?.quality ?? null,
        star_delivery: stars?.delivery ?? null,
        star_communication: stars?.communication ?? null,
        star_value: stars?.value ?? null,
        po_count: po?.count || 0,
        po_open: po?.open || 0,
        po_completed: po?.completed || 0,
        po_cancelled: po?.cancelled || 0,
        po_late: po?.late || 0,
        spend,
        spend_share_pct: spendShare,
      };
    });

    supplierRows.sort(
      (a, b) => b.spend - a.spend || (b.otifef_pct || 0) - (a.otifef_pct || 0)
    );

    // Pareto / concentration
    let cum = 0;
    const concentration = supplierRows
      .filter((r) => r.spend > 0)
      .map((r, i) => {
        cum += r.spend;
        return {
          rank: i + 1,
          supplier_profile_id: r.supplier_profile_id,
          name: r.name,
          spend: r.spend,
          share_pct: r.spend_share_pct,
          cumulative_pct:
            totalSpend > 0
              ? Math.round((cum / totalSpend) * 1000) / 10
              : 0,
        };
      });

    const top3Spend = concentration
      .slice(0, 3)
      .reduce((s, r) => s + r.spend, 0);
    const top3Share =
      totalSpend > 0
        ? Math.round((top3Spend / totalSpend) * 1000) / 10
        : 0;

    // Risk flags
    const risk = {
      lowOtifef: supplierRows
        .filter(
          (r) =>
            r.otifef_pct != null &&
            r.otifef_pct < 80 &&
            (r.otifef_po_count || 0) >= 2
        )
        .sort((a, b) => (a.otifef_pct || 0) - (b.otifef_pct || 0))
        .slice(0, 20),
      highOpenSpend: supplierRows
        .filter((r) => (r.po_open || 0) > 0)
        .sort((a, b) => (b.po_open || 0) - (a.po_open || 0))
        .slice(0, 20),
      lateDeliveries: supplierRows
        .filter((r) => (r.po_late || 0) > 0)
        .sort((a, b) => (b.po_late || 0) - (a.po_late || 0))
        .slice(0, 20),
      lowStars: supplierRows
        .filter(
          (r) =>
            r.star_avg != null && r.star_avg < 3 && (r.star_count || 0) > 0
        )
        .sort((a, b) => (a.star_avg || 0) - (b.star_avg || 0))
        .slice(0, 20),
      singleSourceRisk:
        top3Share >= 60
          ? {
              message: `Top 3 suppliers = ${top3Share}% of period spend — concentration risk`,
              top3Share,
            }
          : null,
    };

    // PO ledger rows
    const poLedger = pos.map((p) => {
      const sid = Number(p.supplier_profile_id);
      const st = String(p.status || '').toLowerCase();
      const meta =
        p.metadata && typeof p.metadata === 'object'
          ? (p.metadata as Record<string, unknown>)
          : {};
      const poNum =
        p.po_number ||
        p.order_number ||
        meta.po_number ||
        meta.order_number ||
        (p.id != null ? `PO-${p.id}` : '—');
      return {
        id: Number(p.id),
        po_number: String(poNum),
        supplier_profile_id: Number.isFinite(sid) ? sid : null,
        supplier_name: Number.isFinite(sid)
          ? nameMap[sid] || `Supplier ${sid}`
          : '—',
        status: st || 'unknown',
        total_amount: Number(p.total_amount || 0),
        currency: p.currency != null ? String(p.currency) : 'ZAR',
        promised_date: p.promised_date
          ? String(p.promised_date).slice(0, 10)
          : null,
        actual_delivery_date: p.actual_delivery_date
          ? String(p.actual_delivery_date).slice(0, 10)
          : null,
        created_at: p.created_at ? String(p.created_at) : null,
        settle_mode:
          p.settle_mode != null
            ? String(p.settle_mode)
            : meta.settle_mode != null
              ? String(meta.settle_mode)
              : null,
        is_hub_order: Boolean(p.is_hub_order || meta.is_hub_order),
        hub_po_id:
          p.hub_po_id != null
            ? Number(p.hub_po_id)
            : meta.hub_po_id != null
              ? Number(meta.hub_po_id)
              : null,
      };
    });

    const trendMonths = Object.keys(monthly)
      .sort()
      .map((ym) => ({
        month: ym,
        spend: Math.round(monthly[ym].spend * 100) / 100,
        count: monthly[ym].count,
        open: monthly[ym].open,
        completed: monthly[ym].completed,
      }));

    const statusMixRows = Object.entries(statusMix)
      .map(([status, v]) => ({
        status,
        count: v.count,
        spend: Math.round(v.spend * 100) / 100,
        share_pct:
          totalSpend > 0
            ? Math.round((v.spend / totalSpend) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const connected = suppliers.filter(
      (s) => s.invite_status === 'accepted' || s.linked_profile_id
    ).length;
    const preferred = suppliers.filter(
      (s) => String(s.status || '').toLowerCase() === 'preferred'
    ).length;
    const verified = suppliers.filter((s) => s.verified).length;
    const starAvgs = supplierRows
      .map((r) => r.star_avg)
      .filter((n): n is number => n != null && n > 0);

    const bookHealth = {
      onBook: suppliers.length,
      connected,
      preferred,
      verified,
      withSpend: supplierRows.filter((r) => r.spend > 0).length,
      withOtifef: supplierRows.filter(
        (r) => r.otifef_pct != null && (r.otifef_po_count || 0) > 0
      ).length,
      withStars: starAvgs.length,
      inactive:
        suppliers.length -
        supplierRows.filter((r) => (r.po_count || 0) > 0).length,
      byStatus: (() => {
        const m: Record<string, number> = {};
        for (const s of suppliers) {
          const st = String(s.status || 'unknown').toLowerCase();
          m[st] = (m[st] || 0) + 1;
        }
        return Object.entries(m).map(([status, count]) => ({ status, count }));
      })(),
    };

    const kpis = {
      suppliersOnBook: suppliers.length,
      connected,
      preferred,
      verified,
      openPos,
      completedPos,
      cancelledPos,
      latePos,
      poCount: pos.length,
      totalSpend: Math.round(totalSpend * 100) / 100,
      avgPoValue:
        pos.length > 0
          ? Math.round((totalSpend / pos.length) * 100) / 100
          : 0,
      top3Share,
      openRiads: riadRes.count || 0,
      invitesPending:
        (invRes.data || []).filter((i) => String(i.status) === 'pending')
          .length ||
        invRes.count ||
        0,
      otifefOverall: otifef.summary.overall,
      otifefOnTime: otifef.summary.onTime,
      otifefInFull: otifef.summary.inFull,
      otifefErrorFree: otifef.summary.errorFree,
      starAvgGiven:
        starAvgs.length > 0
          ? Math.round(
              (starAvgs.reduce((a, b) => a + b, 0) / starAvgs.length) * 10
            ) / 10
          : null,
      companiesStarRated: starAvgs.length,
    };

    const payload: Record<string, unknown> = {
      success: true,
      period: { from, to },
      report,
      kpis,
      suppliers: supplierRows,
      otifefRows: otifef.rows,
      concentration,
      risk,
      poLedger,
      statusMix: statusMixRows,
      trend: trendMonths,
      bookHealth,
      riads: riads.slice(0, 50).map((r) => ({
        id: Number(r.id),
        title: r.title != null ? String(r.title) : null,
        status: r.status != null ? String(r.status) : null,
        severity: r.severity != null ? String(r.severity) : null,
        created_at: r.created_at != null ? String(r.created_at) : null,
        supplier_profile_id: null as number | null,
      })),
      poHref: '/dashboard/suppliers/po',
      warnings: [
        bookRes.error?.message,
        poRes.error?.message,
        otifef.warning,
        ratingsMissing
          ? 'Run 20260712_company_ratings.sql for peer star ratings'
          : ratingsRes.error?.message,
        riadListRes.error?.message,
      ].filter(Boolean),
    };

    // Optional thin responses for single-report clients
    if (report === 'po_ledger') {
      return NextResponse.json({
        success: true,
        period: { from, to },
        report,
        kpis,
        poLedger,
        poHref: '/dashboard/suppliers/po',
        warnings: payload.warnings,
      });
    }

    return NextResponse.json(payload);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
