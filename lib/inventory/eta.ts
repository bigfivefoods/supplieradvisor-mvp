/** Distance / ETA helpers for live transfer tracking */

export type LatLng = { lat: number; lng: number };

const EARTH_KM = 6371;
/** Default average road speed (km/h) when we can't measure from GPS trail */
export const DEFAULT_ROAD_SPEED_KMH = 55;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Road-distance approximation (haversine × 1.3 for typical road routing) */
export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1.3;
}

export function etaMinutesFromKm(km: number, speedKmh = DEFAULT_ROAD_SPEED_KMH): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  const speed = Math.max(5, speedKmh || DEFAULT_ROAD_SPEED_KMH);
  return Math.round((km / speed) * 60);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

export function formatEtaClock(etaAtIso: string | null | undefined): string {
  if (!etaAtIso) return '—';
  try {
    return new Date(etaAtIso).toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return etaAtIso;
  }
}

/** Common city centroids for ETA when warehouse has city but no GPS (SA + region) */
const CITY_COORDS: Record<string, LatLng> = {
  johannesburg: { lat: -26.2041, lng: 28.0473 },
  jhb: { lat: -26.2041, lng: 28.0473 },
  sandton: { lat: -26.1076, lng: 28.0567 },
  pretoria: { lat: -25.7479, lng: 28.2293 },
  tshwane: { lat: -25.7479, lng: 28.2293 },
  midrand: { lat: -25.9992, lng: 28.126 },
  centurion: { lat: -25.8603, lng: 28.1894 },
  soweto: { lat: -26.2485, lng: 27.854 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
  capetown: { lat: -33.9249, lng: 18.4241 },
  stellenbosch: { lat: -33.9321, lng: 18.8602 },
  durban: { lat: -29.8587, lng: 31.0218 },
  pietermaritzburg: { lat: -29.6006, lng: 30.3794 },
  bloemfontein: { lat: -29.0852, lng: 26.1596 },
  'port elizabeth': { lat: -33.9608, lng: 25.6022 },
  gqeberha: { lat: -33.9608, lng: 25.6022 },
  'east london': { lat: -33.0153, lng: 27.9116 },
  polokwane: { lat: -23.9045, lng: 29.4689 },
  nelspruit: { lat: -25.4753, lng: 30.9694 },
  mbombela: { lat: -25.4753, lng: 30.9694 },
  kimberley: { lat: -28.7282, lng: 24.7499 },
  upington: { lat: -28.4478, lng: 21.2561 },
  rustenburg: { lat: -25.6676, lng: 27.2421 },
  witbank: { lat: -25.8738, lng: 29.2321 },
  emalahleni: { lat: -25.8738, lng: 29.2321 },
  windhoek: { lat: -22.5609, lng: 17.0658 },
  gaborone: { lat: -24.6282, lng: 25.9231 },
  maputo: { lat: -25.9692, lng: 32.5732 },
  harare: { lat: -17.8252, lng: 31.0335 },
  lusaka: { lat: -15.3875, lng: 28.3228 },
  nairobi: { lat: -1.2921, lng: 36.8219 },
  lagos: { lat: 6.5244, lng: 3.3792 },
  london: { lat: 51.5074, lng: -0.1278 },
  dubai: { lat: 25.2048, lng: 55.2708 },
};

export function coordsFromCity(city?: string | null, country?: string | null): LatLng | null {
  if (!city) return null;
  const key = city.trim().toLowerCase().replace(/\s+/g, ' ');
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  // partial match
  for (const [name, c] of Object.entries(CITY_COORDS)) {
    if (key.includes(name) || name.includes(key)) return c;
  }
  void country;
  return null;
}

export function resolvePoint(opts: {
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  country?: string | null;
}): LatLng | null {
  if (
    opts.lat != null &&
    opts.lng != null &&
    Number.isFinite(Number(opts.lat)) &&
    Number.isFinite(Number(opts.lng))
  ) {
    return { lat: Number(opts.lat), lng: Number(opts.lng) };
  }
  return coordsFromCity(opts.city, opts.country);
}

/**
 * Estimate speed from GPS event trail (km/h). Falls back to default.
 */
export function speedFromTrail(
  points: Array<{ lat?: number | null; lng?: number | null; created_at?: string | null }>
): number | null {
  const usable = points
    .filter((p) => p.lat != null && p.lng != null && p.created_at)
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      t: new Date(String(p.created_at)).getTime(),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  if (usable.length < 2) return null;

  let totalKm = 0;
  let totalHours = 0;
  for (let i = 1; i < usable.length; i++) {
    const a = usable[i - 1];
    const b = usable[i];
    const dtH = (b.t - a.t) / 3600000;
    if (dtH <= 0 || dtH > 6) continue; // skip bad gaps
    const d = haversineKm(a, b);
    if (d < 0.05) continue; // noise
    totalKm += d;
    totalHours += dtH;
  }
  if (totalHours < 0.02 || totalKm < 0.5) return null;
  const speed = totalKm / totalHours;
  // Clamp to realistic road speeds
  if (speed < 5 || speed > 140) return null;
  return Math.round(speed);
}

export type EtaResult = {
  distance_km: number | null;
  remaining_km: number | null;
  eta_minutes: number | null;
  eta_at: string | null;
  speed_kmh: number | null;
  progress_pct: number | null;
  method: 'gps' | 'schedule' | 'unknown';
  dest: LatLng | null;
  current: LatLng | null;
  origin: LatLng | null;
};

export function computeTransferEta(input: {
  current?: LatLng | null;
  dest?: LatLng | null;
  origin?: LatLng | null;
  speedKmh?: number | null;
  expectedReceiveDate?: string | null;
  shippedAt?: string | null;
  now?: Date;
}): EtaResult {
  const now = input.now || new Date();
  const current = input.current || null;
  const dest = input.dest || null;
  const origin = input.origin || null;
  const speed = input.speedKmh && input.speedKmh > 0 ? input.speedKmh : DEFAULT_ROAD_SPEED_KMH;

  let fullRouteKm: number | null = null;
  if (origin && dest) fullRouteKm = roadKm(origin, dest);

  if (current && dest) {
    const remaining = roadKm(current, dest);
    const mins = etaMinutesFromKm(remaining, speed);
    const etaAt = new Date(now.getTime() + mins * 60000).toISOString();
    let progress: number | null = null;
    if (fullRouteKm && fullRouteKm > 0.1) {
      const done = Math.max(0, fullRouteKm - remaining);
      progress = Math.min(99, Math.max(0, Math.round((done / fullRouteKm) * 100)));
    } else if (origin && current) {
      const done = roadKm(origin, current);
      const rem = remaining;
      const total = done + rem;
      if (total > 0.1) progress = Math.min(99, Math.round((done / total) * 100));
    }
    return {
      distance_km: fullRouteKm != null ? Math.round(fullRouteKm * 10) / 10 : null,
      remaining_km: Math.round(remaining * 10) / 10,
      eta_minutes: mins,
      eta_at: etaAt,
      speed_kmh: speed,
      progress_pct: progress,
      method: 'gps',
      dest,
      current,
      origin,
    };
  }

  // Fallback: scheduled expected receive date
  if (input.expectedReceiveDate) {
    const end = new Date(input.expectedReceiveDate);
    // treat date-only as end of day local-ish
    if (String(input.expectedReceiveDate).length <= 10) {
      end.setHours(17, 0, 0, 0);
    }
    const mins = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000));
    return {
      distance_km: fullRouteKm != null ? Math.round(fullRouteKm * 10) / 10 : null,
      remaining_km: fullRouteKm != null ? Math.round(fullRouteKm * 10) / 10 : null,
      eta_minutes: mins,
      eta_at: end.toISOString(),
      speed_kmh: null,
      progress_pct: null,
      method: 'schedule',
      dest,
      current,
      origin,
    };
  }

  return {
    distance_km: fullRouteKm != null ? Math.round(fullRouteKm * 10) / 10 : null,
    remaining_km: null,
    eta_minutes: null,
    eta_at: null,
    speed_kmh: null,
    progress_pct: null,
    method: 'unknown',
    dest,
    current,
    origin,
  };
}
