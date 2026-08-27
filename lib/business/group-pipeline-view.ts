/**
 * Holding-company pipeline views: consolidated group vs one operating company.
 * Pure helpers — safe for client and API.
 */

export type GroupPipelineCompany = {
  id: number;
  name: string;
  isViewer: boolean;
  dealCount: number;
  openCount: number;
  openAmount: number;
  weightedAmount: number;
};

export type GroupPipelineMeta = {
  includesSubsidiaries: boolean;
  viewerCompanyId: number;
  viewerCompanyName: string | null;
  /** True when this company sits under a holding / group parent. */
  isSubsidiary: boolean;
  /**
   * Holding (no parent): consolidated group.
   * Subsidiary: this company's own pipeline.
   */
  defaultView: GroupPipelineView;
  companies: GroupPipelineCompany[];
};

export type GroupPipelineView = 'all' | number;

const CLOSED = new Set(['closed_won', 'closed_lost']);

export function isPipelineOpenStage(stage?: string | null): boolean {
  return !CLOSED.has(String(stage || ''));
}

export function opportunitySourceCompanyId(o: {
  source_company_id?: number | null;
  profile_id?: number | null;
}): number | null {
  const id = Number(o.source_company_id || o.profile_id || 0);
  return id > 0 ? id : null;
}

export function filterOpportunitiesByGroupView<
  T extends {
    source_company_id?: number | null;
    profile_id?: number | null;
  },
>(rows: T[], view: GroupPipelineView): T[] {
  if (view === 'all') return rows;
  const want = Number(view);
  if (!Number.isFinite(want) || want <= 0) return rows;
  return rows.filter((o) => opportunitySourceCompanyId(o) === want);
}

export function defaultGroupPipelineView(opts: {
  isSubsidiary?: boolean;
  viewerCompanyId: number;
  includesSubsidiaries?: boolean;
}): GroupPipelineView {
  const viewerId = Number(opts.viewerCompanyId);
  if (opts.isSubsidiary && viewerId > 0) return viewerId;
  if (opts.includesSubsidiaries) return 'all';
  return viewerId > 0 ? viewerId : 'all';
}

export function summarizeGroupPipeline(opts: {
  viewerCompanyId: number;
  names: Map<number, string> | Record<number, string>;
  companyIds: number[];
  isSubsidiary?: boolean;
  opportunities: Array<{
    source_company_id?: number | null;
    profile_id?: number | null;
    stage?: string | null;
    amount?: number | null;
    weighted_amount?: number | null;
  }>;
}): GroupPipelineMeta {
  const viewerId = Number(opts.viewerCompanyId);
  const nameOf = (id: number) => {
    if (opts.names instanceof Map) return opts.names.get(id) || `Company #${id}`;
    return opts.names[id] || `Company #${id}`;
  };

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const raw of opts.companyIds) {
    const id = Number(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (viewerId > 0 && !seen.has(viewerId)) {
    ids.unshift(viewerId);
  }

  const companies: GroupPipelineCompany[] = ids.map((id) => {
    const rows = opts.opportunities.filter(
      (o) => opportunitySourceCompanyId(o) === id
    );
    const open = rows.filter((o) => isPipelineOpenStage(o.stage));
    return {
      id,
      name: nameOf(id),
      isViewer: id === viewerId,
      dealCount: rows.length,
      openCount: open.length,
      openAmount: open.reduce((s, o) => s + Number(o.amount || 0), 0),
      weightedAmount: open.reduce(
        (s, o) => s + Number(o.weighted_amount || 0),
        0
      ),
    };
  });

  const includesSubsidiaries = companies.some((c) => !c.isViewer);
  const isSubsidiary = Boolean(opts.isSubsidiary);
  return {
    includesSubsidiaries,
    viewerCompanyId: viewerId,
    viewerCompanyName: viewerId > 0 ? nameOf(viewerId) : null,
    isSubsidiary,
    defaultView: defaultGroupPipelineView({
      isSubsidiary,
      viewerCompanyId: viewerId,
      includesSubsidiaries,
    }),
    companies,
  };
}
