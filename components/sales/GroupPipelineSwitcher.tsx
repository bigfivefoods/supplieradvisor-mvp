'use client';

import { Building2, Layers } from 'lucide-react';
import { formatMoney } from '@/lib/customers/types';
import type {
  GroupPipelineMeta,
  GroupPipelineView,
} from '@/lib/business/group-pipeline-view';

export default function GroupPipelineSwitcher({
  group,
  view,
  onView,
}: {
  group: GroupPipelineMeta | null;
  view: GroupPipelineView;
  onView: (next: GroupPipelineView) => void;
}) {
  if (!group?.includesSubsidiaries || !Array.isArray(group.companies) || group.companies.length < 2)
    return null;

  const selected =
    view === 'all'
      ? null
      : group.companies.find((c) => c.id === view) || null;

  return (
    <div className="rounded-3xl border border-sky-100 bg-sky-50/60 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-800/80 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {group.isSubsidiary ? 'Company pipeline' : 'Group pipeline'}
          </p>
          <p className="text-sm text-slate-700 mt-0.5">
            {view === 'all'
              ? group.isSubsidiary
                ? `Group view — ${
                    group.viewerCompanyName || 'this company'
                  } plus subsidiaries.`
                : `Consolidated view — all companies under ${
                    group.viewerCompanyName || 'this holding company'
                  }.`
              : selected?.isViewer
                ? `Your pipeline — deals booked on ${
                    selected.name || 'this company'
                  }.`
                : `Deals booked on ${selected?.name || 'this company'} only.`}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onView('all')}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border ${
            view === 'all'
              ? 'border-[#0077b6] bg-[#0077b6] text-white'
              : 'border-white bg-white text-slate-700 hover:border-sky-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          All companies
        </button>
        {group.companies.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onView(c.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border ${
              view === c.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-white bg-white text-slate-700 hover:border-sky-200'
            }`}
          >
            <span className="max-w-[12rem] truncate">
              {c.isViewer ? `${c.name} · you` : c.name}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                view === c.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {c.openCount}
            </span>
          </button>
        ))}
      </div>

      {view !== 'all' && selected && !selected.isViewer ? (
        <p className="text-[11px] text-sky-900/80">
          You are viewing {selected.name}. New deals are still created on{' '}
          {group.viewerCompanyName || 'the holding company'} — switch company
          in the picker to book a deal on this subsidiary.
        </p>
      ) : null}

      {view === 'all' ? (
        <div className="overflow-x-auto rounded-2xl border border-white bg-white">
          <table className="w-full text-left text-xs min-w-[480px]">
            <thead>
              <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-wider text-neutral-400">
                <th className="py-2 px-3 font-semibold">Company</th>
                <th className="py-2 px-3 font-semibold text-right">Open deals</th>
                <th className="py-2 px-3 font-semibold text-right">Pipeline</th>
                <th className="py-2 px-3 font-semibold text-right">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {group.companies.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-50 last:border-0 cursor-pointer hover:bg-sky-50/80"
                  onClick={() => onView(c.id)}
                >
                  <td className="py-2 px-3 font-semibold text-slate-800">
                    {c.name}
                    {c.isViewer ? (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                        {group.isSubsidiary ? 'this company' : 'holding'}
                      </span>
                    ) : (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                        subsidiary
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                    {c.openCount}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-900">
                    {formatMoney(c.openAmount)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                    {formatMoney(c.weightedAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
