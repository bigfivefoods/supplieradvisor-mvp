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
import { commitProfileMetadata } from '@/lib/construction/metadata-commit';
import {
  applyStaffConstructionAction,
  upgradePlaintextPortals,
} from '@/lib/construction/staff-book';

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
};

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

    let metadata = row.metadata;
    if (upgradePlaintextPortals(metadata, gate.userId, new Date().toISOString()).changed) {
      try {
        const saved = await commitProfileMetadata({
          read: () => io.read(),
          write: (args) => io.write(args),
          change: (current) => {
            const next = upgradePlaintextPortals(
              current.metadata,
              gate.userId,
              new Date().toISOString()
            );
            if (!next.changed) return { metadata: current.metadata, value: false };
            return { metadata: next.metadata, value: true };
          },
        });
        if (saved.ok) metadata = saved.metadata;
      } catch {
        console.error('cg_staff_legacy_upgrade_failed');
      }
    }

    const store = readConstructiongraphFromMetadata(metadata);
    return json({
      success: true,
      store: sanitiseConstructiongraphStore(store),
      summary: summariseConstructiongraph(store),
      programme: programmeReport(store),
    });
  } catch {
    console.error('cg_staff_read_failed');
    return json({ error: GENERIC }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Payload;
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
    if (action === 'replace') {
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
          portalId: body.portalId,
          confirm: body.confirm,
          actorId: gate.userId,
        });
        if ('error' in applied) return applied;
        return { metadata: applied.metadata, value: applied.value };
      },
    });
    if (!saved.ok) return json({ error: saved.error }, saved.status);
    return json({ success: true, ...saved.value });
  } catch {
    console.error('cg_staff_write_failed');
    return json({ error: GENERIC }, 500);
  }
}
