'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Box,
  ArrowLeftRight,
  RefreshCw,
  ClipboardCheck,
  Warehouse,
  ShoppingBag,
  QrCode,
  Link2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

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
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
          World-class inventory · live Supabase
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
          Inventory command center
        </h1>
        <p className="text-neutral-600 mt-2 max-w-2xl">
          All modules read/write the same tables: products, product_categories, warehouses,
          stock_levels, stock_movements, inventory_lots, inventory_serials, inventory_transfers,
          edi_messages — plus container_inventory for outlets.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <Kpi label="Products" value={summary?.products ?? 0} sub={`${summary?.productsActive ?? 0} active`} />
          <Kpi
            label="Units on hand"
            value={Math.round(summary?.unitsOnHand ?? 0)}
            sub={`${Math.round(summary?.containerUnits ?? 0)} in containers`}
          />
          <Kpi
            label="Low stock"
            value={summary?.lowStock ?? 0}
            sub="at or below reorder"
            tone={(summary?.lowStock || 0) > 0 ? 'amber' : 'neutral'}
          />
          <Kpi
            label="On-chain ready"
            value={summary?.onchainReady ?? 0}
            sub="hashed / anchored products"
            tone="emerald"
          />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          {
            href: '/dashboard/inventory/products',
            icon: ShoppingBag,
            title: 'Products & QR',
            desc: 'SKU master, public QR passport, on-chain mint/anchor',
            badge: 'Core',
          },
          {
            href: '/dashboard/inventory/scan',
            icon: QrCode,
            title: 'Scan receive',
            desc: 'Camera QR/GS1 → stock + lot/serial pedigree',
            badge: 'Scan',
          },
          {
            href: '/dashboard/inventory/stock',
            icon: TrendingUp,
            title: 'Stock levels',
            desc: 'Live on-hand, reserved, reorder points by warehouse',
            badge: 'Live',
          },
          {
            href: '/dashboard/inventory/lots',
            icon: Package,
            title: 'Lots & serials',
            desc: 'Expiry pedigree and serial number tracking',
            badge: 'Pedigree',
          },
          {
            href: '/dashboard/inventory/sync',
            icon: ArrowLeftRight,
            title: 'Warehouse ↔ container',
            desc: 'Auto-sync outlet stock with central warehouse',
            badge: 'Sync',
          },
          {
            href: '/dashboard/inventory/edi',
            icon: Link2,
            title: 'GS1 & EDI',
            desc: 'GTIN parse + 846/INVRPT inventory advice export',
            badge: 'B2B',
          },
          {
            href: '/dashboard/inventory/warehouses',
            icon: Warehouse,
            title: 'Warehouses',
            desc: 'Multi-location network including container outlets',
          },
          {
            href: '/dashboard/inventory/stock-transfers',
            icon: ArrowLeftRight,
            title: 'Internal transfers',
            desc: 'Move stock between warehouses with hash ledger',
          },
          {
            href: '/dashboard/inventory/cycle-counts',
            icon: RefreshCw,
            title: 'Cycle counts',
            desc: 'Rolling accuracy programs',
          },
          {
            href: '/dashboard/inventory/stock-take',
            icon: ClipboardCheck,
            title: 'Stock take',
            desc: 'Full physical inventory reconciliation',
          },
          {
            href: '/dashboard/inventory/raw-materials',
            icon: Package,
            title: 'Raw materials',
            desc: 'Inbound ingredients and production inputs',
          },
          {
            href: '/dashboard/inventory/finished-goods',
            icon: Box,
            title: 'Finished goods',
            desc: 'Sellable catalogue and availability',
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white border border-neutral-200 rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <card.icon className="w-7 h-7 text-[#00b4d8]" />
              {card.badge && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6]">
                  {card.badge}
                </span>
              )}
            </div>
            <div className="font-bold text-lg text-slate-900 group-hover:text-[#0077b6]">
              {card.title}
            </div>
            <div className="text-sm text-neutral-500 mt-1">{card.desc}</div>
            <div className="mt-4 text-xs font-medium text-[#00b4d8] inline-flex items-center gap-1">
              Open <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3">
          <Link2 className="w-6 h-6 text-emerald-700 flex-shrink-0" />
          <div>
            <div className="font-bold text-emerald-900">On-chain product passports</div>
            <p className="text-sm text-emerald-800/80 mt-1 max-w-xl">
              Every product gets a stable public ID, QR code, and SHA-256 identity hash. Stock
              movements are hashed for audit. Anchor hashes on Base when you go live with the
              registry contract.
            </p>
          </div>
        </div>
        <Link href="/dashboard/inventory/products" className="btn-primary !py-2.5 !px-5 text-sm flex-shrink-0">
          Manage products
        </Link>
      </div>

      {(summary?.lowStock || 0) > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {summary?.lowStock} line{summary?.lowStock === 1 ? '' : 's'} at or below reorder — review
          stock levels.
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'neutral' | 'amber' | 'emerald';
}) {
  const tones = {
    neutral: 'bg-white border-neutral-200',
    amber: 'bg-amber-50 border-amber-100',
    emerald: 'bg-emerald-50 border-emerald-100',
  };
  return (
    <div className={`rounded-3xl border p-5 ${tones[tone]}`}>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-3xl font-black tracking-tighter text-slate-900">{value}</div>
      <div className="text-xs text-neutral-500 mt-1">{sub}</div>
    </div>
  );
}
