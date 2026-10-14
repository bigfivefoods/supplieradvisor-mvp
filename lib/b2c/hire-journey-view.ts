/**
 * Client-safe hire journey view model.
 * Server loading lives in hire-journeys.ts so the member app does not
 * bundle the Supabase server client or the hire store.
 */
import type { CalendarLinkEvent } from '@/lib/b2c/calendar-links';

export type B2cHireJourney = {
  id: string;
  membership_id: string;
  brand: string;
  company_id: number;
  portal_path: string;
  item_title: string;
  code: string;
  status: string;
  status_label: string;
  timeline: Array<{
    id: string;
    label: string;
    done: boolean;
    current: boolean;
  }>;
  start_date?: string | null;
  end_date?: string | null;
  duration_label?: string;
  can_extend?: boolean;
  customer_pays_zar?: number | null;
  deposit_zar?: number | null;
  docs_pending: Array<{ key: string; label: string }>;
  next_action: string;
  open: boolean;
  location?: string;
  includes?: string;
  excludes?: string;
  specs?: string;
  fulfillment_label?: string;
  collect_hours?: string;
  cancellation_note?: string;
  deposit_note?: string;
};

export const HIRE_PROCESS_STEPS = [
  { id: 'requested', label: 'Request', hint: 'Pick the gear and your dates' },
  {
    id: 'awaiting_requirements',
    label: 'Docs',
    hint: 'ID, licence or site checks the desk needs',
  },
  { id: 'approved', label: 'OK', hint: 'The hire desk approves your request' },
  { id: 'paid', label: 'Pay', hint: 'Rental plus a refundable deposit' },
  { id: 'out', label: 'Out', hint: 'Collect or we deliver' },
  { id: 'returned', label: 'Back', hint: 'Return on the end date' },
  { id: 'completed', label: 'Done', hint: 'Deposit settled' },
] as const;

export function hireJourneyCalendarEvent(
  journey: Pick<
    B2cHireJourney,
    | 'id'
    | 'item_title'
    | 'brand'
    | 'start_date'
    | 'end_date'
    | 'status_label'
    | 'next_action'
    | 'location'
    | 'portal_path'
    | 'collect_hours'
    | 'fulfillment_label'
  >
): CalendarLinkEvent | null {
  const start = String(journey.start_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  return {
    id: `hire-${journey.id}`,
    title: `${journey.item_title} hire`,
    date: start,
    end_date: String(journey.end_date || start).slice(0, 10),
    all_day: true,
    location: journey.location || journey.brand,
    href: journey.portal_path,
    description: [
      `${journey.brand} · ${journey.status_label}`,
      journey.fulfillment_label,
      journey.collect_hours ? `Hours: ${journey.collect_hours}` : '',
      journey.next_action,
    ]
      .filter(Boolean)
      .join('. '),
  };
}
