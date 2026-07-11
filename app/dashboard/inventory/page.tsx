'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  ArrowLeftRight,
  ClipboardCheck,
  Warehouse,
  ShoppingBag,
  QrCode,
  Link2,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Fingerprint,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  CompanyGate,
} from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

type Summary = {
  products: number;
  productsActive: number;
  warehouses: number;
  stockLines: number;
  unitsOnHand: number;
  containerUnits: number;
  lowStock: number;
  onchainReady: number;
  rawMaterials: number;
  finishedGoods: number;
};

export default function InventoryHub() {
  return (
    <CompanyGate noun="Inventory">
      <HubInner />
    </CompanyGate>
  );
}

function HubInner() {
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
      const res = await fetch(`/api/inventory/summary?companyId=${companyId}`);
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

  const modules: HubModule[] = [
    {
      href: '/dashboard/inventory/products',
      icon: ShoppingBag,
      code: '01',
      title: 'Products',
      desc: 'SKU master for raw materials, finished goods, kits — QR & on-chain passport.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: s?.products ?? '—',
      metricLabel: 'SKUs',
    },
    {
      href: '/dashboard/inventory/warehouses',
      icon: Warehouse,
      code: '02',
      title: 'Locations',
      desc: 'DCs, supplier plants, and customer sites that hold stock.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: s?.warehouses ?? '—',
      metricLabel: 'sites',
    },
    {
      href: '/dashboard/inventory/stock',
      icon: TrendingUp,
      code: '03',
      title: 'Live stock',
      desc: 'Totals and stock by product and location in real time.',
      accent: 'from-cyan-50 to-white border-cyan-100',
      metric: Math.round(s?.unitsOnHand ?? 0),
      metricLabel: 'units',
    },
    {
      href: '/dashboard/inventory/scan',
      icon: QrCode,
      code: '04',
      title: 'Receive',
      desc: 'Scan QR / GS1 barcode to put stock on hand with lot pedigree.',
      accent: 'from-emerald-50 to-white border-emerald-100',
    },
    {
      href: '/dashboard/inventory/stock-transfers',
      icon: ArrowLeftRight,
      code: '05',
      title: 'Transfers',
      desc: 'Driver QR pickup → GPS en route → deliver; warehouse ↔ container.',
      accent: 'from-amber-50 to-white border-amber-100',
    },
    {
      href: '/dashboard/inventory/counts',
      icon: ClipboardCheck,
      code: '06',
      title: 'Counts',
      desc: 'Physical stock take, post variances, and count history.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
    {
      href: '/dashboard/inventory/tracking',
      icon: Navigation,
      code: '07',
      title: 'Live transfer tracking',
      desc: 'Real-time map, GPS from drivers, ETA to destination.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
    {
      href: '/dashboard/inventory/lots',
      icon: Package,
      code: '08',
      title: 'Lots & serials',
      desc: 'Expiry pedigree and serial tracking for regulated stock.',
      accent: 'from-slate-50 to-white border-slate-200',
    },
    {
      href: '/dashboard/inventory/edi',
      icon: Link2,
      code: '09',
      title: 'GS1 & EDI',
      desc: 'GTIN parse and inventory advice (846 / INVRPT) for partners.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
  ];

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Inventory operating system"
        title="Inventory"
        titleAccent="Command"
        description="Master data, stock, receive, transfer, and counts — light, precise, always on hand."
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

      <HubHero
        pill="Live stock · master → count"
        title="Every unit has a home."
        description="Products, locations, and UOMs first. On-hand lives at a site — warehouse, plant, or container. Lots and on-chain hashes support audit without slowing put-away."
        stats={[
          {
            label: 'On hand',
            value: loading ? '—' : Math.round(s?.unitsOnHand ?? 0),
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'SKUs',
            value: loading ? '—' : s?.products ?? 0,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Low stock',
            value: loading ? '—' : s?.lowStock ?? 0,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      {loading && !summary ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <HubTelemetryGrid>
            <TelemetryCard
              label="Products"
              value={s?.products ?? 0}
              sub={`${s?.rawMaterials ?? 0} raw · ${s?.finishedGoods ?? 0} FG`}
              accent="violet"
              icon={ShoppingBag}
              href="/dashboard/inventory/products"
            />
            <TelemetryCard
              label="Units on hand"
              value={Math.round(s?.unitsOnHand ?? 0)}
              sub={`${Math.round(s?.containerUnits ?? 0)} in containers`}
              accent="cyan"
              icon={Package}
              href="/dashboard/inventory/stock"
            />
            <TelemetryCard
              label="Locations"
              value={s?.warehouses ?? 0}
              sub={`${s?.stockLines ?? 0} stock lines`}
              accent="sky"
              icon={Warehouse}
              href="/dashboard/inventory/warehouses"
            />
            <TelemetryCard
              label="Low stock"
              value={s?.lowStock ?? 0}
              sub="At or below reorder"
              accent={(s?.lowStock || 0) > 0 ? 'amber' : 'emerald'}
              icon={AlertTriangle}
              href="/dashboard/inventory/stock?low=1"
            />
            <TelemetryCard
              label="On-chain ready"
              value={s?.onchainReady ?? 0}
              sub="Products hashed"
              accent="emerald"
              icon={Fingerprint}
              href="/dashboard/inventory/products"
            />
            <TelemetryCard
              label="Active SKUs"
              value={s?.productsActive ?? 0}
              sub="Sellable / usable"
              accent="slate"
              icon={TrendingUp}
              href="/dashboard/inventory/products"
            />
          </HubTelemetryGrid>

          {(s?.lowStock || 0) > 0 && (
            <Link
              href="/dashboard/inventory/stock?low=1"
              className="mb-8 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100/80"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {s?.lowStock} line{s?.lowStock === 1 ? '' : 's'} at or below reorder — open live stock
            </Link>
          )}

          <HubModuleGrid modules={modules} />

          <HubPrinciples
            items={[
              {
                title: 'Master data first',
                body: 'Products, locations, and UOMs are the foundation. Stock without a clean SKU master is noise.',
              },
              {
                title: 'Every unit has a home',
                body: 'On-hand lives at a location — warehouse, plant, or container. Transfers keep the physical truth synced.',
              },
              {
                title: 'Pedigree when it matters',
                body: 'Lots, serials, and on-chain hashes support audit and recall without slowing daily put-away.',
              },
            ]}
          />
        </>
      )}
    </RelationshipPage>
  );
}
