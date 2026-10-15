import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  legacyPrivyFrom,
  requireCompanyAccess,
  requireCompanyPermission,
  requireCompanyRoles,
  ROLES_OPS_CRITICAL,
} from '@/lib/auth/api-auth';
import {
  programmeReport,
  readConstructiongraphFromMetadata,
  sanitiseConstructiongraphStore,
  summariseConstructiongraph,
  type ConstructiongraphStore,
} from '@/lib/construction/constructiongraph';
import { getCompanyMembership } from '@/lib/business/access';
import { commitProfileMetadata } from '@/lib/construction/metadata-commit';
import { redactRolePayload, resolveConstructionRole, storeForRole } from '@/lib/construction/roles';
import { applyStaffConstructionAction } from '@/lib/construction/staff-book';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const GENERIC = 'Something went wrong';

type Payload = {
  companyId?: number;
  action?: string;
  store?: Partial<ConstructiongraphStore>;
  clientId?: string;
  siteId?: string;
  portalId?: string;
  confirm?: string;
  id?: string;
  workersSeeMoney?: boolean;
};

function presentForRole(
  value: Record<string, unknown>,
  role: ReturnType<typeof resolveConstructionRole>,
  full: ConstructiongraphStore
) {
  const redacted = redactRolePayload(value, role) as Record<string, unknown>;
  const book = redacted.store;
  if (
    role === 'site_manager' &&
    full.settings?.workers_see_money &&
    book &&
    typeof book === 'object'
  ) {
    const next = book as ConstructiongraphStore;
    next.payments = full.payments;
    next.certificates = full.certificates;
  }
  return redacted;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

type LooseDb = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        maybeSingle(): PromiseLike<{
          data: { metadata?: unknown; updated_at?: string | null } | null;
          error: { message?: string } | null;
        }>;
      };
    };
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          select(columns: string): PromiseLike<{
            data: Array<{ id?: number }> | null;
            error: { message?: string } | null;
          }>;
        };
        is(column: string, value: null): {
          select(columns: string): PromiseLike<{
            data: Array<{ id?: number }> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};

function companyIo(supabase: LooseDb, companyId: number) {
  return {
    async read() {
      const res = await supabase
        .from('profiles')
        .select('metadata, updated_at')
        .eq('id', companyId)
        .maybeSingle();
      if (res.error) throw new Error('cg_staff_read_failed');
      if (!res.data) return null;
      return {
        metadata: asObject(res.data.metadata),
        updated_at: res.data.updated_at ?? null,
      };
    },
    async write(args: {
      metadata: Record<string, unknown>;
      prevUpdatedAt: string | null;
      nextUpdatedAt: string;
    }) {
      const update = supabase
        .from('profiles')
        .update({ metadata: args.metadata, updated_at: args.nextUpdatedAt })
        .eq('id', companyId);
      const res =
        args.prevUpdatedAt == null
          ? await update.is('updated_at', null).select('id')
          : await update.eq('updated_at', args.prevUpdatedAt).select('id');
      if (res.error) throw new Error('cg_staff_write_failed');
      return res.data && res.data.length > 0 ? ('ok' as const) : ('lost' as const);
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return json({ error: 'companyId required' }, 400);
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const perm = await requireCompanyPermission(request, companyId, 'operations', 'view', {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!perm.ok) return perm.response;

    const supabase = getSupabaseServer();
    const io = companyIo(supabase as unknown as LooseDb, companyId);
    const row = await io.read();
    if (!row) return json({ error: 'Company not found' }, 404);

    // View-only roles may GET. Legacy upgrade is a write, so it stays on the
    // public read and on staff writes, not on this GET.
    const membership = await getCompanyMembership(gate.userId, companyId);
    if (!membership.ok) return json({ error: membership.error }, membership.status);
    const moduleRole = resolveConstructionRole(membership.role);
    if (moduleRole === 'none') return json({ error: 'Not available for your role' }, 403);

    const metadata = row.metadata;
    const store = readConstructiongraphFromMetadata(metadata);
    const safe = sanitiseConstructiongraphStore(store);
    const body = presentForRole(
      {
        success: true,
        role: moduleRole,
        store: storeForRole(safe, moduleRole),
        summary: summariseConstructiongraph(store),
        programme: programmeReport(store),
      },
      moduleRole,
      safe
    );
    return json(body);
  } catch {
    console.error('cg_staff_read_failed');
    return json({ error: GENERIC }, 500);
  }
}

export async function POST(request: NextRequest) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  try {
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return json({ error: 'companyId required' }, 400);
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'merge');
    const legacy = { legacyPrivyUserId: legacyPrivyFrom(request) };
    if (action === 'replace' || action === 'set_workers_money') {
      const role = await requireCompanyRoles(request, companyId, ['owner', 'admin'], legacy);
      if (!role.ok) return role.response;
    } else if (
      action === 'ensure_portal' ||
      action === 'ensure_client_portal' ||
      action === 'ensure_contractor_portal' ||
      action === 'revoke_portal' ||
      action === 'reissue_portal' ||
      action === 'seed_demo'
    ) {
      const role = await requireCompanyRoles(request, companyId, ROLES_OPS_CRITICAL, legacy);
      if (!role.ok) return role.response;
    } else {
      const perm = await requireCompanyPermission(
        request,
        companyId,
        'operations',
        'write',
        legacy
      );
      if (!perm.ok) return perm.response;
    }

    const membership = await getCompanyMembership(gate.userId, companyId);
    if (!membership.ok) return json({ error: membership.error }, membership.status);
    const moduleRole = resolveConstructionRole(membership.role);
    if (moduleRole === 'none') return json({ error: 'Not available for your role' }, 403);

    const supabase = getSupabaseServer();
    const io = companyIo(supabase as unknown as LooseDb, companyId);
    const saved = await commitProfileMetadata({
      read: () => io.read(),
      write: (args) => io.write(args),
      change: (row) => {
        const applied = applyStaffConstructionAction({
          meta: row.metadata,
          action,
          patch: body.store,
          clientId: body.clientId,
          siteId: body.siteId,
          portalId: body.portalId || body.id,
          confirm: body.confirm,
          actorId: gate.userId,
          moduleRole,
          extra: body as unknown as Record<string, unknown>,
        });
        if ('error' in applied) return applied;
        return { metadata: applied.metadata, value: { ...applied.value, role: moduleRole } };
      },
    });
    if (!saved.ok) {
      return json(
        { error: saved.error, ...(saved.needsConfirm ? { needsConfirm: true } : {}) },
        saved.status
      );
    }
    const savedStore = (saved.value as { store?: ConstructiongraphStore }).store;
    const visible = presentForRole(
      saved.value as Record<string, unknown>,
      moduleRole,
      savedStore || ({ settings: {} } as ConstructiongraphStore)
    );
    return json({ success: true, ...visible });
  } catch {
    console.error('cg_staff_write_failed');
    return json({ error: GENERIC }, 500);
  }
}
