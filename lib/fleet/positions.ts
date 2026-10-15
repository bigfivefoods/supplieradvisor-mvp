/**
 * FleetAdvisor® position checks. Pure. No writer in this brief calls them.
 */
import { haversineKm } from './cpk';

export const POSITION_SOURCES = ['driver_phone', 'telematics', 'csv_import', 'gpx_import', 'manual'] as const;
export type PositionSource = (typeof POSITION_SOURCES)[number];

export const FRESH_MS = 5 * 60 * 1000;
export const STALE_MS = 60 * 60 * 1000;
export const GAP_MS = 15 * 60 * 1000;
export const MAX_ACCURACY_M = 100;
export const MAX_SPEED_KMH = 140;

export type PositionFix = {
  at: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  speed_kmh?: number | null;
  source?: PositionSource;
};

export function sourceLabel(source: PositionSource): string {
  if (source === 'driver_phone') return 'Driver phone';
  if (source === 'telematics') return 'Telematics';
  if (source === 'csv_import') return 'GPS file import';
  if (source === 'gpx_import') return 'GPS file import';
  return 'Manual odometer';
}

export function freshness(ageMs: number): 'fresh' | 'stale' | 'offline' {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'offline';
  if (ageMs < FRESH_MS) return 'fresh';
  if (ageMs < STALE_MS) return 'stale';
  return 'offline';
}

export function fixInRange(fix: { lat: number; lng: number }): boolean {
  return Number.isFinite(fix.lat) && Number.isFinite(fix.lng) && fix.lat >= -90 && fix.lat <= 90 && fix.lng >= -180 && fix.lng <= 180;
}

export function filterFixes(fixes: PositionFix[]): { kept: PositionFix[]; warnings: string[] } {
  const warnings: string[] = [];
  const sorted = [...fixes].filter((fix) => fix.at).sort((a, b) => a.at.localeCompare(b.at));
  const kept: PositionFix[] = [];
  for (const fix of sorted) {
    if (!fixInRange(fix)) {
      warnings.push('A fix was left out because the coordinates were out of range');
      continue;
    }
    if (fix.accuracy_m != null && fix.accuracy_m > MAX_ACCURACY_M) {
      warnings.push('A fix was left out because accuracy was over 100 m');
      continue;
    }
    if (fix.speed_kmh != null && fix.speed_kmh > MAX_SPEED_KMH) {
      warnings.push('A fix was left out because speed was over 140 km/h');
      continue;
    }
    const prev = kept[kept.length - 1];
    if (prev) {
      const gap = new Date(fix.at).getTime() - new Date(prev.at).getTime();
      if (Number.isFinite(gap) && gap > 0 && gap <= GAP_MS) {
        const km = haversineKm(prev.lat, prev.lng, fix.lat, fix.lng);
        const hours = gap / 3_600_000;
        if (hours > 0 && km / hours > MAX_SPEED_KMH) {
          warnings.push('A fix was left out because speed was over 140 km/h');
          continue;
        }
      }
    }
    kept.push(fix);
  }
  return { kept, warnings };
}

export function pathKm(fixes: PositionFix[]): number {
  const { kept } = filterFixes(fixes);
  let km = 0;
  for (let i = 1; i < kept.length; i += 1) {
    const gap = new Date(kept[i].at).getTime() - new Date(kept[i - 1].at).getTime();
    if (!Number.isFinite(gap) || gap <= 0 || gap > GAP_MS) continue;
    km += haversineKm(kept[i - 1].lat, kept[i - 1].lng, kept[i].lat, kept[i].lng);
  }
  return km;
}
