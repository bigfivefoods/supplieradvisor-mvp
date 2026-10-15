/**
 * Allow-listed portal screens for the external app.
 * Brief 112 still owns the stored token. This only chooses fields to show.
 */
import {
  portalViewForToken,
  type ConstructionPortal,
  type ConstructiongraphStore,
} from './constructiongraph';
import { formatRand } from './format';
import { buildSubcontractorView } from './subcontractor-view';

export type PortalKind = 'public' | 'client' | 'contractor' | 'subcontractor';

export type PortalScreen = {
  kind: PortalKind;
  companyName: string;
  headline: string;
  projects: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    plannedPct: number;
    actualPct: number;
  }>;
  activities: Array<{
    id: string;
    activity: string;
    status: string;
    plannedPct: number;
    actualPct: number;
    plannedEnd: string | null;
  }>;
  payments: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    amountLabel: string;
  }>;
  variations: Array<{ id: string; number: string; title: string; status: string; days: number }>;
  snags: Array<{ id: string; item: string; status: string; location: string }>;
  documents: Array<{ id: string; number: string; title: string; revision: string; status: string }>;
  required: Array<{ id: string; title: string; kind: string; status: string; expiresOn: string | null }>;
  site: { name: string; code: string; address: string; manager: string; phone: string } | null;
};

const EMPTY: Omit<PortalScreen, 'kind' | 'companyName' | 'headline'> = {
  projects: [],
  activities: [],
  payments: [],
  variations: [],
  snags: [],
  documents: [],
  required: [],
  site: null,
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

export function findPortal(
  store: ConstructiongraphStore,
  token: string
): ConstructionPortal | { token: string; kind: 'public' } | null {
  return (
    store.portals.find((row) => row.token === token) ||
    (store.settings.public_token === token ? { token, kind: 'public' as const } : null)
  );
}

/** HTTP body for a token. Null when the link is missing, revoked, or expired. */
export function publicConstructionView(
  store: ConstructiongraphStore,
  token: string,
  companyName: string
): PortalScreen | null {
  const portal = findPortal(store, token);
  if (!portal) return null;
  if ('revoked_at' in portal && portal.revoked_at) return null;
  if ('expires_at' in portal && portal.expires_at && String(portal.expires_at).slice(0, 10) < new Date().toISOString().slice(0, 10)) {
    return null;
  }
  if (portal.kind === 'subcontractor') {
    const view = buildSubcontractorView(store, portal, companyName);
    if (!view) return null;
    return {
      ...EMPTY,
      kind: 'subcontractor',
      companyName: view.companyName,
      headline: view.subcontractorName,
      site: view.site
        ? {
            name: view.site.name,
            code: view.site.code,
            address: view.site.address,
            manager: view.site.siteManagerName,
            phone: view.site.siteManagerPhone,
          }
        : null,
      activities: view.programme.map((row) => ({
        id: row.id,
        activity: row.activity,
        status: row.status,
        plannedPct: row.plannedPct,
        actualPct: row.actualPct,
        plannedEnd: row.plannedEnd,
      })),
      required: view.required.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind,
        status: row.status,
        expiresOn: row.expiresOn || row.validTo,
      })),
      documents: view.documents.map((row) => ({
        id: row.id,
        number: row.number,
        title: row.title,
        revision: row.revision,
        status: row.status,
      })),
    };
  }

  const wide = portalViewForToken(store, token, companyName);
  if (!wide) return null;
  const siteIds = new Set(wide.projects.map((row) => row.siteId));
  const projects = wide.projects.map((row) => ({
    id: row.siteId,
    name: row.name,
    code: row.code,
    status: row.status,
    plannedPct: row.plannedPct,
    actualPct: row.actualPct,
  }));
  const activities = wide.activities.map((row) => ({
    id: row.id,
    activity: row.activity,
    status: row.status,
    plannedPct: row.plannedPct,
    actualPct: row.actualPct,
    plannedEnd: row.plannedEnd ?? null,
  }));
  if (wide.kind === 'public') {
    return {
      ...EMPTY,
      kind: 'public',
      companyName,
      headline: 'Open programme',
      projects,
      activities,
    };
  }
  const payments = (wide.kind === 'client' || wide.kind === 'contractor' ? wide.payments : []).map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    amountLabel: formatRand(row.certifiedAmount || row.claimedAmount || row.plannedAmount),
  }));
  const variations =
    wide.kind === 'client'
      ? store.variations
          .filter((row) => !row.site_id || siteIds.has(row.site_id))
          .map((row) => ({
            id: row.id,
            number: row.number,
            title: row.title || row.description,
            status: String(row.status || 'draft'),
            days: Number(row.days) || 0,
          }))
      : [];
  const snags =
    wide.kind === 'client'
      ? store.snags
          .filter((row) => !row.site_id || siteIds.has(row.site_id))
          .map((row) => ({
            id: row.id,
            item: row.item,
            status: String(row.status || 'open'),
            location: row.location || '',
          }))
      : [];
  return {
    ...EMPTY,
    kind: wide.kind === 'contractor' ? 'contractor' : 'client',
    companyName,
    headline: wide.projectName || wide.clientName || companyName,
    projects,
    activities,
    payments,
    variations,
    snags,
  };
}

/** Drop anything the external app must not render, even if an older API sent it. */
export function screenFromPayload(payload: unknown): PortalScreen | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const kind = text(body.kind);
  if (kind !== 'public' && kind !== 'client' && kind !== 'contractor' && kind !== 'subcontractor') return null;
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  const projects = list(body.projects).map((row) => {
    const item = (row || {}) as Record<string, unknown>;
    return {
      id: text(item.id || item.siteId),
      name: text(item.name),
      code: text(item.code),
      status: text(item.status),
      plannedPct: num(item.plannedPct),
      actualPct: num(item.actualPct),
    };
  });
  const activities = list(body.activities || body.programme).map((row) => {
    const item = (row || {}) as Record<string, unknown>;
    return {
      id: text(item.id),
      activity: text(item.activity),
      status: text(item.status),
      plannedPct: num(item.plannedPct),
      actualPct: num(item.actualPct),
      plannedEnd: item.plannedEnd ? text(item.plannedEnd) : null,
    };
  });
  const payments =
    kind === 'public' || kind === 'subcontractor'
      ? []
      : list(body.payments).map((row) => {
          const item = (row || {}) as Record<string, unknown>;
          return {
            id: text(item.id),
            number: text(item.number),
            title: text(item.title),
            status: text(item.status),
            amountLabel: text(item.amountLabel || ''),
          };
        });
  const siteRaw = body.site && typeof body.site === 'object' ? (body.site as Record<string, unknown>) : null;
  return {
    kind,
    companyName: text(body.companyName, 'ConstructionAdvisor®'),
    headline: text(body.headline || body.subcontractorName || body.projectName || body.clientName, 'Project'),
    projects,
    activities,
    payments,
    variations:
      kind === 'client'
        ? list(body.variations).map((row) => {
            const item = (row || {}) as Record<string, unknown>;
            return {
              id: text(item.id),
              number: text(item.number),
              title: text(item.title),
              status: text(item.status),
              days: num(item.days),
            };
          })
        : [],
    snags:
      kind === 'client'
        ? list(body.snags).map((row) => {
            const item = (row || {}) as Record<string, unknown>;
            return {
              id: text(item.id),
              item: text(item.item),
              status: text(item.status),
              location: text(item.location),
            };
          })
        : [],
    documents: list(body.documents).map((row) => {
      const item = (row || {}) as Record<string, unknown>;
      return {
        id: text(item.id),
        number: text(item.number),
        title: text(item.title),
        revision: text(item.revision),
        status: text(item.status),
      };
    }),
    required: list(body.required).map((row) => {
      const item = (row || {}) as Record<string, unknown>;
      return {
        id: text(item.id),
        title: text(item.title),
        kind: text(item.kind),
        status: text(item.status),
        expiresOn: item.expiresOn ? text(item.expiresOn) : null,
      };
    }),
    site: siteRaw
      ? {
          name: text(siteRaw.name),
          code: text(siteRaw.code),
          address: text(siteRaw.address),
          manager: text(siteRaw.manager || siteRaw.siteManagerName),
          phone: text(siteRaw.phone || siteRaw.siteManagerPhone),
        }
      : null,
  };
}
