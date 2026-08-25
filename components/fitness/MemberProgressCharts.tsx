'use client';

import { useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import type { MemberGoalView } from '@/lib/fitness/member-goals';
import {
  buildStampSeries,
  type GoalPeriodKey,
} from '@/lib/fitness/goal-chart';
import {
  GoalPeriodPicker,
  GoalSparkline,
  MetricSparkline,
} from '@/components/fitness/GoalTrendChart';
import { GymExpandSection } from '@/components/fitness/GymMemberPwaUi';

export type SessionFeedbackPoint = {
  at?: string;
  date?: string;
  feeling: number;
  intensity: number;
  enjoyment?: number | null;
};

export function MemberProgressCharts({
  feedback,
  goals,
  color,
}: {
  feedback: SessionFeedbackPoint[];
  goals: MemberGoalView[];
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<GoalPeriodKey>('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const feel = useMemo(
    () =>
      buildStampSeries(
        feedback.map((f) => ({
          at: f.at || f.date,
          value: f.feeling,
        }))
      ),
    [feedback]
  );
  const rpe = useMemo(
    () =>
      buildStampSeries(
        feedback.map((f) => ({
          at: f.at || f.date,
          value: f.intensity,
        }))
      ),
    [feedback]
  );
  const enjoy = useMemo(
    () =>
      buildStampSeries(
        feedback.map((f) => ({
          at: f.at || f.date,
          value: f.enjoyment ?? null,
        }))
      ),
    [feedback]
  );

  const activeGoals = goals.filter((g) => g.status !== 'abandoned');

  return (
    <GymExpandSection
      title="Progress charts"
      hint={
        open
          ? undefined
          : 'Class ratings and goals over 1W–12M'
      }
      icon={<LineChart className="h-4 w-4" />}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <GoalPeriodPicker
        period={period}
        onPeriod={setPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        color={color}
      />
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Session progress
        </p>
        <MetricSparkline
          label="How it felt"
          unit="/5"
          points={feel}
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          color={color}
        />
        <MetricSparkline
          label="Effort / RPE"
          unit="/10"
          points={rpe}
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          color="#0f172a"
        />
        <MetricSparkline
          label="Enjoyment"
          unit="/5"
          points={enjoy}
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          color="#059669"
        />
      </div>
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Goal progress
        </p>
        {activeGoals.length ? (
          activeGoals.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
            >
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {g.title}
              </p>
              <GoalSparkline
                goal={g}
                period={period}
                customFrom={customFrom}
                customTo={customTo}
                color={color}
              />
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-500">
            Set a goal above and it will chart here.
          </p>
        )}
      </div>
    </GymExpandSection>
  );
}
