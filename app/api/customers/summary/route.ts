import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { stageProbability } from '@/lib/customers/types';
import { assertCustomersAccess } from '@/lib/customers/access';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCustomersAccess(privyUserId, companyId, 'view');
      if (!mem.ok) {
        return NextResponse.json({ error: mem.error }, { status: mem.status });
      }
    }
    const supabase = getSupabaseServer();

    const [customers, leads, opportunities, invitations] = await Promise.all([
      supabase
        .from('customers')
        .select('id, status, invite_status')
        .eq('profile_id', companyId),
      supabase
        .from('leads')
        .select('id, status, value_estimate, priority, next_action_date')
        .eq('profile_id', companyId),
      supabase
        .from('opportunities')
        .select(
          'id, stage, status, amount, opportunity_size, probability, expected_close_date, estimated_date'
        )
        .eq('profile_id', companyId),
      supabase
        .from('customer_invitations')
        .select('id, status')
        .eq('profile_id', companyId),
    ]);

    const cust = customers.data || [];
    const leadRows = leads.data || [];
    const oppRows = opportunities.data || [];
    const invRows = invitations.data || [];

    const openLeads = leadRows.filter(
      (l) => !['converted', 'unqualified', 'recycled'].includes(String(l.status || ''))
    );
    const openOpps = oppRows.filter((o) => {
      const s = String(o.stage || o.status || '').toLowerCase();
      return !['closed_won', 'closed_lost', 'won', 'lost'].includes(s);
    });
    const won = oppRows.filter((o) => {
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

    const overdueFollowups = leadRows.filter((l) => {
      if (!l.next_action_date) return false;
      if (['converted', 'unqualified', 'recycled'].includes(String(l.status || ''))) return false;
      return new Date(l.next_action_date).getTime() < Date.now();
    }).length;

    // CRM relationship-phase counts (customers.invite_status)
    const invitePending = cust.filter(
      (c) => String(c.invite_status || '').toLowerCase() === 'invited'
    ).length;
    const inviteAccepted = cust.filter(
      (c) => String(c.invite_status || '').toLowerCase() === 'accepted'
    ).length;
    const inviteSuspended = cust.filter(
      (c) => String(c.invite_status || '').toLowerCase() === 'suspended'
    ).length;
    const inviteExpired = cust.filter(
      (c) => String(c.invite_status || '').toLowerCase() === 'expired'
    ).length;
    const inviteDeclined = cust.filter(
      (c) => String(c.invite_status || '').toLowerCase() === 'declined'
    ).length;
    const inviteNotInvited = cust.filter((c) => {
      const s = String(c.invite_status || 'not_invited').toLowerCase();
      return s === 'not_invited' || s === '';
    }).length;

    // Invitation-attempt counts (customer_invitations.status)
    const invitationsPending = invRows.filter(
      (i) => String(i.status || '').toLowerCase() === 'pending'
    ).length;
    const invitationsClaiming = invRows.filter(
      (i) => String(i.status || '').toLowerCase() === 'claiming'
    ).length;
    const invitationsExpired = invRows.filter(
      (i) => String(i.status || '').toLowerCase() === 'expired'
    ).length;

    return NextResponse.json({
      success: true,
      summary: {
        customers: cust.length,
        customersActive: cust.filter((c) => c.status === 'active').length,
        leads: leadRows.length,
        leadsOpen: openLeads.length,
        opportunities: oppRows.length,
        opportunitiesOpen: openOpps.length,
        pipelineValue,
        weightedPipeline: Math.round(weightedPipeline),
        wonValue,
        wonCount: won.length,
        overdueFollowups,
        // Platform invite relationship phase (CRM)
        invitePending,
        inviteAccepted,
        inviteSuspended,
        inviteExpired,
        inviteDeclined,
        inviteNotInvited,
        // Invitation attempt rows (optional detail)
        invitationsPending,
        invitationsClaiming,
        invitationsExpired,
        invitationsTotal: invRows.length,
      },
      warnings: [customers.error, leads.error, opportunities.error, invitations.error]
        .filter(Boolean)
        .map((e) => (e as { message: string }).message),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
