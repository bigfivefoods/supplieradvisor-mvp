/**
 * SHEQ domain types — ISO 45001 incidents/hazards + NCR/CAPA (ISO 9001-style).
 */

export const INCIDENT_TYPES = [
  'near_miss',
  'injury',
  'illness',
  'property_damage',
  'environmental',
  'security',
  'other',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_STATUSES = [
  'open',
  'investigating',
  'awaiting_capa',
  'closed',
  'cancelled',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const NCR_SOURCES = [
  'manual',
  'inspection',
  'incident',
  'haccp',
  'customer_claim',
  'audit',
  'other',
] as const;
export type NcrSource = (typeof NCR_SOURCES)[number];

export const NCR_DOMAINS = [
  'quality',
  'safety',
  'health',
  'environment',
  'food_safety',
  'other',
] as const;
export type NcrDomain = (typeof NCR_DOMAINS)[number];

export const NCR_STATUSES = [
  'open',
  'containment',
  'capa_linked',
  'closed',
  'cancelled',
] as const;
export type NcrStatus = (typeof NCR_STATUSES)[number];

export const CAPA_STATUSES = [
  'open',
  'in_progress',
  'pending_verify',
  'effective',
  'ineffective',
  'closed',
  'cancelled',
] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const HAZARD_STATUSES = ['open', 'controlled', 'accepted', 'closed'] as const;
export type HazardStatus = (typeof HAZARD_STATUSES)[number];

export function isOneOf<T extends string>(val: unknown, list: readonly T[]): val is T {
  return typeof val === 'string' && (list as readonly string[]).includes(val);
}

export function clampScore(n: number, min = 1, max = 5): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function riskScore(likelihood: number, severity: number): number {
  return clampScore(likelihood) * clampScore(severity);
}

export function riskBand(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 16) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function formatRef(prefix: string, id: number): string {
  return `${prefix}-${String(id).padStart(5, '0')}`;
}

export type SheqIncident = {
  id: number;
  profile_id: number;
  public_ref?: string | null;
  incident_type: string;
  severity: string;
  status: string;
  title: string;
  description?: string | null;
  location?: string | null;
  site_name?: string | null;
  occurred_at?: string | null;
  reported_by?: string | null;
  injured_person?: string | null;
  immediate_action?: string | null;
  root_cause?: string | null;
  investigation_notes?: string | null;
  closed_at?: string | null;
  ncr_id?: number | null;
  capa_id?: number | null;
  created_at?: string | null;
};

export type SheqNcr = {
  id: number;
  profile_id: number;
  public_ref?: string | null;
  source: string;
  domain: string;
  status: string;
  severity: string;
  title: string;
  description?: string | null;
  lot_number?: string | null;
  product_id?: number | null;
  inspection_id?: number | null;
  incident_id?: number | null;
  capa_id?: number | null;
  containment?: string | null;
  disposition?: string | null;
  raised_at?: string | null;
  closed_at?: string | null;
};

export type SheqCapa = {
  id: number;
  profile_id: number;
  public_ref?: string | null;
  ncr_id?: number | null;
  incident_id?: number | null;
  title: string;
  description?: string | null;
  root_cause?: string | null;
  corrective_action?: string | null;
  preventive_action?: string | null;
  status: string;
  priority?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  effectiveness_check?: string | null;
  effectiveness_result?: string | null;
  closed_at?: string | null;
};

export type SheqHazard = {
  id: number;
  profile_id: number;
  title: string;
  category?: string | null;
  location?: string | null;
  description?: string | null;
  likelihood: number;
  severity: number;
  risk_score: number;
  residual_likelihood?: number | null;
  residual_severity?: number | null;
  residual_risk_score?: number | null;
  controls?: string | null;
  status: string;
  owner_name?: string | null;
  review_due?: string | null;
};
