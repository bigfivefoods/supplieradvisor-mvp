import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { computeProfileCompleteness } from '@/lib/business/completeness';
import { normalizeProfileRow } from '@/lib/business/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { OPPORTUNITY_STAGES, stageProbability } from '@/lib/customers/types';

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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();

    // Full row so profile completeness matches My Business hub / profile page
    const { data: company, error: companyError } = await supabase
      .from('profiles')
      .select('*')
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
      // Network trade expansion
      pricingAgreementsRes,
      customerQuotesRes,
      customerInvoicesRes,
      productsFullRes,
      accountingInvoicesRes,
      marketplaceListingsRes,
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
        .select(
          'id, stage, status, amount, opportunity_size, probability, name, updated_at'
        )
        .eq('profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(200),

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

      supabase
        .from('pricing_agreements')
        .select('id, status, title, seller_profile_id, buyer_profile_id, currency, updated_at')
        .or(`seller_profile_id.eq.${companyId},buyer_profile_id.eq.${companyId}`)
        .order('updated_at', { ascending: false })
        .limit(100),

      supabase
        .from('customer_quotes')
        .select('id, status, total_amount, currency, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('customer_invoices')
        .select('id, status, total_amount, amount_paid, currency, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('products')
        .select('id, base_currency, prices, sell_price, name, status')
        .eq('profile_id', companyId)
        .limit(500),

      supabase
        .from('invoices')
        .select('id, direction, status, total_amount, amount_paid, currency, created_at')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),

      supabase
        .from('marketplace_listings')
        .select('id, status, title, unit_price, currency, created_at')
        .eq('seller_profile_id', companyId)
        .limit(100),
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
    // Prefer company-scoped edges (profile ids) for the modern network graph
    const companyConnections = (connectionsProfileRes.data || []).filter((c) => {
      const a = Number((c as { requester_profile_id?: number }).requester_profile_id);
      const b = Number((c as { requestee_profile_id?: number }).requestee_profile_id);
      return Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0;
    }) as Array<{
      id: string | number;
      status?: string;
      requested_at?: string | null;
      accepted_at?: string | null;
      requester_profile_id?: number | null;
      requestee_profile_id?: number | null;
    }>;
    const connections = (
      companyConnections.length
        ? companyConnections
        : Array.from(connectionMap.values())
    ) as Array<{
      id: string | number;
      status?: string;
      requested_at?: string | null;
      accepted_at?: string | null;
      requester_profile_id?: number | null;
      requestee_profile_id?: number | null;
    }>;

    const teamActive = team.filter((m) => m.status === 'active').length;
    const teamInvited = team.filter((m) => m.status === 'invited' || m.status === 'pending').length;

    const connectionsAccepted = connections.filter(
      (c) => c.status === 'accepted' || c.status === 'approved'
    ).length;
    const connectionsPending = connections.filter((c) => c.status === 'pending').length;
    const networkPendingIn = connections.filter(
      (c) =>
        c.status === 'pending' && Number(c.requestee_profile_id) === companyId
    ).length;
    const networkPendingOut = connections.filter(
      (c) =>
        c.status === 'pending' && Number(c.requester_profile_id) === companyId
    ).length;

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
    // Align with Customers → Leads KPIs: open = not closed_won / closed_lost
    const closedStages = new Set(['closed_won', 'closed_lost', 'won', 'lost']);
    const normalizeOppStage = (o: { stage?: string | null; status?: string | null }) =>
      String(o.stage || o.status || 'prospecting')
        .toLowerCase()
        .replace(/\s+/g, '_');
    const openOpps = opportunities.filter((o) => !closedStages.has(normalizeOppStage(o)));
    const pipelineValue = openOpps.reduce(
      (s, o) => s + Number((o as { amount?: number; opportunity_size?: number }).amount ?? (o as { opportunity_size?: number }).opportunity_size ?? 0),
      0
    );
    let pipelineWeighted = 0;
    for (const o of openOpps) {
      const amt = Number(
        (o as { amount?: number; opportunity_size?: number }).amount ??
          (o as { opportunity_size?: number }).opportunity_size ??
          0
      );
      const st = normalizeOppStage(o);
      const prob =
        (o as { probability?: number }).probability != null
          ? Number((o as { probability?: number }).probability)
          : stageProbability(st);
      pipelineWeighted += (amt * (Number.isFinite(prob) ? prob : 10)) / 100;
    }
    const wonOpps = opportunities.filter((o) => {
      const st = normalizeOppStage(o);
      return st === 'closed_won' || st === 'won';
    });
    const wonValue = wonOpps.reduce(
      (s, o) =>
        s +
        Number(
          (o as { amount?: number; opportunity_size?: number }).amount ??
            (o as { opportunity_size?: number }).opportunity_size ??
            0
        ),
      0
    );
    const invoicedOpps = opportunities.filter((o) => normalizeOppStage(o) === 'invoiced');
    const invoicedValue = invoicedOpps.reduce(
      (s, o) =>
        s +
        Number(
          (o as { amount?: number; opportunity_size?: number }).amount ??
            (o as { opportunity_size?: number }).opportunity_size ??
            0
        ),
      0
    );
    const lostOpps = opportunities.filter((o) => {
      const st = normalizeOppStage(o);
      return st === 'closed_lost' || st === 'lost';
    });
    const pipelineStages = OPPORTUNITY_STAGES.map((stage) => {
      const cards = opportunities.filter((o) => {
        const st = normalizeOppStage(o);
        if (stage.value === 'closed_won') return st === 'closed_won' || st === 'won';
        if (stage.value === 'closed_lost') return st === 'closed_lost' || st === 'lost';
        if (stage.value === 'proposal') return st === 'proposal' || st === 'quoted';
        return st === stage.value;
      });
      const value = cards.reduce(
        (s, o) =>
          s +
          Number(
            (o as { amount?: number; opportunity_size?: number }).amount ??
              (o as { opportunity_size?: number }).opportunity_size ??
              0
          ),
        0
      );
      let weighted = 0;
      for (const o of cards) {
        const amt = Number(
          (o as { amount?: number; opportunity_size?: number }).amount ??
            (o as { opportunity_size?: number }).opportunity_size ??
            0
        );
        const prob =
          (o as { probability?: number }).probability != null
            ? Number((o as { probability?: number }).probability)
            : stage.probability;
        weighted += (amt * prob) / 100;
      }
      return {
        stage: stage.value,
        label: stage.label,
        probability: stage.probability,
        count: cards.length,
        value: Math.round(value),
        weighted: Math.round(weighted),
      };
    });
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

    // Same formula as My Business hub (/api/business/summary)
    const normalizedCompany = normalizeProfileRow(company as Record<string, unknown>);
    const profileCompleteness = computeProfileCompleteness(
      normalizedCompany as Record<string, unknown>
    ).pct;

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

    // ── Network trade expansion (pricing, quotes, AR/AP, multi-currency) ────
    const pricingAgreements = pricingAgreementsRes.error
      ? []
      : pricingAgreementsRes.data || [];
    const pricingActive = pricingAgreements.filter(
      (a) => String(a.status || '').toLowerCase() === 'active'
    ).length;
    const pricingSelling = pricingAgreements.filter(
      (a) => Number(a.seller_profile_id) === companyId
    ).length;
    const pricingBuying = pricingAgreements.filter(
      (a) => Number(a.buyer_profile_id) === companyId
    ).length;

    const quotes = customerQuotesRes.error ? [] : customerQuotesRes.data || [];
    const openQuoteStatuses = new Set(['draft', 'sent', 'accepted', 'pending', 'viewed']);
    const quotesOpenRows = quotes.filter((q) =>
      openQuoteStatuses.has(String(q.status || '').toLowerCase())
    );
    const quotesOpen = quotesOpenRows.length;
    const quotesValue = quotesOpenRows.reduce(
      (s, q) => s + Number(q.total_amount || 0),
      0
    );
    const quotesAcceptedRows = quotes.filter((q) =>
      ['accepted', 'converted', 'won'].includes(String(q.status || '').toLowerCase())
    );
    const quotesAcceptedValue = quotesAcceptedRows.reduce(
      (s, q) => s + Number(q.total_amount || 0),
      0
    );
    const quotesTotalValue = quotes.reduce(
      (s, q) => s + Number(q.total_amount || 0),
      0
    );

    const custInvoices = customerInvoicesRes.error ? [] : customerInvoicesRes.data || [];
    const openInvStatuses = new Set([
      'draft',
      'sent',
      'partial',
      'overdue',
      'issued',
      'unpaid',
    ]);
    const invoicesOpenRows = custInvoices.filter((i) =>
      openInvStatuses.has(String(i.status || '').toLowerCase())
    );
    const invoicesOpen = invoicesOpenRows.length;
    const invoicesOpenValue = invoicesOpenRows.reduce(
      (s, i) =>
        s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
      0
    );
    const invoicesPaidRows = custInvoices.filter((i) =>
      ['paid', 'settled', 'complete', 'completed'].includes(
        String(i.status || '').toLowerCase()
      )
    );
    const invoicesPaidValue = invoicesPaidRows.reduce(
      (s, i) => s + Number(i.total_amount || i.amount_paid || 0),
      0
    );
    const invoicesTotalValue = custInvoices.reduce(
      (s, i) => s + Number(i.total_amount || 0),
      0
    );
    const invoicesCollectedValue = custInvoices.reduce(
      (s, i) => s + Number(i.amount_paid || 0),
      0
    );

    const productsFull = productsFullRes.error ? [] : productsFullRes.data || [];
    let multiCurrencyProducts = 0;
    const currencySet = new Set<string>();
    for (const p of productsFull) {
      const prices = Array.isArray(p.prices) ? p.prices : [];
      if (prices.length > 1) multiCurrencyProducts += 1;
      if (p.base_currency) currencySet.add(String(p.base_currency).toUpperCase());
      for (const row of prices) {
        if (row && typeof row === 'object' && (row as { currency?: string }).currency) {
          currencySet.add(String((row as { currency: string }).currency).toUpperCase());
        }
      }
    }
    if (currencySet.size === 0) currencySet.add('ZAR');

    const acctInvoices = accountingInvoicesRes.error
      ? []
      : accountingInvoicesRes.data || [];
    const arOpen = acctInvoices.filter(
      (i) =>
        i.direction === 'receivable' &&
        !['paid', 'void', 'cancelled'].includes(String(i.status || '').toLowerCase())
    );
    const apOpen = acctInvoices.filter(
      (i) =>
        i.direction === 'payable' &&
        !['paid', 'void', 'cancelled'].includes(String(i.status || '').toLowerCase())
    );
    const arOpenValue = arOpen.reduce(
      (s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
      0
    );
    const apOpenValue = apOpen.reduce(
      (s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
      0
    );

    const listings = marketplaceListingsRes.error
      ? []
      : marketplaceListingsRes.data || [];
    const listingsActive = listings.filter(
      (l) => String(l.status || '').toLowerCase() === 'active'
    ).length;

    if (networkPendingIn > 0) {
      alerts.unshift({
        id: 'network-incoming',
        severity: 'warning',
        title: `${networkPendingIn} incoming connection request${networkPendingIn === 1 ? '' : 's'}`,
        detail: 'Accept or decline partners so trade, pricing, and POs can unlock.',
        href: '/dashboard/connections',
      });
    }
    if (pricingActive === 0 && connectionsAccepted > 0) {
      alerts.push({
        id: 'pricing-empty',
        severity: 'info',
        title: 'No active pricing agreements',
        detail: 'Set wholesale list prices with connected companies for global trade.',
        href: '/dashboard/connections/pricing',
      });
    }
    if (arOpen.length > 0) {
      alerts.push({
        id: 'ar-open',
        severity: 'info',
        title: `${arOpen.length} open AR invoice${arOpen.length === 1 ? '' : 's'}`,
        detail: `Outstanding ~ ${arOpenValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} across currencies.`,
        href: '/dashboard/accounting/accounts-receivable',
      });
    }

    for (const a of pricingAgreements.slice(0, 2)) {
      activity.push({
        id: `pa-${a.id}`,
        title: `Pricing: ${a.title || 'Agreement'}`,
        subtitle: `${a.status || 'draft'} · ${a.currency || 'ZAR'} · ${
          Number(a.seller_profile_id) === companyId ? 'selling' : 'buying'
        }`,
        at: a.updated_at || null,
        type: 'network',
      });
    }
    for (const q of quotes.slice(0, 2)) {
      activity.push({
        id: `quote-${q.id}`,
        title: `Quote · ${String(q.currency || 'ZAR')} ${Number(q.total_amount || 0).toFixed(0)}`,
        subtitle: String(q.status || 'draft'),
        at: q.created_at || null,
        type: 'network',
      });
    }

    activity.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });

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
        primary_currency: company.primary_currency || 'ZAR',
      },
      kpis: {
        teamActive,
        teamInvited,
        teamTotal: team.length,
        networkAccepted: connectionsAccepted,
        networkPending: connectionsPending,
        networkPendingIn,
        networkPendingOut,
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
        pipelineValue: Math.round(pipelineValue),
        pipelineWeighted: Math.round(pipelineWeighted),
        wonCount: wonOpps.length,
        wonValue: Math.round(wonValue),
        invoicedCount: invoicedOpps.length,
        invoicedValue: Math.round(invoicedValue),
        lostCount: lostOpps.length,
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
        // Network trade
        pricingAgreements: pricingAgreements.length,
        pricingActive,
        pricingSelling,
        pricingBuying,
        quotesOpen,
        quotesValue,
        quotesAcceptedValue,
        quotesTotalValue,
        invoicesOpen,
        invoicesOpenValue,
        invoicesPaidValue,
        invoicesTotalValue,
        invoicesCollectedValue,
        multiCurrencyProducts,
        catalogueCurrencies: Array.from(currencySet).sort(),
        arOpen: arOpen.length,
        arOpenValue,
        apOpen: apOpen.length,
        apOpenValue,
        marketplaceListings: listingsActive,
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
      network: {
        accepted: connectionsAccepted,
        pending: connectionsPending,
        pendingIn: networkPendingIn,
        pendingOut: networkPendingOut,
        pricingActive,
        pricingTotal: pricingAgreements.length,
        marketplaceListings: listingsActive,
        href: '/dashboard/connections',
      },
      trade: {
        quotesOpen,
        quotesValue,
        quotesAcceptedValue,
        quotesTotalValue,
        invoicesOpen,
        invoicesOpenValue,
        invoicesPaidValue,
        invoicesTotalValue,
        invoicesCollectedValue,
        openPos: srmOpenPos.length,
        onchainPos: srmOnchainPos.length,
        arOpen: arOpen.length,
        arOpenValue,
        apOpen: apOpen.length,
        apOpenValue,
      },
      inventory: {
        products: productsCount,
        multiCurrencyProducts,
        currencies: Array.from(currencySet).sort(),
        warehouseLowStock,
        warehouses: warehouses.length,
        href: '/dashboard/inventory/products',
      },
      crm: {
        customers: customers.length,
        customersActive,
        leadsOpen: openLeads.length,
        leadsTotal: leads.length,
        // Pipeline (matches Customers → Leads KPIs)
        opportunitiesOpen: openOpps.length,
        pipelineValue: Math.round(pipelineValue),
        pipelineWeighted: Math.round(pipelineWeighted),
        wonCount: wonOpps.length,
        wonValue: Math.round(wonValue),
        invoicedCount: invoicedOpps.length,
        invoicedValue: Math.round(invoicedValue),
        lostCount: lostOpps.length,
        opportunitiesTotal: opportunities.length,
        pipelineStages,
        invitePending: crmInvitePending,
        inviteAccepted: crmInviteAccepted,
        riadOpen: crmRiadOpen,
        // Commercial process (quotes → invoices)
        quotesOpen,
        quotesValue,
        quotesAcceptedValue,
        quotesTotalValue,
        invoicesOpen,
        invoicesOpenValue,
        invoicesPaidValue,
        invoicesTotalValue,
        invoicesCollectedValue,
        href: '/dashboard/customers',
        leadsHref: '/dashboard/customers/leads',
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
