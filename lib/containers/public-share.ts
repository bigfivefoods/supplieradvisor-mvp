/**
 * Sanitised public payload for embeddable container network views.
 */

export type PublicContainerPin = {
  id: number;
  name: string;
  code: string;
  status: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  contractor: string | null;
  photo_url: string | null;
  /** Food security / jobs (when impact enabled) */
  people_fed?: number;
  jobs_total?: number;
  jobs_direct?: number;
  jobs_support?: number;
  staffed?: boolean;
};

export type PublicNetworkMetrics = {
  total: number;
  active: number;
  mapped: number;
  unmapped: number;
  byCountry: Array<{ country: string; count: number }>;
  byCity: Array<{ city: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
};

/** Public food security + jobs story (no revenue amounts) */
export type PublicImpactMetrics = {
  people_fed: number;
  jobs_total: number;
  jobs_direct: number;
  jobs_support: number;
  staffed: number;
  containers: number;
  period_from: string;
  period_to: string;
  byCity: Array<{
    city: string;
    people_fed: number;
    jobs: number;
    containers: number;
  }>;
  methodology: string | null;
};

export type PublicNetworkPayload = {
  title: string;
  brandName: string | null;
  brandUrl: string | null;
  companyName: string;
  metrics: PublicNetworkMetrics | null;
  impact: PublicImpactMetrics | null;
  pins: PublicContainerPin[];
  outlets: Array<{
    id: number;
    name: string;
    code: string;
    status: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    mapped: boolean;
    contractor: string | null;
    people_fed?: number;
    jobs_total?: number;
  }>;
  showList: boolean;
  showMetrics: boolean;
  showImpact: boolean;
  generatedAt: string;
};

function isActiveStatus(status?: string | null): boolean {
  if (!status) return true;
  return ['active', 'deployed', 'operational', 'open'].includes(
    String(status).toLowerCase()
  );
}

export function buildPublicNetworkPayload(opts: {
  companyName: string;
  title?: string | null;
  brandName?: string | null;
  brandUrl?: string | null;
  showMetrics: boolean;
  showList: boolean;
  showContractors: boolean;
  showPhotos: boolean;
  /** When true, attach people-fed / jobs (defaults true with metrics) */
  showImpact?: boolean;
  containers: Array<Record<string, unknown>>;
  /** Precomputed impact by container id (from impact model) */
  impactByContainer?: Map<
    number,
    {
      people_fed: number;
      jobs_total: number;
      jobs_direct: number;
      jobs_support: number;
      staffed: boolean;
    }
  >;
  impactTotals?: {
    people_fed: number;
    jobs_total: number;
    jobs_direct: number;
    jobs_support: number;
    staffed: number;
    containers: number;
  } | null;
  impactPeriod?: { from: string; to: string } | null;
  methodology?: string | null;
}): PublicNetworkPayload {
  const containers = opts.containers || [];
  const showImpact = opts.showImpact !== false;
  const pins: PublicContainerPin[] = [];
  const outlets: PublicNetworkPayload['outlets'] = [];
  const byCountry = new Map<string, number>();
  const byCity = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const impactByCity = new Map<
    string,
    { city: string; people_fed: number; jobs: number; containers: number }
  >();

  let mapped = 0;
  let active = 0;

  for (const c of containers) {
    const lat = c.latitude != null ? Number(c.latitude) : NaN;
    const lng = c.longitude != null ? Number(c.longitude) : NaN;
    const hasGps = Number.isFinite(lat) && Number.isFinite(lng);
    if (hasGps) mapped += 1;
    const status = c.status != null ? String(c.status) : null;
    if (isActiveStatus(status)) active += 1;

    const country = c.country != null ? String(c.country) : 'Unknown';
    const city = c.city != null ? String(c.city) : 'Unknown';
    const st = status || 'unknown';
    byCountry.set(country, (byCountry.get(country) || 0) + 1);
    byCity.set(city, (byCity.get(city) || 0) + 1);
    byStatus.set(st, (byStatus.get(st) || 0) + 1);

    const contractor =
      opts.showContractors && c.assigned_contractor
        ? String(c.assigned_contractor)
        : null;

    const impact = opts.impactByContainer?.get(Number(c.id));

    if (showImpact && impact) {
      if (!impactByCity.has(city)) {
        impactByCity.set(city, {
          city,
          people_fed: 0,
          jobs: 0,
          containers: 0,
        });
      }
      const ic = impactByCity.get(city)!;
      ic.people_fed += impact.people_fed;
      ic.jobs += impact.jobs_total;
      ic.containers += 1;
    }

    if (hasGps) {
      pins.push({
        id: Number(c.id),
        name: String(c.name || 'Outlet'),
        code: String(c.container_code || ''),
        status,
        city: c.city != null ? String(c.city) : null,
        province: c.province != null ? String(c.province) : null,
        country: c.country != null ? String(c.country) : null,
        latitude: lat,
        longitude: lng,
        contractor,
        photo_url:
          opts.showPhotos && c.photo_url ? String(c.photo_url) : null,
        ...(showImpact && impact
          ? {
              people_fed: impact.people_fed,
              jobs_total: impact.jobs_total,
              jobs_direct: impact.jobs_direct,
              jobs_support: impact.jobs_support,
              staffed: impact.staffed,
            }
          : {}),
      });
    }

    if (opts.showList) {
      outlets.push({
        id: Number(c.id),
        name: String(c.name || 'Outlet'),
        code: String(c.container_code || ''),
        status,
        city: c.city != null ? String(c.city) : null,
        province: c.province != null ? String(c.province) : null,
        country: c.country != null ? String(c.country) : null,
        mapped: hasGps,
        contractor,
        ...(showImpact && impact
          ? {
              people_fed: impact.people_fed,
              jobs_total: impact.jobs_total,
            }
          : {}),
      });
    }
  }

  const sortCount = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([k, count]) => ({ country: k, city: k, status: k, count }))
      .sort((a, b) => b.count - a.count);

  const metrics: PublicNetworkMetrics = {
    total: containers.length,
    active,
    mapped,
    unmapped: containers.length - mapped,
    byCountry: sortCount(byCountry).map(({ country, count }) => ({
      country,
      count,
    })),
    byCity: sortCount(byCity)
      .slice(0, 12)
      .map(({ city, count }) => ({ city, count })),
    byStatus: sortCount(byStatus).map(({ status, count }) => ({
      status,
      count,
    })),
  };

  const t = opts.impactTotals;
  const period = opts.impactPeriod;
  const impact: PublicImpactMetrics | null =
    showImpact && t && period
      ? {
          people_fed: t.people_fed,
          jobs_total: t.jobs_total,
          jobs_direct: t.jobs_direct,
          jobs_support: t.jobs_support,
          staffed: t.staffed,
          containers: t.containers,
          period_from: period.from,
          period_to: period.to,
          byCity: Array.from(impactByCity.values())
            .map((c) => ({
              ...c,
              jobs: Math.round(c.jobs * 10) / 10,
            }))
            .sort((a, b) => b.people_fed - a.people_fed),
          methodology: opts.methodology || null,
        }
      : null;

  return {
    title:
      opts.title?.trim() ||
      `${opts.companyName} · Container network`,
    brandName: opts.brandName || null,
    brandUrl: opts.brandUrl || null,
    companyName: opts.companyName,
    metrics: opts.showMetrics ? metrics : null,
    impact,
    pins,
    outlets: opts.showList ? outlets : [],
    showList: opts.showList,
    showMetrics: opts.showMetrics,
    showImpact: Boolean(impact),
    generatedAt: new Date().toISOString(),
  };
}

export function newShareToken(): string {
  // URL-safe token
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
