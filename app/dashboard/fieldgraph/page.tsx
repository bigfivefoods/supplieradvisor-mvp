'use client';

/**
 * CropAdvisor® — primary production command centre.
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
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  FieldgraphPage,
  FieldgraphRequired,
} from '@/components/agri/FieldgraphShell';
import FieldgraphSystemFlow from '@/components/agri/FieldgraphSystemFlow';
import FieldgraphProcessPdfButtons from '@/components/agri/FieldgraphProcessPdfButtons';
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
  boardEstimates?: number;
  harvestOpen: number;
  applications: number;
  regenSamples: number;
  avgSoilOrganicCarbon: number | null;
  vehicleCount?: number;
  fleetLogs: number;
  fuelTotalL?: number;
  fleetHours?: number;
  labourLogs: number;
};

/** Core agri business sections — lead the module */
const CORE_MODULES: HubModule[] = [
  {
    href: '/dashboard/fieldgraph/fields',
    icon: MapPinned,
    code: '01',
    title: 'Field & agronomic data',
    desc: 'Shared field master across all modules. Yield & quality analysis across and within seasons.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/fieldgraph/estimates',
    icon: BarChart3,
    code: '02',
    title: 'Estimates',
    desc: 'Field-level Estimate Manager — create, revise, Mill Group Board submissions & revision reports.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/fieldgraph/harvest',
    icon: CalendarRange,
    code: '03',
    title: 'Harvest Planner',
    desc: 'Cutting sequence + estimates + daily allocation → expected cut dates for every field.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/fieldgraph/fleet',
    icon: Tractor,
    code: '04',
    title: 'Vehicle Management',
    desc: 'Daily vehicle activity by field, fuel utilisation, and reports by vehicle & activity.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
];

const EXTENDED_MODULES: HubModule[] = [
  {
    href: '/dashboard/fieldgraph/inputs',
    icon: FlaskConical,
    code: '05',
    title: 'Inputs',
    desc: 'Fertiliser, chem, seed — applications with N-P-K / ha.',
    accent: 'from-violet-50 to-white border-violet-100',
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
    href: '/dashboard/messages?from=fieldgraph&channel=connection',
    icon: MessageSquare,
    code: '08b',
    title: 'Messages',
    desc: 'Farm · mill · buyer threads — platform inbox for CropAdvisor.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
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
    title: 'Reports · Slice & dice',
    desc: 'Period + crop/field filters across yield, harvest, fleet, labour, inputs and regen.',
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
        title="CropAdvisor"
        titleAccent="®"
        description="Core agri: shared field & agronomic data, estimate manager, harvest planner, and vehicle management — plus inputs, regen and farm-to-buyer trade. Multi-crop, not cane-only."
        action={
          <div className="flex flex-wrap gap-2">
            <FieldgraphProcessPdfButtons variant="header" />
            <Link
              href="/dashboard/fieldgraph/fields"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Sprout className="w-4 h-4" /> Field & agronomic
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

      <FieldgraphSystemFlow />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-white" />
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
            sub={`${summary?.boardEstimates ?? 0} board / submitted`}
          />
          <TelemetryCard
            label="Harvest open"
            value={String(summary?.harvestOpen ?? 0)}
            sub="Planned / cutting"
          />
          <TelemetryCard
            label="Fleet"
            value={String(summary?.vehicleCount ?? 0)}
            sub={`${summary?.fuelTotalL ?? 0} L fuel · ${summary?.fleetHours ?? 0} h`}
          />
        </HubTelemetryGrid>
      )}

      <div className="my-8 grid sm:grid-cols-2 gap-3">
        {[
          {
            t: 'Shared field master',
            b: 'One agronomic record feeds estimates, harvest, inputs, fleet and regen — consistent codes, ha and crop everywhere.',
          },
          {
            t: 'Harvest dates from sequence',
            b: 'User cutting order + estimates + daily allocation projects start/end cut dates for the whole season.',
          },
          {
            t: 'Board-ready estimates',
            b: 'Revisions, board status and Mill Group Board style rows for submissions and revision reports.',
          },
          {
            t: 'Fleet fuel & utilisation',
            b: 'Registry, daily activity by field, and reports of hours and L/hour by vehicle and activity.',
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-emerald-300 bg-emerald-50/50 px-4 py-3 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40"
          >
            <div className="text-sm font-black text-slate-900 dark:text-white">
              {x.t}
            </div>
            <p className="text-[12px] text-slate-600 dark:text-white/90 mt-1 leading-relaxed">
              {x.b}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-emerald-800 dark:text-white mb-4">
          Core · Field & agronomic · Estimates · Harvest · Vehicles
        </h2>
        <HubModuleGrid modules={CORE_MODULES} uniformDark />
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          Extended · Season ops & network
        </h2>
        <HubModuleGrid modules={EXTENDED_MODULES} uniformDark />
      </div>
    </FieldgraphPage>
  );
}
