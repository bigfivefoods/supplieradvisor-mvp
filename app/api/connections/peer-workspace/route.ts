import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&peerId=
 * Open POs, invoices, and recent activity shared with a peer.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const peerId = Number(sp.get('peerId'));

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!Number.isFinite(peerId) || peerId <= 0) {
      return NextResponse.json({ error: 'peerId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    // Purchase orders where either side matches (buyer or supplier)
    const openPoStatuses = [
      'draft',
      'sent',
      'pending',
      'submitted',
      'accepted',
      'confirmed',
      'in_progress',
      'partial',
      'open',
    ];

    type PoRow = {
      id: number;
      status?: string | null;
      total_amount?: number | null;
      currency?: string | null;
      created_at?: string | null;
      po_number?: string | null;
      buyer_profile_id?: number | null;
      supplier_profile_id?: number | null;
      supplier_id?: number | null;
    };

    let pos: PoRow[] = [];
    {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(
          'id, status, total_amount, currency, created_at, po_number, buyer_profile_id, supplier_profile_id, supplier_id'
        )
        .or(
          `and(buyer_profile_id.eq.${companyId},supplier_profile_id.eq.${peerId}),and(buyer_profile_id.eq.${peerId},supplier_profile_id.eq.${companyId}),and(buyer_profile_id.eq.${companyId},supplier_id.eq.${peerId}),and(buyer_profile_id.eq.${peerId},supplier_id.eq.${companyId})`
        )
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) {
        pos = data as PoRow[];
      } else {
        // Fallback: wider filter then client-side
        const { data: loose } = await supabase
          .from('purchase_orders')
          .select(
            'id, status, total_amount, currency, created_at, po_number, buyer_profile_id, supplier_profile_id, supplier_id'
          )
          .or(
            `buyer_profile_id.eq.${companyId},supplier_profile_id.eq.${companyId},buyer_profile_id.eq.${peerId},supplier_profile_id.eq.${peerId}`
          )
          .order('created_at', { ascending: false })
          .limit(80);
        pos = ((loose || []) as PoRow[]).filter((p) => {
          const buyer = Number(p.buyer_profile_id);
          const supplier = Number(p.supplier_profile_id || p.supplier_id);
          return (
            (buyer === companyId && supplier === peerId) ||
            (buyer === peerId && supplier === companyId)
          );
        });
      }
    }

    const openPos = pos.filter((p) => {
      const s = String(p.status || '').toLowerCase();
      return (
        !s ||
        openPoStatuses.includes(s) ||
        (!['cancelled', 'canceled', 'closed', 'completed', 'delivered', 'rejected'].includes(s))
      );
    });

    // Customer invoices involving peer (as customer linked profile or metadata)
    type InvRow = {
      id: number;
      status?: string | null;
      total_amount?: number | null;
      currency?: string | null;
      invoice_number?: string | null;
      created_at?: string | null;
      customer_profile_id?: number | null;
      profile_id?: number | null;
    };
    let invoices: InvRow[] = [];
    {
      const { data } = await supabase
        .from('customer_invoices')
        .select(
          'id, status, total_amount, currency, invoice_number, created_at, customer_profile_id, profile_id'
        )
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(40);
      invoices = ((data || []) as InvRow[]).filter((inv) => {
        const cust = Number(inv.customer_profile_id);
        return cust === peerId;
      });
      // Also invoices peer issued to us
      const { data: inbound } = await supabase
        .from('customer_invoices')
        .select(
          'id, status, total_amount, currency, invoice_number, created_at, customer_profile_id, profile_id'
        )
        .eq('profile_id', peerId)
        .eq('customer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (inbound?.length) {
        invoices = [...invoices, ...(inbound as InvRow[])];
      }
    }

    const openInvoices = invoices.filter((inv) => {
      const s = String(inv.status || '').toLowerCase();
      return !['paid', 'void', 'cancelled', 'canceled', 'written_off'].includes(s);
    });

    // Recent activity mentioning peer
    type ActRow = {
      id?: number;
      action?: string | null;
      summary?: string | null;
      created_at?: string | null;
      entity_type?: string | null;
      entity_id?: string | null;
    };
    let activity: ActRow[] = [];
    {
      const { data } = await supabase
        .from('activity_log')
        .select('id, action, summary, created_at, entity_type, entity_id, metadata')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(60);
      activity = ((data || []) as Array<ActRow & { metadata?: unknown }>).filter(
        (a) => {
          const summary = String(a.summary || '').toLowerCase();
          const meta = JSON.stringify(a.metadata || {}).toLowerCase();
          const peerStr = String(peerId);
          return (
            summary.includes(peerStr) ||
            meta.includes(peerStr) ||
            meta.includes(`"peer`) ||
            String(a.entity_id || '') === peerStr
          );
        }
      );
      if (!activity.length && data?.length) {
        // Show latest company activity as fallback context
        activity = (data as ActRow[]).slice(0, 8);
      } else {
        activity = activity.slice(0, 12);
      }
    }

    return NextResponse.json({
      success: true,
      companyId,
      peerId,
      purchaseOrders: {
        open: openPos.slice(0, 10),
        recent: pos.slice(0, 10),
        openCount: openPos.length,
        total: pos.length,
      },
      invoices: {
        open: openInvoices.slice(0, 10),
        recent: invoices.slice(0, 10),
        openCount: openInvoices.length,
        total: invoices.length,
      },
      activity,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
