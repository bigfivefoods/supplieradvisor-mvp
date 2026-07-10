'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  ClipboardCheck,
  Factory,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Warehouse,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  OperationsHeader,
  OperationsPage,
  StatusPill,
  TelemetryCard,
} from '@/components/operations/OperationsShell';
import {
  OperatingPrinciples,
} from '@/components/relationship/RelationshipChrome';

type Summary = {
  supplierPos: number;
  supplierPosOpen: number;
  suppliers: number;
  inboundShipments: number;
  inboundInMotion: number;
  warehouses: number;
  products: number;
  rawMaterials: number;
  finishedGoods: number;
  unitsOnHand: number;
  skusWithStock: number;
  transfersLive: number;
  workOrders: number;
  workOrdersInFlight: number;
  workOrdersHold: number;
  bomsActive: number;
  workCells: number;
  outboundShipments: number;
  outboundInMotion: number;
  carriersActive: number;
  customerPos: number;
  customerPosOpen: number;
  customers: number;
  containers: number;
  qualityOpen: number;
  exceptions: number;
  shipmentsInMotion: number;
  throughput: number;
  recent: { id: string; domain: string; title: string; status: string; href: string }[];
};

const MODULES = [
  {
    href: '/dashboard/operations/supplier-orders',
    icon: Truck,
    code: '01',
    title: 'Supplier orders',
    desc: 'Raise and track purchase orders. Feed inbound and MRP with real demand.',
    accent: 'from-violet-50 to-white border-violet-100',
    metricKey: 'supplierPosOpen' as const,
    metricLabel: 'open POs',
  },
  {
    href: '/dashboard/operations/inbound',
    icon: ArrowDownToLine,
    code: '02',
    title: 'Inbound',
    desc: 'ASN to dock — inbound shipments, receipts, and put-away readiness.',
    accent: 'from-sky-50 to-white border-sky-100',
    metricKey: 'inboundInMotion' as const,
    metricLabel: 'in motion',
  },
  {
    href: '/dashboard/operations/warehouse',
    icon: Warehouse,
    code: '03',
    title: 'Warehouse & inventory',
    desc: 'Stock, locations, transfers, receive, counts — the physical buffer.',
    accent: 'from-cyan-50 to-white border-cyan-100',
    metricKey: 'unitsOnHand' as const,
    metricLabel: 'units on hand',
  },
  {
    href: '/dashboard/operations/production',
    icon: Factory,
    code: '04',
    title: 'Production',
    desc: 'Work orders, BOMs, cells, MPS/MRP — convert materials into finished goods.',
    accent: 'from-emerald-50 to-white border-emerald-100',
    metricKey: 'workOrdersInFlight' as const,
    metricLabel: 'WOs live',
  },
  {
    href: '/dashboard/operations/outbound',
    icon: ArrowUpFromLine,
    code: '05',
    title: 'Outbound',
    desc: 'Pick, pack, ship — local last-mile to global ocean and air lanes.',
    accent: 'from-amber-50 to-white border-amber-100',
    metricKey: 'outboundInMotion' as const,
    metricLabel: 'in motion',
  },
  {
    href: '/dashboard/operations/customer-orders',
    icon: ShoppingCart,
    code: '06',
    title: 'Customer fulfillment',
    desc: 'Sales orders and inbound customer POs — promise, ship, prove delivery.',
    accent: 'from-rose-50 to-white border-rose-100',
    metricKey: 'customerPosOpen' as const,
    metricLabel: 'open orders',
  },
] as const;

const DOMAIN_TONE: Record<string, string> = {
  procure: 'bg-violet-50 text-violet-800 border-violet-100',
  inbound: 'bg-sky-50 text-sky-800 border-sky-100',
  make: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  outbound: 'bg-amber-50 text-amber-900 border-amber-100',
  fulfill: 'bg-rose-50 text-rose-800 border-rose-100',
};

export default function OperationsCommand() {
  return (
    <CompanyRequired>
      <CommandInner />
    </CompanyRequired>
  );
}

function CommandInner() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data.summary || null);
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
    <OperationsPage>
      <OperationsHeader
        title="Operations"
        titleAccent="Command"
        description="End-to-end control tower — procure, receive, store, make, ship, and fulfill. Live signals from SRM, inventory, manufacturing, distribution, and CRM."
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

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50 p-6 sm:p-8 mb-8 shadow-sm">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#00b4d8]/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-4 shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Live ops · procure → fulfill
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
              One chain. Zero blind spots.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              SupplierAdvisor operations unifies purchase orders, inbound logistics, warehouse
              stock, manufacturing work orders, outbound distribution, and customer fulfillment —
              light, precise, and always actionable.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white border border-cyan-100 px-3 py-3 text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Throughput
              </div>
              <div className="text-2xl font-black tabular-nums text-[#00b4d8]">
                {loading ? '—' : s?.throughput ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-cyan-100 px-3 py-3 text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                In motion
              </div>
              <div className="text-2xl font-black tabular-nums text-emerald-600">
                {loading
                  ? '—'
                  : (s?.shipmentsInMotion ?? 0) + (s?.workOrdersInFlight ?? 0)}
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
              label="Open buy POs"
              value={s?.supplierPosOpen ?? 0}
              sub={`${s?.supplierPos ?? 0} total · ${s?.suppliers ?? 0} suppliers`}
              accent="violet"
              icon={Truck}
              href="/dashboard/operations/supplier-orders"
            />
            <TelemetryCard
              label="Inbound motion"
              value={s?.inboundInMotion ?? 0}
              sub={`${s?.inboundShipments ?? 0} inbound shipments`}
              accent="sky"
              icon={ArrowDownToLine}
              href="/dashboard/operations/inbound"
            />
            <TelemetryCard
              label="Units on hand"
              value={s?.unitsOnHand ?? 0}
              sub={`${s?.skusWithStock ?? 0} SKUs · ${s?.warehouses ?? 0} sites`}
              accent="cyan"
              icon={Package}
              href="/dashboard/operations/warehouse"
            />
            <TelemetryCard
              label="WOs in flight"
              value={s?.workOrdersInFlight ?? 0}
              sub={`${s?.workOrdersHold ?? 0} hold · ${s?.bomsActive ?? 0} active BOMs`}
              accent="emerald"
              icon={Factory}
              href="/dashboard/operations/production"
            />
            <TelemetryCard
              label="Outbound motion"
              value={s?.outboundInMotion ?? 0}
              sub={`${s?.carriersActive ?? 0} carriers active`}
              accent="amber"
              icon={ArrowUpFromLine}
              href="/dashboard/operations/outbound"
            />
            <TelemetryCard
              label="Customer open"
              value={s?.customerPosOpen ?? 0}
              sub={`${s?.customerPos ?? 0} orders · ${s?.customers ?? 0} customers`}
              accent="rose"
              icon={ShoppingCart}
              href="/dashboard/operations/customer-orders"
            />
            <TelemetryCard
              label="Containers"
              value={s?.containers ?? 0}
              sub={`${s?.transfersLive ?? 0} transfers live`}
              accent="slate"
              icon={Package}
              href="/dashboard/containers"
            />
            <TelemetryCard
              label="Exceptions"
              value={s?.exceptions ?? 0}
              sub={`${s?.qualityOpen ?? 0} quality open`}
              accent="rose"
              icon={AlertTriangle}
              href="/dashboard/operations/exceptions"
            />
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const metric = s ? s[m.metricKey] : '—';
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
                    <div className="text-right">
                      <div className="text-[10px] font-black tracking-widest text-neutral-400 font-mono">
                        {m.code}
                      </div>
                      <div className="text-lg font-black tabular-nums text-slate-800 mt-0.5">
                        {metric}
                      </div>
                      <div className="text-[9px] font-bold uppercase text-neutral-400">
                        {m.metricLabel}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1.5 group-hover:text-[#0077b6] transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-3">{m.desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00b4d8]">
                    Open workbench{' '}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-800">Live activity</h3>
                <ClipboardCheck className="w-4 h-4 text-[#00b4d8]" />
              </div>
              {!s?.recent?.length ? (
                <p className="text-sm text-neutral-400 py-6 text-center">
                  Activity appears as you create POs, work orders, and shipments.
                </p>
              ) : (
                <ul className="space-y-2">
                  {s.recent.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={r.href}
                        className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 px-3 py-2.5 hover:border-cyan-200 hover:bg-sky-50/40 transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <StatusPill
                            label={r.domain}
                            className={DOMAIN_TONE[r.domain] || 'bg-slate-100 text-slate-600 border-slate-200'}
                          />
                          <span className="font-mono text-xs font-bold text-slate-800 truncate">
                            {r.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-neutral-400 shrink-0">
                          {r.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-sky-50/80 p-5 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-3">Connected systems</h3>
              <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                Operations is the orchestrator. Deep work lives in specialist modules — jump when
                you need full tooling.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { href: '/dashboard/suppliers/po', label: 'SRM purchase orders' },
                  { href: '/dashboard/inventory', label: 'Inventory OS' },
                  { href: '/dashboard/manufacturing', label: 'Manufacturing' },
                  { href: '/dashboard/distribution', label: 'Distribution' },
                  { href: '/dashboard/customers/orders', label: 'CRM orders' },
                  { href: '/dashboard/quality', label: 'Quality & HACCP' },
                  { href: '/dashboard/containers', label: 'Containers' },
                  { href: '/dashboard/intelligence', label: 'Intelligence' },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-xs font-bold text-[#0077b6] rounded-xl border border-cyan-100 bg-white px-3 py-2.5 hover:border-[#00b4d8] transition-colors"
                  >
                    {l.label} →
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <OperatingPrinciples
            items={[
              {
                title: 'One value stream',
                body: 'Procure → inbound → warehouse → make → outbound → fulfill. Every stage is visible on one tower — no spreadsheet drift.',
              },
              {
                title: 'Exceptions block flow',
                body: 'Holds, logistics exceptions, and quality gates surface first. Clear them to restore throughput.',
              },
              {
                title: 'Orchestrate, then dive deep',
                body: 'Command metrics live here; SRM, inventory, manufacturing, and distribution own the full tooling.',
              },
            ]}
          />
        </>
      )}
    </OperationsPage>
  );
}
