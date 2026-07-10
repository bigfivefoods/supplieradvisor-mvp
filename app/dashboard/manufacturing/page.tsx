'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarRange,
  Factory,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  Rocket,
  Workflow,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  ManufacturingHeader,
  ManufacturingPage,
  SchemaHint,
  TelemetryCard,
} from '@/components/manufacturing/ManufacturingShell';

type Summary = {
  boms: number;
  bomsActive: number;
  orders: number;
  ordersPlanned: number;
  ordersReleased: number;
  ordersInProgress: number;
  ordersHold: number;
  ordersComplete: number;
  qtyPlanned: number;
  qtyCompleted: number;
  qtyScrapped: number;
  yieldPct: number;
  completionPct: number;
  workCenters: number;
  workCentersActive: number;
  mpsPlans: number;
  mpsActive: number;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  unitsOnHand: number;
  lastMrp: { run_number?: string; completed_at?: string; summary?: Record<string, number> } | null;
};

const MODULES = [
  {
    href: '/dashboard/manufacturing/production-orders',
    icon: Factory,
    code: 'WO',
    title: 'Work orders',
    desc: 'Release, run, complete — live shop-floor execution with priority and yield.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/manufacturing/bills-of-materials',
    icon: Network,
    code: 'BOM',
    title: 'Bills of materials',
    desc: 'Versioned product structures, scrap, yield, and multi-level explosion.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/manufacturing/master-production-schedules',
    icon: CalendarRange,
    code: 'MPS',
    title: 'Master schedule',
    desc: 'Weekly demand horizon. Firm buckets. Push straight to work orders.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/manufacturing/mrp',
    icon: Layers,
    code: 'MRP',
    title: 'Material requirements',
    desc: 'Net requirements, make/buy actions, BOM explosion against live stock.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/manufacturing/work-centers',
    icon: Workflow,
    code: 'CELL',
    title: 'Work cells',
    desc: 'Capacity, efficiency, WIP load — the physics of your factory.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
] as const;

export default function ManufacturingCommandCenter() {
  return (
    <CompanyRequired>
      <CommandInner />
    </CompanyRequired>
  );
}

function CommandInner() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [warning, setWarning] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data.summary || null);
      setWarning(data.warning);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = summary;

  return (
    <ManufacturingPage>
      <ManufacturingHeader
        title="Manufacturing"
        titleAccent="Command"
        description="Mission-control for production — BOMs, master schedule, MRP explosion, and work-order execution. Build faster. Waste less. Ship quality."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh telemetry
          </button>
        }
      />

      <SchemaHint message={warning} />

      {/* Hero strip */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-[#003d5c] text-white p-6 sm:p-8 mb-8 shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-4">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Systems live · manufacturing OS
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
              Factory physics, not spreadsheets.
            </h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Plan demand on the MPS. Explode materials through BOMs. Net against inventory.
              Release work orders to cells. Measure OEE-style throughput every refresh.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[280px]">
            <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-3 text-center backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">OEE</div>
              <div className="text-2xl font-black tabular-nums text-emerald-300">
                {loading ? '—' : `${s?.oee ?? 0}%`}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-3 text-center backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">WIP</div>
              <div className="text-2xl font-black tabular-nums text-cyan-300">
                {loading ? '—' : s?.ordersInProgress ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-3 text-center backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Yield</div>
              <div className="text-2xl font-black tabular-nums text-amber-200">
                {loading ? '—' : `${s?.yieldPct ?? 100}%`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading && !summary ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <TelemetryCard
              label="Work orders"
              value={s?.orders ?? 0}
              sub={`${s?.ordersInProgress ?? 0} in flight · ${s?.ordersHold ?? 0} hold`}
              accent="emerald"
            />
            <TelemetryCard
              label="Active BOMs"
              value={s?.bomsActive ?? 0}
              sub={`${s?.boms ?? 0} total structures`}
              accent="cyan"
            />
            <TelemetryCard
              label="MPS plans"
              value={s?.mpsPlans ?? 0}
              sub={`${s?.mpsActive ?? 0} active horizons`}
              accent="slate"
            />
            <TelemetryCard
              label="Work cells"
              value={`${s?.workCentersActive ?? 0}/${s?.workCenters ?? 0}`}
              sub="active / total capacity"
              accent="amber"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-8">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                Availability
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${s?.availability ?? 0}%` }}
                />
              </div>
              <div className="text-lg font-black tabular-nums text-slate-800">
                {s?.availability ?? 0}%
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                Performance
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-2">
                <div
                  className="h-full bg-[#00b4d8] rounded-full transition-all"
                  style={{ width: `${s?.performance ?? 0}%` }}
                />
              </div>
              <div className="text-lg font-black tabular-nums text-slate-800">
                {s?.performance ?? 0}%
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                Quality
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-2">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${s?.quality ?? 0}%` }}
                />
              </div>
              <div className="text-lg font-black tabular-nums text-slate-800">{s?.quality ?? 0}%</div>
            </div>
          </div>

          {/* Flow */}
          <div className="mb-3 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[#00b4d8]" />
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">
              Production flow
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-8 text-xs font-semibold text-slate-600">
            {['Demand / MPS', 'MRP netting', 'BOM explode', 'Work orders', 'Cells', 'Ship quality'].map(
              (step, i, arr) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 shadow-sm">
                    {step}
                  </span>
                  {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />}
                </div>
              )
            )}
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`group rounded-3xl border bg-gradient-to-br ${m.accent} p-6 shadow-sm hover:shadow-md hover:border-[#00b4d8]/40 transition-all`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-neutral-100 flex items-center justify-center shadow-sm">
                      <Icon className="w-5 h-5 text-[#0077b6]" />
                    </div>
                    <span className="text-[10px] font-black tracking-widest text-neutral-400 font-mono">
                      {m.code}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1.5 group-hover:text-[#0077b6] transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-4">{m.desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00b4d8]">
                    Open system <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              );
            })}
          </div>

          {s?.lastMrp && (
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                  Last MRP run
                </div>
                <div className="font-mono font-bold text-slate-800">{s.lastMrp.run_number}</div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {s.lastMrp.completed_at
                    ? new Date(s.lastMrp.completed_at).toLocaleString()
                    : '—'}
                  {s.lastMrp.summary?.shortages != null &&
                    ` · ${s.lastMrp.summary.shortages} shortages`}
                </div>
              </div>
              <Link
                href="/dashboard/manufacturing/mrp"
                className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                Run / view MRP <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </ManufacturingPage>
  );
}
