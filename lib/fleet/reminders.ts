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

export function visibleReminderLog<T extends { status: string; item_id: string; expires_on: string; threshold_days: number; channel: string; recipient_key: string }>(
  rows: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (row.status === 'skipped_superseded') {
      const key = logKey(row.item_id, row.expires_on, row.threshold_days, row.channel, row.recipient_key);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(row);
  }
  return out;
}

const REMINDER_STATUS_LABEL: Record<string, string> = {
  claimed: 'Sending',
  sent: 'Sent',
  failed: 'Could not send',
  skipped_superseded: 'Skipped, a closer reminder covers it',
};

export function reminderStatusLabel(status: string): string {
  return REMINDER_STATUS_LABEL[status] || status;
}

/** One row per send. A claim followed by a send is the same send. */
export function deskReminderRows<
  T extends { id: string; status: string; item_id: string; expires_on: string; threshold_days: number; channel: string; recipient_key: string; at: string },
>(rows: T[]): Array<T & { label: string }> {
  const visible = visibleReminderLog(rows);
  const indexByKey = new Map<string, number>();
  const out: Array<T & { label: string }> = [];
  for (const row of visible) {
    const label = reminderStatusLabel(row.status);
    if (row.status === 'claimed' || row.status === 'sent') {
      const key = logKey(row.item_id, row.expires_on, row.threshold_days, row.channel, row.recipient_key);
      const existing = indexByKey.get(key);
      if (existing != null && (out[existing].status === 'claimed' || out[existing].status === 'sent')) {
        if (row.status === 'sent') out[existing] = { ...out[existing], status: 'sent', label: reminderStatusLabel('sent'), at: row.at };
        continue;
      }
      indexByKey.set(key, out.length);
    }
    out.push({ ...row, label });
  }
  return out;
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
