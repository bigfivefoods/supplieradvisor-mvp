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
  ArrowRight,
  TrendingUp,
  Fingerprint,
  ChevronRight,
  Navigation,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { InventoryProcessNav, INVENTORY_TOOLS } from '@/components/inventory/InventoryShell';

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

const PROCESS_STEPS = [
  {
    href: '/dashboard/inventory/products',
    icon: ShoppingBag,
    title: 'Products',
    desc: 'SKU master for raw materials, finished goods, kits — QR & on-chain passport',
  },
  {
    href: '/dashboard/inventory/warehouses',
    icon: Warehouse,
    title: 'Locations',
    desc: 'Your DCs, supplier plants, and customer sites that hold stock',
  },
  {
    href: '/dashboard/inventory/stock',
    icon: TrendingUp,
    title: 'Live stock',
    desc: 'See totals and stock by product and by location in real time',
  },
  {
    href: '/dashboard/inventory/scan',
    icon: QrCode,
    title: 'Receive',
    desc: 'Scan QR / GS1 barcode to put stock on hand (with lot pedigree)',
  },
  {
    href: '/dashboard/inventory/stock-transfers',
    icon: ArrowLeftRight,
    title: 'Transfers',
    desc: 'Driver QR pickup → GPS en route → deliver; or warehouse ↔ container',
  },
  {
    href: '/dashboard/inventory/counts',
    icon: ClipboardCheck,
    title: 'Counts',
    desc: 'Physical stock take, post variances, and count history',
  },
] as const;

export default function InventoryHub() {
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

  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">Select a company to open Inventory.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryProcessNav />

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
          End-to-end inventory
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
          Inventory
        </h1>
        <p className="text-neutral-600 mt-2 max-w-2xl">
          End-to-end inventory — master data, stock, receive, transfer, and counts in one place.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <Kpi
            label="Products"
            value={summary?.products ?? 0}
            sub={`${summary?.rawMaterials ?? 0} raw · ${summary?.finishedGoods ?? 0} FG`}
            href="/dashboard/inventory/products"
          />
          <Kpi
            label="Units on hand"
            value={Math.round(summary?.unitsOnHand ?? 0)}
            sub={`${Math.round(summary?.containerUnits ?? 0)} in containers`}
            href="/dashboard/inventory/stock"
          />
          <Kpi
            label="Locations"
            value={summary?.warehouses ?? 0}
            sub={`${summary?.stockLines ?? 0} stock lines`}
            href="/dashboard/inventory/warehouses"
          />
          <Kpi
            label="Low stock"
            value={summary?.lowStock ?? 0}
            sub="at or below reorder"
            tone={(summary?.lowStock || 0) > 0 ? 'amber' : 'neutral'}
            href="/dashboard/inventory/stock?low=1"
          />
        </div>
      )}

      {/* Module cards */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">Modules</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {PROCESS_STEPS.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="bg-white border border-neutral-200 rounded-3xl p-5 hover:border-[#00b4d8] hover:shadow-md transition-all group relative"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                <step.icon className="w-5 h-5 text-[#00b4d8]" />
              </div>
            </div>
            <div className="font-bold text-slate-900 group-hover:text-[#0077b6]">{step.title}</div>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{step.desc}</p>
            <div className="mt-3 text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1">
              Open <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* Tools (secondary) */}
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-800">Tracking & specialist tools</h2>
        <p className="text-xs text-neutral-500">Live movement board, pedigree, and B2B export</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <Link
          href="/dashboard/inventory/tracking"
          className="bg-white border rounded-3xl p-5 hover:border-[#00b4d8] transition-all flex gap-4 items-start"
        >
          <Navigation className="w-6 h-6 text-[#00b4d8] flex-shrink-0" />
          <div>
            <div className="font-bold">Live transfer tracking</div>
            <p className="text-xs text-neutral-500 mt-1">
              Real-time map, GPS from drivers, ETA to destination
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 ml-auto flex-shrink-0" />
        </Link>
        <Link
          href="/dashboard/inventory/lots"
          className="bg-white border rounded-3xl p-5 hover:border-slate-400 transition-all flex gap-4 items-start"
        >
          <Package className="w-6 h-6 text-slate-600 flex-shrink-0" />
          <div>
            <div className="font-bold">Lots & serials</div>
            <p className="text-xs text-neutral-500 mt-1">
              Expiry pedigree and serial tracking for regulated or high-value stock
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 ml-auto flex-shrink-0" />
        </Link>
        <Link
          href="/dashboard/inventory/edi"
          className="bg-white border rounded-3xl p-5 hover:border-slate-400 transition-all flex gap-4 items-start"
        >
          <Link2 className="w-6 h-6 text-slate-600 flex-shrink-0" />
          <div>
            <div className="font-bold">GS1 & EDI</div>
            <p className="text-xs text-neutral-500 mt-1">
              GTIN parse and inventory advice (846 / INVRPT) for trading partners
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 ml-auto flex-shrink-0" />
        </Link>
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3">
          <Fingerprint className="w-6 h-6 text-emerald-700 flex-shrink-0" />
          <div>
            <div className="font-bold text-emerald-900">On-chain ready</div>
            <p className="text-sm text-emerald-800/80 mt-1 max-w-xl">
              {summary?.onchainReady ?? 0} products hashed. Product passports and movement hashes
              support audit without changing day-to-day warehouse work.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/inventory/products"
          className="btn-primary !py-2.5 !px-5 text-sm flex-shrink-0"
        >
          Manage products
        </Link>
      </div>

      {(summary?.lowStock || 0) > 0 && (
        <Link
          href="/dashboard/inventory/stock"
          className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2 hover:bg-amber-100/80"
        >
          <AlertTriangle className="w-4 h-4" />
          {summary?.lowStock} line{summary?.lowStock === 1 ? '' : 's'} at or below reorder — open live
          stock
          <ArrowRight className="w-4 h-4 ml-auto" />
        </Link>
      )}

      <p className="mt-8 text-[11px] text-neutral-400 text-center">
        Consolidated: raw materials & finished goods live under Products · warehouse↔container under
        Transfers · stock take & cycle counts under Counts
        {INVENTORY_TOOLS.length ? '' : ''}
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'neutral' | 'amber' | 'emerald';
  href?: string;
}) {
  const tones = {
    neutral: 'bg-white border-neutral-200',
    amber: 'bg-amber-50 border-amber-100',
    emerald: 'bg-emerald-50 border-emerald-100',
  };
  const className = `rounded-3xl border p-5 block ${tones[tone]} ${href ? 'hover:border-[#00b4d8] transition-all' : ''}`;
  const body = (
    <>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-3xl font-black tracking-tighter text-slate-900">{value}</div>
      <div className="text-xs text-neutral-500 mt-1">{sub}</div>
    </>
  );
  if (href) return <Link href={href} className={className}>{body}</Link>;
  return <div className={className}>{body}</div>;
}
