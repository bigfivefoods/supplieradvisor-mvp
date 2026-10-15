/**
 * Staff mutations for the ConstructionAdvisor® book.
 * Portals change only through the explicit actions. merge and replace cannot
 * forge or resurrect a link.
 */
import { sha256Hex } from './sha256';
import {
  appendConstructionAudit,
  applyPaymentAction,
  constructionBookHasRows,
  emptyConstructiongraphStore,
  keepConstructionExtras,
  markPresentedTokenLegacy,
  mergeConstructiongraphStore,
  programmeReport,
  readConstructiongraphFromMetadata,
  sanitiseConstructiongraphStore,
  stripPortalOwnedFields,
  summariseConstructiongraph,
  writeConstructiongraphToMetadata,
  type ConstructiongraphStore,
} from './constructiongraph';
import { applyConstructionAction } from './actions';
import { sastToday } from './format';
import {
  issueConstructionPortal,
  reissueConstructionPortal,
  revokeConstructionPortal,
  seedConstructionBook,
  type IssuedPortal,
} from './portal-issue';
import { guardRoleMerge, type ConstructionRole } from './roles';

export const REPLACE_CONFIRM = 'REPLACE ALL DATA';

export type StaffBookValue = {
  store: ConstructiongraphStore;
  summary: ReturnType<typeof summariseConstructiongraph>;
  programme: ReturnType<typeof programmeReport>;
  issued?: IssuedPortal | IssuedPortal[];
};

function pack(
  meta: Record<string, unknown>,
  store: ConstructiongraphStore,
  issued?: IssuedPortal | IssuedPortal[]
): { metadata: Record<string, unknown>; value: StaffBookValue } {
  return {
    metadata: meta,
    value: {
      store: sanitiseConstructiongraphStore(store),
      summary: summariseConstructiongraph(store),
      programme: programmeReport(store),
      ...(issued ? { issued } : {}),
    },
  };
}

function audit(
  meta: Record<string, unknown>,
  store: ConstructiongraphStore,
  entry: { at: string; actorId: string; action: string; target: string },
  issued?: IssuedPortal | IssuedPortal[]
) {
  const withBook = writeConstructiongraphToMetadata(meta, store);
  const withAudit = appendConstructionAudit(withBook, {
    at: entry.at,
    actor_kind: 'staff',
    actor_id: entry.actorId,
    action: entry.action,
    target: entry.target,
  });
  return pack(withAudit, readConstructiongraphFromMetadata(withAudit), issued);
}

export function plaintextPortalTokens(store: ConstructiongraphStore): string[] {
  const tokens = new Set<string>();
  for (const portal of store.portals) {
    if (portal.token) tokens.add(portal.token);
  }
  if (store.settings.public_token) tokens.add(store.settings.public_token);
  return [...tokens];
}

export function upgradePlaintextPortals(
  meta: Record<string, unknown>,
  actorId: string,
  now: string
): { metadata: Record<string, unknown>; store: ConstructiongraphStore; changed: boolean } {
  let store = readConstructiongraphFromMetadata(meta);
  const tokens = plaintextPortalTokens(store);
  if (!tokens.length && !store.settings.public_token) {
    return { metadata: meta, store, changed: false };
  }
  for (const token of tokens) store = markPresentedTokenLegacy(store, token);
  const upgradedHashes = new Set(tokens.map((token) => sha256Hex(token)));
  let next = writeConstructiongraphToMetadata(meta, store);
  const saved = readConstructiongraphFromMetadata(next);
  for (const portal of saved.portals) {
    if (!portal.id || !portal.token_hash || !upgradedHashes.has(portal.token_hash)) continue;
    next = appendConstructionAudit(next, {
      at: now,
      actor_kind: 'staff',
      actor_id: actorId,
      action: 'legacy_upgraded',
      target: portal.id,
    });
  }
  return { metadata: next, store: readConstructiongraphFromMetadata(next), changed: true };
}

export function applyStaffConstructionAction(opts: {
  meta: Record<string, unknown>;
  action: string;
  patch?: Partial<ConstructiongraphStore>;
  clientId?: string;
  siteId?: string;
  portalId?: string;
  confirm?: string;
  actorId: string;
  now?: string;
  moduleRole?: ConstructionRole;
  extra?: Record<string, unknown>;
}): { metadata: Record<string, unknown>; value: StaffBookValue } | { error: string; status: number; needsConfirm?: boolean } {
  const now = opts.now || new Date().toISOString();
  const current = readConstructiongraphFromMetadata(opts.meta);
  const action = String(opts.action || 'merge');

  if (action === 'seed_demo') {
    if (constructionBookHasRows(current)) {
      return { error: 'The book already has data', status: 409 };
    }
    const seeded = seedConstructionBook(now);
    return audit(opts.meta, seeded.store, {
      at: now,
      actorId: opts.actorId,
      action: 'seed',
      target: 'store',
    }, seeded.issued);
  }

  if (action === 'replace') {
    // Owner or admin, and the exact phrase REPLACE ALL DATA. The route checks the role.
    // Issued portals and settings stay; a replace must not delete links or their hashes.
    if (opts.confirm !== REPLACE_CONFIRM) {
      return { error: 'confirm must be REPLACE ALL DATA', status: 400 };
    }
    const next = mergeConstructiongraphStore(
      emptyConstructiongraphStore(),
      stripPortalOwnedFields(opts.patch || {})
    );
    const replaced = keepConstructionExtras(
      {
        ...next,
        portals: current.portals,
        settings: { ...(current.settings || {}) },
      },
      current
    );
    return audit(opts.meta, replaced, {
      at: now,
      actorId: opts.actorId,
      action: 'replace',
      target: 'store',
    });
  }

  if (action === 'ensure_portal') {
    const issued = issueConstructionPortal(current, {
      kind: 'public',
      label: 'Client & contractor PWA',
      created_by: opts.actorId,
      now,
    });
    if (!issued.ok) return issued;
    return audit(opts.meta, issued.store, {
      at: now,
      actorId: opts.actorId,
      action: 'portal_issued',
      target: issued.issued.id,
    }, issued.issued);
  }

  if (action === 'ensure_client_portal') {
    const clientId = String(opts.clientId || '').trim();
    const client = current.clients.find((row) => row.id === clientId);
    if (!client) return { error: 'clientId required', status: 400 };
    const issued = issueConstructionPortal(current, {
      kind: 'client',
      client_id: clientId,
      label: client.name,
      created_by: opts.actorId,
      now,
    });
    if (!issued.ok) return issued;
    return audit(opts.meta, issued.store, {
      at: now,
      actorId: opts.actorId,
      action: 'portal_issued',
      target: issued.issued.id,
    }, issued.issued);
  }

  if (action === 'ensure_contractor_portal') {
    const siteId = String(opts.siteId || '').trim();
    const site = current.sites.find((row) => row.id === siteId);
    if (!site) return { error: 'siteId required', status: 400 };
    const issued = issueConstructionPortal(current, {
      kind: 'contractor',
      site_id: siteId,
      client_id: site.client_id,
      label: `${site.code} site team`,
      created_by: opts.actorId,
      now,
    });
    if (!issued.ok) return issued;
    return audit(opts.meta, issued.store, {
      at: now,
      actorId: opts.actorId,
      action: 'portal_issued',
      target: issued.issued.id,
    }, issued.issued);
  }

  if (action === 'revoke_portal') {
    const portalId = String(opts.portalId || '').trim();
    const revoked = revokeConstructionPortal(current, portalId, now);
    if (!revoked.ok) return revoked;
    return audit(opts.meta, revoked.store, {
      at: now,
      actorId: opts.actorId,
      action: 'portal_revoked',
      target: portalId,
    });
  }

  if (action === 'reissue_portal') {
    const portalId = String(opts.portalId || '').trim();
    const reissued = reissueConstructionPortal(current, portalId, opts.actorId, now);
    if (!reissued.ok) return reissued;
    return audit(opts.meta, reissued.store, {
      at: now,
      actorId: opts.actorId,
      action: 'portal_reissued',
      target: reissued.issued.id,
    }, reissued.issued);
  }

  const role = opts.moduleRole || 'owner';
  if (action === 'set_workers_money') {
    const settings = {
      ...(current.settings || {}),
      workers_see_money: Boolean(opts.extra?.workersSeeMoney),
    };
    const next = keepConstructionExtras({ ...current, settings }, current);
    return audit(opts.meta, next, {
      at: now,
      actorId: opts.actorId,
      action: 'workers_money',
      target: settings.workers_see_money ? 'on' : 'off',
    });
  }

  if (action === 'payment') {
    if (role !== 'owner' && role !== 'office') {
      return { error: 'Not available for your role', status: 403 };
    }
    const verb = opts.extra?.verb === 'pay' || opts.extra?.verb === 'claim' ? opts.extra.verb : 'certify';
    const paid = applyPaymentAction(current, {
      paymentId: String(opts.extra?.paymentId || ''),
      action: verb,
      actor: 'staff',
      date: sastToday(),
    });
    if (!paid.ok) return { error: paid.error, status: 400 };
    return audit(opts.meta, paid.store, {
      at: now,
      actorId: opts.actorId,
      action: `payment_${verb}`,
      target: String(opts.extra?.paymentId || ''),
    });
  }

  if (
    action === 'remove_sample' ||
    action === 'delete_row' ||
    action === 'decide_variation' ||
    action === 'baseline_programme'
  ) {
    const result = applyConstructionAction(current, { action, ...(opts.extra || {}) }, role);
    if (!result.ok) {
      return {
        error: result.error,
        status: result.status,
        ...(result.needsConfirm ? { needsConfirm: true } : {}),
      };
    }
    const event = result.events[0];
    return audit(opts.meta, result.store, {
      at: now,
      actorId: opts.actorId,
      action: event?.action || action,
      target: event?.target || action,
    });
  }

  if (action === 'merge' && opts.moduleRole) {
    const guarded = guardRoleMerge(opts.moduleRole, opts.patch || {});
    if (!guarded.ok) return { error: guarded.error, status: guarded.status };
  }

  const next = mergeConstructiongraphStore(
    current,
    stripPortalOwnedFields(opts.patch || {})
  );
  const metadata = writeConstructiongraphToMetadata(opts.meta, next);
  return pack(metadata, readConstructiongraphFromMetadata(metadata));
}
