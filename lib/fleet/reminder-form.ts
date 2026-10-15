/**
 * FleetAdvisor® reminder form. A new rule stays off and names nobody until someone chooses both.
 */
import type { FleetReminder } from './types';

export type ReminderDraft = {
  id: string | null;
  scope_kind: 'all' | 'vehicle' | 'driver';
  kind: string | null;
  thresholds_days: number[];
  channels: Array<'email' | 'push'>;
  recipient_member_ids: string[];
  enabled: boolean;
};

export function reminderDraft(rule: FleetReminder | null | undefined): ReminderDraft {
  if (!rule) {
    return {
      id: null,
      scope_kind: 'all',
      kind: null,
      thresholds_days: [30, 14, 7, 0],
      channels: [],
      recipient_member_ids: [],
      enabled: false,
    };
  }
  return {
    id: rule.id,
    scope_kind: rule.scope_kind,
    kind: rule.kind,
    thresholds_days: [...rule.thresholds_days],
    channels: [...rule.channels],
    recipient_member_ids: [...rule.recipient_member_ids],
    enabled: rule.enabled,
  };
}

export function parseThresholds(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

export function prdpUnchanged(current: number | null, raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') return current == null;
  const next = Number(trimmed);
  if (!Number.isFinite(next)) return true;
  return next === current;
}
