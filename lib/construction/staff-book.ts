/**
 * Staff mutations for the ConstructionAdvisor® book.
 * Portals change only through the explicit actions. merge and replace cannot
 * forge or resurrect a link.
 */
import { sha256Hex } from './sha256';
import {
  appendConstructionAudit,
  constructionBookHasRows,
  emptyConstructiongraphStore,
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
import {
  issueConstructionPortal,
  reissueConstructionPortal,
  revokeConstructionPortal,
  seedConstructionBook,
  type IssuedPortal,
} from './portal-issue';

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
}): { metadata: Record<string, unknown>; value: StaffBookValue } | { error: string; status: number } {
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
    if (opts.confirm !== REPLACE_CONFIRM) {
      return { error: 'confirm must be REPLACE ALL DATA', status: 400 };
    }
    const next = mergeConstructiongraphStore(
      emptyConstructiongraphStore(),
      stripPortalOwnedFields(opts.patch || {})
    );
    return audit(opts.meta, next, {
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

  const next = mergeConstructiongraphStore(
    current,
    stripPortalOwnedFields(opts.patch || {})
  );
  const metadata = writeConstructiongraphToMetadata(opts.meta, next);
  return pack(metadata, readConstructiongraphFromMetadata(metadata));
}
