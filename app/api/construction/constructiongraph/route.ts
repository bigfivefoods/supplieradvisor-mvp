import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { applyConstructionAction } from '@/lib/construction/actions';
import { appendConstructionAudit } from '@/lib/construction/audit';
import {
  addDaysIso,
  applyPaymentAction,
  constructiongraphSeedStore,
  emptyConstructiongraphStore,
  mergeConstructiongraphStore,
  mintConstructionToken,
  programmeReport,
  readConstructiongraphFromMetadata,
  summariseConstructiongraph,
  upsertPortal,
  writeConstructiongraphToMetadata,
  type ConstructionPortal,
  type ConstructiongraphStore,
} from '@/lib/construction/constructiongraph';
import { sastToday } from '@/lib/construction/format';
import { constructionPortalPath } from '@/lib/construction/pwa-roles';
import {
  redactRolePayload,
  resolveConstructionRole,
  storeForRole,
  type ConstructionRole,
} from '@/lib/construction/roles';

export const runtime = 'nodejs';

type Payload = {
  companyId?: number;
  action?: string;
  store?: Partial<ConstructiongraphStore>;
  clientId?: string;
  siteId?: string;
  subcontractorId?: string;
  expiresIn?: number | null;
  id?: string;
  paymentId?: string;
  verb?: string;
  collection?: string;
  decision?: string;
  confirmRebaseline?: boolean;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function respond(role: ConstructionRole, store: ConstructiongraphStore, extra: Record<string, unknown> = {}) {
  const visible = storeForRole(store, role);
  const body = {
    success: true,
    role,
    store: visible,
    summary: summariseConstructiongraph(store),
    programme: programmeReport(store),
    ...extra,
  };
  return NextResponse.json(redactRolePayload(body, role));
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const membership = await getCompanyMembership(gate.userId, companyId);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }
    const role = resolveConstructionRole(membership.role);
    if (role === 'none') {
      return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
    }

    const metadata = asObject(profile?.metadata);
    const store = readConstructiongraphFromMetadata(metadata);
    return respond(role, store);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Payload;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const membership = await getCompanyMembership(gate.userId, companyId);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }
    const role = resolveConstructionRole(membership.role);
    if (role === 'none') {
      return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
    }

    const prevMeta = asObject(profile?.metadata);
    const prevStore = readConstructiongraphFromMetadata(prevMeta);
    const action = String(body.action || 'merge');
    let nextStore = prevStore;
    let events: Array<{ action: string; target: string }> = [];
    let issued: Record<string, string> | null = null;

    const ownerOnly = role === 'owner';
    if (
      (action === 'seed_demo' || action === 'replace' || action === 'remove_sample' || action.startsWith('ensure_') || action === 'revoke_portal') &&
      !ownerOnly
    ) {
      return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
    }

    if (action === 'seed_demo') {
      nextStore = constructiongraphSeedStore();
    } else if (action === 'replace') {
      nextStore = mergeConstructiongraphStore(
        emptyConstructiongraphStore(),
        asObject(body.store) as Partial<ConstructiongraphStore>
      );
    } else if (action === 'payment') {
      if (role !== 'owner' && role !== 'office') {
        return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
      }
      const verb = body.verb === 'pay' || body.verb === 'claim' ? body.verb : 'certify';
      const paid = applyPaymentAction(prevStore, {
        paymentId: String(body.paymentId || ''),
        action: verb,
        actor: 'staff',
        date: sastToday(),
      });
      if (!paid.ok) return NextResponse.json({ error: paid.error }, { status: 400 });
      nextStore = paid.store;
      events = [{ action: `payment_${verb}`, target: String(body.paymentId || '') }];
    } else if (action === 'revoke_portal') {
      const id = String(body.id || '');
      const row = prevStore.portals.find((portal) => portal.id === id || portal.token === id);
      if (!row) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
      nextStore = {
        ...prevStore,
        portals: prevStore.portals.map((portal) =>
          portal === row ? { ...portal, revoked_at: new Date().toISOString() } : portal
        ),
      };
      events = [{ action: 'revoke_portal', target: id }];
    } else if (action.startsWith('ensure_')) {
      const token = mintConstructionToken();
      const days = body.expiresIn == null ? null : Number(body.expiresIn);
      const expires_at = days ? addDaysIso(sastToday(), days) : null;
      let portal: ConstructionPortal | null = null;
      if (action === 'ensure_portal') {
        portal = { token, kind: 'public', label: 'Open programme', created_at: new Date().toISOString(), expires_at, token_hint: token.slice(-4), legacy: false };
      } else if (action === 'ensure_client_portal') {
        const clientId = String(body.clientId || '').trim();
        const client = prevStore.clients.find((row) => row.id === clientId);
        if (!client) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
        portal = { token, kind: 'client', client_id: clientId, label: client.name, created_at: new Date().toISOString(), expires_at, token_hint: token.slice(-4), legacy: false };
      } else if (action === 'ensure_contractor_portal') {
        const siteId = String(body.siteId || '').trim();
        const site = prevStore.sites.find((row) => row.id === siteId);
        if (!site) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
        portal = { token, kind: 'contractor', site_id: siteId, client_id: site.client_id, label: `${site.code} site team`, created_at: new Date().toISOString(), expires_at, token_hint: token.slice(-4), legacy: false };
      } else if (action === 'ensure_subcontractor_portal') {
        const subcontractorId = String(body.subcontractorId || '').trim();
        const sub = prevStore.subcontractors.find((row) => row.id === subcontractorId);
        if (!sub) return NextResponse.json({ error: 'subcontractorId required' }, { status: 400 });
        portal = { token, kind: 'subcontractor', subcontractor_id: subcontractorId, site_id: sub.site_id, label: sub.name, created_at: new Date().toISOString(), expires_at, token_hint: token.slice(-4), legacy: false };
      }
      if (!portal) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
      nextStore = upsertPortal(prevStore, portal);
      issued = { id: token, kind: portal.kind, token, path: constructionPortalPath(token), hint: token.slice(-4) };
      events = [{ action: 'issue_portal', target: portal.kind }];
    } else {
      const result = applyConstructionAction(prevStore, asObject(body), role);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, needsConfirm: result.needsConfirm || false },
          { status: result.status }
        );
      }
      nextStore = result.store;
      events = result.events;
    }

    let nextMeta = writeConstructiongraphToMetadata(prevMeta, nextStore);
    if (events.length) {
      nextMeta = appendConstructionAudit(
        nextMeta,
        events.map((event) => ({
          at: new Date().toISOString(),
          actor_kind: 'staff' as const,
          actor_id: gate.userId,
          action: event.action,
          target: event.target,
        }))
      );
    }

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return respond(role, nextStore, issued ? { issued } : {});
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
