import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type DashboardActivity = {
  id: string;
  title: string;
  subtitle: string;
  at: string | null;
  type: 'team' | 'network' | 'risk' | 'invite' | 'supplier' | 'system';
};

export type DashboardAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  href: string;
};

/**
 * POST /api/dashboard/summary
 * Body: { companyId: string | number }
 * Aggregates live Supabase metrics for the selected company workspace.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = body.companyId != null ? Number(body.companyId) : NaN;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data: company, error: companyError } = await supabase
      .from('profiles')
      .select(
        `id, user_id, trading_name, legal_name, industry, industries, business_type, country, city,
         verification_status, verified_at, supplier_status, status, relationship_type,
         trust_score, logo_url, short_description, email, contact_name, contact_phone,
         wallet_address, created_at, updated_at`
      )
      .eq('id', companyId)
      .maybeSingle();

    if (companyError) {
      console.error('dashboard company error:', companyError);
      return NextResponse.json({ error: companyError.message }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const did = company.user_id ? String(company.user_id) : null;

    const [
      teamRes,
      invitesRes,
      riadRes,
      productsRes,
      projectsRes,
      documentsRes,
      companyDocsRes,
      suppliersRes,
      connectionsProfileRes,
      connectionsDidRes,
    ] = await Promise.all([
      supabase
        .from('business_users')
        .select('id, name, email, invited_email, role, status, created_at, joined_at, invited_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false }),

      supabase
        .from('invitations')
        .select('id, invited_email, role, status, created_at, expires_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('riad_logs')
        .select('id, title, riad_type, status, severity, rpn, created_at, stakeholder_type')
        .eq('owner_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),

      supabase
        .from('projects')
        .select('id, title, status, progress, updated_at')
        .eq('profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(10),

      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),

      supabase
        .from('company_documents')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),

      supabase
        .from('profiles')
        .select(
          'id, trading_name, supplier_status, verification_status, invited_at, claimed_at, created_at, relationship_type'
        )
        .or('relationship_type.eq.supplier,is_supplier.eq.true')
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('business_connections')
        .select(
          'id, status, requested_at, accepted_at, requester_profile_id, requestee_profile_id, requester_id, requestee_id'
        )
        .or(`requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`),

      did
        ? supabase
            .from('business_connections')
            .select('id, status, requested_at, accepted_at, requester_id, requestee_id, message')
            .or(`requester_id.eq.${did},requestee_id.eq.${did}`)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    ]);

    const team = teamRes.data || [];
    const invites = invitesRes.data || [];
    const riads = riadRes.data || [];
    const projects = projectsRes.data || [];
    const supplierProfiles = suppliersRes.data || [];

    const connectionMap = new Map<string | number, Record<string, unknown>>();
    for (const c of [...(connectionsProfileRes.data || []), ...(connectionsDidRes.data || [])]) {
      if (c && (c as { id?: unknown }).id != null) {
        connectionMap.set((c as { id: string | number }).id, c as Record<string, unknown>);
      }
    }
    const connections = Array.from(connectionMap.values()) as Array<{
      id: string | number;
      status?: string;
      requested_at?: string | null;
      accepted_at?: string | null;
    }>;

    const teamActive = team.filter((m) => m.status === 'active').length;
    const teamInvited = team.filter((m) => m.status === 'invited' || m.status === 'pending').length;

    const connectionsAccepted = connections.filter(
      (c) => c.status === 'accepted' || c.status === 'approved'
    ).length;
    const connectionsPending = connections.filter((c) => c.status === 'pending').length;

    const openRisks = riads.filter(
      (r) => r.status === 'active' || r.status === 'open' || r.status === 'in_progress'
    );
    const highRisks = openRisks.filter(
      (r) =>
        (r.severity && String(r.severity).toLowerCase() === 'high') ||
        (typeof r.rpn === 'number' && r.rpn >= 15)
    );

    const pendingInvites = invites.filter((i) => i.status === 'pending' || i.status === 'invited');

    const activeSuppliers = supplierProfiles.filter(
      (s) => s.supplier_status === 'active' || s.verification_status === 'verified'
    ).length;
    const invitedSuppliers = supplierProfiles.filter((s) => s.supplier_status === 'invited').length;

    const productsCount = productsRes.count ?? 0;
    const documentsCount = (documentsRes.count ?? 0) + (companyDocsRes.count ?? 0);

    const activity: DashboardActivity[] = [];

    for (const m of team.slice(0, 5)) {
      activity.push({
        id: `team-${m.id}`,
        title:
          m.status === 'active'
            ? `${m.name || m.email || 'Team member'} joined`
            : `Invited ${m.name || m.invited_email || m.email || 'teammate'}`,
        subtitle: `${m.role || 'Member'} · ${m.status}`,
        at: m.joined_at || m.invited_at || m.created_at,
        type: 'team',
      });
    }

    for (const inv of pendingInvites.slice(0, 3)) {
      activity.push({
        id: `inv-${inv.id}`,
        title: `Pending invite to ${inv.invited_email}`,
        subtitle: inv.role || 'Team member',
        at: inv.created_at,
        type: 'invite',
      });
    }

    for (const r of riads.slice(0, 5)) {
      activity.push({
        id: `riad-${r.id}`,
        title: r.title || `${r.riad_type || 'RIAD'} logged`,
        subtitle: `${r.riad_type || 'item'} · ${r.status || 'open'}${r.rpn != null ? ` · RPN ${r.rpn}` : ''}`,
        at: r.created_at,
        type: 'risk',
      });
    }

    for (const c of connections.slice(0, 5)) {
      activity.push({
        id: `conn-${c.id}`,
        title:
          c.status === 'accepted' || c.status === 'approved'
            ? 'Connection accepted'
            : 'Connection request',
        subtitle: c.status || 'pending',
        at: c.accepted_at || c.requested_at || null,
        type: 'network',
      });
    }

    for (const s of supplierProfiles.slice(0, 4)) {
      activity.push({
        id: `sup-${s.id}`,
        title:
          s.supplier_status === 'active'
            ? `Supplier active: ${s.trading_name}`
            : `Supplier listed: ${s.trading_name}`,
        subtitle: s.supplier_status || s.relationship_type || 'supplier',
        at: s.claimed_at || s.invited_at || s.created_at,
        type: 'supplier',
      });
    }

    activity.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });

    const alerts: DashboardAlert[] = [];

    if (company.verification_status !== 'verified') {
      alerts.push({
        id: 'verify',
        severity: 'warning',
        title: 'Company not fully verified',
        detail: 'Complete verification to unlock trust badges and preferred network status.',
        href: '/dashboard/my-business/profile',
      });
    }

    if (teamInvited > 0) {
      alerts.push({
        id: 'team-pending',
        severity: 'info',
        title: `${teamInvited} team invitation${teamInvited === 1 ? '' : 's'} pending`,
        detail: 'Follow up so teammates can accept and start collaborating.',
        href: '/dashboard/my-business/team',
      });
    }

    if (pendingInvites.length > 0) {
      alerts.push({
        id: 'invites',
        severity: 'info',
        title: `${pendingInvites.length} open invitation${pendingInvites.length === 1 ? '' : 's'}`,
        detail: 'Invitations waiting to be accepted.',
        href: '/dashboard/my-business/team',
      });
    }

    if (connectionsPending > 0) {
      alerts.push({
        id: 'network-pending',
        severity: 'warning',
        title: `${connectionsPending} network connection${connectionsPending === 1 ? '' : 's'} pending`,
        detail: 'Review and accept or follow up on connection requests.',
        href: '/dashboard/network',
      });
    }

    if (openRisks.length > 0) {
      alerts.push({
        id: 'risks',
        severity: highRisks.length > 0 ? 'critical' : 'warning',
        title: `${openRisks.length} open RIAD item${openRisks.length === 1 ? '' : 's'}`,
        detail:
          highRisks.length > 0
            ? `${highRisks.length} high-priority — review the RIAD log.`
            : 'Monitor and close out active risks, issues, assumptions, and dependencies.',
        href: '/dashboard/my-business/riad-log',
      });
    }

    if (productsCount === 0) {
      alerts.push({
        id: 'products',
        severity: 'info',
        title: 'No products catalogued yet',
        detail: 'Add products to enable purchase orders and inventory modules.',
        href: '/dashboard/inventory/products',
      });
    }

    const supplierHealth = Math.min(
      100,
      Math.round(
        (activeSuppliers / Math.max(supplierProfiles.length || 1, 1)) * 70 +
          (company.verification_status === 'verified' ? 20 : 0) +
          (connectionsAccepted > 0 ? 10 : 0)
      )
    );

    const fulfillmentSignal =
      productsCount > 0 || connectionsAccepted > 0
        ? Math.min(100, 50 + productsCount * 5 + Math.min(connectionsAccepted, 10) * 3)
        : 35;

    const riskScoreLabel =
      highRisks.length >= 3
        ? 'High'
        : openRisks.length >= 2
          ? 'Medium'
          : openRisks.length === 1
            ? 'Low'
            : 'Stable';

    const riskBar =
      highRisks.length >= 3 ? 85 : openRisks.length >= 2 ? 55 : openRisks.length === 1 ? 30 : 15;

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        trading_name: company.trading_name,
        legal_name: company.legal_name,
        industry:
          company.industry ||
          (Array.isArray(company.industries) ? company.industries[0] : null),
        business_type: company.business_type,
        country: company.country,
        city: company.city,
        verification_status: company.verification_status,
        verified_at: company.verified_at,
        supplier_status: company.supplier_status,
        status: company.status,
        relationship_type: company.relationship_type,
        trust_score: company.trust_score,
        logo_url: company.logo_url,
        short_description: company.short_description,
        contact_name: company.contact_name,
        email: company.email,
      },
      kpis: {
        teamActive,
        teamInvited,
        teamTotal: team.length,
        networkAccepted: connectionsAccepted,
        networkPending: connectionsPending,
        networkTotal: connections.length,
        suppliersTotal: supplierProfiles.length,
        suppliersActive: activeSuppliers,
        suppliersInvited: invitedSuppliers,
        openRisks: openRisks.length,
        highRisks: highRisks.length,
        products: productsCount,
        documents: documentsCount,
        projects: projects.length,
        pendingInvites: pendingInvites.length,
      },
      health: {
        supplierHealth,
        fulfillmentSignal,
        riskScoreLabel,
        riskBar,
      },
      activity: activity.slice(0, 8),
      alerts: alerts.slice(0, 6),
      teamPreview: team.slice(0, 5).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email || m.invited_email,
        role: m.role,
        status: m.status,
      })),
      projectsPreview: projects.slice(0, 4),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Dashboard summary failed';
    console.error('dashboard summary error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
