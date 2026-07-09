import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type DashboardActivity = {
  id: string;
  title: string;
  subtitle: string;
  at: string | null;
  type: 'team' | 'network' | 'risk' | 'invite' | 'supplier' | 'system' | 'container' | 'inventory' | 'contractor';
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
 * Live Supabase command-center metrics for the selected company.
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
      return NextResponse.json({ error: companyError.message }, { status: 500 });
    }
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const did = company.user_id ? String(company.user_id) : null;

    const [
      teamRes,
      invitesRes,
      riadByProfile,
      riadByOwner,
      productsRes,
      projectsRes,
      documentsRes,
      companyDocsRes,
      suppliersRes,
      connectionsProfileRes,
      connectionsDidRes,
      containersRes,
      contractorsRes,
      containerInvRes,
      containerSalesRes,
      stockLevelsRes,
      warehousesRes,
      // CRM
      customersRes,
      leadsRes,
      opportunitiesRes,
      customerInvitesRes,
      // SRM
      srmSuppliersRes,
      srmInvitesRes,
      srmPosRes,
      customerRiadRes,
      supplierRiadRes,
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
        .select(
          'id, title, riad_type, status, severity, rpn, priority, container_id, source, created_at, module'
        )
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(80),

      supabase
        .from('riad_logs')
        .select(
          'id, title, riad_type, status, severity, rpn, priority, container_id, source, created_at, module'
        )
        .eq('owner_id', companyId)
        .order('created_at', { ascending: false })
        .limit(40),

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

      supabase
        .from('containers')
        .select('id, name, container_code, status, city, contractor_id, assigned_contractor, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false }),

      supabase
        .from('container_contractors')
        .select(
          'id, full_name, email, status, portal_status, verification_status, training_status, created_at, contract_accepted_at, id_number'
        )
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false }),

      supabase
        .from('container_inventory')
        .select('id, qty_on_hand, reorder_level, product_name, container_id')
        .eq('profile_id', companyId),

      supabase
        .from('container_sales')
        .select('id, gross_amount, sale_date, container_id, created_at')
        .eq('profile_id', companyId)
        .order('sale_date', { ascending: false })
        .limit(100),

      supabase
        .from('stock_levels')
        .select('id, qty_on_hand, qty_reserved, reorder_level, product_id')
        .eq('profile_id', companyId),

      supabase
        .from('warehouses')
        .select('id, name, status')
        .eq('profile_id', companyId),

      supabase
        .from('customers')
        .select('id, status, invite_status, trading_name, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),

      supabase
        .from('leads')
        .select('id, status, name, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('opportunities')
        .select('id, stage, status, amount, name, updated_at')
        .eq('profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(100),

      supabase
        .from('customer_invitations')
        .select('id, status, email, company_name, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('srm_suppliers')
        .select(
          'id, trading_name, status, invite_status, trust_score, otifef_pct, verified, linked_profile_id, created_at'
        )
        .eq('profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(200),

      supabase
        .from('supplier_invitations')
        .select('id, status, email, company_name, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('purchase_orders')
        .select('id, status, total_amount, supplier_id, created_at, onchain_po_id')
        .eq('buyer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('customer_riad')
        .select('id, title, entry_type, status, severity, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(40),

      supabase
        .from('supplier_riad')
        .select('id, title, entry_type, status, severity, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    const team = teamRes.data || [];
    const invites = invitesRes.data || [];
    const riadMap = new Map<number, Record<string, unknown>>();
    for (const r of [...(riadByProfile.data || []), ...(riadByOwner.data || [])]) {
      if (r?.id != null) riadMap.set(r.id, r);
    }
    const riads = Array.from(riadMap.values()) as Array<{
      id: number;
      title?: string;
      riad_type?: string;
      status?: string;
      severity?: unknown;
      rpn?: number | null;
      priority?: string | null;
      container_id?: number | null;
      source?: string | null;
      created_at?: string;
      module?: string | null;
    }>;

    const projects = projectsRes.data || [];
    const supplierProfiles = suppliersRes.data || [];
    const containers = containersRes.data || [];
    const contractors = contractorsRes.data || [];
    const containerInv = containerInvRes.data || [];
    const containerSales = containerSalesRes.data || [];
    const stockLevels = stockLevelsRes.data || [];
    const warehouses = warehousesRes.data || [];

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

    const openRisks = riads.filter((r) =>
      ['active', 'open', 'in_progress', 'on_hold', 'mitigated'].includes(
        String(r.status || '').toLowerCase()
      )
    );
    const highRisks = openRisks.filter(
      (r) =>
        r.priority === 'critical' ||
        r.priority === 'high' ||
        (typeof r.rpn === 'number' && r.rpn >= 50) ||
        (r.severity && String(r.severity).toLowerCase() === 'high')
    );
    const containerRiads = riads.filter(
      (r) => r.module === 'containers' || r.container_id != null
    );

    const pendingInvites = invites.filter((i) => i.status === 'pending' || i.status === 'invited');

    const activeSuppliers = supplierProfiles.filter(
      (s) => s.supplier_status === 'active' || s.verification_status === 'verified'
    ).length;
    const invitedSuppliers = supplierProfiles.filter((s) => s.supplier_status === 'invited').length;

    const productsCount = productsRes.count ?? 0;
    const documentsCount = (documentsRes.count ?? 0) + (companyDocsRes.count ?? 0);

    const containersActive = containers.filter(
      (c) => !c.status || c.status === 'active'
    ).length;
    const contractorsActive = contractors.filter((c) => c.status === 'active').length;
    const contractorsVerified = contractors.filter(
      (c) => c.verification_status === 'verified'
    ).length;
    const contractorsPortal = contractors.filter(
      (c) => c.portal_status === 'active' || c.contract_accepted_at
    ).length;

    const containerLowStock = containerInv.filter(
      (i) => Number(i.qty_on_hand) <= Number(i.reorder_level || 0)
    ).length;
    const containerUnits = containerInv.reduce((s, i) => s + Number(i.qty_on_hand || 0), 0);

    const today = new Date().toISOString().slice(0, 10);
    const salesToday = containerSales
      .filter((s) => s.sale_date === today)
      .reduce((s, row) => s + Number(row.gross_amount || 0), 0);

    const warehouseStockUnits = stockLevels.reduce(
      (s, i) => s + Number(i.qty_on_hand || 0),
      0
    );
    const warehouseLowStock = stockLevels.filter(
      (i) => Number(i.qty_on_hand) <= Number(i.reorder_level || 0)
    ).length;

    // Activity feed
    const activity: DashboardActivity[] = [];

    for (const m of team.slice(0, 4)) {
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

    for (const c of containers.slice(0, 5)) {
      activity.push({
        id: `ctr-${c.id}`,
        title: `Container: ${c.name}`,
        subtitle: `${c.container_code || '—'} · ${c.status || 'active'}${
          c.assigned_contractor ? ` · ${c.assigned_contractor}` : ''
        }`,
        at: c.created_at,
        type: 'container',
      });
    }

    for (const c of contractors.slice(0, 4)) {
      activity.push({
        id: `op-${c.id}`,
        title: `Contractor: ${c.full_name}`,
        subtitle: `${c.verification_status || 'unverified'} · portal ${c.portal_status || '—'}`,
        at: c.contract_accepted_at || c.created_at,
        type: 'contractor',
      });
    }

    for (const r of riads.slice(0, 6)) {
      activity.push({
        id: `riad-${r.id}`,
        title: r.title || `${r.riad_type || 'RIAD'} logged`,
        subtitle: `${r.riad_type || 'item'} · ${r.status || 'open'}${
          r.rpn != null ? ` · RPN ${r.rpn}` : ''
        }${r.source === 'contractor' ? ' · contractor' : ''}`,
        at: r.created_at || null,
        type: 'risk',
      });
    }

    for (const sale of containerSales.slice(0, 3)) {
      activity.push({
        id: `sale-${sale.id}`,
        title: `Container sale R ${Number(sale.gross_amount || 0).toFixed(0)}`,
        subtitle: sale.sale_date || 'sale',
        at: sale.created_at || sale.sale_date || null,
        type: 'inventory',
      });
    }

    for (const c of connections.slice(0, 3)) {
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

    // Note: CRM/SRM activity + final sort applied after those queries resolve below

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

    if (containers.length === 0) {
      alerts.push({
        id: 'containers-empty',
        severity: 'info',
        title: 'No retail containers yet',
        detail: 'Add your first container outlet, pin GPS, and appoint a contractor.',
        href: '/dashboard/containers/manage',
      });
    }

    if (contractors.some((c) => c.verification_status !== 'verified' && c.id_number)) {
      const n = contractors.filter((c) => c.verification_status !== 'verified').length;
      alerts.push({
        id: 'contractor-verify',
        severity: 'warning',
        title: `${n} contractor${n === 1 ? '' : 's'} not VerifyNow-verified`,
        detail: 'Run SA ID checks and attach ID documents on the Contractors page.',
        href: '/dashboard/containers/contractors',
      });
    }

    if (containerLowStock > 0) {
      alerts.push({
        id: 'container-low-stock',
        severity: 'warning',
        title: `${containerLowStock} container stock line${containerLowStock === 1 ? '' : 's'} low`,
        detail: 'Review outlet inventory and place replenishment orders.',
        href: '/dashboard/containers/manage',
      });
    }

    if (warehouseLowStock > 0) {
      alerts.push({
        id: 'wh-low-stock',
        severity: 'warning',
        title: `${warehouseLowStock} warehouse SKU${warehouseLowStock === 1 ? '' : 's'} at reorder`,
        detail: 'Open Inventory to replenish or transfer stock.',
        href: '/dashboard/inventory',
      });
    }

    if (openRisks.length > 0) {
      alerts.push({
        id: 'risks',
        severity: highRisks.length > 0 ? 'critical' : 'warning',
        title: `${openRisks.length} open RIAD item${openRisks.length === 1 ? '' : 's'}`,
        detail:
          highRisks.length > 0
            ? `${highRisks.length} high/critical — review Container RIAD log.`
            : 'Monitor risks, issues, actions, and decisions across the business.',
        href: '/dashboard/containers/riad-log',
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

    if (productsCount === 0) {
      alerts.push({
        id: 'products',
        severity: 'info',
        title: 'Build your inventory catalogue',
        detail: 'Add products with SKUs and QR codes for world-class stock control.',
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

    const fulfillmentSignal = Math.min(
      100,
      30 +
        Math.min(productsCount, 20) * 2 +
        Math.min(containersActive, 10) * 3 +
        Math.min(connectionsAccepted, 10) * 2 +
        (warehouseStockUnits > 0 || containerUnits > 0 ? 15 : 0)
    );

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

    // ── CRM pulse ────────────────────────────────────────────────────────────
    const customers = customersRes.error ? [] : customersRes.data || [];
    const leads = leadsRes.error ? [] : leadsRes.data || [];
    const opportunities = opportunitiesRes.error ? [] : opportunitiesRes.data || [];
    const customerInvites = customerInvitesRes.error ? [] : customerInvitesRes.data || [];

    const openLeadStatuses = new Set(['new', 'contacted', 'working', 'qualified', 'recycled']);
    const openLeads = leads.filter((l) => openLeadStatuses.has(String(l.status || '').toLowerCase()));
    const openOppStages = new Set([
      'prospecting',
      'qualification',
      'needs_analysis',
      'proposal',
      'negotiation',
    ]);
    const openOpps = opportunities.filter(
      (o) =>
        openOppStages.has(String(o.stage || '').toLowerCase()) &&
        String(o.status || 'open').toLowerCase() !== 'closed_lost'
    );
    const pipelineValue = openOpps.reduce((s, o) => s + Number(o.amount || 0), 0);
    const wonOpps = opportunities.filter(
      (o) => String(o.stage || '').toLowerCase() === 'closed_won'
    );
    const customersActive = customers.filter(
      (c) => !c.status || ['active', 'customer'].includes(String(c.status).toLowerCase())
    ).length;
    const crmInvitePending = customerInvites.filter((i) => i.status === 'pending').length;
    const crmInviteAccepted =
      customers.filter((c) => c.invite_status === 'accepted').length ||
      customerInvites.filter((i) => i.status === 'accepted').length;

    // ── SRM pulse ────────────────────────────────────────────────────────────
    const srmBook = srmSuppliersRes.error ? [] : srmSuppliersRes.data || [];
    const srmInvites = srmInvitesRes.error ? [] : srmInvitesRes.data || [];
    const srmPos = srmPosRes.error ? [] : srmPosRes.data || [];
    const srmConnected = srmBook.filter(
      (s) => s.invite_status === 'accepted' || s.linked_profile_id
    ).length;
    const srmPreferred = srmBook.filter((s) => s.status === 'preferred' || s.status === 'active')
      .length;
    const srmInvitePending = srmInvites.filter((i) => i.status === 'pending').length;
    const srmVerified = srmBook.filter((s) => s.verified).length;
    const srmAvgTrust =
      srmBook.length > 0
        ? Math.round(
            (srmBook.reduce((s, r) => s + Number(r.trust_score || 0), 0) / srmBook.length) * 10
          ) / 10
        : 0;
    const srmAvgOtifef =
      srmBook.length > 0
        ? Math.round(
            (srmBook.reduce((s, r) => s + Number(r.otifef_pct || 0), 0) / srmBook.length) * 10
          ) / 10
        : 0;
    const openPoStatuses = new Set(['draft', 'sent', 'accepted', 'funded']);
    const srmOpenPos = srmPos.filter((p) => openPoStatuses.has(String(p.status || '').toLowerCase()));
    const srmOnchainPos = srmPos.filter((p) => p.onchain_po_id != null && p.onchain_po_id !== '');

    // Customer + supplier RIAD open counts
    const openLike = (s?: string | null) =>
      ['open', 'active', 'in_progress', 'on_hold', 'mitigated'].includes(
        String(s || '').toLowerCase()
      );
    const crmRiadOpen = (customerRiadRes.error ? [] : customerRiadRes.data || []).filter((r) =>
      openLike(r.status)
    ).length;
    const srmRiadOpen = (supplierRiadRes.error ? [] : supplierRiadRes.data || []).filter((r) =>
      openLike(r.status)
    ).length;

    // Profile completeness (My Business)
    const completenessFields = [
      !!company.trading_name,
      !!company.legal_name,
      !!company.email,
      !!company.contact_name,
      !!company.industry,
      !!company.country,
      !!company.city,
      !!company.wallet_address,
    ];
    const profileCompleteness = Math.round(
      (completenessFields.filter(Boolean).length / completenessFields.length) * 100
    );

    // Enrich activity with CRM / SRM
    for (const c of customers.slice(0, 3)) {
      activity.push({
        id: `cust-${c.id}`,
        title: `Customer: ${c.trading_name || 'Account'}`,
        subtitle: `${c.invite_status || c.status || 'active'}`,
        at: c.created_at || null,
        type: 'network',
      });
    }
    for (const s of srmBook.slice(0, 3)) {
      activity.push({
        id: `srm-${s.id}`,
        title: `Supplier: ${s.trading_name}`,
        subtitle: `${s.invite_status || s.status || 'prospect'}${
          s.otifef_pct != null ? ` · OTIFEF ${Number(s.otifef_pct).toFixed(0)}%` : ''
        }`,
        at: s.created_at || null,
        type: 'supplier',
      });
    }
    for (const po of srmPos.slice(0, 3)) {
      activity.push({
        id: `po-${po.id}`,
        title: `PO #${po.id} · R ${Number(po.total_amount || 0).toFixed(0)}`,
        subtitle: `${po.status || 'sent'}${po.onchain_po_id ? ' · on-chain' : ''}`,
        at: po.created_at || null,
        type: 'supplier',
      });
    }
    for (const o of openOpps.slice(0, 2)) {
      activity.push({
        id: `opp-${o.id}`,
        title: o.name || 'Opportunity',
        subtitle: `${o.stage || 'pipeline'} · R ${Number(o.amount || 0).toFixed(0)}`,
        at: o.updated_at || null,
        type: 'network',
      });
    }

    activity.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });

    // CRM / SRM alerts
    if (crmInvitePending > 0) {
      alerts.push({
        id: 'crm-invites',
        severity: 'info',
        title: `${crmInvitePending} customer invite${crmInvitePending === 1 ? '' : 's'} pending`,
        detail: 'Buyers still need to claim their platform invitations.',
        href: '/dashboard/customers/invites',
      });
    }
    if (srmInvitePending > 0) {
      alerts.push({
        id: 'srm-invites',
        severity: 'info',
        title: `${srmInvitePending} supplier invite${srmInvitePending === 1 ? '' : 's'} pending`,
        detail: 'Follow up so partners can claim and connect.',
        href: '/dashboard/suppliers/invites',
      });
    }
    if (srmOpenPos.length > 0) {
      alerts.push({
        id: 'srm-pos',
        severity: 'info',
        title: `${srmOpenPos.length} open purchase order${srmOpenPos.length === 1 ? '' : 's'}`,
        detail: 'Track delivery and OTIFEF on the SRM PO pipeline.',
        href: '/dashboard/suppliers/po',
      });
    }
    if (profileCompleteness < 70) {
      alerts.push({
        id: 'profile-complete',
        severity: 'warning',
        title: `Company profile ${profileCompleteness}% complete`,
        detail: 'Strengthen trust signals — fill contacts, location, and wallet.',
        href: '/dashboard/my-business/profile',
      });
    }
    if (crmRiadOpen + srmRiadOpen > 0) {
      alerts.push({
        id: 'rel-riad',
        severity: crmRiadOpen + srmRiadOpen > 5 ? 'warning' : 'info',
        title: `${crmRiadOpen + srmRiadOpen} open relationship RIAD items`,
        detail: `${crmRiadOpen} customer · ${srmRiadOpen} supplier`,
        href: '/dashboard/customers/riad-log',
      });
    }

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
        wallet_address: company.wallet_address,
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
        // New module metrics
        containersTotal: containers.length,
        containersActive,
        contractorsTotal: contractors.length,
        contractorsActive,
        contractorsVerified,
        contractorsPortal,
        containerLowStock,
        containerUnits,
        salesToday,
        containerRiads: containerRiads.length,
        warehouses: warehouses.length,
        warehouseStockUnits,
        warehouseLowStock,
        stockLines: stockLevels.length + containerInv.length,
        // CRM
        customersTotal: customers.length,
        customersActive,
        leadsOpen: openLeads.length,
        leadsTotal: leads.length,
        opportunitiesOpen: openOpps.length,
        pipelineValue,
        wonCount: wonOpps.length,
        crmInvitePending,
        crmInviteAccepted,
        crmRiadOpen,
        // SRM
        srmBookTotal: srmBook.length,
        srmConnected,
        srmPreferred,
        srmInvitePending,
        srmVerified,
        srmAvgTrust,
        srmAvgOtifef,
        srmOpenPos: srmOpenPos.length,
        srmOnchainPos: srmOnchainPos.length,
        srmRiadOpen,
        // Business
        profileCompleteness,
      },
      health: {
        supplierHealth,
        fulfillmentSignal,
        riskScoreLabel,
        riskBar,
        profileCompleteness,
      },
      crm: {
        customers: customers.length,
        customersActive,
        leadsOpen: openLeads.length,
        pipelineValue,
        opportunitiesOpen: openOpps.length,
        wonCount: wonOpps.length,
        invitePending: crmInvitePending,
        inviteAccepted: crmInviteAccepted,
        riadOpen: crmRiadOpen,
        href: '/dashboard/customers',
      },
      srm: {
        book: srmBook.length,
        connected: srmConnected,
        preferred: srmPreferred,
        invitePending: srmInvitePending,
        verified: srmVerified,
        avgTrust: srmAvgTrust,
        avgOtifef: srmAvgOtifef,
        openPos: srmOpenPos.length,
        onchainPos: srmOnchainPos.length,
        riadOpen: srmRiadOpen,
        href: '/dashboard/suppliers',
      },
      business: {
        profileCompleteness,
        teamActive,
        teamInvited,
        verified: company.verification_status === 'verified',
        href: '/dashboard/my-business',
      },
      modules: {
        containers: {
          total: containers.length,
          active: containersActive,
          href: '/dashboard/containers',
        },
        contractors: {
          total: contractors.length,
          verified: contractorsVerified,
          portal: contractorsPortal,
          href: '/dashboard/containers/contractors',
        },
        inventory: {
          products: productsCount,
          warehouses: warehouses.length,
          lowStock: warehouseLowStock + containerLowStock,
          units: warehouseStockUnits + containerUnits,
          href: '/dashboard/inventory',
        },
        riad: {
          open: openRisks.length,
          critical: highRisks.length,
          containerScoped: containerRiads.length,
          href: '/dashboard/containers/riad-log',
        },
        crm: { href: '/dashboard/customers' },
        srm: { href: '/dashboard/suppliers' },
        business: { href: '/dashboard/my-business' },
      },
      activity: activity.slice(0, 14),
      alerts: alerts.slice(0, 10),
      teamPreview: team.slice(0, 5).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email || m.invited_email,
        role: m.role,
        status: m.status,
      })),
      containersPreview: containers.slice(0, 5),
      contractorsPreview: contractors.slice(0, 5),
      projectsPreview: projects.slice(0, 4),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Dashboard summary failed';
    console.error('dashboard summary error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
