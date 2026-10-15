import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { publicReadLimit, rateLimit, clientIp } from '@/lib/security/rate-limit';
import { isPortalTokenShape } from '@/lib/construction/portal-tokens';
import {
  applyPaymentAction,
  CONSTRUCTIONGRAPH_HASH_KEY,
  CONSTRUCTIONGRAPH_TOKEN_KEY,
  CONSTRUCTIONGRAPH_TOKENS_KEY,
} from '@/lib/construction/constructiongraph';
import {
  servePublicPortal,
  PORTAL_GENERIC,
  PORTAL_NOT_FOUND,
  type ConstructionPortalDb,
  type PublicProfileRow,
} from '@/lib/construction/public-book';
import { throttleErrorKind } from '@/lib/construction/portal-throttle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function json(body: Record<string, unknown>, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

function portalNotFound() {
  return json({ error: PORTAL_NOT_FOUND }, 404);
}

function genericError() {
  return json({ error: PORTAL_GENERIC }, 500);
}

type LooseDb = {
  from(table: string): {
    select(columns: string): {
      filter(column: string, op: string, value: string): {
        limit(n: number): PromiseLike<{
          data: PublicProfileRow[] | null;
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
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

const PROFILE_SELECT = 'id, trading_name, legal_name, metadata, updated_at';

export function supabasePortalDb(db: LooseDb): ConstructionPortalDb {
  return {
    async findByHash(hash) {
      const res = await db
        .from('profiles')
        .select(PROFILE_SELECT)
        .filter(`metadata->${CONSTRUCTIONGRAPH_HASH_KEY}->>${hash}`, 'neq', '')
        .limit(1);
      if (res.error) throw new Error('cg_portal_lookup_failed');
      return Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
    },
    async findByLegacyToken(token) {
      const byMap = await db
        .from('profiles')
        .select(PROFILE_SELECT)
        .filter(`metadata->${CONSTRUCTIONGRAPH_TOKENS_KEY}->>${token}`, 'neq', '')
        .limit(1);
      if (byMap.error) throw new Error('cg_portal_lookup_failed');
      if (Array.isArray(byMap.data) && byMap.data[0]) return byMap.data[0];
      const byPublic = await db
        .from('profiles')
        .select(PROFILE_SELECT)
        .filter(`metadata->>${CONSTRUCTIONGRAPH_TOKEN_KEY}`, 'eq', token)
        .limit(1);
      if (byPublic.error) throw new Error('cg_portal_lookup_failed');
      return Array.isArray(byPublic.data) && byPublic.data[0] ? byPublic.data[0] : null;
    },
    async commit(id, prevUpdatedAt, metadata, nextUpdatedAt) {
      const update = db
        .from('profiles')
        .update({ metadata, updated_at: nextUpdatedAt })
        .eq('id', id);
      const res =
        prevUpdatedAt == null
          ? await update.is('updated_at', null).select('id')
          : await update.eq('updated_at', prevUpdatedAt).select('id');
      if (res.error) throw new Error('cg_portal_write_failed');
      return res.data && res.data.length > 0 ? 'ok' : 'lost';
    },
    async isThrottled(keyHash) {
      const res = await db.rpc('construction_portal_is_throttled', { p_key_hash: keyHash });
      if (res.error) {
        return throttleErrorKind(res.error) === 'missing' ? 'missing' : 'error';
      }
      return res.data === true ? 'yes' : 'no';
    },
    async registerFailure(keyHash) {
      const res = await db.rpc('construction_portal_register_failure', { p_key_hash: keyHash });
      if (res.error) {
        return throttleErrorKind(res.error) === 'missing' ? 'missing' : 'error';
      }
      return 'ok';
    },
  };
}

export const constructionPublicDeps: { db: ConstructionPortalDb | null; opened: number } = {
  db: null,
  opened: 0,
};

function portalDb(): ConstructionPortalDb {
  constructionPublicDeps.opened += 1;
  if (constructionPublicDeps.db) return constructionPublicDeps.db;
  return supabasePortalDb(getSupabaseAdmin() as unknown as LooseDb);
}

void applyPaymentAction;

export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!isPortalTokenShape(token)) return portalNotFound();

    const rl = publicReadLimit(request, 'public-constructiongraph');
    if (!rl.ok) {
      return json(
        { error: 'Too many requests' },
        429,
        { 'Retry-After': String(rl.retryAfterSec) }
      );
    }

    const db = portalDb();
    const result = await servePublicPortal({ request, token, db });
    return json(result.body, result.status);
  } catch {
    console.error('cg_public_read_failed');
    return genericError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      action?: string;
      paymentId?: string;
      amount?: unknown;
    };
    const token = String(body.token || '').trim();
    if (!isPortalTokenShape(token)) return portalNotFound();

    const rl = rateLimit({
      key: `public-constructiongraph-write:${clientIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return json(
        { error: 'Too many requests' },
        429,
        { 'Retry-After': String(rl.retryAfterSec) }
      );
    }

    const db = portalDb();
    const result = await servePublicPortal({ request, token, db, body });
    return json(result.body, result.status);
  } catch {
    console.error('cg_public_write_failed');
    return genericError();
  }
}
