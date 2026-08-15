/**
 * Advisor calendar intelligence — beats generic Outlook/Google for practices & gyms.
 *
 * Generic calendars show time blocks. Advisors need:
 * - utilisation by clinician / room
 * - gap detection (fillable slots)
 * - no-show & relationship risk on the day
 * - waitlist / demand pressure
 * - one-click operational actions context
 */

import type { ScheduleEvent } from '@/components/schedule/PracticeScheduleCalendar';
import type { WorkingHours } from '@/lib/schedule/working-hours';
import {
  isClosedOn,
  openCloseOn,
  openDurationMinutes,
} from '@/lib/schedule/working-hours';

export type CalendarDayStats = {
  date: string;
  event_count: number;
  booked_minutes: number;
  open_minutes: number;
  utilisation_pct: number | null;
  gaps: Array<{ start: string; end: string; minutes: number }>;
  largest_gap_minutes: number;
  by_person: Array<{
    person_id: string;
    person_name: string;
    events: number;
    minutes: number;
    utilisation_pct: number | null;
  }>;
  risk_events: number;
  public_events: number;
};

export type DayBriefing = {
  date: string;
  headline: string;
  stats: CalendarDayStats;
  priorities: Array<{
    code: string;
    title: string;
    detail?: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  tips: string[];
};

export type EnrichedScheduleEvent = ScheduleEvent & {
  relationship_level?: string | null;
  relationship_score?: number | null;
  no_show_risk?: boolean;
  waitlist_count?: number;
  pack_remaining?: number | null;
  is_private_client?: boolean;
  client_id?: string;
};

function parseHm(t: string): number {
  const [h, m] = String(t || '00:00')
    .slice(0, 5)
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtHm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function eventEndMinutes(ev: ScheduleEvent): number {
  if (ev.end_time) return parseHm(ev.end_time);
  const start = parseHm(ev.start_time);
  const dur = Number(ev.duration_min);
  return start + (Number.isFinite(dur) && dur > 0 ? dur : 45);
}

function eventMinutes(ev: ScheduleEvent): number {
  const start = parseHm(ev.start_time);
  return Math.max(0, eventEndMinutes(ev) - start);
}

/** Compute utilisation + gaps for one day */
export function computeDayStats(
  date: string,
  events: ScheduleEvent[],
  workingHours?: WorkingHours | null,
  people?: Array<{ id: string; name: string }>
): CalendarDayStats {
  const dayEvents = events
    .filter((e) => e.date === date && e.status !== 'cancelled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  let openMinutes = 8 * 60;
  let openStart = 8 * 60;
  let openEnd = 17 * 60;

  if (workingHours && !isClosedOn(workingHours, date)) {
    const oc = openCloseOn(workingHours, date);
    if (oc) {
      openStart = parseHm(oc.open);
      openEnd = parseHm(oc.close);
      openMinutes =
        openDurationMinutes(workingHours, date) || openEnd - openStart;
    }
  } else if (workingHours && isClosedOn(workingHours, date)) {
    openMinutes = 0;
  }

  const booked = dayEvents.reduce((s, e) => s + eventMinutes(e), 0);
  const utilisation =
    openMinutes > 0 ? Math.round((booked / openMinutes) * 1000) / 10 : null;

  const gaps: CalendarDayStats['gaps'] = [];
  if (openMinutes > 0) {
    let cursor = openStart;
    for (const e of dayEvents) {
      const s = parseHm(e.start_time);
      const en = eventEndMinutes(e);
      if (s > cursor + 14) {
        gaps.push({
          start: fmtHm(cursor),
          end: fmtHm(s),
          minutes: s - cursor,
        });
      }
      cursor = Math.max(cursor, en);
    }
    if (openEnd > cursor + 14) {
      gaps.push({
        start: fmtHm(cursor),
        end: fmtHm(openEnd),
        minutes: openEnd - cursor,
      });
    }
  }

  const byPersonMap = new Map<
    string,
    { person_id: string; person_name: string; events: number; minutes: number }
  >();
  for (const e of dayEvents) {
    const pid = e.person_id || '_unassigned';
    const name =
      e.person_name ||
      people?.find((p) => p.id === e.person_id)?.name ||
      'Unassigned';
    const row = byPersonMap.get(pid) || {
      person_id: pid,
      person_name: name,
      events: 0,
      minutes: 0,
    };
    row.events += 1;
    row.minutes += eventMinutes(e);
    byPersonMap.set(pid, row);
  }

  return {
    date,
    event_count: dayEvents.length,
    booked_minutes: booked,
    open_minutes: openMinutes,
    utilisation_pct: utilisation,
    gaps: gaps.sort((a, b) => b.minutes - a.minutes),
    largest_gap_minutes: gaps[0]?.minutes || 0,
    by_person: [...byPersonMap.values()]
      .map((r) => ({
        ...r,
        utilisation_pct:
          openMinutes > 0
            ? Math.round((r.minutes / openMinutes) * 1000) / 10
            : null,
      }))
      .sort((a, b) => b.minutes - a.minutes),
    risk_events: dayEvents.filter(
      (e) =>
        (e as EnrichedScheduleEvent).no_show_risk ||
        (e as EnrichedScheduleEvent).relationship_level === 'at_risk' ||
        (e as EnrichedScheduleEvent).relationship_level === 'cooling'
    ).length,
    public_events: dayEvents.filter((e) => e.public).length,
  };
}

/** Human day briefing for the desk */
export function buildDayBriefing(
  date: string,
  events: ScheduleEvent[],
  workingHours?: WorkingHours | null,
  people?: Array<{ id: string; name: string }>
): DayBriefing {
  const stats = computeDayStats(date, events, workingHours, people);
  const priorities: DayBriefing['priorities'] = [];
  const tips: string[] = [];

  if (stats.risk_events > 0) {
    priorities.push({
      code: 'relationship_risk',
      title: `${stats.risk_events} session(s) with cooling / at-risk clients`,
      detail: 'Open the client and send a personal note before or after class.',
      severity: 'high',
    });
  }

  if (
    stats.utilisation_pct != null &&
    stats.utilisation_pct < 40 &&
    stats.open_minutes > 0
  ) {
    priorities.push({
      code: 'low_util',
      title: `Only ${stats.utilisation_pct}% of open hours filled`,
      detail: 'Promote open slots or release a drop-in class.',
      severity: 'medium',
    });
  }

  if (stats.utilisation_pct != null && stats.utilisation_pct > 90) {
    priorities.push({
      code: 'high_util',
      title: `Near capacity (${stats.utilisation_pct}%)`,
      detail: 'Watch waitlists and double-book risk on clinician diaries.',
      severity: 'medium',
    });
  }

  if (stats.largest_gap_minutes >= 60) {
    const g = stats.gaps[0];
    priorities.push({
      code: 'fill_gap',
      title: `${stats.largest_gap_minutes} min gap ${g?.start}–${g?.end}`,
      detail: 'Ideal for a private client, PT, or admin block.',
      severity: 'low',
    });
  }

  if (stats.event_count === 0 && stats.open_minutes > 0) {
    priorities.push({
      code: 'empty_day',
      title: 'No sessions on this open day',
      detail: 'Schedule series or mark as leave / closed.',
      severity: 'medium',
    });
  }

  if (
    stats.by_person.some(
      (p) => p.utilisation_pct != null && p.utilisation_pct > 95
    )
  ) {
    tips.push('At least one clinician is fully loaded — protect recovery time.');
  }
  if (stats.gaps.filter((g) => g.minutes >= 45).length >= 2) {
    tips.push('Multiple mid-size gaps — consider consolidating appointments.');
  }
  tips.push(
    'Unlike Outlook/Google: each block can carry membership, packs, relationship health, and waitlist pressure.'
  );

  let headline = `${stats.event_count} sessions`;
  if (stats.utilisation_pct != null) {
    headline += ` · ${stats.utilisation_pct}% utilised`;
  }
  if (stats.risk_events) {
    headline += ` · ${stats.risk_events} need care`;
  }

  return { date, headline, stats, priorities, tips };
}

/** Week roll-up for capacity planning */
export function computeWeekUtilisation(
  dates: string[],
  events: ScheduleEvent[],
  workingHours?: WorkingHours | null
): Array<{ date: string; utilisation_pct: number | null; events: number }> {
  return dates.map((d) => {
    const s = computeDayStats(d, events, workingHours);
    return {
      date: d,
      utilisation_pct: s.utilisation_pct,
      events: s.event_count,
    };
  });
}

export function enrichEventsWithRisk(
  events: ScheduleEvent[],
  riskByPersonId: Record<
    string,
    { level?: string; score?: number; no_show_risk?: boolean }
  >
): EnrichedScheduleEvent[] {
  return events.map((e) => {
    const clientHint = (e as EnrichedScheduleEvent).client_id || undefined;
    const risk = clientHint ? riskByPersonId[clientHint] : undefined;
    return {
      ...e,
      relationship_level: risk?.level || null,
      relationship_score: risk?.score ?? null,
      no_show_risk: risk?.no_show_risk || false,
      meta: [
        e.meta,
        risk?.level && risk.level !== 'strong' && risk.level !== 'unknown'
          ? `rel:${risk.level}`
          : null,
        risk?.no_show_risk ? 'no-show risk' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });
}
