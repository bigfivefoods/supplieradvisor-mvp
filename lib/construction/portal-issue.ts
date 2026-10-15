/**
 * Issue, revoke, and reissue ConstructionAdvisor® portal links.
 * The raw token is returned once and is not stored.
 */
import {
  constructiongraphSeedStore,
  hydrateConstructiongraphStore,
  keepConstructionExtras,
  type ConstructiongraphStore,
  type ConstructionPortal,
} from './constructiongraph';
import {
  hashPortalToken,
  newPortalRowId,
  newPortalToken,
  portalTokenHint,
} from './portal-tokens';

export type IssuedPortal = {
  id: string;
  kind: ConstructionPortal['kind'];
  token: string;
  path: string;
};

export type IssueResult =
  | { ok: true; store: ConstructiongraphStore; issued: IssuedPortal }
  | { ok: false; status: number; error: string };

function portalPath(token: string): string {
  return `/construction/${token}`;
}

function isLive(portal: ConstructionPortal, now: number): boolean {
  if (portal.revoked_at) return false;
  if (portal.expires_at && Date.parse(portal.expires_at) <= now) return false;
  return true;
}

function withPortals(
  store: ConstructiongraphStore,
  portals: ConstructionPortal[]
): ConstructiongraphStore {
  const settings = { ...(store.settings || {}) };
  delete settings.public_token;
  const next = hydrateConstructiongraphStore({ ...store, portals, settings });
  return keepConstructionExtras(next, store);
}

export function issueConstructionPortal(
  store: ConstructiongraphStore,
  input: {
    kind: ConstructionPortal['kind'];
    client_id?: string | null;
    site_id?: string | null;
    label?: string;
    created_by?: string;
    now?: string;
  }
): IssueResult {
  const nowIso = input.now || new Date().toISOString();
  const now = Date.parse(nowIso);
  if (input.kind === 'client' && !input.client_id) {
    return { ok: false, status: 400, error: 'clientId required' };
  }
  if (input.kind === 'contractor' && !input.site_id) {
    return { ok: false, status: 400, error: 'siteId required' };
  }
  const existing = store.portals.find((portal) => {
    if (!isLive(portal, now) || portal.kind !== input.kind) return false;
    if (input.kind === 'public') return true;
    if (input.kind === 'client') return portal.client_id === input.client_id;
    return portal.site_id === input.site_id;
  });
  if (existing) {
    const who =
      input.kind === 'public'
        ? 'A public link already exists. Reissue it instead.'
        : input.kind === 'client'
          ? 'This client already has a link. Reissue it instead.'
          : 'This project already has a link. Reissue it instead.';
    return { ok: false, status: 409, error: who };
  }
  const token = newPortalToken();
  const id = newPortalRowId();
  const row: ConstructionPortal = {
    id,
    token_hash: hashPortalToken(token),
    token_hint: portalTokenHint(token),
    kind: input.kind,
    client_id: input.client_id ?? null,
    site_id: input.site_id ?? null,
    label: input.label,
    created_at: nowIso,
    created_by: input.created_by,
  };
  return {
    ok: true,
    store: withPortals(store, [...store.portals, row]),
    issued: { id, kind: input.kind, token, path: portalPath(token) },
  };
}

export function revokeConstructionPortal(
  store: ConstructiongraphStore,
  portalId: string,
  now = new Date().toISOString()
): { ok: true; store: ConstructiongraphStore } | { ok: false; status: number; error: string } {
  const current = store.portals.find((portal) => portal.id === portalId);
  if (!current) return { ok: false, status: 404, error: 'Portal not found' };
  if (current.revoked_at) return { ok: true, store };
  const portals = store.portals.map((portal) =>
    portal.id === portalId ? { ...portal, revoked_at: now } : portal
  );
  return { ok: true, store: withPortals(store, portals) };
}

export function reissueConstructionPortal(
  store: ConstructiongraphStore,
  portalId: string,
  createdBy?: string,
  now = new Date().toISOString()
): IssueResult {
  const current = store.portals.find((portal) => portal.id === portalId);
  if (!current) return { ok: false, status: 404, error: 'Portal not found' };
  const revoked = revokeConstructionPortal(store, portalId, now);
  if (!revoked.ok) return revoked;
  return issueConstructionPortal(revoked.store, {
    kind: current.kind,
    client_id: current.client_id,
    site_id: current.site_id,
    label: current.label,
    created_by: createdBy,
    now,
  });
}

export function seedConstructionBook(nowIso = new Date().toISOString()): {
  store: ConstructiongraphStore;
  issued: IssuedPortal[];
} {
  const specs: Array<Pick<ConstructionPortal, 'kind' | 'client_id' | 'site_id' | 'label'>> = [
    { kind: 'public', label: 'Client & contractor PWA' },
    { kind: 'client', client_id: 'cli_apex', label: 'Apex Developments' },
    { kind: 'contractor', site_id: 'site_1', label: 'Podium site team' },
  ];
  const issued: IssuedPortal[] = [];
  const portals: ConstructionPortal[] = specs.map((spec) => {
    const token = newPortalToken();
    const id = newPortalRowId();
    issued.push({ id, kind: spec.kind, token, path: portalPath(token) });
    return {
      id,
      token_hash: hashPortalToken(token),
      token_hint: portalTokenHint(token),
      kind: spec.kind,
      client_id: spec.client_id ?? null,
      site_id: spec.site_id ?? null,
      label: spec.label,
      created_at: nowIso,
    };
  });
  return { store: constructiongraphSeedStore(nowIso, portals), issued };
}
