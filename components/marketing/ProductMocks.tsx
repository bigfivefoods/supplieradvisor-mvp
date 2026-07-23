'use client';

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Browser-frame product mockups for landing — light Tesla-style product UI. */

/**
 * Fixed heights — every module frame / gallery card shares the same height
 * so rotation and grids never reflow the page.
 */
export const PRODUCT_MOCK_HEIGHT =
  'h-[280px] sm:h-[340px] lg:h-[400px] xl:h-[420px]';

/** Equal height for 2–3 scene cards in the Modules section. */
export const MODULE_GALLERY_HEIGHT =
  'h-[200px] sm:h-[220px] lg:h-[236px]';

function Frame({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_25px_60px_-20px_rgba(15,23,42,0.18)] sm:rounded-[1.75rem] ${className}`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-2.5 py-2 sm:px-4 sm:py-3">
        <div className="flex shrink-0 gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-300 sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-amber-300 sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-emerald-300 sm:h-2.5 sm:w-2.5" />
        </div>
        <div className="min-w-0 flex-1 sm:mx-2">
          <div className="flex h-6 items-center truncate rounded-full border border-slate-200 bg-white px-2 text-[9px] font-medium text-slate-400 sm:h-7 sm:px-3 sm:text-[11px]">
            app.supplieradvisor.com/{title}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-[#f8fafc] via-white to-sky-50/40 p-2.5 sm:p-4">
        {children}
      </div>
    </div>
  );
}

function Telemetry({
  label,
  value,
  tone = 'cyan',
}: {
  label: string;
  value: string;
  tone?: 'cyan' | 'emerald' | 'amber' | 'violet';
}) {
  const tones = {
    cyan: 'from-cyan-50 to-white border-cyan-100',
    emerald: 'from-emerald-50 to-white border-emerald-100',
    amber: 'from-amber-50 to-white border-amber-100',
    violet: 'from-violet-50 to-white border-violet-100',
  };
  return (
    <div className={`rounded-xl sm:rounded-2xl border bg-gradient-to-br ${tones[tone]} px-2.5 sm:px-3 py-2 sm:py-2.5`}>
      <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className="text-base sm:text-xl font-black tabular-nums text-slate-900 tracking-tight">
        {value}
      </div>
    </div>
  );
}

export function OpsMock() {
  return (
    <Frame title="dashboard/operations">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8]">
            Operations · Command
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            One chain. Zero blind spots.
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="Buy POs" value="12" tone="violet" />
        <Telemetry label="Inbound" value="4" tone="cyan" />
        <Telemetry label="WIP" value="7" tone="emerald" />
        <Telemetry label="Ship" value="9" tone="amber" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {['Procure', 'Warehouse', 'Fulfill'].map((t, i) => (
          <div
            key={t}
            className="rounded-xl border border-slate-100 bg-white p-2 sm:p-3 shadow-sm"
          >
            <div className="text-[9px] font-mono text-neutral-400 mb-1">0{i + 1}</div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-800">{t}</div>
            <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00b4d8]"
                style={{ width: `${55 + i * 15}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function CrmMock() {
  return (
    <Frame title="dashboard/customers">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Customers · Command
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">
        Customers you can grow.
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="Pipeline" value="R 2.4M" tone="emerald" />
        <Telemetry label="Leads" value="18" tone="amber" />
        <Telemetry label="Won" value="R 890k" tone="cyan" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
        {['Qualified', 'Proposal', 'Negotiation', 'Closed won'].map((stage, i) => (
          <div key={stage} className="flex items-center gap-2">
            <div className="text-[9px] font-bold text-slate-400 w-20 shrink-0">{stage}</div>
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-violet-400"
                style={{ width: `${85 - i * 18}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function SrmMock() {
  return (
    <Frame title="dashboard/suppliers">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Suppliers · Command
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">OTIFEF portfolio</div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="OTIFEF" value="96%" tone="emerald" />
        <Telemetry label="Connected" value="28" tone="cyan" />
        <Telemetry label="On time" value="98%" tone="violet" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white divide-y divide-slate-50">
        {[
          { n: 'Cape Harvest Co-op', s: '99.2%' },
          { n: 'Atlas Logistics SA', s: '97.1%' },
          { n: 'Kalahari Inputs', s: '95.8%' },
        ].map((r, i) => (
          <div key={r.n} className="flex items-center justify-between px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9px] font-black text-neutral-300 w-4">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-semibold text-slate-800 truncate">{r.n}</span>
            </div>
            <span className="font-black text-[#00b4d8] tabular-nums">{r.s}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function InventoryMock() {
  return (
    <Frame title="dashboard/inventory">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Inventory · Command
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">
        Every unit has a home.
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="On hand" value="48.2k" tone="cyan" />
        <Telemetry label="SKUs" value="312" tone="violet" />
        <Telemetry label="Sites" value="6" tone="emerald" />
        <Telemetry label="Low stock" value="3" tone="amber" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2">
          <span>Live transfers</span>
          <span className="text-emerald-600">2 en route</span>
        </div>
        <div className="h-16 sm:h-20 rounded-lg bg-gradient-to-br from-sky-50 to-cyan-50 border border-cyan-100 relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#00b4d8_1px,transparent_1px)] bg-[length:10px_10px]" />
          <div className="absolute left-[15%] top-[40%] w-2 h-2 rounded-full bg-[#00b4d8] shadow" />
          <div className="absolute left-[45%] top-[30%] w-2 h-2 rounded-full bg-emerald-500 shadow animate-pulse" />
          <div className="absolute right-[18%] top-[55%] w-2 h-2 rounded-full bg-amber-500 shadow" />
          <svg className="absolute inset-0 w-full h-full" aria-hidden>
            <path
              d="M40 40 Q 90 20 140 35 T 240 50"
              fill="none"
              stroke="#00b4d8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.6"
            />
          </svg>
        </div>
      </div>
    </Frame>
  );
}

export function ManufacturingMock() {
  return (
    <Frame title="dashboard/manufacturing">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Manufacturing · Command
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">
        Factory physics, not spreadsheets.
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="OEE" value="87%" tone="emerald" />
        <Telemetry label="WIP" value="14" tone="cyan" />
        <Telemetry label="Yield" value="99%" tone="violet" />
      </div>
      <div className="space-y-2">
        {[
          { l: 'Availability', v: 92, c: 'bg-emerald-500' },
          { l: 'Performance', v: 88, c: 'bg-[#00b4d8]' },
          { l: 'Quality', v: 97, c: 'bg-violet-500' },
        ].map((b) => (
          <div key={b.l} className="rounded-xl border border-slate-100 bg-white p-2.5">
            <div className="flex justify-between text-[10px] font-bold mb-1.5">
              <span className="text-slate-500">{b.l}</span>
              <span className="text-slate-800 tabular-nums">{b.v}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${b.c}`} style={{ width: `${b.v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function DistributionMock() {
  return (
    <Frame title="dashboard/distribution">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Distribution · Command
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">
        Every mile. Every handoff.
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="In motion" value="18" tone="emerald" />
        <Telemetry label="OTIF" value="97%" tone="cyan" />
        <Telemetry label="Exceptions" value="1" tone="amber" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
        {[
          { id: 'SHP-1042', mode: 'Ocean', st: 'In transit', t: 'emerald' },
          { id: 'SHP-1048', mode: 'Road', st: 'At dock', t: 'cyan' },
          { id: 'SHP-1051', mode: 'Air', st: 'Planned', t: 'violet' },
        ].map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between text-[11px] rounded-lg border border-slate-50 px-2.5 py-2"
          >
            <span className="font-mono font-bold text-slate-800">{s.id}</span>
            <span className="text-slate-500">{s.mode}</span>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                s.t === 'emerald'
                  ? 'bg-emerald-50 text-emerald-700'
                  : s.t === 'cyan'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-violet-50 text-violet-700'
              }`}
            >
              {s.st}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function IntelligenceMock() {
  return (
    <Frame title="dashboard/intelligence">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Intelligence · Command
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">Signal over noise.</div>
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-3">
        {[
          { l: 'Health', v: '86' },
          { l: 'Net', v: '91' },
          { l: 'Supply', v: '88' },
          { l: 'Demand', v: '79' },
          { l: 'Ops', v: '84' },
        ].map((h) => (
          <div
            key={h.l}
            className="rounded-xl border border-cyan-100 bg-gradient-to-b from-white to-sky-50 px-1 py-2 text-center"
          >
            <div className="text-[8px] font-bold uppercase text-neutral-400">{h.l}</div>
            <div className="text-sm sm:text-lg font-black text-slate-900 tabular-nums">{h.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
        {[
          { s: 'critical', t: 'AP overdue rising on 2 bills' },
          { s: 'warning', t: 'Supplier concentration 42% top 3' },
          { s: 'positive', t: 'OTIFEF improved +3.1 pts MTD' },
        ].map((i) => (
          <div key={i.t} className="flex items-start gap-2 text-[11px]">
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                i.s === 'critical'
                  ? 'bg-red-500'
                  : i.s === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
            />
            <span className="font-medium text-slate-700">{i.t}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function AccountingMock() {
  return (
    <Frame title="dashboard/accounting">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Accounting · Command
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">One ledger of truth.</div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="AR open" value="R 1.2M" tone="cyan" />
        <Telemetry label="AP open" value="R 640k" tone="amber" />
        <Telemetry label="Bank" value="R 3.1M" tone="emerald" />
        <Telemetry label="Posted" value="148" tone="violet" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <div className="text-[10px] font-bold text-slate-500 mb-2">P&L snapshot</div>
        <div className="flex items-end gap-1 h-16 sm:h-20">
          {[40, 55, 48, 70, 62, 78, 85].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-gradient-to-t from-[#0077b6] to-[#00b4d8] opacity-80"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function SheqMock() {
  return (
    <Frame title="dashboard/sheq">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-amber-700">
            SHEQ · Command
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Safety · Health · Environment · Quality
          </div>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">
          ISO 45001
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="Incidents" value="2 open" tone="amber" />
        <Telemetry label="NCRs" value="5" tone="violet" />
        <Telemetry label="CAPAs" value="3" tone="cyan" />
        <Telemetry label="QA holds" value="1 lot" tone="emerald" />
      </div>
      <div className="space-y-1.5">
        {[
          { t: 'Near-miss · cold store', s: 'Investigating', c: 'bg-amber-100 text-amber-800' },
          { t: 'NCR · lot L-2041 fail', s: 'CAPA linked', c: 'bg-violet-100 text-violet-800' },
          { t: 'Hazard · forklift zone', s: 'Score 12', c: 'bg-rose-100 text-rose-800' },
        ].map((r) => (
          <div
            key={r.t}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2"
          >
            <span className="text-[11px] font-semibold text-slate-800 truncate">{r.t}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${r.c}`}>
              {r.s}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function QualityMock() {
  return (
    <Frame title="dashboard/quality">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Quality · Food safety
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">
        Inspect · hold · trace · recall.
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="Open QA" value="4" tone="amber" />
        <Telemetry label="Passed" value="128" tone="emerald" />
        <Telemetry label="Lots" value="86" tone="cyan" />
        <Telemetry label="CCPs" value="12" tone="violet" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <div className="text-[10px] font-bold text-slate-500 mb-2">Traceability graph</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {['SKU', 'Lot L-88', 'WH-CPT', 'Ship #41', 'HACCP'].map((n, i) => (
            <span key={n} className="inline-flex items-center gap-1">
              <span className="rounded-lg border border-cyan-100 bg-sky-50 px-2 py-1 font-bold text-slate-800">
                {n}
              </span>
              {i < 4 && <span className="text-slate-300">→</span>}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-emerald-700 font-semibold">
          Ship blocked on open hold · audit pack ready
        </div>
      </div>
    </Frame>
  );
}

export function ContainersMock() {
  return (
    <Frame title="dashboard/containers">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">
            Containers · Command
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Outlet network. Jobs & meals.
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
          Live map
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="Outlets" value="24" tone="emerald" />
        <Telemetry label="Resellers" value="18" tone="cyan" />
        <Telemetry label="Jobs" value="96" tone="violet" />
        <Telemetry label="Fed /mo" value="12k" tone="amber" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-2.5 space-y-1.5">
        {[
          { n: 'CPT-07 Woodstock', s: 'Stock OK', t: 'emerald' },
          { n: 'JHB-12 Alexandra', s: 'Reorder', t: 'amber' },
          { n: 'DBN-03 Umlazi', s: 'Impact ↑', t: 'cyan' },
        ].map((r) => (
          <div
            key={r.n}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-50 px-2 py-1.5 text-[11px]"
          >
            <span className="font-semibold text-slate-800 truncate">{r.n}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                r.t === 'emerald'
                  ? 'bg-emerald-50 text-emerald-700'
                  : r.t === 'amber'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-sky-50 text-sky-700'
              }`}
            >
              {r.s}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function NetworkMock() {
  return (
    <Frame title="dashboard/connections">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Network · Graph
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">
        Verified trading edges.
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="Connected" value="42" tone="cyan" />
        <Telemetry label="Pending" value="6" tone="amber" />
        <Telemetry label="Trust avg" value="78" tone="emerald" />
      </div>
      <div className="relative h-[7.5rem] rounded-xl border border-slate-100 bg-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(0,180,216,0.12),transparent_55%)]" />
        <svg viewBox="0 0 280 120" className="absolute inset-0 h-full w-full" aria-hidden>
          <line x1="40" y1="60" x2="120" y2="30" stroke="#bae6fd" strokeWidth="2" />
          <line x1="40" y1="60" x2="130" y2="90" stroke="#bae6fd" strokeWidth="2" />
          <line x1="120" y1="30" x2="220" y2="50" stroke="#c4b5fd" strokeWidth="2" />
          <line x1="130" y1="90" x2="220" y2="50" stroke="#a7f3d0" strokeWidth="2" />
          <circle cx="40" cy="60" r="14" fill="#e0f2fe" stroke="#00b4d8" strokeWidth="2" />
          <circle cx="120" cy="30" r="11" fill="#f5f3ff" stroke="#8b5cf6" strokeWidth="2" />
          <circle cx="130" cy="90" r="11" fill="#ecfdf5" stroke="#10b981" strokeWidth="2" />
          <circle cx="220" cy="50" r="13" fill="#fff7ed" stroke="#f59e0b" strokeWidth="2" />
        </svg>
        <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-bold text-slate-500">
          <span>You</span>
          <span>Suppliers · Buyers · Outlets</span>
        </div>
      </div>
    </Frame>
  );
}

export function ProjectsMock() {
  return (
    <Frame title="dashboard/projects">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00b4d8] mb-1">
        Projects · Portfolio
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 mb-3">
        Gates, boards, delivery.
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="Active" value="9" tone="cyan" />
        <Telemetry label="At risk" value="2" tone="amber" />
        <Telemetry label="On time" value="87%" tone="emerald" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {[
          {
            col: 'To do',
            items: ['Spec freeze', 'Vendor RFQ'],
          },
          {
            col: 'Doing',
            items: ['BOM rev B', 'Pilot site'],
          },
          {
            col: 'Done',
            items: ['Kickoff', 'Risk log'],
          },
        ].map((c) => (
          <div
            key={c.col}
            className="rounded-xl border border-slate-100 bg-white p-2 space-y-1.5"
          >
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              {c.col}
            </div>
            {c.items.map((it) => (
              <div
                key={it}
                className="rounded-lg border border-slate-50 bg-slate-50/80 px-1.5 py-1 text-[10px] font-semibold text-slate-700"
              >
                {it}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function SustainabilityMock() {
  return (
    <Frame title="dashboard/sustainability">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">
            Impact · ESG
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Carbon you can act on.
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
          Scope 1–3
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
        <Telemetry label="tCO₂e MTD" value="42.6" tone="emerald" />
        <Telemetry label="vs plan" value="-8%" tone="cyan" />
        <Telemetry label="Packs" value="3" tone="violet" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <div className="text-[10px] font-bold text-slate-500 mb-2">Emissions mix</div>
        <div className="flex h-3 overflow-hidden rounded-full">
          <div className="bg-emerald-500 w-[38%]" title="Scope 1" />
          <div className="bg-cyan-400 w-[27%]" title="Scope 2" />
          <div className="bg-violet-400 w-[35%]" title="Scope 3" />
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-semibold text-slate-500">
          <span>S1 38%</span>
          <span>S2 27%</span>
          <span>S3 35%</span>
        </div>
      </div>
    </Frame>
  );
}

export type ModuleDef = {
  id: string;
  code: string;
  title: string;
  tagline: string;
  body: string;
  bullets: string[];
  Mock: React.ComponentType;
  icon: LucideIcon;
  accent: string;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Module galleries — 3 equal-height scene cards per module (Modules section)
 * Beautiful, product-real previews that make operators want to join.
 * ═══════════════════════════════════════════════════════════════════════════ */

type GalleryScene = {
  eyebrow: string;
  title: string;
  caption?: string;
  /** Background gradient accent */
  wash?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky';
  metrics?: Array<{ label: string; value: string }>;
  kind: 'bars' | 'list' | 'map' | 'pipeline' | 'ring' | 'tiles' | 'wave' | 'board';
  bars?: number[];
  list?: Array<{ left: string; right: string; tone?: string }>;
  tiles?: string[];
  stages?: string[];
};

const WASH: Record<NonNullable<GalleryScene['wash']>, string> = {
  cyan: 'from-cyan-50 via-white to-sky-100/80',
  emerald: 'from-emerald-50 via-white to-teal-50/90',
  violet: 'from-violet-50 via-white to-fuchsia-50/70',
  amber: 'from-amber-50 via-white to-orange-50/80',
  rose: 'from-rose-50 via-white to-pink-50/70',
  sky: 'from-sky-50 via-white to-cyan-50/90',
};

const MODULE_GALLERIES: Record<string, GalleryScene[]> = {
  ops: [
    {
      eyebrow: 'Control tower',
      title: 'Exceptions first',
      wash: 'cyan',
      kind: 'tiles',
      tiles: ['Procure', 'Receive', 'Make', 'Ship'],
      metrics: [
        { label: 'Open POs', value: '12' },
        { label: 'Exceptions', value: '3' },
      ],
    },
    {
      eyebrow: 'Throughput',
      title: 'Live flow by stage',
      wash: 'sky',
      kind: 'bars',
      bars: [42, 68, 55, 80, 72, 90, 88],
      caption: 'Inbound · WIP · Outbound MTD',
    },
    {
      eyebrow: 'Workboard',
      title: 'What moves next',
      wash: 'violet',
      kind: 'list',
      list: [
        { left: 'PO-1842 receive', right: 'Dock 2', tone: 'amber' },
        { left: 'WO-991 release', right: 'Cell A', tone: 'cyan' },
        { left: 'SO-441 pick', right: 'Ready', tone: 'emerald' },
      ],
    },
  ],
  srm: [
    {
      eyebrow: 'OTIFEF',
      title: 'Trust you can measure',
      wash: 'emerald',
      kind: 'ring',
      metrics: [
        { label: 'OTIFEF', value: '96%' },
        { label: 'On time', value: '98%' },
      ],
      caption: 'After every delivery',
    },
    {
      eyebrow: 'Supplier book',
      title: 'Verified partners',
      wash: 'cyan',
      kind: 'list',
      list: [
        { left: 'Cape Harvest Co-op', right: '99.2%', tone: 'emerald' },
        { left: 'Atlas Logistics SA', right: '97.1%', tone: 'cyan' },
        { left: 'Kalahari Inputs', right: '95.8%', tone: 'violet' },
      ],
    },
    {
      eyebrow: 'Raise PO',
      title: 'Escrow or standard',
      wash: 'violet',
      kind: 'pipeline',
      stages: ['Draft', 'Sent', 'Accept', 'Deliver', 'Rate'],
      caption: 'Optional on-chain escrow',
    },
  ],
  crm: [
    {
      eyebrow: 'Pipeline',
      title: 'R 2.4M weighted',
      wash: 'emerald',
      kind: 'bars',
      bars: [30, 48, 55, 70, 62, 85, 92],
      caption: 'Lead → opportunity → won',
    },
    {
      eyebrow: 'Stages',
      title: 'Deal velocity',
      wash: 'cyan',
      kind: 'pipeline',
      stages: ['Lead', 'Qualify', 'Quote', 'Negotiate', 'Won'],
    },
    {
      eyebrow: 'Revenue desk',
      title: 'Quotes · orders · AR',
      wash: 'violet',
      kind: 'list',
      list: [
        { left: 'Q-2041 · Metro Fresh', right: 'R 180k', tone: 'cyan' },
        { left: 'SO-991 · AfriRetail', right: 'Invoiced', tone: 'emerald' },
        { left: 'INV-552 overdue', right: '7d', tone: 'amber' },
      ],
    },
  ],
  ctr: [
    {
      eyebrow: 'Outlet network',
      title: 'Jobs & meals live',
      wash: 'emerald',
      kind: 'map',
      metrics: [
        { label: 'Outlets', value: '24' },
        { label: 'Fed /mo', value: '12k' },
      ],
    },
    {
      eyebrow: 'Last mile',
      title: 'Stock that feeds people',
      wash: 'amber',
      kind: 'list',
      list: [
        { left: 'CPT-07 Woodstock', right: 'OK', tone: 'emerald' },
        { left: 'JHB-12 Alexandra', right: 'Reorder', tone: 'amber' },
        { left: 'DBN-03 Umlazi', right: 'Impact ↑', tone: 'cyan' },
      ],
    },
    {
      eyebrow: 'Deploy model',
      title: 'Feasibility before steel',
      wash: 'sky',
      kind: 'tiles',
      tiles: ['Site', 'Demand', 'Capex', 'Impact'],
      caption: 'Contractors · resellers · inventory',
    },
  ],
  inv: [
    {
      eyebrow: 'Stock truth',
      title: 'Every unit has a home',
      wash: 'cyan',
      kind: 'wave',
      metrics: [
        { label: 'On hand', value: '48.2k' },
        { label: 'SKUs', value: '312' },
        { label: 'Sites', value: '6' },
      ],
    },
    {
      eyebrow: 'Transfers',
      title: 'GPS en route',
      wash: 'sky',
      kind: 'map',
      caption: 'QR receive · multi-site',
    },
    {
      eyebrow: 'Pedigree',
      title: 'Lots · serials · passports',
      wash: 'violet',
      kind: 'pipeline',
      stages: ['SKU', 'Lot', 'WH', 'Ship', 'QA'],
    },
  ],
  mfg: [
    {
      eyebrow: 'OEE',
      title: 'Factory physics',
      wash: 'emerald',
      kind: 'ring',
      metrics: [
        { label: 'OEE', value: '87%' },
        { label: 'Yield', value: '99%' },
      ],
    },
    {
      eyebrow: 'Cells',
      title: 'Availability · Performance · Quality',
      wash: 'cyan',
      kind: 'bars',
      bars: [92, 88, 97, 85, 90, 94, 91],
    },
    {
      eyebrow: 'Execution',
      title: 'Work orders live',
      wash: 'violet',
      kind: 'list',
      list: [
        { left: 'WO-441 · Line 2', right: 'Running', tone: 'emerald' },
        { left: 'WO-442 · Pack', right: 'Queued', tone: 'amber' },
        { left: 'MPS week 28', right: 'Locked', tone: 'cyan' },
      ],
    },
  ],
  dst: [
    {
      eyebrow: 'In motion',
      title: 'Every mile tracked',
      wash: 'cyan',
      kind: 'map',
      metrics: [
        { label: 'Shipments', value: '18' },
        { label: 'OTIF', value: '97%' },
      ],
    },
    {
      eyebrow: 'Modes',
      title: 'Road · ocean · air',
      wash: 'sky',
      kind: 'list',
      list: [
        { left: 'SHP-1042 Ocean', right: 'In transit', tone: 'emerald' },
        { left: 'SHP-1048 Road', right: 'At dock', tone: 'cyan' },
        { left: 'SHP-1051 Air', right: 'Planned', tone: 'violet' },
      ],
    },
    {
      eyebrow: 'Fleet',
      title: 'Carriers & drivers',
      wash: 'amber',
      kind: 'tiles',
      tiles: ['Fleet', 'Driver', 'Incoterms', 'Events'],
    },
  ],
  net: [
    {
      eyebrow: 'Graph',
      title: 'Verified trading edges',
      wash: 'violet',
      kind: 'map',
      metrics: [
        { label: 'Connected', value: '42' },
        { label: 'Trust', value: '78' },
      ],
    },
    {
      eyebrow: 'Marketplace',
      title: 'Reach beyond the book',
      wash: 'cyan',
      kind: 'bars',
      bars: [20, 35, 48, 60, 72, 80, 95],
      caption: 'Listings · views · RFQs',
    },
    {
      eyebrow: 'Invites',
      title: 'Grow the network',
      wash: 'emerald',
      kind: 'pipeline',
      stages: ['Invite', 'Accept', 'Connect', 'Price', 'Trade'],
    },
  ],
  sheq: [
    {
      eyebrow: 'ISO 45001',
      title: 'Safety on the tower',
      wash: 'amber',
      kind: 'ring',
      metrics: [
        { label: 'Open', value: '2' },
        { label: 'CAPAs', value: '3' },
      ],
    },
    {
      eyebrow: 'HIRARC',
      title: 'Hazards scored live',
      wash: 'rose',
      kind: 'list',
      list: [
        { left: 'Cold store near-miss', right: 'Open', tone: 'amber' },
        { left: 'Lot L-2041 NCR', right: 'CAPA', tone: 'violet' },
        { left: 'Forklift zone', right: '12', tone: 'rose' },
      ],
    },
    {
      eyebrow: 'Loop',
      title: 'Incident → CAPA → close',
      wash: 'violet',
      kind: 'pipeline',
      stages: ['Report', 'Investigate', 'NCR', 'CAPA', 'Close'],
    },
  ],
  qa: [
    {
      eyebrow: 'Release gates',
      title: 'Hold blocks ship',
      wash: 'emerald',
      kind: 'ring',
      metrics: [
        { label: 'Passed', value: '128' },
        { label: 'Holds', value: '1' },
      ],
    },
    {
      eyebrow: 'HACCP',
      title: 'CCPs monitored',
      wash: 'cyan',
      kind: 'bars',
      bars: [88, 92, 90, 95, 93, 97, 96],
      caption: '12 critical control points',
    },
    {
      eyebrow: 'Trace',
      title: 'SKU → lot → ship → recall',
      wash: 'sky',
      kind: 'pipeline',
      stages: ['SKU', 'Lot', 'WH', 'QA', 'Ship'],
    },
  ],
  fin: [
    {
      eyebrow: 'Ledger',
      title: 'One truth for money',
      wash: 'cyan',
      kind: 'bars',
      bars: [40, 55, 48, 70, 62, 78, 85],
      caption: 'P&L snapshot · 7 periods',
    },
    {
      eyebrow: 'Working capital',
      title: 'AR · AP · bank',
      wash: 'emerald',
      kind: 'tiles',
      tiles: ['AR R1.2M', 'AP R640k', 'Bank R3.1M', 'JE 148'],
    },
    {
      eyebrow: 'Balance sheet',
      title: 'Assets & liabilities allocated',
      wash: 'violet',
      kind: 'list',
      list: [
        { left: 'PPE capitalised', right: 'On BS', tone: 'emerald' },
        { left: 'Inventory 1140', right: 'Live', tone: 'cyan' },
        { left: 'AP 2110', right: 'Matched', tone: 'violet' },
      ],
    },
  ],
  prj: [
    {
      eyebrow: 'Portfolio',
      title: 'Work that ships',
      wash: 'cyan',
      kind: 'ring',
      metrics: [
        { label: 'Active', value: '9' },
        { label: 'On time', value: '87%' },
      ],
    },
    {
      eyebrow: 'Board',
      title: 'Kanban discipline',
      wash: 'violet',
      kind: 'board',
      tiles: ['To do', 'Doing', 'Done'],
      list: [
        { left: 'Spec freeze', right: 'To do' },
        { left: 'BOM rev B', right: 'Doing' },
        { left: 'Kickoff', right: 'Done' },
      ],
    },
    {
      eyebrow: 'Gates',
      title: 'Milestones & risk',
      wash: 'amber',
      kind: 'pipeline',
      stages: ['Init', 'Plan', 'Build', 'Gate', 'Close'],
    },
  ],
  esg: [
    {
      eyebrow: 'Carbon',
      title: 'tCO₂e you can act on',
      wash: 'emerald',
      kind: 'ring',
      metrics: [
        { label: 'MTD', value: '42.6' },
        { label: 'vs plan', value: '-8%' },
      ],
    },
    {
      eyebrow: 'Scopes',
      title: '1 · 2 · 3 mix',
      wash: 'sky',
      kind: 'bars',
      bars: [38, 27, 35, 40, 32, 30, 28],
      caption: 'Tied to inventory & logistics',
    },
    {
      eyebrow: 'Packs',
      title: 'ESG reports ready',
      wash: 'violet',
      kind: 'tiles',
      tiles: ['Scope 1', 'Scope 2', 'Scope 3', 'Export'],
    },
  ],
  bi: [
    {
      eyebrow: 'Pulse',
      title: 'Enterprise health 86',
      wash: 'cyan',
      kind: 'bars',
      bars: [86, 91, 88, 79, 84, 90, 87],
      caption: 'Net · supply · demand · ops',
    },
    {
      eyebrow: 'Signals',
      title: 'What needs you now',
      wash: 'amber',
      kind: 'list',
      list: [
        { left: 'AP overdue rising', right: 'Crit', tone: 'rose' },
        { left: 'Supplier concentration', right: 'Warn', tone: 'amber' },
        { left: 'OTIFEF +3.1 pts', right: 'Good', tone: 'emerald' },
      ],
    },
    {
      eyebrow: 'SAM + Super-Cube®',
      title: 'Leaders who learn in-app',
      wash: 'violet',
      kind: 'tiles',
      tiles: ['Ask SAM', 'Forecast', 'Cube', 'Guide'],
    },
  ],
};

function GalleryCard({ scene }: { scene: GalleryScene }) {
  const wash = WASH[scene.wash || 'cyan'];
  const waveId = useId().replace(/:/g, '');
  return (
    <div
      className={`group relative flex ${MODULE_GALLERY_HEIGHT} w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br ${wash} shadow-[0_18px_40px_-18px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#00b4d8]/45 hover:shadow-[0_24px_50px_-16px_rgba(0,180,216,0.28)]`}
    >
      {/* Decorative orbs */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#00b4d8]/10 blur-2xl transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-violet-300/15 blur-2xl"
        aria-hidden
      />

      <div className="relative flex min-h-0 flex-1 flex-col p-3.5 sm:p-4">
        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#00b4d8]">
          {scene.eyebrow}
        </div>
        <div className="text-[13px] font-black leading-snug tracking-tight text-slate-900 sm:text-sm">
          {scene.title}
        </div>

        {scene.metrics && scene.metrics.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {scene.metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-white/80 bg-white/80 px-2 py-1 shadow-sm backdrop-blur-sm"
              >
                <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  {m.label}
                </div>
                <div className="text-sm font-black tabular-nums tracking-tight text-slate-900">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto min-h-0 pt-2">
          {scene.kind === 'bars' && scene.bars && (
            <div className="flex h-14 items-end gap-1 sm:h-16">
              {scene.bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-[#0077b6] to-[#00b4d8] opacity-85 transition-opacity group-hover:opacity-100"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          )}

          {scene.kind === 'wave' && (
            <div className="relative h-14 overflow-hidden rounded-xl border border-cyan-100/80 bg-white/60 sm:h-16">
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#00b4d8_1px,transparent_1px)] bg-[length:8px_8px]" />
              <svg
                className="absolute inset-x-0 bottom-0 h-10 w-full"
                viewBox="0 0 200 40"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M0 28 Q 25 8 50 22 T 100 18 T 150 24 T 200 12 V40 H0Z"
                  fill={`url(#${waveId})`}
                  opacity="0.55"
                />
                <defs>
                  <linearGradient id={waveId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00b4d8" />
                    <stop offset="100%" stopColor="#00b4d8" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}

          {scene.kind === 'list' && scene.list && (
            <div className="space-y-1">
              {scene.list.slice(0, 3).map((row) => (
                <div
                  key={row.left}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/70 bg-white/75 px-2 py-1 text-[10px] shadow-sm backdrop-blur-sm"
                >
                  <span className="truncate font-semibold text-slate-800">
                    {row.left}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                      row.tone === 'emerald'
                        ? 'bg-emerald-50 text-emerald-700'
                        : row.tone === 'amber'
                          ? 'bg-amber-50 text-amber-800'
                          : row.tone === 'violet'
                            ? 'bg-violet-50 text-violet-700'
                            : row.tone === 'rose'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-sky-50 text-sky-700'
                    }`}
                  >
                    {row.right}
                  </span>
                </div>
              ))}
            </div>
          )}

          {scene.kind === 'map' && (
            <div className="relative h-14 overflow-hidden rounded-xl border border-slate-100/80 bg-white/70 sm:h-16">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(0,180,216,0.16),transparent_55%)]" />
              <svg
                viewBox="0 0 200 64"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                <line x1="30" y1="32" x2="90" y2="18" stroke="#bae6fd" strokeWidth="2" />
                <line x1="30" y1="32" x2="100" y2="48" stroke="#c4b5fd" strokeWidth="2" />
                <line x1="90" y1="18" x2="160" y2="28" stroke="#a7f3d0" strokeWidth="2" />
                <circle cx="30" cy="32" r="7" fill="#e0f2fe" stroke="#00b4d8" strokeWidth="2" />
                <circle cx="90" cy="18" r="6" fill="#f5f3ff" stroke="#8b5cf6" strokeWidth="2" />
                <circle cx="100" cy="48" r="6" fill="#ecfdf5" stroke="#10b981" strokeWidth="2" />
                <circle
                  cx="160"
                  cy="28"
                  r="7"
                  fill="#fff7ed"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  className="animate-pulse"
                />
              </svg>
            </div>
          )}

          {scene.kind === 'pipeline' && scene.stages && (
            <div className="flex flex-wrap items-center gap-1">
              {scene.stages.map((s, i) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span className="rounded-lg border border-cyan-100/90 bg-white/85 px-1.5 py-0.5 text-[9px] font-bold text-slate-800 shadow-sm">
                    {s}
                  </span>
                  {i < scene.stages!.length - 1 && (
                    <span className="text-[9px] text-slate-300">→</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {scene.kind === 'ring' && (
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#00b4d8"
                    strokeWidth="3.5"
                    strokeDasharray="70 88"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-900">
                  {scene.metrics?.[0]?.value || '—'}
                </div>
              </div>
              {scene.caption && (
                <p className="text-[10px] font-medium leading-snug text-slate-500">
                  {scene.caption}
                </p>
              )}
            </div>
          )}

          {scene.kind === 'tiles' && scene.tiles && (
            <div className="grid grid-cols-2 gap-1">
              {scene.tiles.slice(0, 4).map((t) => (
                <div
                  key={t}
                  className="rounded-lg border border-white/80 bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold text-slate-800 shadow-sm backdrop-blur-sm"
                >
                  {t}
                </div>
              ))}
            </div>
          )}

          {scene.kind === 'board' && (
            <div className="grid grid-cols-3 gap-1">
              {(scene.tiles || ['To do', 'Doing', 'Done']).map((col) => (
                <div
                  key={col}
                  className="rounded-lg border border-white/80 bg-white/75 p-1.5 shadow-sm"
                >
                  <div className="mb-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                    {col}
                  </div>
                  <div className="h-6 rounded bg-slate-100/90" />
                  <div className="mt-1 h-6 rounded bg-slate-50" />
                </div>
              ))}
            </div>
          )}

          {scene.caption &&
            scene.kind !== 'ring' &&
            scene.kind !== 'bars' && (
              <p className="mt-1.5 text-[9px] font-medium text-slate-500">
                {scene.caption}
              </p>
            )}
          {scene.caption && scene.kind === 'bars' && (
            <p className="mt-1 text-[9px] font-medium text-slate-500">
              {scene.caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Three equal-height preview images for a module — used in Modules section.
 */
export function ModuleGallery({
  moduleId,
  className = '',
}: {
  moduleId: string;
  className?: string;
}) {
  const scenes = MODULE_GALLERIES[moduleId] || MODULE_GALLERIES.ops;
  return (
    <div
      className={`grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3.5 ${className}`}
    >
      {scenes.slice(0, 3).map((scene) => (
        <GalleryCard key={`${moduleId}-${scene.eyebrow}-${scene.title}`} scene={scene} />
      ))}
    </div>
  );
}

/** Hero / featured shell — fixed height wrapper for rotating mocks */
export function ProductMockShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT} ${className}`}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
