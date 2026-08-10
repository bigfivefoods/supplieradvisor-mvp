/**
 * Lightweight Advisor event bus — append-only log on profile metadata
 * plus optional side-effects (accounting stub, CRM note stub).
 */

export type AdvisorEventType =
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'attendance.marked'
  | 'pack.issued'
  | 'pack.consumed'
  | 'pack.expired_warn'
  | 'deposit.required'
  | 'deposit.paid'
  | 'waitlist.promoted'
  | 'reminder.sent'
  | 'recall.due'
  | 'visit_note.saved'
  | 'treatment_plan.updated'
  | 'outcome.recorded';

export type AdvisorEvent = {
  id: string;
  at: string;
  module: string;
  company_id: number;
  type: AdvisorEventType;
  person_id?: string | null;
  booking_id?: string | null;
  amount_zar?: number | null;
  meta?: Record<string, unknown>;
};

const META_KEY = 'advisor_events';
const MAX_EVENTS = 200;

export function readAdvisorEvents(
  metadata: Record<string, unknown> | null | undefined
): AdvisorEvent[] {
  const raw = metadata?.[META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw as AdvisorEvent[];
}

export function appendAdvisorEvent(
  metadata: Record<string, unknown>,
  event: Omit<AdvisorEvent, 'id' | 'at'> & { id?: string; at?: string }
): { metadata: Record<string, unknown>; event: AdvisorEvent } {
  const full: AdvisorEvent = {
    id:
      event.id ||
      `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: event.at || new Date().toISOString(),
    module: event.module,
    company_id: event.company_id,
    type: event.type,
    person_id: event.person_id,
    booking_id: event.booking_id,
    amount_zar: event.amount_zar,
    meta: event.meta,
  };
  const prev = readAdvisorEvents(metadata);
  const next = [full, ...prev].slice(0, MAX_EVENTS);
  return {
    metadata: { ...metadata, [META_KEY]: next },
    event: full,
  };
}

/**
 * Side-effect hooks — best-effort, never throws.
 * Accounting / CRM integration points for Phase D.
 */
export async function dispatchAdvisorEventSideEffects(
  event: AdvisorEvent
): Promise<{ accounting?: string; crm?: string }> {
  const out: { accounting?: string; crm?: string } = {};
  try {
    // Revenue-ish events can later create AR / payment claims
    if (
      event.type === 'deposit.paid' ||
      event.type === 'pack.issued' ||
      (event.type === 'pack.consumed' && event.amount_zar)
    ) {
      out.accounting = 'queued'; // stub — wire to /api/accounting when ready
    }
    if (
      event.type === 'booking.created' ||
      event.type === 'attendance.marked' ||
      event.type === 'recall.due'
    ) {
      out.crm = 'queued'; // stub — wire to customers leads/activity
    }
  } catch {
    /* soft */
  }
  return out;
}

export function eventsSummary(events: AdvisorEvent[], days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const recent = events.filter((e) => new Date(e.at).getTime() >= cutoff);
  const byType: Record<string, number> = {};
  for (const e of recent) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  return { period_days: days, total: recent.length, by_type: byType };
}
