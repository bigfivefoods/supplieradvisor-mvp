'use client';

import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { StatRow } from '@/components/hire/SimpleEntityForm';
import {
  HIRE_CATEGORIES,
  HIRE_REQUIREMENT_LABELS,
  type HireRequirementKey,
} from '@/lib/hire/hiregraph';

export default function HireCategoriesPage() {
  const { store, loading, summary } = useHiregraph();
  const counts = (summary?.categoryCounts || {}) as Record<string, number>;

  return (
    <HiregraphWorkbench
      title="Categories"
      titleAccent="requirement stacks"
      description="Each hire category enforces different customer / site requirements before gear can go out. Items inherit these rules (plus optional extras)."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="hg-desk"
            items={[
              { label: 'Categories', value: HIRE_CATEGORIES.length },
              { label: 'Catalogue items', value: store.items.length },
              {
                label: 'Core suppliers',
                value: Number(summary?.supplierCount) || 0,
              },
            ]}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {HIRE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="rounded-2xl border border-violet-100 bg-white p-4 dark:border-violet-500/25 dark:bg-gradient-to-br dark:from-[#1e1033] dark:to-[#0c3a4f]/40"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-300">
                      {cat.short}
                      {cat.highValue ? ' · high value' : ''}
                      {cat.needsDelivery ? ' · delivery' : ''}
                    </p>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {cat.name}
                    </h3>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-500/30 dark:text-violet-100">
                    {counts[cat.id] || 0} items
                  </span>
                </div>
                <p className="text-[12px] text-slate-600 dark:text-violet-50/75">
                  {cat.description}
                </p>
                {cat.examples?.length ? (
                  <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-violet-100/65">
                    <span className="font-bold text-slate-600 dark:text-violet-100/80">
                      Examples:{' '}
                    </span>
                    {cat.examples.slice(0, 6).join(' · ')}
                    {cat.examples.length > 6 ? ' · …' : ''}
                  </p>
                ) : null}
                <p className="mt-2 text-[10px] font-bold uppercase text-slate-400 dark:text-violet-200/50">
                  Default unit · {cat.unit}
                  {cat.defaultDepositPct != null
                    ? ` · deposit hint ${cat.defaultDepositPct}%`
                    : ''}
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {cat.requirements.map((r: HireRequirementKey) => (
                    <li
                      key={r}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-violet-500/20 dark:bg-violet-950/50 dark:text-violet-100"
                    >
                      {HIRE_REQUIREMENT_LABELS[r]}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </HiregraphWorkbench>
  );
}
