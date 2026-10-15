/**
 * FleetAdvisor® reminder planner. Dates are SAST calendar dates from an injected clock.
 */
import { COMPLIANCE_LABELS, daysBetween } from './compliance';
import { sastDate } from './format';
import type { ComplianceKind, FleetCompliance, FleetDriver, FleetReminder, FleetVehicle, ReminderChannel } from './types';

export type DueReminder = {
  ruleId: string;
  itemId: string;
  subjectKind: 'vehicle' | 'driver';
  subjectId: string;
  subjectLabel: string;
  kind: ComplianceKind;
  kindLabel: string;
  expiresOn: string;
  thresholdDays: number;
  daysLeft: number;
  channel: ReminderChannel;
  recipientKey: string;
};

export type SkippedReminder = { code: string; count: number };

export function planReminders(input: {
  items: FleetCompliance[];
  rules: FleetReminder[];
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  members: Array<{ id: string }>;
  logKeys: string[];
  now: string | Date;
  workspace: { real_data_enabled?: boolean };
}): { due: DueReminder[]; skipped: SkippedReminder[]; superseded: DueReminder[] } {
  const today = sastDate(input.now);
  if (!today) return { due: [], skipped: [{ code: 'clock', count: 1 }], superseded: [] };
  const memberIds = new Set(input.members.map((member) => member.id));
  const logged = new Set(input.logKeys);
  const vehicles = new Map(input.vehicles.map((row) => [row.id, row]));
  const drivers = new Map(input.drivers.map((row) => [row.id, row]));
  const skipped = new Map<string, number>();
  const due: DueReminder[] = [];
  const superseded: DueReminder[] = [];
  const bump = (code: string) => skipped.set(code, (skipped.get(code) || 0) + 1);

  const rules = input.rules.filter((rule) => rule.enabled && !rule.archived_at);
  for (const item of input.items) {
    if (item.archived_at || item.subject_kind === 'company' || !item.subject_id) {
      bump('skipped_subject');
      continue;
    }
    const expires = sastDate(item.expires_on);
    if (!expires) {
      bump('no_date');
      continue;
    }
    const vehicle = item.subject_kind === 'vehicle' ? vehicles.get(item.subject_id) : undefined;
    const driver = item.subject_kind === 'driver' ? drivers.get(item.subject_id) : undefined;
    if (item.subject_kind === 'vehicle' && (!vehicle || vehicle.archived_at || vehicle.status === 'sold')) {
      bump('skipped_subject');
      continue;
    }
    if (item.subject_kind === 'driver' && (!driver || driver.archived_at || driver.status === 'inactive')) {
      bump('skipped_subject');
      continue;
    }
    const applicable = rules.filter((rule) => ruleMatches(rule, item));
    const specific = applicable.find((rule) => rule.kind === item.kind) || applicable.find((rule) => rule.kind == null);
    if (!specific) {
      bump('no_rule');
      continue;
    }
    const daysLeft = expires >= today ? daysBetween(today, expires) : -daysBetween(expires, today);
    const passed = [...specific.thresholds_days].filter((threshold) => daysLeft <= threshold).sort((a, b) => a - b);
    if (!passed.length) continue;
    const nearest = passed[0];
    const subjectLabel = vehicle?.reg_no || driver?.full_name || '';
    for (const threshold of passed) {
      for (const channel of specific.channels) {
        for (const recipient of specific.recipient_member_ids) {
          if (!memberIds.has(recipient)) {
            bump('recipient_left');
            continue;
          }
          const key = logKey(item.id, expires, threshold, channel, recipient);
          const entry: DueReminder = {
            ruleId: specific.id,
            itemId: item.id,
            subjectKind: item.subject_kind,
            subjectId: item.subject_id,
            subjectLabel,
            kind: item.kind,
            kindLabel: COMPLIANCE_LABELS[item.kind],
            expiresOn: expires,
            thresholdDays: threshold,
            daysLeft,
            channel,
            recipientKey: recipient,
          };
          if (threshold !== nearest) {
            if (!logged.has(key)) {
              bump('skipped_superseded');
              superseded.push(entry);
            }
            continue;
          }
          if (logged.has(key)) continue;
          due.push(entry);
        }
      }
    }
  }
  return {
    due,
    skipped: [...skipped.entries()].map(([code, count]) => ({ code, count })),
    superseded,
  };
}

export function logKey(itemId: string, expiresOn: string, threshold: number, channel: string, recipient: string): string {
  return `${itemId}|${expiresOn}|${threshold}|${channel}|${recipient}`;
}

function ruleMatches(rule: FleetReminder, item: FleetCompliance): boolean {
  if (rule.scope_kind === 'vehicle' && item.subject_kind !== 'vehicle') return false;
  if (rule.scope_kind === 'driver' && item.subject_kind !== 'driver') return false;
  if (rule.kind && rule.kind !== item.kind) return false;
  return true;
}

export function normaliseThresholds(values: number[]): number[] | null {
  const days = values.map((value) => Math.trunc(value));
  if (days.length < 1 || days.length > 6) return null;
  if (days.some((day) => day < 0 || day > 365)) return null;
  for (let index = 1; index < days.length; index += 1) {
    if (days[index - 1] <= days[index]) return null;
  }
  return days;
}
