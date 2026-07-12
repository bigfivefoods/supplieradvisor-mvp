import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { stageProbability } from '@/lib/customers/types';
import { aggregateRatings, type CompanyRatingRow } from '@/lib/ratings/company-rating';

/**
 * GET ?companyId=&from=&to=
 * Customer report: CRM pipeline KPIs + star ratings of customers + commercial volume.
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

    const [custRes, leadRes, oppRes, invRes, orderRes, arRes, ratingsRes, claimRes] =
      await Promise.all([
        supabase
          .from('customers')
          .select(
            'id, trading_name, legal_name, status, invite_status, linked_profile_id, email, city, country'
          )
          .eq('profile_id', companyId),
        supabase
          .from('leads')
          .select('id, status, value_estimate, next_action_date')
          .eq('profile_id', companyId),
        supabase
          .from('opportunities')
          .select(
            'id, stage, status, amount, opportunity_size, probability, customer_id, linked_profile_id'
          )
          .eq('profile_id', companyId),
        supabase
          .from('customer_invitations')
          .select('id, status')
          .eq('profile_id', companyId),
        supabase
          .from('sales_orders')
          .select('id, status, total_amount, currency, customer_id, created_at')
          .eq('profile_id', companyId)
          .gte('created_at', `${from}T00:00:00.000Z`)
          .lte('created_at', `${to}T23:59:59.999Z`)
          .limit(2000),
        supabase
          .from('invoices')
          .select(
            'id, status, total_amount, balance_due, currency, customer_id, direction, created_at'
          )
          .eq('profile_id', companyId)
          .eq('direction', 'receivable')
          .gte('created_at', `${from}T00:00:00.000Z`)
          .lte('created_at', `${to}T23:59:59.999Z`)
          .limit(2000),
        supabase
          .from('company_ratings')
          .select('*')
          .eq('rater_profile_id', companyId)
          .eq('ratee_role', 'customer')
          .eq('status', 'published')
          .limit(500),
        supabase
          .from('customer_claims')
          .select('id, status, claim_type')
          .eq('profile_id', companyId)
          .limit(500),
      ]);

    const customers = custRes.data || [];
    const leads = leadRes.data || [];
    const opps = oppRes.data || [];
    const invites = invRes.data || [];
    const orders = orderRes.data || [];
    const invoices = arRes.data || [];
    const ratings = (ratingsRes.data || []) as CompanyRatingRow[];
    const claims = claimRes.data || [];
    const ratingsMissing =
      ratingsRes.error && /does not exist|schema cache/i.test(ratingsRes.error.message);

    const openLeads = leads.filter(
      (l) => !['converted', 'unqualified', 'recycled'].includes(String(l.status || ''))
    );
    const openOpps = opps.filter((o) => {
      const s = String(o.stage || o.status || '').toLowerCase();
      return !['closed_won', 'closed_lost', 'won', 'lost'].includes(s);
    });
    const won = opps.filter((o) => {
      const s = String(o.stage || o.status || '').toLowerCase();
      return s === 'closed_won' || s === 'won';
    });

    let pipelineValue = 0;
    let weightedPipeline = 0;
    for (const o of openOpps) {
      const amount = Number(o.amount ?? o.opportunity_size ?? 0);
      const stage = String(o.stage || 'prospecting').toLowerCase().replace(/\s+/g, '_');
      const prob =
        o.probability != null ? Number(o.probability) : stageProbability(stage);
      pipelineValue += amount;
      weightedPipeline += (amount * prob) / 100;
    }
    const wonValue = won.reduce(
      (s, o) => s + Number(o.amount ?? o.opportunity_size ?? 0),
      0
    );

    const orderByCustomer = new Map<number, { count: number; revenue: number }>();
    let orderRevenue = 0;
    for (const o of orders) {
      const cid = Number(o.customer_id);
      if (!Number.isFinite(cid)) continue;
      if (!orderByCustomer.has(cid)) orderByCustomer.set(cid, { count: 0, revenue: 0 });
      const m = orderByCustomer.get(cid)!;
      m.count += 1;
      const amt = Number(o.total_amount || 0);
      m.revenue += amt;
      orderRevenue += amt;
    }

    const invByCustomer = new Map<
      number,
      { count: number; billed: number; open: number }
    >();
    let arOpen = 0;
    let billed = 0;
    for (const inv of invoices) {
      const cid = Number(inv.customer_id);
      if (!Number.isFinite(cid)) continue;
      if (!invByCustomer.has(cid)) {
        invByCustomer.set(cid, { count: 0, billed: 0, open: 0 });
      }
      const m = invByCustomer.get(cid)!;
      m.count += 1;
      const tot = Number(inv.total_amount || 0);
      const bal = Number(inv.balance_due ?? tot);
      m.billed += tot;
      billed += tot;
      const st = String(inv.status || '').toLowerCase();
      if (!['paid', 'void', 'cancelled', 'written_off'].includes(st) && bal > 0) {
        m.open += bal;
        arOpen += bal;
      }
    }

    const nameMap: Record<number, string> = {};
    const customerById = new Map<number, (typeof customers)[0]>();
    for (const c of customers) {
      customerById.set(Number(c.id), c);
      const linked = Number(c.linked_profile_id);
      if (linked) {
        nameMap[linked] =
          (c.trading_name as string) ||
          (c.legal_name as string) ||
          `Customer ${c.id}`;
      }
    }

    // Map linked profiles for ratings
    const linkedToCustomer = new Map<number, number>();
    for (const c of customers) {
      const linked = Number(c.linked_profile_id);
      if (linked) linkedToCustomer.set(linked, Number(c.id));
    }

    const ratingAggs = ratingsMissing ? [] : aggregateRatings(ratings, nameMap);
    const ratingByProfile = new Map(ratingAggs.map((a) => [a.ratee_profile_id, a]));

    // Build customer rows
    const customerRows = customers.map((c) => {
      const id = Number(c.id);
      const linked = Number(c.linked_profile_id) || null;
      const ord = orderByCustomer.get(id);
      const inv = invByCustomer.get(id);
      const stars = linked ? ratingByProfile.get(linked) : undefined;
      return {
        customer_id: id,
        linked_profile_id: linked,
        name:
          (c.trading_name as string) ||
          (c.legal_name as string) ||
          `Customer ${id}`,
        status: c.status,
        invite_status: c.invite_status,
        city: c.city,
        country: c.country,
        order_count: ord?.count || 0,
        order_revenue: Math.round((ord?.revenue || 0) * 100) / 100,
        invoice_count: inv?.count || 0,
        billed: Math.round((inv?.billed || 0) * 100) / 100,
        ar_open: Math.round((inv?.open || 0) * 100) / 100,
        star_avg: stars?.rating_avg ?? null,
        star_count: stars?.rating_count ?? 0,
        star_payment: stars?.payment ?? null,
        star_communication: stars?.communication ?? null,
        star_reliability: stars?.reliability ?? null,
        star_value: stars?.value ?? null,
      };
    });

    customerRows.sort((a, b) => b.order_revenue - a.order_revenue || b.billed - a.billed);

    const starAvgs = customerRows
      .map((r) => r.star_avg)
      .filter((n): n is number => n != null && n > 0);

    const openClaims = claims.filter((c) =>
      ['open', 'submitted', 'in_review', 'pending'].includes(
        String(c.status || '').toLowerCase()
      )
    ).length;

    return NextResponse.json({
      success: true,
      period: { from, to },
      kpis: {
        customersTotal: customers.length,
        customersActive: customers.filter((c) =>
          ['active', 'accepted'].includes(String(c.status || c.invite_status || '').toLowerCase())
        ).length,
        invitePending: invites.filter((i) => String(i.status) === 'pending').length,
        inviteAccepted: customers.filter(
          (c) => String(c.invite_status || '').toLowerCase() === 'accepted'
        ).length,
        openLeads: openLeads.length,
        openOpportunities: openOpps.length,
        pipelineValue: Math.round(pipelineValue * 100) / 100,
        weightedPipeline: Math.round(weightedPipeline * 100) / 100,
        wonValue: Math.round(wonValue * 100) / 100,
        ordersCount: orders.length,
        orderRevenue: Math.round(orderRevenue * 100) / 100,
        invoicesCount: invoices.length,
        billed: Math.round(billed * 100) / 100,
        arOpen: Math.round(arOpen * 100) / 100,
        openClaims,
        starAvgGiven:
          starAvgs.length > 0
            ? Math.round(
                (starAvgs.reduce((a, b) => a + b, 0) / starAvgs.length) * 10
              ) / 10
            : null,
        customersStarRated: starAvgs.length,
      },
      customers: customerRows,
      warnings: [
        custRes.error?.message,
        orderRes.error?.message,
        arRes.error?.message,
        claimRes.error?.message,
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
