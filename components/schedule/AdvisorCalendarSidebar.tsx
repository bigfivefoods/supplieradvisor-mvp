'use client';

/**
 * Right rail: day briefing + selected event context + ICS feed link.
 */

import { AdvisorCalendarBriefing } from '@/components/schedule/AdvisorCalendarBriefing';
import {
  AdvisorEventContextCard,
  type EventReminderTarget,
} from '@/components/schedule/AdvisorEventContextCard';
import type { ScheduleEvent } from '@/components/schedule/PracticeScheduleCalendar';
import type { WorkingHours } from '@/lib/schedule/working-hours';
import type { EnrichedScheduleEvent } from '@/lib/services/advisor-calendar-intelligence';
import { Download } from 'lucide-react';

type Props = {
  date: string;
  events: ScheduleEvent[];
  workingHours?: WorkingHours | null;
  people?: Array<{ id: string; name: string }>;
  peopleLabel?: string;
  selected: EnrichedScheduleEvent | null;
  onClearSelected?: () => void;
  clientsHref?: string;
  messagesHref?: string;
  reminder?: EventReminderTarget | null;
  onReschedule?: (next: {
    id: string;
    date: string;
    start_time: string;
  }) => void | Promise<void>;
  icsFeedHref?: string | null;
  companyId?: number | string;
  module?: string;
  personFilter?: string;
};

export function AdvisorCalendarSidebar({
  date,
  events,
  workingHours,
  people,
  peopleLabel,
  selected,
  onClearSelected,
  clientsHref,
  messagesHref,
  reminder,
  onReschedule,
  icsFeedHref,
  companyId,
  module = 'fitgraph',
  personFilter,
}: Props) {
  const feed =
    icsFeedHref ||
    (companyId
      ? `/api/schedule/ics?companyId=${encodeURIComponent(String(companyId))}&module=${encodeURIComponent(module)}${
          personFilter
            ? `&personId=${encodeURIComponent(personFilter)}`
            : ''
        }`
      : null);

  return (
    <div className="space-y-3 lg:sticky lg:top-4">
      <AdvisorCalendarBriefing
        date={date}
        events={events}
        workingHours={workingHours}
        people={people}
        peopleLabel={peopleLabel}
      />
      <AdvisorEventContextCard
        event={selected}
        clientsHref={clientsHref}
        messagesHref={messagesHref}
        onClose={onClearSelected}
        reminder={reminder}
        onReschedule={onReschedule}
      />
      {feed ? (
        <a
          href={feed}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <Download className="w-3.5 h-3.5" />
          Download diary ICS (Outlook / Google mirror)
        </a>
      ) : null}
      <p className="text-[10px] text-slate-400 leading-relaxed">
        SupplierAdvisor is the system of record. ICS feeds let staff mirror the
        diary in Outlook or Google — changes still belong here.
      </p>
    </div>
  );
}

export default AdvisorCalendarSidebar;
