'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  FileText,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  Ship,
  Truck,
  Users,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  DistributionHeader,
  DistributionPage,
  SchemaHint,
  TelemetryCard,
} from '@/components/distribution/DistributionShell';
import {
  OperatingPrinciples,
} from '@/components/relationship/RelationshipChrome';

type Summary = {
  shipments: number;
  inbound: number;
  outbound: number;
  inMotion: number;
  planned: number;
  exceptions: number;
  delivered: number;
  carriers: number;
  carriersActive: number;
  vehicles: number;
  vehiclesAvailable: number;
  drivers: number;
  driversAvailable: number;
  inventoryTransfersLive: number;
  otifPct: number;
  modeMix: Record<string, number>;
};

const MODULES = [
  {
    href: '/dashboard/distribution/inbound',
    icon: ArrowDownToLine,
    code: 'INB',
    title: 'Inbound logistics',
    desc: 'Supplier → plant → DC. ASN-style visibility from pickup to goods receipt.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/distribution/outbound',
    icon: ArrowUpFromLine,
    code: 'OUT',
    title: 'Outbound logistics',
    desc: 'Factory → customer. Local last-mile to global ocean and air lanes.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/distribution/tracking',
    icon: MapPin,
    code: 'TRK',
    title: 'Live tracking',
    desc: 'Control-tower view of every leg — events, ETAs, exceptions, POD.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/distribution/carriers',
    icon: Truck,
    code: '3PL',
    title: 'Carriers',
    desc: 'Partner network — road, ocean, air. Performance and coverage.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/distribution/fleet-drivers',
    icon: Users,
    code: 'FLT',
    title: 'Fleet & drivers',
    desc: 'Own assets and people. Capacity, availability, assignment.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/distribution/incoterms',
    icon: FileText,
    code: 'ICC',
    title: 'Incoterms® 2020',
    desc: 'Who owns risk and cost at every mile. Set company defaults.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
] as const;

export default function DistributionCommand() {
  return (
    <CompanyRequired>
      <CommandInner />
    </CompanyRequired>
  );
}

function CommandInner() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/distribution/summary?companyId=${companyId}`);
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
    <DistributionPage>
      <DistributionHeader
        title="Distribution"
        titleAccent="Command"
        description="Local to global logistics — inbound supply, outbound fulfilment, fleet, carriers, and full chain tracking. Light, precise, always visible."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <SchemaHint message={warning} />

      {/* Light hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50 p-6 sm:p-8 mb-8 shadow-sm">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#00b4d8]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/3 bottom-0 h-32 w-32 rounded-full bg-violet-200/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-4 shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Control tower · live chain
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
              Every mile. Every handoff.
              <span className="block text-[#00b4d8]">Door to destination.</span>
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Track inbound raw materials and outbound finished goods across road, rail, ocean, and
              air — with Incoterms clarity, carrier OTIF, and event-level supply chain visibility.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white border border-cyan-100 px-3 py-3 text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                In motion
              </div>
              <div className="text-2xl font-black tabular-nums text-emerald-600">
                {loading ? '—' : s?.inMotion ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-cyan-100 px-3 py-3 text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                OTIF
              </div>
              <div className="text-2xl font-black tabular-nums text-[#00b4d8]">
                {loading ? '—' : `${s?.otifPct ?? 100}%`}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-cyan-100 px-3 py-3 text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Exceptions
              </div>
              <div className="text-2xl font-black tabular-nums text-amber-600">
                {loading ? '—' : s?.exceptions ?? 0}
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
              label="Inbound"
              value={s?.inbound ?? 0}
              sub="supplier → you"
              accent="sky"
              icon={ArrowDownToLine}
            />
            <TelemetryCard
              label="Outbound"
              value={s?.outbound ?? 0}
              sub="you → customer"
              accent="cyan"
              icon={ArrowUpFromLine}
            />
            <TelemetryCard
              label="Carriers"
              value={`${s?.carriersActive ?? 0}/${s?.carriers ?? 0}`}
              sub="active partners"
              accent="violet"
              icon={Truck}
            />
            <TelemetryCard
              label="Fleet ready"
              value={`${s?.vehiclesAvailable ?? 0}/${s?.vehicles ?? 0}`}
              sub={`${s?.driversAvailable ?? 0} drivers free`}
              accent="amber"
              icon={Users}
            />
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
                    <div className="w-11 h-11 rounded-2xl bg-white border border-cyan-50 flex items-center justify-center shadow-sm text-[#0077b6]">
                      <Icon className="w-5 h-5" />
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
                    Open{' '}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Globe2 className="w-4 h-4 text-[#00b4d8]" />
                <h3 className="text-sm font-black text-slate-800">Mode mix</h3>
              </div>
              {s?.modeMix && Object.keys(s.modeMix).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(s.modeMix).map(([mode, n]) => (
                    <div key={mode} className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase text-neutral-500 w-20">
                        {mode}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#00b4d8]"
                          style={{
                            width: `${Math.min(100, (n / Math.max(1, s.shipments)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-black tabular-nums text-slate-700 w-6 text-right">
                        {n}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No shipments yet — mode mix appears here.</p>
              )}
            </div>
            <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-sky-50/80 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Ship className="w-4 h-4 text-[#00b4d8]" />
                <h3 className="text-sm font-black text-slate-800">Inventory bridge</h3>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed mb-3">
                Stock transfers with driver GPS live under Inventory. Distribution shipments add
                multi-carrier, multi-mode, Incoterms, and event history for the wider chain.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/inventory/stock-transfers"
                  className="text-xs font-bold text-[#00b4d8] hover:underline"
                >
                  Open stock transfers →
                </Link>
                <span className="text-xs text-neutral-400">
                  {s?.inventoryTransfersLive ?? 0} live warehouse moves
                </span>
              </div>
            </div>
          </div>

          <OperatingPrinciples
            items={[
              {
                title: 'Local to global, one chain',
                body: 'Road, rail, ocean, and air share the same status spine — door to destination, not siloed modes.',
              },
              {
                title: 'Events beat estimates',
                body: 'Every handoff is logged. Tracking is evidence of movement, not a best-guess ETA alone.',
              },
              {
                title: 'Incoterms assign risk',
                body: 'Who pays and who owns risk is explicit on every lane — commercial clarity before the truck moves.',
              },
            ]}
          />
        </>
      )}
    </DistributionPage>
  );
}
