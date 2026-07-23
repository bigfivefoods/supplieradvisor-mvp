'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Clock, Coins } from 'lucide-react';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  formatZar,
} from '@/lib/billing/company-subscription';

/**
 * Simple operator ROI model vs fragmented Excel / multi-tool stack.
 * Illustrative — not financial advice.
 */
export default function RoiCalculator() {
  const [people, setPeople] = useState(8);
  const [hoursPerWeek, setHoursPerWeek] = useState(6);
  const [hourlyRate, setHourlyRate] = useState(350);
  const [tools, setTools] = useState(5);
  const [toolCost, setToolCost] = useState(1200);

  const result = useMemo(() => {
    const labourMonth = people * hoursPerWeek * 4.33 * hourlyRate;
    const toolsMonth = tools * toolCost;
    const wasteMonth = labourMonth + toolsMonth;
    const saCost = COMPANY_SUBSCRIPTION_MONTHLY_ZAR;
    // Assume OS reclaims ~65% of rework / rekey / reconciliation time
    const reclaimed = labourMonth * 0.65;
    // Assume consolidating 60% of tool spend over time
    const toolsSaved = toolsMonth * 0.55;
    const monthlyGain = reclaimed + toolsSaved - saCost;
    const annualGain = monthlyGain * 12;
    const hoursReclaimed = people * hoursPerWeek * 4.33 * 0.65;
    return {
      labourMonth,
      toolsMonth,
      wasteMonth,
      reclaimed,
      toolsSaved,
      monthlyGain,
      annualGain,
      hoursReclaimed,
      saCost,
    };
  }, [people, hoursPerWeek, hourlyRate, tools, toolCost]);

  return (
    <section
      id="roi"
      className="scroll-mt-20 border-t border-slate-200 bg-[#f8fafc] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
            ROI
          </p>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
            What does spreadsheet chaos
            <span className="mt-2 block text-[#00b4d8]">actually cost you?</span>
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Model hours lost to rekeying, reconciliations, and tool sprawl — then
            compare to one company plan from {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}
            /mo.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-5">
            <div className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Calculator className="h-4 w-4 text-[#00b4d8]" />
              Your inputs
            </div>
            <div className="space-y-5">
              <Slider
                label="People touching ops data"
                value={people}
                min={1}
                max={80}
                onChange={setPeople}
                suffix=" people"
              />
              <Slider
                label="Hours / person / week on rework"
                value={hoursPerWeek}
                min={1}
                max={25}
                onChange={setHoursPerWeek}
                suffix=" h"
              />
              <Slider
                label="Fully loaded hourly cost (ZAR)"
                value={hourlyRate}
                min={100}
                max={1500}
                step={25}
                onChange={setHourlyRate}
                prefix="R"
              />
              <Slider
                label="SaaS / tools in the stack"
                value={tools}
                min={1}
                max={25}
                onChange={setTools}
                suffix=" tools"
              />
              <Slider
                label="Avg cost per tool / month (ZAR)"
                value={toolCost}
                min={0}
                max={15000}
                step={100}
                onChange={setToolCost}
                prefix="R"
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <ResultCard
                icon={Clock}
                label="Hours reclaimed / month"
                value={Math.round(result.hoursReclaimed).toLocaleString('en-ZA')}
                sub="~65% of rework time"
                tone="sky"
              />
              <ResultCard
                icon={Coins}
                label="Est. monthly value"
                value={formatZar(Math.max(0, result.monthlyGain))}
                sub={
                  result.monthlyGain >= 0
                    ? 'After SupplierAdvisor plan'
                    : 'Adjust inputs — still try the free trial'
                }
                tone="emerald"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Monthly breakdown</h3>
              <dl className="space-y-3 text-sm">
                <Row
                  label="Labour cost of rework (Excel / email)"
                  value={formatZar(result.labourMonth)}
                />
                <Row
                  label="Tool sprawl (approx.)"
                  value={formatZar(result.toolsMonth)}
                />
                <Row
                  label="Reclaimed labour value"
                  value={formatZar(result.reclaimed)}
                  positive
                />
                <Row
                  label="Consolidated tool savings"
                  value={formatZar(result.toolsSaved)}
                  positive
                />
                <Row
                  label="SupplierAdvisor company plan"
                  value={`− ${formatZar(result.saCost)}`}
                />
                <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                  <span className="font-black text-slate-900">
                    Net monthly gain (illustrative)
                  </span>
                  <span
                    className={`text-xl font-black tabular-nums ${
                      result.monthlyGain >= 0
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatZar(result.monthlyGain)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Annualised</span>
                  <span className="font-bold tabular-nums">
                    {formatZar(result.annualGain)}
                  </span>
                </div>
              </dl>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
                Illustrative model only — your recovery rate depends on process
                maturity. {COMPANY_TRIAL_DAYS}-day free trial lets you measure
                real time saved.
              </p>
              <Link
                href="/onboarding?type=business"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
              >
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  prefix = '',
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex justify-between gap-2 text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums text-slate-900">
          {prefix}
          {value.toLocaleString('en-ZA')}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00b4d8]"
      />
    </label>
  );
}

function Row({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600">{label}</dt>
      <dd
        className={`font-semibold tabular-nums ${
          positive ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ResultCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub: string;
  tone: 'sky' | 'emerald';
}) {
  const bg =
    tone === 'emerald'
      ? 'from-emerald-50 to-white border-emerald-100'
      : 'from-sky-50 to-white border-sky-100';
  return (
    <div className={`rounded-3xl border bg-gradient-to-br ${bg} p-5 shadow-sm`}>
      <Icon className="h-5 w-5 text-[#00b4d8] mb-2" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums text-slate-900 sm:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
