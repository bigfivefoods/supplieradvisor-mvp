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

export type PublicNetworkPayload = {
  title: string;
  brandName: string | null;
  brandUrl: string | null;
  companyName: string;
  metrics: PublicNetworkMetrics | null;
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
  }>;
  showList: boolean;
  showMetrics: boolean;
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
  containers: Array<Record<string, unknown>>;
}): PublicNetworkPayload {
  const containers = opts.containers || [];
  const pins: PublicContainerPin[] = [];
  const outlets: PublicNetworkPayload['outlets'] = [];
  const byCountry = new Map<string, number>();
  const byCity = new Map<string, number>();
  const byStatus = new Map<string, number>();

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

  return {
    title:
      opts.title?.trim() ||
      `${opts.companyName} · Container network`,
    brandName: opts.brandName || null,
    brandUrl: opts.brandUrl || null,
    companyName: opts.companyName,
    metrics: opts.showMetrics ? metrics : null,
    pins,
    outlets: opts.showList ? outlets : [],
    showList: opts.showList,
    showMetrics: opts.showMetrics,
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
