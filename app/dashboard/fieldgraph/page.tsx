'use client';

/**
 * Fieldgraph® — primary production command centre.
 * Multi-crop field OS: fields → harvest → inputs → regen → farm-to-buyer trade.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CalendarRange,
  FlaskConical,
  Leaf,
  Loader2,
  MapPinned,
  Package,
  ShoppingCart,
  Sparkles,
  Sprout,
  Tractor,
  Users,
  Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  FieldgraphPage,
  FieldgraphRequired,
} from '@/components/agri/FieldgraphShell';
import {
  RelationshipHeader,
} from '@/components/relationship/RelationshipChrome';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

type Summary = {
  fieldCount: number;
  hectares: number;
  cropCount: number;
  crops: string[];
  estimateTonnes: number;
  harvestOpen: number;
  applications: number;
  regenSamples: number;
  avgSoilOrganicCarbon: number | null;
  fleetLogs: number;
  labourLogs: number;
};

const MODULES: HubModule[] = [
  {
    href: '/dashboard/fieldgraph/fields',
    icon: MapPinned,
    code: '01',
    title: 'Fields',
    desc: 'Multi-crop field book — code, ha, variety, ratoon, irrigation, geo.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/fieldgraph/estimates',
    icon: BarChart3,
    code: '02',
    title: 'Estimates',
    desc: 'Season estimates, t/ha, quality metrics, revisions — any crop.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/fieldgraph/harvest',
    icon: CalendarRange,
    code: '03',
    title: 'Harvest plan',
    desc: 'Cut sequence, daily allocation, projected dates, mill/buyer destination.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/fieldgraph/inputs',
    icon: FlaskConical,
    code: '04',
    title: 'Inputs',
    desc: 'Fertiliser, chem, seed — applications with N-P-K / ha.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/fieldgraph/fleet',
    icon: Tractor,
    code: '05',
    title: 'Fleet',
    desc: 'Vehicle activity by field, hours and fuel.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
  {
    href: '/dashboard/fieldgraph/labour',
    icon: Users,
    code: '06',
    title: 'Labour',
    desc: 'Gangs, attendance, field activity — links into People when needed.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/fieldgraph/regen',
    icon: Leaf,
    code: '07',
    title: 'Regen',
    desc: 'Soil organic carbon, cover, water — buyer-ready regenerative proof.',
    accent: 'from-lime-50 to-white border-lime-100',
  },
  {
    href: '/dashboard/fieldgraph/trade',
    icon: ShoppingCart,
    code: '08',
    title: 'Trade',
    desc: 'Hand off to mills, silos, and buyers on the SupplierAdvisor network.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/inventory/lots',
    icon: Warehouse,
    code: '09',
    title: 'Origin lots',
    desc: 'Farm → lot → stock for full chain of custody (Inventory).',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/fieldgraph/report',
    icon: Sparkles,
    code: '10',
    title: 'Insights',
    desc: 'Yield, nutrients, fleet, labour and regen on one season scorecard.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
];

export default function FieldgraphHubPage() {
  return (
    <FieldgraphRequired>
      <HubInner />
    </FieldgraphRequired>
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
        `/api/agri/fieldgraph?companyId=${companyId}`,
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
      const res = await fetch('/api/agri/fieldgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'seed_demo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setSummary(data.summary || null);
      toast.success('Demo estate loaded — cane, maize & citrus');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <FieldgraphPage>
      <RelationshipHeader
        eyebrow="Primary production OS"
        title="Fieldgraph"
        titleAccent="®"
        description="Multi-crop field book, estimates, harvest planning, inputs, regen metrics, and farm-to-buyer trade — not cane-only software. Built for growers who sell into verified networks."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/fieldgraph/fields"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Sprout className="w-4 h-4" /> Open fields
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
              Load demo estate
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <HubTelemetryGrid>
          <TelemetryCard
            label="Fields"
            value={String(summary?.fieldCount ?? 0)}
            sub={`${summary?.hectares ?? 0} ha · ${summary?.cropCount ?? 0} crops`}
          />
          <TelemetryCard
            label="Estimate tonnes"
            value={String(summary?.estimateTonnes ?? 0)}
            sub="Non-draft estimates"
          />
          <TelemetryCard
            label="Harvest open"
            value={String(summary?.harvestOpen ?? 0)}
            sub="Planned / cutting"
          />
          <TelemetryCard
            label="Soil organic C"
            value={
              summary?.avgSoilOrganicCarbon != null
                ? `${summary.avgSoilOrganicCarbon}%`
                : '—'
            }
            sub={`${summary?.regenSamples ?? 0} regen samples`}
          />
        </HubTelemetryGrid>
      )}

      <div className="my-8 grid sm:grid-cols-2 gap-3">
        {[
          {
            t: 'Multi-crop, not cane-only',
            b: 'Sugar cane, maize, citrus, veg and more share one field book — estimates and harvest still work per crop.',
          },
          {
            t: 'Farm-to-buyer on the network',
            b: 'Hand harvest destinations into mills, silos and buyers with trust, OTIFEF and settle — not a private island.',
          },
          {
            t: 'Regen is first-class',
            b: 'Soil carbon, cover and water sit next to yield so buyers and ESG packs see the same truth as the farm office.',
          },
          {
            t: 'Origin into inventory',
            b: 'Lots and stock inherit field origin for traceability — the same graph as Quality and Impact.',
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-emerald-100 bg-emerald-50/30 px-4 py-3"
          >
            <div className="text-sm font-black text-slate-900">{x.t}</div>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
              {x.b}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          Workbenches
        </h2>
        <HubModuleGrid modules={MODULES} />
      </div>
    </FieldgraphPage>
  );
}
