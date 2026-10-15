/**
 * FleetAdvisor® assignability for a planned date. Brief C reads the reasons.
 * Today is never read from the clock.
 */
import { COMPLIANCE_LABELS, complianceStatus, daysBetween } from './compliance';
import { formatSastDate, sastDate } from './format';
import type { ComplianceKind, FleetCompliance, FleetDriver, FleetVehicle, VehicleKind } from './types';

export type AssignReason = {
  code: string;
  severity: 'block' | 'warn';
  kind?: ComplianceKind;
  itemId?: string;
  message: string;
};

export type AssignSubject =
  | { kind: 'vehicle'; row: Pick<FleetVehicle, 'id' | 'status' | 'archived_at' | 'reg_no' | 'gvm_kg' | 'kind'> }
  | { kind: 'driver'; row: Pick<FleetDriver, 'id' | 'status' | 'archived_at' | 'full_name'> };

export type AssignNeeds = {
  crossBorder?: boolean;
  countries?: string[];
  abnormal?: boolean;
  dangerousGoods?: boolean;
  vehicleGvmKg?: number | null;
};

export type AssignContext = {
  items: FleetCompliance[];
  workspace: {
    expiring_window_days: number;
    prdp_gvm_threshold_kg: number | null;
    expected_vehicle_kinds?: ComplianceKind[];
    expected_driver_kinds?: ComplianceKind[];
  };
  needs?: AssignNeeds;
  pairedVehicle?: { id: string; kind?: VehicleKind; gvm_kg: number | null; reg_no?: string } | null;
};

const DEFAULT_VEHICLE: ComplianceKind[] = ['licence_disc', 'roadworthy', 'insurance'];
const DEFAULT_DRIVER: ComplianceKind[] = ['driver_licence', 'prdp', 'medical'];

export function isAssignable(subject: AssignSubject, date: string, ctx: AssignContext): { assignable: boolean; reasons: AssignReason[] } {
  const planned = sastDate(date);
  const reasons: AssignReason[] = [];
  if (!planned) {
    reasons.push({ code: 'date', severity: 'block', message: 'Choose a date.' });
    return { assignable: false, reasons };
  }
  if (subject.row.archived_at) {
    reasons.push({
      code: 'archived',
      severity: 'block',
      message: subject.kind === 'vehicle' ? 'This vehicle is archived.' : 'This driver is archived.',
    });
  }
  if (subject.kind === 'vehicle' && (subject.row.status === 'sold' || subject.row.status === 'off_road' || subject.row.status === 'workshop')) {
    reasons.push({ code: 'status', severity: 'block', message: `This vehicle is ${statusWord(subject.row.status)}.` });
  }
  if (subject.kind === 'driver' && (subject.row.status === 'inactive' || subject.row.status === 'on_leave')) {
    reasons.push({ code: 'status', severity: 'block', message: subject.row.status === 'on_leave' ? 'This driver is on leave.' : 'This driver is inactive.' });
  }

  const own = currentItems(ctx.items, subject.kind, subject.row.id);
  const windowDays = ctx.workspace.expiring_window_days;
  for (const item of own) {
    if (item.kind === 'operator_card') {
      pushItemState(reasons, item, planned, windowDays, false);
      continue;
    }
    if (item.kind === 'medical') {
      const review = sastDate(reviewDate(item));
      if (!review) {
        reasons.push({ code: 'not_recorded', severity: 'warn', kind: 'medical', itemId: item.id, message: 'Medical review: Not recorded' });
      } else if (review < planned) {
        reasons.push({
          code: 'medical_review',
          severity: 'warn',
          kind: 'medical',
          itemId: item.id,
          message: `Medical review date ${formatSastDate(review)} is before this date.`,
        });
      } else if (complianceStatus(review, planned, windowDays) === 'expiring') {
        reasons.push({
          code: 'expiring',
          severity: 'warn',
          kind: 'medical',
          itemId: item.id,
          message: `Medical review expires on ${formatSastDate(review)}`,
        });
      }
      continue;
    }
    pushItemState(reasons, item, planned, windowDays, false);
  }

  const expected = subject.kind === 'vehicle' ? ctx.workspace.expected_vehicle_kinds || DEFAULT_VEHICLE : ctx.workspace.expected_driver_kinds || DEFAULT_DRIVER;
  for (const kind of expected) {
    if (kind === 'operator_card') continue;
    if (own.some((item) => item.kind === kind)) continue;
    reasons.push({ code: 'not_recorded', severity: 'warn', kind, message: `${COMPLIANCE_LABELS[kind]}: Not recorded` });
  }

  const needs = ctx.needs || {};
  const permitItems = subject.kind === 'vehicle' ? own : currentItems(ctx.items, 'vehicle', ctx.pairedVehicle?.id || '');
  if (needs.crossBorder) {
    const countries = (needs.countries || []).map((code) => code.trim().toUpperCase()).filter(Boolean);
    const covered = permitItems.filter((item) => item.kind === 'cross_border_permit' && covers(item, planned));
    const missing = countries.filter((code) => !covered.some((item) => countryList(item).includes(code)));
    if (!countries.length || missing.length || !covered.length) {
      reasons.push({
        code: 'cross_border',
        severity: 'block',
        kind: 'cross_border_permit',
        message: missing.length ? `No cross-border permit covers ${missing.join(', ')} on this date.` : 'No cross-border permit covers this date.',
      });
    }
  }
  if (needs.abnormal && !permitItems.some((item) => item.kind === 'abnormal_permit' && covers(item, planned))) {
    reasons.push({ code: 'abnormal', severity: 'block', kind: 'abnormal_permit', message: 'No abnormal permit covers this date.' });
  }
  if (subject.kind === 'driver' && needs.dangerousGoods && !hasCategory(own, 'D', planned)) {
    reasons.push({ code: 'prdp_d', severity: 'block', kind: 'prdp', message: 'No PrDP category D covers this date.' });
  }

  const gvm = subject.kind === 'vehicle' ? subject.row.gvm_kg : ctx.needs?.vehicleGvmKg ?? ctx.pairedVehicle?.gvm_kg ?? null;
  const threshold = ctx.workspace.prdp_gvm_threshold_kg;
  if (subject.kind === 'driver' && threshold != null && gvm != null && gvm > threshold && !own.some((item) => item.kind === 'prdp' && covers(item, planned))) {
    reasons.push({
      code: 'prdp_gvm',
      severity: 'warn',
      kind: 'prdp',
      message: 'PrDP is not recorded for a vehicle above your threshold. Check with your licensing authority.',
    });
  }
  return { assignable: reasons.every((reason) => reason.severity !== 'block'), reasons };
}

function statusWord(status: string): string {
  if (status === 'off_road') return 'off road';
  return status;
}

function currentItems(items: FleetCompliance[], kind: 'vehicle' | 'driver', id: string): FleetCompliance[] {
  if (!id) return [];
  return items.filter((item) => !item.archived_at && item.subject_kind === kind && item.subject_id === id);
}

function pushItemState(reasons: AssignReason[], item: FleetCompliance, planned: string, windowDays: number, warnOnly: boolean) {
  const state = complianceStatus(item.expires_on, planned, windowDays);
  const label = COMPLIANCE_LABELS[item.kind];
  if (state === 'no_date') {
    reasons.push({ code: 'not_recorded', severity: 'warn', kind: item.kind, itemId: item.id, message: `${label}: Not recorded` });
    return;
  }
  if (state === 'expired') {
    const expiry = sastDate(item.expires_on) || '';
    const days = daysBetween(expiry, planned);
    reasons.push({
      code: 'expired',
      severity: warnOnly ? 'warn' : 'block',
      kind: item.kind,
      itemId: item.id,
      message: `${label} expired ${days === 1 ? '1 day' : `${days} days`} before this date`,
    });
    return;
  }
  if (state === 'expiring') {
    reasons.push({
      code: 'expiring',
      severity: 'warn',
      kind: item.kind,
      itemId: item.id,
      message: `${label} expires on ${formatSastDate(item.expires_on)}`,
    });
  }
}

function reviewDate(item: FleetCompliance): string | null {
  const detail = item.detail || {};
  const next = typeof detail.next_review_on === 'string' ? detail.next_review_on : null;
  return next || item.expires_on;
}

function covers(item: FleetCompliance, planned: string): boolean {
  const expiry = sastDate(item.expires_on);
  const issued = sastDate(item.issued_on);
  if (issued && issued > planned) return false;
  if (expiry && expiry < planned) return false;
  return true;
}

function countryList(item: FleetCompliance): string[] {
  const raw = item.detail?.countries;
  if (!Array.isArray(raw)) return [];
  return raw.map((code) => String(code || '').trim().toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code));
}

function hasCategory(items: FleetCompliance[], category: string, planned: string): boolean {
  return items.some((item) => {
    if (item.kind !== 'prdp' || !covers(item, planned)) return false;
    const raw = item.detail?.category;
    const categories = Array.isArray(raw) ? raw : String(raw || '').split(/[,\s]+/);
    return categories.map((code) => String(code).trim().toUpperCase()).includes(category);
  });
}
