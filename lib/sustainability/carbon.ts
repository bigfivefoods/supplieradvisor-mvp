/**
 * Lightweight emission factors (kg CO2e) — order-of-magnitude estimates for ops awareness.
 * Not for regulatory reporting; replace with certified factors later.
 */

export type TransportMode = 'road' | 'rail' | 'sea' | 'air' | 'parcel' | string;

/** kg CO2e per tonne-km by mode */
export const MODE_FACTORS_KG_PER_TKM: Record<string, number> = {
  road: 0.12,
  rail: 0.03,
  sea: 0.015,
  air: 0.6,
  parcel: 0.2,
  multimodal: 0.08,
  other: 0.1,
};

/** Default average shipment weight (tonnes) when unknown */
export const DEFAULT_WEIGHT_TONNES = 1;

/** Default distance km when origin/destination coords missing */
export const DEFAULT_DISTANCE_KM = 250;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateShipmentCo2e(params: {
  mode?: string | null;
  distanceKm?: number | null;
  weightTonnes?: number | null;
  originLat?: number | null;
  originLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
}): {
  kgCo2e: number;
  distanceKm: number;
  weightTonnes: number;
  factor: number;
  mode: string;
  method: string;
} {
  const mode = String(params.mode || 'road').toLowerCase();
  const factor = MODE_FACTORS_KG_PER_TKM[mode] ?? MODE_FACTORS_KG_PER_TKM.other;
  const weight = Math.max(
    Number(params.weightTonnes) || DEFAULT_WEIGHT_TONNES,
    0.01
  );

  let distance = Number(params.distanceKm);
  let method = 'declared_distance';
  if (!Number.isFinite(distance) || distance <= 0) {
    const oLat = Number(params.originLat);
    const oLng = Number(params.originLng);
    const dLat = Number(params.destLat);
    const dLng = Number(params.destLng);
    if (
      [oLat, oLng, dLat, dLng].every((n) => Number.isFinite(n)) &&
      !(oLat === 0 && oLng === 0)
    ) {
      distance = haversineKm(oLat, oLng, dLat, dLng);
      method = 'haversine';
    } else {
      distance = DEFAULT_DISTANCE_KM;
      method = 'default_distance';
    }
  }

  const kgCo2e = Math.round(factor * weight * distance * 100) / 100;
  return {
    kgCo2e,
    distanceKm: Math.round(distance * 10) / 10,
    weightTonnes: weight,
    factor,
    mode,
    method,
  };
}

export function formatCo2e(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t CO₂e`;
  return `${kg.toFixed(1)} kg CO₂e`;
}
