/**
 * Allow-listed subcontractor portal. Field by field. No spreads of the book.
 * Sits beside the per-kind builders from Brief 112.
 */
import type { ConstructionPortal, ConstructiongraphStore } from './constructiongraph';

export type SubcontractorPortalView = {
  kind: 'subcontractor';
  companyName: string;
  subcontractorName: string;
  trade: string;
  packageLabel: string;
  site: {
    name: string;
    code: string;
    address: string;
    siteManagerName: string;
    siteManagerPhone: string;
  } | null;
  programme: Array<{
    id: string;
    activity: string;
    plannedStart: string | null;
    plannedEnd: string | null;
    plannedPct: number;
    actualPct: number;
    status: string;
  }>;
  required: Array<{
    id: string;
    title: string;
    kind: string;
    expiresOn: string | null;
    validTo: string | null;
    status: string;
  }>;
  documents: Array<{
    id: string;
    number: string;
    title: string;
    revision: string;
    issuedOn: string | null;
    status: string;
  }>;
};

function sameParty(a?: string | null, b?: string | null): boolean {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return Boolean(left) && left === right;
}

export function buildSubcontractorView(
  store: ConstructiongraphStore,
  portal: Pick<ConstructionPortal, 'kind' | 'subcontractor_id'> | null | undefined,
  companyName: string
): SubcontractorPortalView | null {
  if (!portal || portal.kind !== 'subcontractor') return null;
  const subId = String(portal.subcontractor_id || '').trim();
  if (!subId) return null;
  const sub = store.subcontractors.find((row) => row.id === subId);
  if (!sub) return null;
  const site = sub.site_id ? store.sites.find((row) => row.id === sub.site_id) || null : null;
  const packageLabel = sub.package_label || '';
  const programme = store.programme
    .filter((row) => {
      if (sub.site_id && row.site_id && row.site_id !== sub.site_id) return false;
      if (row.subcontractor_id && row.subcontractor_id === sub.id) return true;
      if (packageLabel && row.package_label && sameParty(row.package_label, packageLabel)) return true;
      return false;
    })
    .map((row) => ({
      id: row.id,
      activity: row.activity,
      plannedStart: row.planned_start || row.start_date || null,
      plannedEnd: row.planned_end || row.end_date || null,
      plannedPct: Number(row.planned_pct ?? row.pct_complete ?? 0) || 0,
      actualPct: Number(row.actual_pct ?? row.pct_complete ?? 0) || 0,
      status: String(row.status || 'planned'),
    }));
  const required = store.safety
    .filter((row) => sameParty(row.company, sub.name))
    .map((row) => ({
      id: row.id,
      title: row.title,
      kind: String(row.kind),
      expiresOn: row.expires_on || null,
      validTo: row.valid_to || null,
      status: String(row.status || 'open'),
    }));
  const documents = store.drawings
    .filter((row) => sameParty(row.issued_to, sub.name) || (packageLabel && sameParty(row.issued_to, packageLabel)))
    .map((row) => ({
      id: row.id,
      number: row.drawing_no,
      title: row.title,
      revision: row.revision || '',
      issuedOn: row.issued_on || null,
      status: String(row.status || 'issued'),
    }));
  return {
    kind: 'subcontractor',
    companyName,
    subcontractorName: sub.name,
    trade: sub.trade,
    packageLabel,
    site: site
      ? {
          name: site.name,
          code: site.code,
          address: [site.address, site.city].filter(Boolean).join(', '),
          siteManagerName: site.site_manager_name || '',
          siteManagerPhone: site.site_manager_phone || '',
        }
      : null,
    programme,
    required,
    documents,
  };
}
