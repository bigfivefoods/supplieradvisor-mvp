import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export type AppNotification = {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  body: string;
  href: string;
  created_at: string;
  source: string;
};

/**
 * GET ?companyId=&privyUserId=
 * Actionable notifications derived from live company state (no separate inbox table).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const now = Date.now();
    const notifications: AppNotification[] = [];

    const [
      openInsp,
      failedInsp,
      openPos,
      unmatchedBank,
      lowStock,
      openTransfers,
      pendingInvites,
      marketInq,
    ] = await Promise.all([
      supabase
        .from('quality_inspections')
        .select('id, lot_number, created_at')
        .eq('profile_id', companyId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('quality_inspections')
        .select('id, lot_number, created_at')
        .eq('profile_id', companyId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('purchase_orders')
        .select('id, status, total_amount, created_at, onchain_po_id')
        .eq('buyer_profile_id', companyId)
        .in('status', ['sent', 'accepted', 'funded'])
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('bank_transactions')
        .select('id, amount, description, transaction_date')
        .eq('profile_id', companyId)
        .or('allocation_status.eq.unmatched,allocated.eq.false,is_allocated.eq.false')
        .order('transaction_date', { ascending: false })
        .limit(8),
      supabase
        .from('product_stock')
        .select('id, product_id, qty_on_hand, reorder_point, warehouse_id')
        .eq('profile_id', companyId)
        .limit(200),
      supabase
        .from('stock_transfer_orders')
        .select('id, transfer_number, status, created_at')
        .eq('profile_id', companyId)
        .in('status', ['in_transit', 'shipped', 'partially_received'])
        .limit(10),
      supabase
        .from('srm_supplier_invitations')
        .select('id, email, created_at, status')
        .eq('profile_id', companyId)
        .eq('status', 'pending')
        .limit(8),
      supabase
        .from('marketplace_inquiries')
        .select('id, status, created_at, metadata')
        .eq('seller_profile_id', companyId)
        .in('status', ['new', 'open'])
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    for (const r of openInsp.data || []) {
      notifications.push({
        id: `qi-open-${r.id}`,
        severity: 'warning',
        title: 'Open QA inspection',
        body: r.lot_number
          ? `Lot ${r.lot_number} awaiting pass/fail`
          : `Inspection #${r.id} is open`,
        href: '/dashboard/quality/inspections',
        created_at: r.created_at || new Date().toISOString(),
        source: 'quality',
      });
    }
    for (const r of failedInsp.data || []) {
      notifications.push({
        id: `qi-fail-${r.id}`,
        severity: 'critical',
        title: 'Failed QA — lot on hold',
        body: r.lot_number ? `Lot ${r.lot_number} failed inspection` : `Inspection #${r.id} failed`,
        href: '/dashboard/quality/inspections',
        created_at: r.created_at || new Date().toISOString(),
        source: 'quality',
      });
    }

    for (const po of openPos.data || []) {
      const funded = String(po.status) === 'funded';
      const escrow = po.onchain_po_id != null;
      notifications.push({
        id: `po-${po.id}`,
        severity: funded ? 'info' : 'warning',
        title: funded
          ? `PO #${po.id} funded — confirm delivery`
          : `Open PO #${po.id} (${po.status})`,
        body: escrow
          ? 'On-chain escrow linked — complete ship/confirm lifecycle'
          : 'Progress status or record delivery for OTIFEF',
        href: '/dashboard/suppliers/po',
        created_at: po.created_at || new Date().toISOString(),
        source: 'procurement',
      });
    }

    // Unmatched bank — only if query succeeded with rows
    if (!unmatchedBank.error && (unmatchedBank.data || []).length) {
      const n = unmatchedBank.data!.length;
      notifications.push({
        id: 'bank-unmatched',
        severity: n >= 5 ? 'warning' : 'info',
        title: `${n}+ unmatched bank line${n === 1 ? '' : 's'}`,
        body: 'Allocate or auto-match in Accounting → Bank',
        href: '/dashboard/accounting/bank-reconciliation',
        created_at: unmatchedBank.data![0].transaction_date || new Date().toISOString(),
        source: 'banking',
      });
    }

    // Low stock heuristic
    if (!lowStock.error) {
      let low = 0;
      for (const s of lowStock.data || []) {
        const qty = Number(s.qty_on_hand || 0);
        const rp = Number(s.reorder_point);
        if (Number.isFinite(rp) && rp > 0 && qty <= rp) low += 1;
        else if (!Number.isFinite(rp) && qty <= 0) low += 1;
      }
      if (low > 0) {
        notifications.push({
          id: 'stock-low',
          severity: low >= 5 ? 'warning' : 'info',
          title: `${low} stock location${low === 1 ? '' : 's'} at/below reorder`,
          body: 'Review Inventory → Live stock',
          href: '/dashboard/inventory/stock',
          created_at: new Date(now).toISOString(),
          source: 'inventory',
        });
      }
    }

    for (const t of openTransfers.data || []) {
      notifications.push({
        id: `trf-${t.id}`,
        severity: 'info',
        title: `Transfer ${t.transfer_number || '#' + t.id} in motion`,
        body: `Status: ${t.status}`,
        href: '/dashboard/inventory/stock-transfers',
        created_at: t.created_at || new Date().toISOString(),
        source: 'inventory',
      });
    }

    if (!pendingInvites.error && (pendingInvites.data || []).length) {
      notifications.push({
        id: 'srm-invites',
        severity: 'info',
        title: `${pendingInvites.data!.length} supplier invite(s) pending`,
        body: 'Follow up from Suppliers → Invitations',
        href: '/dashboard/suppliers/invites',
        created_at: pendingInvites.data![0].created_at || new Date().toISOString(),
        source: 'srm',
      });
    }

    for (const iq of marketInq.data || []) {
      notifications.push({
        id: `mkt-${iq.id}`,
        severity: 'positive',
        title: 'New marketplace inquiry',
        body: 'A buyer requested your listing — respond or convert to PO',
        href: '/dashboard/connections/marketplace',
        created_at: iq.created_at || new Date().toISOString(),
        source: 'marketplace',
      });
    }

    // Severity sort: critical > warning > info > positive
    const rank = { critical: 0, warning: 1, info: 2, positive: 3 };
    notifications.sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const unreadCritical = notifications.filter((n) => n.severity === 'critical').length;
    const unreadWarning = notifications.filter((n) => n.severity === 'warning').length;

    return NextResponse.json({
      success: true,
      notifications: notifications.slice(0, 40),
      counts: {
        total: notifications.length,
        critical: unreadCritical,
        warning: unreadWarning,
        badge: unreadCritical + unreadWarning,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
