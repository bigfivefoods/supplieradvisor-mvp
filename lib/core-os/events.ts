/**
 * Advisor events → CRM activity + Intelligence pulse + inbox mix.
 */
import type { AdvisorEvent, AdvisorEventType } from '@/lib/services/advisor-events';
import type { Insight } from '@/lib/intelligence/engine';

export type CrmActivityDraft = {
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  metadata: Record<string, unknown>;
};

const CRM_TYPES: AdvisorEventType[] = [
  'booking.created',
  'booking.cancelled',
  'attendance.marked',
  'recall.due',
  'pack.issued',
  'pack.consumed',
  'waitlist.promoted',
];

export function crmActivityFromEvent(event: AdvisorEvent): CrmActivityDraft | null {
  if (!CRM_TYPES.includes(event.type)) return null;
  const who = event.person_id || event.booking_id || 'member';
  const label = event.type.replace(/\./g, ' ');
  return {
    action: `advisor.${event.type}`,
    entity_type: 'customer',
    entity_id: String(event.meta?.crm_customer_id || event.person_id || ''),
    summary: `${label} · ${who}`,
    metadata: {
      advisor_event_id: event.id,
      module: event.module,
      type: event.type,
      booking_id: event.booking_id || null,
      amount_zar: event.amount_zar ?? null,
    },
  };
}

export function intelligenceFromEvents(
  events: AdvisorEvent[],
  extras?: {
    debitReady?: number;
    debitMissing?: number;
    fillPct?: number | null;
    attendance7?: number;
  }
): Insight[] {
  const insights: Insight[] = [];
  const cutoff = Date.now() - 7 * 86400000;
  const recent = events.filter((e) => new Date(e.at).getTime() >= cutoff);
  const attendance = recent.filter((e) => e.type === 'attendance.marked').length;
  const recalls = recent.filter((e) => e.type === 'recall.due').length;
  const cancelled = recent.filter((e) => e.type === 'booking.cancelled').length;

  if (attendance > 0) {
    insights.push({
      id: 'advisor-attendance',
      severity: 'positive',
      domain: 'ops',
      title: `${attendance} attendance mark${attendance === 1 ? '' : 's'} this week`,
      detail: 'Class and consult attendance is flowing into CRM activity.',
      href: '/dashboard/customers/360',
      metric: String(attendance),
    });
  }
  if (recalls > 0) {
    insights.push({
      id: 'advisor-recalls',
      severity: 'warning',
      domain: 'demand',
      title: `${recalls} recall${recalls === 1 ? '' : 's'} due`,
      detail: 'Follow up from Customers 360 or the Advisor book.',
      href: '/dashboard/calendar',
      metric: String(recalls),
      action: 'Open calendar',
    });
  }
  if (cancelled >= 5) {
    insights.push({
      id: 'advisor-cancels',
      severity: 'warning',
      domain: 'demand',
      title: `${cancelled} cancellations this week`,
      detail: 'Check waitlist promote and no-show policy.',
      href: '/dashboard/fitgraph/bookings',
    });
  }
  if ((extras?.debitMissing || 0) > 0) {
    insights.push({
      id: 'advisor-debit-gap',
      severity: extras!.debitMissing! > 3 ? 'critical' : 'warning',
      domain: 'finance',
      title: `${extras!.debitMissing} members missing debit-order bank`,
      detail: 'Membership is incomplete until bank details are on the profile.',
      href: '/dashboard/accounting/debit-orders',
      metric: String(extras!.debitMissing),
      action: 'Open debit file',
    });
  }
  if ((extras?.debitReady || 0) > 0) {
    insights.push({
      id: 'advisor-debit-ready',
      severity: 'info',
      domain: 'finance',
      title: `${extras!.debitReady} debit-ready members`,
      detail: 'Export the debit-order file and match it on bank rec.',
      href: '/dashboard/accounting/debit-orders',
      metric: String(extras!.debitReady),
    });
  }
  if (extras?.fillPct != null && extras.fillPct < 60) {
    insights.push({
      id: 'advisor-fill',
      severity: 'warning',
      domain: 'ops',
      title: `Class fill ${Math.round(extras.fillPct)}%`,
      detail: 'Promote waitlist or push the public book.',
      href: '/dashboard/fitgraph/calendar',
    });
  }
  if ((extras?.attendance7 || attendance) > 0 && extras?.fillPct != null && extras.fillPct >= 85) {
    insights.push({
      id: 'advisor-fill-strong',
      severity: 'positive',
      domain: 'ops',
      title: 'Diaries are filling well',
      detail: 'Attendance and fill are healthy this week.',
      href: '/dashboard/intelligence',
    });
  }
  return insights;
}

export type InboxItem = {
  id: string;
  channel: 'trade' | 'care' | 'team';
  title: string;
  preview?: string;
  at: string;
  href: string;
};

export function mixInbox(opts: {
  trade?: InboxItem[];
  care?: InboxItem[];
  team?: InboxItem[];
  filter?: 'all' | 'trade' | 'care' | 'team';
}): InboxItem[] {
  const all = [
    ...(opts.trade || []),
    ...(opts.care || []),
    ...(opts.team || []),
  ];
  const filtered =
    !opts.filter || opts.filter === 'all'
      ? all
      : all.filter((i) => i.channel === opts.filter);
  return filtered.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
