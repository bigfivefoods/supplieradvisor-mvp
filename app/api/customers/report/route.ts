import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { stageProbability } from '@/lib/customers/types';
import {
  aggregateRatings,
  type CompanyRatingRow,
} from '@/lib/ratings/company-rating';

/**
 * GET ?companyId=&from=&to=
 * Customer report: CRM pipeline + commercial volume (customer_invoices + sales_orders)
 * + peer star ratings of buyers + public invoice/order feedback (stars / OTIFEF).
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
    const fromIso = `${from}T00:00:00.000Z`;
    const toIso = `${to}T23:59:59.999Z`;

    const supabase = getSupabaseServer();

    const [
      custRes,
      leadRes,
      oppRes,
      invInviteRes,
      orderRes,
      crmInvRes,
      arRes,
      ratingsRes,
      claimRes,
      feedbackRes,
    ] = await Promise.all([
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
      // Orders — load without strict date first if needed; filter in JS using created_at
      supabase
        .from('sales_orders')
        .select(
          'id, status, total_amount, currency, customer_id, order_number, created_at, invoice_id'
        )
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5000),
      // CRM commercial invoices (DocumentWorkspace / INV-*)
      supabase
        .from('customer_invoices')
        .select(
          'id, status, total_amount, amount_paid, currency, customer_id, invoice_number, issue_date, due_date, created_at, order_id, customer_name'
        )
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5000),
      // Accounting AR invoices (legacy / finance module)
      supabase
        .from('invoices')
        .select(
          'id, status, total_amount, balance_due, currency, customer_id, direction, created_at, invoice_number'
        )
        .eq('profile_id', companyId)
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
        .select('id, status, claim_type, customer_id, invoice_id, title')
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('invoice_feedback')
        .select(
          'id, invoice_id, invoice_number, feedback_type, rating, otifef_score, title, body, contact_name, contact_email, metadata, created_at'
        )
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const customers = custRes.data || [];
    const leads = leadRes.data || [];
    const opps = oppRes.data || [];
    const invites = invInviteRes.data || [];
    const ordersAll = orderRes.data || [];
    const crmInvoicesAll = crmInvRes.data || [];
    const acctInvoicesAll = (arRes.data || []).filter((inv) => {
      const dir = String(inv.direction || 'receivable').toLowerCase();
      return !dir || dir === 'receivable' || dir === 'ar' || dir === 'sales';
    });
    const ratings = (ratingsRes.data || []) as CompanyRatingRow[];
    const claims = claimRes.data || [];
    const feedbackAll = feedbackRes.data || [];

    const ratingsMissing = isMissing(ratingsRes.error?.message);
    const feedbackMissing = isMissing(feedbackRes.error?.message);
    const crmInvMissing = isMissing(crmInvRes.error?.message);

    // Date filter in JS so issue_date / created_at both work
    const inPeriod = (row: Record<string, unknown>) => {
      const candidates = [
        row.issue_date,
        row.created_at,
        row.invoice_date,
        row.order_date,
      ];
      for (const c of candidates) {
        if (c == null) continue;
        const d = String(c).slice(0, 10);
        if (d >= from && d <= to) return true;
        // also allow full ISO compare
        const t = new Date(String(c)).getTime();
        if (Number.isFinite(t)) {
          const fromT = new Date(fromIso).getTime();
          const toT = new Date(toIso).getTime();
          if (t >= fromT && t <= toT) return true;
        }
      }
      // If no date field, include (better than hiding revenue)
      if (candidates.every((c) => c == null)) return true;
      return false;
    };

    const orders = ordersAll.filter((o) =>
      inPeriod(o as Record<string, unknown>)
    );
    const crmInvoices = crmInvMissing
      ? []
      : crmInvoicesAll.filter((o) => inPeriod(o as Record<string, unknown>));
    const acctInvoices = acctInvoicesAll.filter((o) =>
      inPeriod(o as Record<string, unknown>)
    );

    // Normalize unified invoice list
    type UniInv = {
      id: number;
      source: 'crm' | 'accounting';
      customer_id: number | null;
      customer_name: string | null;
      total: number;
      paid: number;
      open: number;
      status: string;
      number: string | null;
      order_id: number | null;
      date: string | null;
    };

    const unified: UniInv[] = [];

    for (const inv of crmInvoices) {
      const tot = Number(inv.total_amount || 0);
      const paid = Number(inv.amount_paid || 0);
      const st = String(inv.status || '').toLowerCase();
      let open = Math.max(0, tot - paid);
      if (['paid', 'void', 'cancelled', 'written_off'].includes(st)) open = 0;
      if (['draft'].includes(st) && paid <= 0) {
        // Draft still counts as billed pipeline for visibility
      }
      unified.push({
        id: Number(inv.id),
        source: 'crm',
        customer_id:
          inv.customer_id != null && Number.isFinite(Number(inv.customer_id))
            ? Number(inv.customer_id)
            : null,
        customer_name: inv.customer_name ? String(inv.customer_name) : null,
        total: tot,
        paid,
        open,
        status: st || 'draft',
        number: inv.invoice_number ? String(inv.invoice_number) : null,
        order_id:
          inv.order_id != null && Number.isFinite(Number(inv.order_id))
            ? Number(inv.order_id)
            : null,
        date: String(inv.issue_date || inv.created_at || '').slice(0, 10) || null,
      });
    }

    for (const inv of acctInvoices) {
      // Skip if same number already in CRM set
      const num = inv.invoice_number ? String(inv.invoice_number) : null;
      if (num && unified.some((u) => u.number === num)) continue;
      const tot = Number(inv.total_amount || 0);
      const bal =
        inv.balance_due != null ? Number(inv.balance_due) : tot;
      const st = String(inv.status || '').toLowerCase();
      let open = bal;
      if (['paid', 'void', 'cancelled', 'written_off'].includes(st)) open = 0;
      unified.push({
        id: Number(inv.id),
        source: 'accounting',
        customer_id:
          inv.customer_id != null && Number.isFinite(Number(inv.customer_id))
            ? Number(inv.customer_id)
            : null,
        customer_name: null,
        total: tot,
        paid: Math.max(0, tot - open),
        open: Math.max(0, open),
        status: st || 'open',
        number: num,
        order_id: null,
        date: String(inv.created_at || '').slice(0, 10) || null,
      });
    }

    // Name resolution helpers for invoices missing customer_id
    const customerById = new Map<number, (typeof customers)[0]>();
    const customerByName = new Map<string, number>();
    for (const c of customers) {
      customerById.set(Number(c.id), c);
      for (const n of [c.trading_name, c.legal_name]) {
        if (n) customerByName.set(normName(String(n)), Number(c.id));
      }
    }

    for (const inv of unified) {
      if (inv.customer_id != null) continue;
      if (inv.customer_name) {
        const id = customerByName.get(normName(inv.customer_name));
        if (id) inv.customer_id = id;
      }
    }

    const openLeads = leads.filter(
      (l) =>
        !['converted', 'unqualified', 'recycled'].includes(
          String(l.status || '')
        )
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
      const stage = String(o.stage || 'prospecting')
        .toLowerCase()
        .replace(/\s+/g, '_');
      const prob =
        o.probability != null
          ? Number(o.probability)
          : stageProbability(stage);
      pipelineValue += amount;
      weightedPipeline += (amount * prob) / 100;
    }
    const wonValue = won.reduce(
      (s, o) => s + Number(o.amount ?? o.opportunity_size ?? 0),
      0
    );

    const orderByCustomer = new Map<
      number,
      { count: number; revenue: number }
    >();
    let orderRevenue = 0;
    for (const o of orders) {
      const cid = Number(o.customer_id);
      if (!Number.isFinite(cid)) continue;
      if (!orderByCustomer.has(cid)) {
        orderByCustomer.set(cid, { count: 0, revenue: 0 });
      }
      const m = orderByCustomer.get(cid)!;
      m.count += 1;
      const amt = Number(o.total_amount || 0);
      m.revenue += amt;
      orderRevenue += amt;
    }

    const invByCustomer = new Map<
      number,
      { count: number; billed: number; open: number; paid: number }
    >();
    let arOpen = 0;
    let billed = 0;
    let unassignedBilled = 0;
    for (const inv of unified) {
      const tot = inv.total;
      billed += tot;
      arOpen += inv.open;
      const cid = inv.customer_id;
      if (cid == null || !Number.isFinite(cid)) {
        unassignedBilled += tot;
        continue;
      }
      if (!invByCustomer.has(cid)) {
        invByCustomer.set(cid, { count: 0, billed: 0, open: 0, paid: 0 });
      }
      const m = invByCustomer.get(cid)!;
      m.count += 1;
      m.billed += tot;
      m.open += inv.open;
      m.paid += inv.paid;
    }

    const nameMap: Record<number, string> = {};
    for (const c of customers) {
      const linked = Number(c.linked_profile_id);
      if (linked) {
        nameMap[linked] =
          (c.trading_name as string) ||
          (c.legal_name as string) ||
          `Customer ${c.id}`;
      }
    }

    const linkedToCustomer = new Map<number, number>();
    for (const c of customers) {
      const linked = Number(c.linked_profile_id);
      if (linked) linkedToCustomer.set(linked, Number(c.id));
    }

    const ratingAggs = ratingsMissing
      ? []
      : aggregateRatings(ratings, nameMap);
    const ratingByProfile = new Map(
      ratingAggs.map((a) => [a.ratee_profile_id, a])
    );

    // Invoice / order feedback from customers (public QR)
    type FbAgg = {
      count: number;
      rating_sum: number;
      rating_n: number;
      otifef_sum: number;
      otifef_n: number;
      latest_rating: number | null;
    };
    const feedbackByCustomer = new Map<number, FbAgg>();
    const feedbackByInvoice = new Map<number, typeof feedbackAll>();

    // Map invoice_id → customer_id
    const invCustomer = new Map<number, number>();
    for (const inv of unified) {
      if (inv.customer_id != null) invCustomer.set(inv.id, inv.customer_id);
    }
    // also from full CRM list (outside period) for feedback attachment
    for (const inv of crmInvoicesAll) {
      if (inv.customer_id != null) {
        invCustomer.set(Number(inv.id), Number(inv.customer_id));
      } else if (inv.customer_name) {
        const id = customerByName.get(normName(String(inv.customer_name)));
        if (id) invCustomer.set(Number(inv.id), id);
      }
    }

    const recentFeedback: Array<{
      id: number;
      invoice_id: number | null;
      invoice_number: string | null;
      customer_id: number | null;
      customer_name: string | null;
      order_id: number | null;
      order_number: string | null;
      rating: number | null;
      otifef_score: number | null;
      feedback_type: string | null;
      title: string | null;
      body: string | null;
      contact_name: string | null;
      created_at: string | null;
    }> = [];

    if (!feedbackMissing) {
      for (const fb of feedbackAll) {
        const invId =
          fb.invoice_id != null ? Number(fb.invoice_id) : null;
        let cid =
          invId != null && invCustomer.has(invId)
            ? invCustomer.get(invId)!
            : null;

        // Match by invoice number if needed
        if (cid == null && fb.invoice_number) {
          const match = unified.find(
            (u) =>
              u.number &&
              String(u.number).toLowerCase() ===
                String(fb.invoice_number).toLowerCase()
          );
          if (match?.customer_id) cid = match.customer_id;
          else {
            const full = crmInvoicesAll.find(
              (i) =>
                String(i.invoice_number || '').toLowerCase() ===
                String(fb.invoice_number).toLowerCase()
            );
            if (full?.customer_id) cid = Number(full.customer_id);
          }
        }

        if (cid != null) {
          if (!feedbackByCustomer.has(cid)) {
            feedbackByCustomer.set(cid, {
              count: 0,
              rating_sum: 0,
              rating_n: 0,
              otifef_sum: 0,
              otifef_n: 0,
              latest_rating: null,
            });
          }
          const a = feedbackByCustomer.get(cid)!;
          a.count += 1;
          const r = fb.rating != null ? Number(fb.rating) : NaN;
          if (Number.isFinite(r) && r > 0) {
            a.rating_sum += r;
            a.rating_n += 1;
            if (a.latest_rating == null) a.latest_rating = r;
          }
          const o =
            fb.otifef_score != null ? Number(fb.otifef_score) : NaN;
          if (Number.isFinite(o)) {
            a.otifef_sum += o;
            a.otifef_n += 1;
          }
        }

        if (invId != null) {
          if (!feedbackByInvoice.has(invId)) {
            feedbackByInvoice.set(invId, []);
          }
          feedbackByInvoice.get(invId)!.push(fb);
        }

        const uni = invId != null
          ? unified.find((u) => u.id === invId)
          : null;
        const orderId = uni?.order_id ?? null;
        const order = orderId
          ? ordersAll.find((o) => Number(o.id) === orderId)
          : null;
        const cust = cid != null ? customerById.get(cid) : null;

        recentFeedback.push({
          id: Number(fb.id),
          invoice_id: invId,
          invoice_number: fb.invoice_number
            ? String(fb.invoice_number)
            : uni?.number || null,
          customer_id: cid,
          customer_name: cust
            ? String(cust.trading_name || cust.legal_name || '')
            : uni?.customer_name || null,
          order_id: orderId,
          order_number: order?.order_number
            ? String(order.order_number)
            : null,
          rating: fb.rating != null ? Number(fb.rating) : null,
          otifef_score:
            fb.otifef_score != null ? Number(fb.otifef_score) : null,
          feedback_type: fb.feedback_type
            ? String(fb.feedback_type)
            : null,
          title: fb.title ? String(fb.title) : null,
          body: fb.body ? String(fb.body) : null,
          contact_name: fb.contact_name
            ? String(fb.contact_name)
            : null,
          created_at: fb.created_at ? String(fb.created_at) : null,
        });
      }
    }

    // Orders with attached invoice feedback (for per-order stars)
    const orderFeedbackRows = orders.map((o) => {
      const oid = Number(o.id);
      const inv =
        unified.find((u) => u.order_id === oid) ||
        crmInvoicesAll.find((i) => Number(i.order_id) === oid);
      const invId = inv ? Number((inv as { id: number }).id) : null;
      const fbs =
        invId != null ? feedbackByInvoice.get(invId) || [] : [];
      const ratings = fbs
        .map((f) => (f.rating != null ? Number(f.rating) : NaN))
        .filter((n) => Number.isFinite(n) && n > 0);
      const otifs = fbs
        .map((f) =>
          f.otifef_score != null ? Number(f.otifef_score) : NaN
        )
        .filter((n) => Number.isFinite(n));
      const cid = Number(o.customer_id);
      const cust = customerById.get(cid);
      return {
        order_id: oid,
        order_number: o.order_number || `SO-${oid}`,
        customer_id: Number.isFinite(cid) ? cid : null,
        customer_name: cust
          ? String(cust.trading_name || cust.legal_name || `Customer ${cid}`)
          : '—',
        total_amount: Number(o.total_amount || 0),
        status: o.status,
        created_at: o.created_at,
        invoice_id: invId,
        invoice_number: inv
          ? String(
              (inv as { invoice_number?: string; number?: string })
                .invoice_number ||
                (inv as { number?: string }).number ||
                ''
            ) || null
          : null,
        feedback_count: fbs.length,
        star_avg:
          ratings.length > 0
            ? Math.round(
                (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10
              ) / 10
            : null,
        otifef_avg:
          otifs.length > 0
            ? Math.round(
                (otifs.reduce((a, b) => a + b, 0) / otifs.length) * 10
              ) / 10
            : null,
        latest_rating: ratings[0] ?? null,
      };
    });

    const customerRows = customers.map((c) => {
      const id = Number(c.id);
      const linked = Number(c.linked_profile_id) || null;
      const ord = orderByCustomer.get(id);
      const inv = invByCustomer.get(id);
      const stars = linked ? ratingByProfile.get(linked) : undefined;
      const fb = feedbackByCustomer.get(id);
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
        order_revenue: round2(ord?.revenue || 0),
        invoice_count: inv?.count || 0,
        billed: round2(inv?.billed || 0),
        ar_open: round2(inv?.open || 0),
        // Peer ratings (seller → customer)
        star_avg: stars?.rating_avg ?? null,
        star_count: stars?.rating_count ?? 0,
        star_payment: stars?.payment ?? null,
        star_communication: stars?.communication ?? null,
        star_reliability: stars?.reliability ?? null,
        star_value: stars?.value ?? null,
        // Feedback from customer (invoice QR / OTIFEF)
        feedback_count: fb?.count || 0,
        feedback_star_avg:
          fb && fb.rating_n > 0
            ? round1(fb.rating_sum / fb.rating_n)
            : null,
        feedback_otifef_avg:
          fb && fb.otifef_n > 0
            ? round1(fb.otifef_sum / fb.otifef_n)
            : null,
        feedback_latest_rating: fb?.latest_rating ?? null,
      };
    });

    customerRows.sort(
      (a, b) =>
        b.billed - a.billed ||
        b.order_revenue - a.order_revenue ||
        a.name.localeCompare(b.name)
    );

    const starAvgs = customerRows
      .map((r) => r.star_avg)
      .filter((n): n is number => n != null && n > 0);

    const fbStars = customerRows
      .map((r) => r.feedback_star_avg)
      .filter((n): n is number => n != null && n > 0);

    const openClaims = claims.filter((c) =>
      ['open', 'submitted', 'in_review', 'pending'].includes(
        String(c.status || '').toLowerCase()
      )
    ).length;

    // Invoice detail for transparency (top 50 by total)
    const invoiceDetails = [...unified]
      .sort((a, b) => b.total - a.total)
      .slice(0, 50)
      .map((inv) => {
        const cust =
          inv.customer_id != null
            ? customerById.get(inv.customer_id)
            : null;
        const fbs = feedbackByInvoice.get(inv.id) || [];
        const ratings = fbs
          .map((f) => (f.rating != null ? Number(f.rating) : NaN))
          .filter((n) => Number.isFinite(n) && n > 0);
        return {
          id: inv.id,
          source: inv.source,
          number: inv.number,
          customer_id: inv.customer_id,
          customer_name: cust
            ? String(cust.trading_name || cust.legal_name || '')
            : inv.customer_name,
          total: round2(inv.total),
          open: round2(inv.open),
          status: inv.status,
          date: inv.date,
          order_id: inv.order_id,
          feedback_star_avg:
            ratings.length > 0
              ? round1(
                  ratings.reduce((a, b) => a + b, 0) / ratings.length
                )
              : null,
          feedback_count: fbs.length,
        };
      });

    return NextResponse.json({
      success: true,
      period: { from, to },
      kpis: {
        customersTotal: customers.length,
        customersActive: customers.filter((c) =>
          ['active', 'accepted'].includes(
            String(c.status || c.invite_status || '').toLowerCase()
          )
        ).length,
        invitePending: invites.filter((i) => String(i.status) === 'pending')
          .length,
        inviteAccepted: customers.filter(
          (c) =>
            String(c.invite_status || '').toLowerCase() === 'accepted'
        ).length,
        openLeads: openLeads.length,
        openOpportunities: openOpps.length,
        pipelineValue: round2(pipelineValue),
        weightedPipeline: round2(weightedPipeline),
        wonValue: round2(wonValue),
        ordersCount: orders.length,
        orderRevenue: round2(orderRevenue),
        invoicesCount: unified.length,
        billed: round2(billed),
        arOpen: round2(arOpen),
        unassignedBilled: round2(unassignedBilled),
        openClaims,
        starAvgGiven:
          starAvgs.length > 0
            ? round1(
                starAvgs.reduce((a, b) => a + b, 0) / starAvgs.length
              )
            : null,
        customersStarRated: starAvgs.length,
        feedbackAvgStars:
          fbStars.length > 0
            ? round1(fbStars.reduce((a, b) => a + b, 0) / fbStars.length)
            : null,
        feedbackCount: recentFeedback.length,
      },
      customers: customerRows,
      orders: orderFeedbackRows.slice(0, 100),
      invoices: invoiceDetails,
      recentFeedback: recentFeedback.slice(0, 40),
      warnings: [
        custRes.error?.message,
        orderRes.error?.message,
        crmInvMissing
          ? 'customer_invoices table missing — run CRM sales lifecycle migration'
          : crmInvRes.error?.message,
        arRes.error && !isMissing(arRes.error.message)
          ? arRes.error.message
          : null,
        claimRes.error?.message,
        ratingsMissing
          ? 'Run 20260712_company_ratings.sql for peer star ratings'
          : ratingsRes.error?.message,
        feedbackMissing
          ? 'Run 20260711_invoice_feedback.sql for customer invoice feedback stars'
          : feedbackRes.error?.message,
        unassignedBilled > 0
          ? `${formatHint(unassignedBilled)} billed is not linked to a customer record (missing customer_id).`
          : null,
      ].filter(Boolean),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function isMissing(msg?: string | null) {
  return Boolean(
    msg &&
      /does not exist|schema cache|could not find.*table|PGRST205/i.test(
        msg
      )
  );
}

function normName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function formatHint(n: number) {
  return `R${Math.round(n).toLocaleString('en-ZA')}`;
}
