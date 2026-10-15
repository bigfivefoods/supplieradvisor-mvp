/**
 * ConstructionAdvisor® public portal reads and claim/pay writes.
 * Unknown, revoked, expired, and unscoped links all fail the same way.
 */
import { clientIp } from '@/lib/security/rate-limit';
import {
  appendConstructionAudit,
  applyPaymentAction,
  markPresentedTokenLegacy,
  parsePortalAmount,
  portalAmountWithinRow,
  portalDenial,
  portalViewForToken,
  readConstructiongraphFromMetadata,
  resolvePresentedPortal,
  writeConstructiongraphToMetadata,
  type ConstructiongraphStore,
} from './constructiongraph';
import { commitProfileMetadata } from './metadata-commit';
import { hashPortalToken, portalAttemptKeyHash } from './portal-tokens';
import { noteThrottleUnavailable } from './portal-throttle';

export type PublicProfileRow = {
  id?: number;
  trading_name?: string | null;
  legal_name?: string | null;
  metadata?: unknown;
  updated_at?: string | null;
};

export type ConstructionPortalDb = {
  findByHash(hash: string): Promise<PublicProfileRow | null>;
  findByLegacyToken(token: string): Promise<PublicProfileRow | null>;
  commit(
    id: number,
    prevUpdatedAt: string | null,
    metadata: Record<string, unknown>,
    nextUpdatedAt: string
  ): Promise<'ok' | 'lost'>;
  isThrottled(keyHash: string): Promise<'no' | 'yes' | 'missing' | 'error'>;
  registerFailure(keyHash: string): Promise<'ok' | 'missing' | 'error'>;
};

export const PORTAL_NOT_FOUND = 'Portal not found';
export const PORTAL_THROTTLED = 'Too many tries, try again in a few minutes';
export const PORTAL_GENERIC = 'Something went wrong';

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function companyName(row: PublicProfileRow): string {
  return String(row.trading_name || row.legal_name || 'ConstructionAdvisor®');
}

async function throttleGate(
  db: ConstructionPortalDb,
  request: { headers: { get(name: string): string | null } }
): Promise<'ok' | 'throttled'> {
  const key = portalAttemptKeyHash(clientIp(request));
  const status = await db.isThrottled(key);
  if (status === 'missing') {
    noteThrottleUnavailable();
    return 'ok';
  }
  if (status === 'yes' || status === 'error') return 'throttled';
  return 'ok';
}

async function noteFailure(
  db: ConstructionPortalDb,
  request: { headers: { get(name: string): string | null } }
): Promise<void> {
  const key = portalAttemptKeyHash(clientIp(request));
  const status = await db.registerFailure(key);
  if (status === 'missing') noteThrottleUnavailable();
}

function needsUpgrade(store: ConstructiongraphStore, token: string): boolean {
  if (store.settings.public_token) return true;
  return store.portals.some((portal) => portal.token === token);
}

async function upgradeLegacy(
  db: ConstructionPortalDb,
  row: PublicProfileRow,
  token: string
): Promise<void> {
  if (!row.id) return;
  try {
    await commitProfileMetadata({
      read: async () => {
        const fresh = await db.findByHash(hashPortalToken(token));
        const legacy = fresh || (await db.findByLegacyToken(token));
        if (!legacy?.metadata || legacy.id !== row.id) return null;
        return {
          metadata: asObject(legacy.metadata),
          updated_at: legacy.updated_at ?? null,
        };
      },
      write: (args) => db.commit(row.id as number, args.prevUpdatedAt, args.metadata, args.nextUpdatedAt),
      change: (current) => {
        const store = markPresentedTokenLegacy(
          readConstructiongraphFromMetadata(current.metadata),
          token
        );
        let metadata = writeConstructiongraphToMetadata(current.metadata, store);
        const saved = readConstructiongraphFromMetadata(metadata);
        const upgraded = saved.portals.find(
          (row) => row.token_hash && row.token_hash === hashPortalToken(token)
        );
        const target = upgraded?.id && upgraded.id !== token ? upgraded.id : 'legacy';
        metadata = appendConstructionAudit(metadata, {
          at: new Date().toISOString(),
          actor_kind: 'portal',
          actor_id: target,
          action: 'legacy_upgraded',
          target,
        });
        return { metadata, value: true };
      },
    });
  } catch (error) {
    console.error('cg_portal_legacy_upgrade_failed', error instanceof Error ? error.name : 'error');
  }
}

export async function servePublicPortal(opts: {
  request: { headers: { get(name: string): string | null } };
  token: string;
  db: ConstructionPortalDb;
  body?: { action?: string; paymentId?: string; amount?: unknown };
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const gate = await throttleGate(opts.db, opts.request);
  if (gate === 'throttled') {
    return { status: 429, body: { error: PORTAL_THROTTLED } };
  }

  const hash = hashPortalToken(opts.token);
  let row = await opts.db.findByHash(hash);
  let via: 'hash' | 'legacy' = 'hash';
  if (!row) {
    row = await opts.db.findByLegacyToken(opts.token);
    via = 'legacy';
  }
  if (!row?.metadata || !row.id) {
    await noteFailure(opts.db, opts.request);
    return { status: 404, body: { error: PORTAL_NOT_FOUND } };
  }

  const meta = asObject(row.metadata);
  const store = readConstructiongraphFromMetadata(meta);
  const found = resolvePresentedPortal(store, opts.token);
  if (!found) {
    await noteFailure(opts.db, opts.request);
    return { status: 404, body: { error: PORTAL_NOT_FOUND } };
  }
  const denial = portalDenial(found.portal);
  if (denial) {
    if (denial === 'revoked' || denial === 'expired' || denial === 'missing') {
      await noteFailure(opts.db, opts.request);
    }
    if (via === 'legacy' || needsUpgrade(store, opts.token)) {
      await upgradeLegacy(opts.db, row, opts.token);
    }
    return { status: 404, body: { error: PORTAL_NOT_FOUND } };
  }

  if (!opts.body) {
    const view = portalViewForToken(store, opts.token, companyName(row));
    if (!view) {
      await noteFailure(opts.db, opts.request);
      return { status: 404, body: { error: PORTAL_NOT_FOUND } };
    }
    if (via === 'legacy' || needsUpgrade(store, opts.token)) {
      await upgradeLegacy(opts.db, row, opts.token);
    }
    return { status: 200, body: { success: true, view } };
  }

  const action = String(opts.body.action || '');
  if (action !== 'claim' && action !== 'pay') {
    return { status: 400, body: { error: 'action must be claim or pay' } };
  }
  const actor = found.portal.kind === 'contractor' ? 'contractor' : found.portal.kind === 'client' ? 'client' : 'public';
  if (actor === 'public' || (actor === 'contractor' && action !== 'claim') || (actor === 'client' && action !== 'pay')) {
    return { status: 400, body: { error: 'That action is not available on this link' } };
  }

  const paymentId = String(opts.body.paymentId || '');
  const payment = store.payments.find((item) => item.id === paymentId);
  if (!payment) return { status: 400, body: { error: 'Payment not found' } };
  if (payment.paid_at || payment.status === 'paid') {
    return { status: 400, body: { error: 'Payment is already paid' } };
  }

  let amount: number | undefined;
  if (opts.body.amount !== undefined) {
    const parsed = parsePortalAmount(opts.body.amount);
    if (!parsed.ok) return { status: 400, body: { error: 'Amount is not valid' } };
    if (!portalAmountWithinRow(action, payment, parsed.value)) {
      return { status: 400, body: { error: 'Amount is not valid' } };
    }
    amount = parsed.value;
  }

  const result = applyPaymentAction(store, {
    paymentId,
    action,
    amount,
    actor,
    portal: found.portal,
  });
  if (!result.ok) return { status: 400, body: { error: result.error } };

  const reportedAt = new Date().toISOString();
  const saved = await commitProfileMetadata({
    read: async () => {
      const freshHash = await opts.db.findByHash(hash);
      const fresh = freshHash || (await opts.db.findByLegacyToken(opts.token));
      if (!fresh?.metadata || fresh.id !== row?.id) return null;
      return { metadata: asObject(fresh.metadata), updated_at: fresh.updated_at ?? null };
    },
    write: (args) => opts.db.commit(row?.id as number, args.prevUpdatedAt, args.metadata, args.nextUpdatedAt),
    change: (current) => {
      const latest = readConstructiongraphFromMetadata(current.metadata);
      const again = resolvePresentedPortal(latest, opts.token);
      if (!again || portalDenial(again.portal)) {
        return { error: PORTAL_NOT_FOUND, status: 404 };
      }
      const replay = applyPaymentAction(latest, {
        paymentId,
        action,
        amount,
        actor,
        portal: again.portal,
      });
      if (!replay.ok) return { error: replay.error, status: 400 };
      const nextStore: ConstructiongraphStore = {
        ...replay.store,
        payments: replay.store.payments.map((item) =>
          item.id === paymentId
            ? {
                ...item,
                reported_via: 'portal',
                reported_portal_id: again.portal.id,
                reported_at: reportedAt,
              }
            : item
        ),
      };
      let metadata = writeConstructiongraphToMetadata(current.metadata, nextStore);
      metadata = appendConstructionAudit(metadata, {
        at: reportedAt,
        actor_kind: 'portal',
        actor_id: again.portal.id || actor,
        action: action === 'claim' ? 'portal_claim' : 'portal_pay',
        target: paymentId,
      });
      return { metadata, value: nextStore };
    },
  });

  if (!saved.ok) {
    if (saved.status === 404) return { status: 404, body: { error: PORTAL_NOT_FOUND } };
    return { status: saved.status, body: { error: saved.error } };
  }

  const view = portalViewForToken(
    readConstructiongraphFromMetadata(saved.metadata),
    opts.token,
    companyName(row)
  );
  if (!view) return { status: 404, body: { error: PORTAL_NOT_FOUND } };
  return { status: 200, body: { success: true, view } };
}
