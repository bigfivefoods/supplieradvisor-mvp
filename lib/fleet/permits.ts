/**
 * FleetAdvisor® permit details. Dates and references the user enters. No fees and no limits.
 */
import { prdpCategoryMissing } from './compliance';
import type { ComplianceKind } from './types';

const ISO2 = /^[A-Z]{2}$/;
const PRDP = new Set(['G', 'D', 'P']);

export type PermitError = { ok: false; error: string };
export type PermitOk = { ok: true; detail: Record<string, unknown> };

export function normaliseCountries(value: unknown): string[] | null {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : null;
  if (!raw) return null;
  const countries: string[] = [];
  for (const item of raw) {
    const code = String(item || '').trim().toUpperCase();
    if (!code) continue;
    if (!ISO2.test(code)) return null;
    if (!countries.includes(code)) countries.push(code);
  }
  if (countries.length < 1 || countries.length > 12) return null;
  return countries;
}

export function validatePermitDetail(kind: string, detail: unknown): PermitOk | PermitError | { ok: true; detail: Record<string, unknown> } {
  const record = detail && typeof detail === 'object' && !Array.isArray(detail) ? { ...(detail as Record<string, unknown>) } : {};
  if (kind === 'prdp') {
    if (prdpCategoryMissing(kind, record)) return { ok: false, error: 'PrDP needs a category.' };
    const category = String(record.category || '').trim().toUpperCase();
    if (!PRDP.has(category)) return { ok: false, error: 'PrDP category must be G, D or P.' };
    return { ok: true, detail: { ...record, category } };
  }
  if (kind === 'cross_border_permit') {
    const countries = normaliseCountries(record.countries);
    if (!countries) return { ok: false, error: 'Add between 1 and 12 country codes.' };
    const permitClass = record.permit_class == null ? '' : String(record.permit_class).trim();
    if (permitClass.length > 40) return { ok: false, error: 'Permit class is too long.' };
    const next: Record<string, unknown> = { countries };
    if (permitClass) next.permit_class = permitClass;
    return { ok: true, detail: next };
  }
  if (kind === 'abnormal_permit') {
    const province = String(record.province || '').trim();
    const route = String(record.route_text || '').trim();
    const conditions = String(record.conditions || '').trim();
    if (!province || province.length > 80) return { ok: false, error: 'Add the province.' };
    if (route.length > 500) return { ok: false, error: 'Route text is too long.' };
    if (conditions.length > 1000) return { ok: false, error: 'Conditions text is too long.' };
    if (typeof record.escort_required !== 'boolean') return { ok: false, error: 'Say whether an escort is required.' };
    return {
      ok: true,
      detail: { province, route_text: route, conditions, escort_required: record.escort_required },
    };
  }
  return { ok: true, detail: record };
}

export function permitKinds(): ComplianceKind[] {
  return ['cross_border_permit', 'abnormal_permit'];
}
