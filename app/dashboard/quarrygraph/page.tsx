'use client';

/**
 * QuarryAdvisor® — quarrying & aggregates command centre (primary sector).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ClipboardCheck,
  Factory,
  HardHat,
  Loader2,
  MapPin,
  Mountain,
  Package,
  Scale,
  Shield,
  Sparkles,
  Tractor,
  Truck,
  Users,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  QuarrygraphPage,
  QuarrygraphRequired,
} from '@/components/quarry/QuarrygraphShell';
import QuarrygraphSystemFlow from '@/components/quarry/QuarrygraphSystemFlow';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

type Summary = Record<string, number | string | null | undefined>;

const CORE: HubModule[] = [
  {
    href: '/dashboard/quarrygraph/quarries',
    icon: Mountain,
    code: '01',
    title: 'Quarries',
    desc: 'Multi-quarry registry — set up many operations; pits and fleet home under each.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/quarrygraph/sites',
    icon: HardHat,
    code: '02',
    title: 'Sites & faces',
    desc: 'Pits, temp pads, batch yards — material, rights, GPS. Master for all ops.',
    accent: 'from-stone-50 to-white border-stone-200',
  },
  {
    href: '/dashboard/quarrygraph/locations',
    icon: MapPin,
    code: '03',
    title: 'Locations & projects',
    desc: 'Temporary quarries, batching plants, allocate resources, distance matrix.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/quarrygraph/products',
    icon: Package,
    code: '04',
    title: 'Products & grades',
    desc: 'G1–G7, concrete stone, crusher sand and custom grades with density.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/quarrygraph/reserves',
    icon: BarChart3,
    code: '05',
    title: 'Reserves',
    desc: 'Surveyed / approved recoverable tonnes and quality by site and season.',
    accent: 'from-orange-50 to-white border-orange-100',
  },
  {
    href: '/dashboard/quarrygraph/production',
    icon: HardHat,
    code: '06',
    title: 'Production planner',
    desc: 'Cutting/blast sequence, daily allocation → planned dates, plus blast logs.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
];

const OPS: HubModule[] = [
  {
    href: '/dashboard/quarrygraph/plant',
    icon: Factory,
    code: '07',
    title: 'Plant & stockpiles',
    desc: 'Crusher / screen runs and pad balances by product.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
  {
    href: '/dashboard/quarrygraph/dispatch',
    icon: Scale,
    code: '08',
    title: 'Weighbridge dispatch',
    desc: 'Tickets, net tonnes, customers, destinations — deducts stock when ticketed.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/quarrygraph/fleet',
    icon: Tractor,
    code: '09',
    title: 'Vehicles & metrics',
    desc: 'Full fleet KPIs: util %, L/h, t/h, R/t, status, multi-quarry home base.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/quarrygraph/labour',
    icon: Users,
    code: '10',
    title: 'Labour & rates',
    desc: 'Crews permanent / temporary / contractor with costed day logs.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
];

const ASSURE: HubModule[] = [
  {
    href: '/dashboard/quarrygraph/quality',
    icon: ClipboardCheck,
    code: '10',
    title: 'Quality lab',
    desc: 'CS, grading, ACV and pass/fail by product and site.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/quarrygraph/compliance',
    icon: Shield,
    code: '11',
    title: 'Compliance',
    desc: 'Mining rights, WUL, EMP — auto-flag expiring permits.',
    accent: 'from-lime-50 to-white border-lime-100',
  },
  {
    href: '/dashboard/quarrygraph/report',
    icon: Sparkles,
    code: '12',
    title: 'Key reports',
    desc: 'By quarry, vehicle KPIs, plant vs dispatch, cost/t, compliance pack.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/customers',
    icon: Truck,
    code: '13',
    title: 'Trade (CRM)',
    desc: 'Customers, quotes and invoices on the SupplierAdvisor network.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/messages?from=quarrygraph&channel=connection',
    icon: MessageSquare,
    code: '14',
    title: 'Messages',
    desc: 'Office · pit · trade threads — platform inbox for QuarryAdvisor.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
];

export default function QuarrygraphHubPage() {
  return (
    <QuarrygraphRequired>
      <HubInner />
    </QuarrygraphRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/quarry/quarrygraph?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSummary(data.summary || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/quarry/quarrygraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'seed_demo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setSummary(data.summary || null);
      toast.success('Demo quarry loaded — pits, plant, dispatch & permits');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <QuarrygraphPage>
      <RelationshipHeader
        eyebrow="Primary sector · extractives"
        title="QuarryAdvisor"
        titleAccent="®"
        description="Multi-quarry aggregates OS: register many quarries, pits, reserves, production, plant, weighbridge, vehicle KPIs, labour, lab QA and permits — with management reports by quarry and fleet."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/quarrygraph/quarries"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Mountain className="w-4 h-4" /> Quarries
            </Link>
            <button
              type="button"
              disabled={seeding}
              onClick={() => void seedDemo()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              Load demo quarry
            </button>
          </div>
        }
      />

      <QuarrygraphSystemFlow defaultCollapsed />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-700" />
        </div>
      ) : (
        <HubTelemetryGrid>
          <TelemetryCard
            label="Quarries"
            value={String(summary?.quarryCount ?? 0)}
            sub={`${summary?.siteCount ?? 0} pits · ${summary?.productCount ?? 0} products`}
          />
          <TelemetryCard
            label="Reserves (t)"
            value={String(summary?.reserveTonnes ?? 0)}
            sub={`${summary?.productionOpen ?? 0} plan rows open`}
          />
          <TelemetryCard
            label="Stock / dispatched"
            value={`${summary?.stockpileTonnes ?? 0} / ${summary?.dispatchedTonnes ?? 0}`}
            sub="tonnes on pads · ticketed"
          />
          <TelemetryCard
            label="Fleet KPIs"
            value={String(summary?.vehicleCount ?? 0)}
            sub={`${summary?.tPerHour ?? '—'} t/h · ${summary?.lPerTonne ?? '—'} L/t · R ${summary?.fleetCostZar ?? 0}`}
          />
        </HubTelemetryGrid>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-black uppercase tracking-widest text-amber-900/70 mb-4">
          Core · Quarries · Pits · Products · Reserves · Production
        </h2>
        <HubModuleGrid modules={CORE} uniformDark />
      </div>
      <div className="mt-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          Ops · Plant · Dispatch · Vehicles (metrics) · Labour
        </h2>
        <HubModuleGrid modules={OPS} uniformDark />
      </div>
      <div className="mt-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          Assure · Quality · Compliance · Key reports · Trade
        </h2>
        <HubModuleGrid modules={ASSURE} uniformDark />
      </div>
    </QuarrygraphPage>
  );
}
