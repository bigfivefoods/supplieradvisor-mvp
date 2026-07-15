import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { userIdMatchVariants } from '@/lib/auth/identity';
import {
  assertSalesPortalAccess,
  getOrCreateAgreement,
  isAgreementSigned,
  matchesSalesRep,
} from '@/lib/sales-contractor/access';
import {
  calculateCommission,
  ensureAscendingCommissionTiers,
  type CommissionTier,
} from '@/lib/sales-contractor/commission';
import type { SalesPortalSummary } from '@/lib/sales-contractor/types';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { resolveProgramSettings } from '@/lib/sales-program';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
}

/**
 * GET ?companyId=&privyUserId=
 * World-class sales contractor dashboard payload.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const ctx = await assertSalesPortalAccess(privyUserId, companyId);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const agrRes = await getOrCreateAgreement({
      companyId,
      memberId: ctx.memberId,
      userId: ctx.userId,
      name: ctx.name,
      email: ctx.email,
    });
    const agreement = agrRes.ok ? agrRes.agreement : null;
    const program = await resolveProgramSettings(companyId);
    const signed = agreement?.status === 'signed';
    const tiers: CommissionTier[] = ensureAscendingCommissionTiers(
      signed && agreement?.commission_tiers?.length
        ? agreement.commission_tiers
        : program.commission_tiers?.length
          ? program.commission_tiers
          : agreement?.commission_tiers || []
    );
    const variants = userIdMatchVariants(ctx.userId);
    const scopeMine = ctx.isSalesContractor;
    const subscriptionActive =
      ctx.subscriptionExempt || Boolean(agreement?.subscription?.isActive);

    const supabase = getSupabaseServer();

    const [leadsR, custR, oppR, quotesR, invR, ledgerR] = await Promise.all([
      supabase.from('leads').select('*').eq('profile_id', companyId).limit(800),
      supabase.from('customers').select('*').eq('profile_id', companyId).limit(800),
      supabase.from('opportunities').select('*').eq('profile_id', companyId).limit(800),
      supabase
        .from('customer_quotes')
        .select('*')
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('customer_invoices')
        .select('*')
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('sales_commission_ledger')
        .select('*')
        .eq('profile_id', companyId)
        .in('sales_rep_user_id', variants)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const filterMine = <T extends Record<string, unknown>>(rows: T[] | null | undefined) => {
      const list = rows || [];
      if (!scopeMine) return list;
      // Sales contractor: prefer attributed rows; if none attributed yet, show all company so they can work
      const mine = list.filter((r) =>
        matchesSalesRep(
          r as { sales_rep_user_id?: string; created_by?: string },
          ctx.userId,
          variants
        )
      );
      return mine.length > 0 ? mine : list;
    };

    const leads = filterMine(leadsR.data as Record<string, unknown>[]);
    const customers = filterMine(custR.data as Record<string, unknown>[]);
    const opps = filterMine(oppR.data as Record<string, unknown>[]);
    const quotes = filterMine(quotesR.data as Record<string, unknown>[]);
    const invoices = filterMine(invR.data as Record<string, unknown>[]);
    const ledger = ledgerR.data || [];

    const openLeads = leads.filter(
      (l) => !['converted', 'unqualified', 'recycled'].includes(String(l.status || ''))
    );
    const openOpps = opps.filter((o) => String(o.status || 'open') === 'open');
    const pipelineValue = openOpps.reduce(
      (s, o) => s + Number(o.amount || o.opportunity_size || 0),
      0
    );
    const weightedPipeline = openOpps.reduce((s, o) => {
      const amt = Number(o.amount || o.opportunity_size || 0);
      const p = Number(o.probability || 10) / 100;
      return s + amt * p;
    }, 0);
    const won = opps.filter((o) => String(o.status) === 'won' || String(o.stage) === 'closed_won');
    const wonValue = won.reduce((s, o) => s + Number(o.amount || o.opportunity_size || 0), 0);

    const openQuotes = quotes.filter((q) =>
      ['draft', 'sent'].includes(String(q.status || 'draft'))
    );
    const quotesValue = openQuotes.reduce((s, q) => s + Number(q.total_amount || 0), 0);

    const openInvoices = invoices.filter((i) =>
      ['draft', 'sent', 'partial', 'overdue'].includes(String(i.status || 'draft'))
    );
    const invoicesValue = openInvoices.reduce(
      (s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
      0
    );

    const earnedCommission = ledger
      .filter((r) => ['earned', 'approved', 'paid'].includes(String(r.status)))
      .reduce((s, r) => s + Number(r.commission_amount || 0), 0);
    const paidCommission = ledger
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + Number(r.commission_amount || 0), 0);

    // Projected from open pipeline + quotes
    const projectedFromPipeline = openOpps.reduce((s, o) => {
      const amt = Number(o.amount || o.opportunity_size || 0);
      const p = Number(o.probability || 10) / 100;
      return s + calculateCommission(amt * p, { tiers }).commissionAmount;
    }, 0);
    const projectedFromQuotes = openQuotes.reduce((s, q) => {
      return s + calculateCommission(Number(q.total_amount || 0), { tiers }).commissionAmount;
    }, 0);
    const projectedCommission = projectedFromPipeline + projectedFromQuotes;

    // Monthly series (last 6 months)
    const now = new Date();
    const pipelineByMonth: SalesPortalSummary['pipelineByMonth'] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const label = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      const monthQuotes = quotes.filter((q) => {
        const t = q.created_at || q.updated_at;
        return t && String(t).startsWith(key);
      });
      const monthInv = invoices.filter((inv) => {
        const t = inv.paid_at || inv.updated_at || inv.created_at;
        return t && String(t).startsWith(key) && inv.status === 'paid';
      });
      const projected = monthQuotes.reduce(
        (s, q) => s + calculateCommission(Number(q.total_amount || 0), { tiers }).commissionAmount,
        0
      );
      const earned = monthInv.reduce(
        (s, inv) =>
          s + calculateCommission(Number(inv.total_amount || 0), { tiers }).commissionAmount,
        0
      );
      pipelineByMonth.push({ month: label, projected, earned });
    }

    // 90-day forecast by week from open opps expected close
    const forecastNext90: SalesPortalSummary['forecastNext90'] = [];
    for (let w = 0; w < 12; w++) {
      const start = new Date(now);
      start.setDate(start.getDate() + w * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const inWeek = openOpps.filter((o) => {
        const raw = o.expected_close_date || o.estimated_date;
        if (!raw) return w === 0; // undated → first week bucket
        const dt = new Date(String(raw));
        return dt >= start && dt < end;
      });
      const amount = inWeek.reduce(
        (s, o) => s + Number(o.amount || o.opportunity_size || 0) * (Number(o.probability || 20) / 100),
        0
      );
      forecastNext90.push({
        week: weekLabel(start),
        amount: Math.round(amount),
        commission: calculateCommission(amount, { tiers }).commissionAmount,
      });
    }

    const topDeals = openOpps
      .map((o) => {
        const amount = Number(o.amount || o.opportunity_size || 0);
        const c = calculateCommission(amount, { tiers });
        return {
          id: Number(o.id),
          name: String(o.name || o.company_name || 'Opportunity'),
          amount,
          stage: String(o.stage || 'prospecting'),
          commission: c.commissionAmount,
          type: 'opportunity',
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // Also surface open quotes as deals
    for (const q of openQuotes.slice(0, 5)) {
      const amount = Number(q.total_amount || 0);
      const c = calculateCommission(amount, { tiers });
      topDeals.push({
        id: Number(q.id),
        name: String(q.customer_name || q.quote_number || 'Quote'),
        amount,
        stage: String(q.status || 'draft'),
        commission: c.commissionAmount,
        type: 'quote',
      });
    }
    topDeals.sort((a, b) => b.amount - a.amount);

    const sampleAmounts = [25_000, 75_000, 200_000, 500_000, 1_500_000];
    const samples = sampleAmounts.map((amount) => {
      const r = calculateCommission(amount, { tiers });
      return {
        amount,
        commission: r.commissionAmount,
        effectiveRatePct: r.effectiveRatePct,
      };
    });

    const recentActivity: SalesPortalSummary['recentActivity'] = [
      ...openQuotes.slice(0, 5).map((q) => ({
        id: `q-${q.id}`,
        label: `Quote ${q.quote_number || q.id} · ${q.customer_name || 'Customer'}`,
        amount: Number(q.total_amount || 0),
        commission: calculateCommission(Number(q.total_amount || 0), { tiers }).commissionAmount,
        at: String(q.updated_at || q.created_at || now.toISOString()),
      })),
      ...ledger.slice(0, 5).map((r) => ({
        id: `l-${r.id}`,
        label: `${r.status} commission · ${r.customer_name || r.source_type}`,
        amount: Number(r.deal_amount || 0),
        commission: Number(r.commission_amount || 0),
        at: String(r.created_at || now.toISOString()),
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 10);

    const summary: SalesPortalSummary = {
      companyName: ctx.companyName,
      roleLabel: ctx.isSalesContractor ? 'Sales contractor' : String(ctx.role),
      agreementSigned: ctx.subscriptionExempt || isAgreementSigned(agreement),
      subscriptionActive,
      subscriptionExempt: ctx.subscriptionExempt,
      subscription: agreement?.subscription || null,
      agreement,
      kpis: {
        myLeads: openLeads.length,
        myCustomers: customers.filter((c) => String(c.status || 'active') !== 'inactive').length,
        openPipeline: openOpps.length,
        weightedPipeline: Math.round(weightedPipeline),
        quotesOpen: openQuotes.length,
        quotesValue: Math.round(quotesValue),
        invoicesOpen: openInvoices.length,
        invoicesValue: Math.round(invoicesValue),
        earnedCommission: Math.round(earnedCommission * 100) / 100,
        projectedCommission: Math.round(projectedCommission * 100) / 100,
        paidCommission: Math.round(paidCommission * 100) / 100,
        wonDeals: won.length,
        wonValue: Math.round(wonValue),
      },
      pipelineByMonth,
      forecastNext90,
      topDeals: topDeals.slice(0, 8),
      recentActivity,
      commissionPreview: { sampleAmounts, samples },
    };

    return NextResponse.json({ success: true, summary });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
