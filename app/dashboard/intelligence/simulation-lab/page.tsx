'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import {
  healthTone,
  useIntelligence,
} from '@/lib/intelligence/useIntelligence';
import { simulateHealth, type PulseInput } from '@/lib/intelligence/engine';

const DEFAULT_PULSE: PulseInput = {
  networkAccepted: 3,
  networkPendingIn: 1,
  networkPendingOut: 0,
  pricingActive: 1,
  walletReady: true,
  srmBook: 5,
  srmConnected: 3,
  srmAvgOtifef: 82,
  srmAvgTrust: 70,
  srmVerified: 2,
  customers: 8,
  customersActive: 6,
  openLeads: 4,
  openOpps: 2,
  pipelineValue: 250000,
  openPos: 4,
  onchainPos: 1,
  poValue30: 120000,
  poGrowth: 5,
  quotesOpen: 3,
  quotesValue: 80000,
  quoteWinRate: 30,
  quotesCount: 10,
  arOpen: 4,
  arBalance: 95000,
  apOpen: 3,
  apBalance: 40000,
  products: 24,
  multiCurrencyProducts: 4,
  currencyCount: 2,
  lowStock: 3,
  stockUnits: 1200,
  sales30: 45000,
  salesGrowth: 8,
  topSupplierShare: 45,
  supplierPoCount: 4,
  qualityPassRate: 92,
  qualityFailed: 0,
  haccpPlans: 1,
  sheqOpen: 0,
  esgTotalKg: 12000,
  esgTargetsActive: 1,
  esgCertExpiring: 0,
  projectsActive: 2,
  projectsOpenRiads: 1,
  dmaicStuck: 0,
  mfOpenOrders: 1,
  shipmentsOpen: 2,
};

export default function SimulationLabPage() {
  return (
    <CompanyRequired>
      <LabInner />
    </CompanyRequired>
  );
}

function LabInner() {
  const { data, loading, error, reload } = useIntelligence();
  const base = data?.pulseModel || DEFAULT_PULSE;
  const usingLive = Boolean(data?.pulseModel);

  const [otifefDelta, setOtifefDelta] = useState(0);
  const [lowStockDelta, setLowStockDelta] = useState(0);
  const [arOpenDelta, setArOpenDelta] = useState(0);
  const [networkDelta, setNetworkDelta] = useState(0);
  const [winRateDelta, setWinRateDelta] = useState(0);
  const [pipelineMult, setPipelineMult] = useState(1);

  const sim = useMemo(
    () =>
      simulateHealth(base, {
        otifefDelta,
        lowStockDelta,
        arOpenDelta,
        networkDelta,
        winRateDelta,
        pipelineMult,
      }),
    [
      base,
      otifefDelta,
      lowStockDelta,
      arOpenDelta,
      networkDelta,
      winRateDelta,
      pipelineMult,
    ]
  );

  const baseHealth = useMemo(() => {
    return simulateHealth(base, {}).health;
  }, [base]);

  const reset = () => {
    setOtifefDelta(0);
    setLowStockDelta(0);
    setArOpenDelta(0);
    setNetworkDelta(0);
    setWinRateDelta(0);
    setPipelineMult(1);
  };

  if (loading && !data) {
    return (
      <IntelligencePage>
        <div className="py-28 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </IntelligencePage>
    );
  }

  return (
    <IntelligencePage>
      <IntelligenceHeader
        title="Simulation"
        titleAccent="lab"
        description="What-if levers on your live pulse (or a demo baseline). Adjust OTIFEF, stock, AR, network, and win rate — health scores and insights recompute instantly."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Reload base
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Live pulse unavailable ({error}). Running demo baseline so the lab still
          works.
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 text-xs text-neutral-500">
        <FlaskConical className="w-3.5 h-3.5" />
        Base:{' '}
        <strong className="text-slate-700">
          {usingLive ? 'Live company pulse' : 'Demo baseline'}
        </strong>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Panel title="Levers">
          <div className="p-5 space-y-5">
            <Lever
              label="OTIFEF delta"
              value={otifefDelta}
              min={-40}
              max={20}
              unit=" pts"
              onChange={setOtifefDelta}
            />
            <Lever
              label="Low-stock SKUs delta"
              value={lowStockDelta}
              min={-10}
              max={15}
              unit=""
              onChange={setLowStockDelta}
            />
            <Lever
              label="Open AR invoices delta"
              value={arOpenDelta}
              min={-10}
              max={15}
              unit=""
              onChange={setArOpenDelta}
            />
            <Lever
              label="Network connections delta"
              value={networkDelta}
              min={-5}
              max={10}
              unit=""
              onChange={setNetworkDelta}
            />
            <Lever
              label="Quote win-rate delta"
              value={winRateDelta}
              min={-30}
              max={40}
              unit=" pts"
              onChange={setWinRateDelta}
            />
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Pipeline multiplier</span>
                <span className="tabular-nums">{pipelineMult.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.1}
                value={pipelineMult}
                onChange={(e) => setPipelineMult(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Health impact">
          <div className="p-5 space-y-3">
            {(
              [
                ['Overall', baseHealth.overall, sim.health.overall],
                ['Network', baseHealth.network, sim.health.network],
                ['Supply', baseHealth.supply, sim.health.supply],
                ['Demand', baseHealth.demand, sim.health.demand],
                ['Finance', baseHealth.finance, sim.health.finance],
                ['Ops', baseHealth.ops, sim.health.ops],
              ] as const
            ).map(([label, before, after]) => {
              const delta = after - before;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>{label}</span>
                    <span className="tabular-nums">
                      {before} →{' '}
                      <span
                        className={
                          healthTone(after) === 'emerald'
                            ? 'text-emerald-700'
                            : healthTone(after) === 'amber'
                              ? 'text-amber-700'
                              : 'text-slate-900'
                        }
                      >
                        {after}
                      </span>
                      <span
                        className={`ml-1 ${
                          delta > 0
                            ? 'text-emerald-600'
                            : delta < 0
                              ? 'text-rose-600'
                              : 'text-neutral-400'
                        }`}
                      >
                        ({delta > 0 ? '+' : ''}
                        {delta})
                      </span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full bg-[#00b4d8] rounded-full transition-all"
                      style={{ width: `${Math.min(100, after)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Simulated insights (top signals)">
        <ul className="divide-y">
          {sim.insights.length === 0 ? (
            <li className="p-8 text-center text-sm text-neutral-500">
              No signals under this scenario.
            </li>
          ) : (
            sim.insights.map((ins) => (
              <li key={ins.id} className="px-5 py-3 flex justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-neutral-400">
                    {ins.domain} · {ins.severity}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {ins.title}
                  </div>
                  <div className="text-xs text-neutral-500">{ins.detail}</div>
                </div>
                <Link
                  href={ins.href}
                  className="text-xs font-semibold text-[#00b4d8] shrink-0"
                >
                  Act →
                </Link>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <p className="mt-4 text-xs text-neutral-500">
        Lab uses the same scoring engine as live scorecards. It does not write
        data — only models outcomes so leaders prioritise the right moves.
      </p>
    </IntelligencePage>
  );
}

function Lever({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span>{label}</span>
        <span className="tabular-nums">
          {value > 0 ? '+' : ''}
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
