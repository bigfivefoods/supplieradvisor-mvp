import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

/**
 * GET /api/buyer/workspace
 *
 * Company-scoped buyer workspace: accepted customer-type connections where
 * the selected company is the requestee (buyer). Includes suspended edges
 * with a suspended flag for UI badges (Raise PO stays disabled client-side).
 *
 * Query: buyerCompanyId, privyUserId
 *
 * AuthZ: assertCompanyMember(privyUserId, buyerCompanyId)
 */

export type BuyerWorkspaceSupplier = {
  connectionId: number;
  supplierProfileId: number;
  tradingName: string | null;
  legalName: string | null;
  city: string | null;
  country: string | null;
  logoUrl: string | null;
  verificationStatus: string | null;
  suspended: boolean;
  suspendedAt: string | null;
  customerId: number | null;
  inviteStatus: string | null;
  connectedAt: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const buyerCompanyId = Number(sp.get('buyerCompanyId'));
    const privyUserId = sp.get('privyUserId');

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();

    // Option A: single edge, buyer = requestee, type=customer, accepted (incl. suspended)
    const { data: connections, error: connErr } = await supabase
      .from('business_connections')
      .select(
        'id, requester_profile_id, requestee_profile_id, status, connection_type, metadata, responded_at, created_at'
      )
      .eq('requestee_profile_id', buyerCompanyId)
      .eq('connection_type', 'customer')
      .eq('status', 'accepted')
      .order('responded_at', { ascending: false });

    if (connErr) {
      console.error('buyer/workspace connections error:', connErr);
      return NextResponse.json(
        { error: 'Failed to load supplier connections' },
        { status: 500 }
      );
    }

    const rows = connections || [];
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        buyerCompanyId,
        suppliers: [] as BuyerWorkspaceSupplier[],
        counts: {
          total: 0,
          active: 0,
          suspended: 0,
        },
      });
    }

    const supplierIds = rows
      .map((r) => Number(r.requester_profile_id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const [{ data: profiles }, { data: customers }] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, city, country, logo_url, verification_status'
        )
        .in('id', supplierIds),
      supabase
        .from('customers')
        .select('id, profile_id, invite_status, linked_profile_id')
        .eq('linked_profile_id', buyerCompanyId)
        .in('profile_id', supplierIds)
        .order('id', { ascending: true }),
    ]);

    const profileById = new Map<
      number,
      {
        trading_name: string | null;
        legal_name: string | null;
        city: string | null;
        country: string | null;
        logo_url: string | null;
        verification_status: string | null;
      }
    >();
    for (const p of profiles || []) {
      profileById.set(Number(p.id), {
        trading_name: p.trading_name ?? null,
        legal_name: p.legal_name ?? null,
        city: p.city ?? null,
        country: p.country ?? null,
        logo_url: p.logo_url ?? null,
        verification_status: p.verification_status ?? null,
      });
    }

    // Lowest customer id per seller profile (design bridge rule)
    const customerBySupplier = new Map<
      number,
      { id: number; invite_status: string | null }
    >();
    for (const c of customers || []) {
      const pid = Number(c.profile_id);
      if (!customerBySupplier.has(pid)) {
        customerBySupplier.set(pid, {
          id: Number(c.id),
          invite_status: c.invite_status ?? null,
        });
      }
    }

    const suppliers: BuyerWorkspaceSupplier[] = [];

    for (const row of rows) {
      const supplierProfileId = Number(row.requester_profile_id);
      if (!Number.isFinite(supplierProfileId) || supplierProfileId <= 0) continue;

      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const suspended = meta.suspended === true || meta.suspended === 'true';
      const suspendedAt =
        typeof meta.suspended_at === 'string'
          ? meta.suspended_at
          : meta.suspended_at != null
            ? String(meta.suspended_at)
            : null;

      const profile = profileById.get(supplierProfileId);
      const customer = customerBySupplier.get(supplierProfileId);

      suppliers.push({
        connectionId: Number(row.id),
        supplierProfileId,
        tradingName: profile?.trading_name ?? null,
        legalName: profile?.legal_name ?? null,
        city: profile?.city ?? null,
        country: profile?.country ?? null,
        logoUrl: profile?.logo_url ?? null,
        verificationStatus: profile?.verification_status ?? null,
        suspended,
        suspendedAt,
        customerId: customer?.id ?? null,
        inviteStatus: customer?.invite_status ?? null,
        connectedAt: row.responded_at || row.created_at || null,
      });
    }

    const suspendedCount = suppliers.filter((s) => s.suspended).length;

    return NextResponse.json({
      success: true,
      buyerCompanyId,
      suppliers,
      counts: {
        total: suppliers.length,
        active: suppliers.length - suspendedCount,
        suspended: suspendedCount,
      },
    });
  } catch (e: unknown) {
    console.error('GET /api/buyer/workspace error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
