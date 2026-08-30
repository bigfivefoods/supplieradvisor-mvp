import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isMissingRelation } from '@/lib/business/company-data';
import {
  migrationHint,
  type TradePortalKind,
  type TradePortalRow,
  type TradePortalViewer,
} from '@/lib/portals/trade-portal';

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export type GuestCtx = {
  portal: TradePortalRow;
  viewer: TradePortalViewer;
  linkedProfileId: number | null;
  accountName: string;
};

export async function resolveGuestViewer(
  token: string
): Promise<
  | { ok: true; ctx: GuestCtx }
  | { ok: false; error: string; status: number }
> {
  const tok = String(token || '').trim();
  if (tok.length < 12) {
    return { ok: false, error: 'Invalid portal link', status: 404 };
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('trade_portal_viewers')
    .select('*')
    .eq('token', tok)
    .maybeSingle();
  if (error && isMissingRelation(error)) {
    return { ok: false, error: migrationHint(), status: 503 };
  }
  if (!data) {
    return {
      ok: false,
      error: 'Use your personal portal link (the one attached to your account on our books).',
      status: 404,
    };
  }
  const viewer: TradePortalViewer = {
    id: Number(data.id),
    portal_id: Number(data.portal_id),
    profile_id: Number(data.profile_id),
    name: String(data.name || 'Guest'),
    email: data.email != null ? String(data.email) : null,
    phone: data.phone != null ? String(data.phone) : null,
    job_title: data.job_title != null ? String(data.job_title) : null,
    token: String(data.token || ''),
    customer_id:
      data.customer_id != null ? Number(data.customer_id) : null,
    supplier_id:
      data.supplier_id != null ? Number(data.supplier_id) : null,
    status: data.status === 'revoked' ? 'revoked' : 'active',
    last_seen_at: data.last_seen_at != null ? String(data.last_seen_at) : null,
  };
  if (viewer.status !== 'active') {
    return { ok: false, error: 'This access link was revoked', status: 403 };
  }

  const { data: portalRaw } = await supabase
    .from('trade_portals')
    .select('*')
    .eq('id', viewer.portal_id)
    .maybeSingle();
  if (!portalRaw) {
    return { ok: false, error: 'Portal not found', status: 404 };
  }
  const p = asObject(portalRaw);
  if (p.status === 'paused') {
    return { ok: false, error: 'This portal is paused', status: 403 };
  }
  const kind: TradePortalKind = p.kind === 'supplier' ? 'supplier' : 'customer';
  const portal: TradePortalRow = {
    id: Number(p.id),
    profile_id: Number(p.profile_id),
    kind,
    public_token: String(p.public_token || ''),
    title: p.title != null ? String(p.title) : null,
    welcome_message:
      p.welcome_message != null ? String(p.welcome_message) : null,
    sections: (p.sections as TradePortalRow['sections']) || {},
    status: 'active',
  };

  if (kind === 'customer' && !viewer.customer_id) {
    return {
      ok: false,
      error: 'This link is not attached to a customer on our books.',
      status: 403,
    };
  }
  if (kind === 'supplier' && !viewer.supplier_id) {
    return {
      ok: false,
      error: 'This link is not attached to a supplier on our books.',
      status: 403,
    };
  }

  let linkedProfileId: number | null = null;
  let accountName = viewer.name;
  if (kind === 'customer' && viewer.customer_id) {
    const { assertCustomerPortalParty } = await import(
      '@/lib/portals/assert-supplier-portal-party'
    );
    const gate = await assertCustomerPortalParty(
      portal.profile_id,
      viewer.customer_id
    );
    if (!gate.ok) {
      return {
        ok: false,
        error:
          gate.reason === 'supplier_only'
            ? 'This portal is only for customers on our books.'
            : gate.error,
        status: gate.status === 404 ? 404 : 403,
      };
    }
    const { data: c } = await supabase
      .from('customers')
      .select('trading_name, linked_profile_id')
      .eq('id', viewer.customer_id)
      .eq('profile_id', portal.profile_id)
      .maybeSingle();
    if (!c) {
      return { ok: false, error: 'Customer not found on our books', status: 404 };
    }
    accountName = String(c.trading_name || accountName);
    if (c.linked_profile_id) linkedProfileId = Number(c.linked_profile_id);
  }
  if (kind === 'supplier' && viewer.supplier_id) {
    const { assertSupplierPortalParty } = await import(
      '@/lib/portals/assert-supplier-portal-party'
    );
    const gate = await assertSupplierPortalParty(
      portal.profile_id,
      viewer.supplier_id
    );
    if (!gate.ok) {
      return {
        ok: false,
        error:
          gate.reason === 'customer_only'
            ? 'This portal is only for suppliers on our books.'
            : gate.error,
        status: gate.status === 404 ? 404 : 403,
      };
    }
    const { data: s } = await supabase
      .from('srm_suppliers')
      .select('trading_name, linked_profile_id')
      .eq('id', viewer.supplier_id)
      .eq('profile_id', portal.profile_id)
      .maybeSingle();
    if (!s) {
      return { ok: false, error: 'Supplier not found on our books', status: 404 };
    }
    accountName = String(s.trading_name || accountName);
    if (s.linked_profile_id) linkedProfileId = Number(s.linked_profile_id);
  }

  return {
    ok: true,
    ctx: { portal, viewer, linkedProfileId, accountName },
  };
}
