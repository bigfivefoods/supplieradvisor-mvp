'use client';

import Link from 'next/link';
import { ArrowRight, Building2, Package } from 'lucide-react';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { StatRow } from '@/components/hire/SimpleEntityForm';

/**
 * Hire suppliers = Core OS Suppliers (SRM) book.
 * Gear is listed against an SRM row; manage parties under Suppliers module.
 */
export default function HireSuppliersPage() {
  const { store, coreSuppliers, loading, summary } = useHiregraph();

  const itemCountBySupplier = new Map<number, number>();
  for (const item of store?.items || []) {
    const sid = Number(item.srm_supplier_id);
    if (!sid) continue;
    itemCountBySupplier.set(sid, (itemCountBySupplier.get(sid) || 0) + 1);
  }

  return (
    <HiregraphWorkbench
      title="Hire suppliers"
      titleAccent="Core Suppliers module"
      description="Owners of gear live in Core OS Suppliers (SRM). Add or invite suppliers there, then list catalogue items against them here. Dual commission still applies on completed hires."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-500/30 dark:bg-violet-950/40">
            <p className="text-sm text-violet-950 dark:text-violet-50">
              <strong>Source of truth:</strong> Suppliers module — not a
              separate HireAdvisor address book.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/suppliers"
                className="inline-flex items-center gap-1 rounded-full bg-violet-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                Open Suppliers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/hiregraph/catalogue"
                className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-900 dark:border-violet-400/40 dark:bg-violet-900/40 dark:text-violet-50"
              >
                List gear on catalogue
              </Link>
            </div>
          </div>

          <StatRow
            tone="hg-desk"
            items={[
              {
                label: 'Core suppliers',
                value: coreSuppliers.length,
              },
              {
                label: 'With hire gear',
                value: itemCountBySupplier.size,
              },
              {
                label: 'Catalogue items',
                value: Number(summary?.itemCount) || store.items.length,
              },
            ]}
          />

          {coreSuppliers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center dark:border-violet-500/20 dark:bg-violet-950/30">
              <Building2 className="mx-auto h-8 w-8 text-slate-300 dark:text-violet-300" />
              <p className="mt-3 font-bold text-slate-800 dark:text-white">
                No suppliers on this company yet
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-violet-100/70">
                Add hire partners under Core Suppliers, then come back to list
                jumping castles, plant, tools and more against them.
              </p>
              <Link
                href="/dashboard/suppliers"
                className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-bold text-white"
              >
                Go to Suppliers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-violet-500/15 dark:border-violet-500/25">
              {coreSuppliers.map((s) => {
                const n = itemCountBySupplier.get(s.id) || 0;
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-transparent"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {s.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-violet-100/65">
                        {[s.email, s.phone, s.city, s.status]
                          .filter(Boolean)
                          .join(' · ') || `SRM #${s.id}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-violet-400/30 dark:text-violet-100">
                        <Package className="h-3 w-3" /> {n} items
                      </span>
                      <Link
                        href={`/dashboard/hiregraph/catalogue`}
                        className="text-xs font-bold text-[#0077b6] dark:text-cyan-200"
                      >
                        Catalogue
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </HiregraphWorkbench>
  );
}
