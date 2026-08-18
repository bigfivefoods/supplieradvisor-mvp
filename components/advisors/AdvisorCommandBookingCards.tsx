'use client';

import { TelemetryCard } from '@/components/chrome/CommandHubChrome';
import {
  formatCommandZar,
  formatFillPct,
} from '@/lib/advisors/command-booking-metrics';

export type AdvisorCommandBookingSummary = {
  bookedToday?: number | null;
  bookedWeek?: number | null;
  bookedMonth?: number | null;
  fillRateTodayPct?: number | null;
  fillRateWeekPct?: number | null;
  fillRateMonthPct?: number | null;
  monthIncomeZar?: number | null;
  monthPotentialZar?: number | null;
};

export function AdvisorCommandBookingCards({
  summary,
  calendarHref,
  incomeLabel = 'Month income',
  countNoun = 'booked',
}: {
  summary?: AdvisorCommandBookingSummary | Record<string, unknown> | null;
  calendarHref?: string;
  incomeLabel?: string;
  countNoun?: string;
}) {
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const today = num(summary?.bookedToday) || 0;
  const week = num(summary?.bookedWeek) || 0;
  const month = num(summary?.bookedMonth) || 0;
  const fillToday = formatFillPct(num(summary?.fillRateTodayPct));
  const fillWeek = formatFillPct(num(summary?.fillRateWeekPct));
  const fillMonth = formatFillPct(num(summary?.fillRateMonthPct));
  const income = num(summary?.monthIncomeZar) || 0;
  const potential = num(summary?.monthPotentialZar) || 0;
  const incomeSub =
    potential > income
      ? `${formatCommandZar(potential)} if 100% full`
      : `from ${countNoun} this month`;

  const fillSub = (pct: string) =>
    pct === '—' ? 'no diary slots' : `${pct} full`;

  return (
    <>
      <TelemetryCard
        label="Booked today"
        value={String(today)}
        sub={fillSub(fillToday)}
        accent="cyan"
        href={calendarHref}
      />
      <TelemetryCard
        label="This week"
        value={String(week)}
        sub={fillSub(fillWeek)}
        accent="sky"
        href={calendarHref}
      />
      <TelemetryCard
        label="This month"
        value={String(month)}
        sub={fillSub(fillMonth)}
        accent="violet"
        href={calendarHref}
      />
      <TelemetryCard
        label="Full rate"
        value={fillMonth}
        sub={`today ${fillToday} · week ${fillWeek}`}
        accent="emerald"
        href={calendarHref}
      />
      <TelemetryCard
        label={incomeLabel}
        value={formatCommandZar(income)}
        sub={incomeSub}
        accent="amber"
      />
    </>
  );
}
