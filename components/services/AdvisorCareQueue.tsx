'use client';

/**
 * Proactive care queue — members sorted by relationship risk / cooling.
 */

import Link from 'next/link';
import { AlertTriangle, HeartHandshake, MessageSquare } from 'lucide-react';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import { buildCareQueue } from '@/lib/fitness/fitgraph-coach-ops';

type Props = {
  store: FitgraphStore;
  coachId?: string | null;
  title?: string;
  limit?: number;
  onMessage?: (clientId: string) => void;
};

const LEVEL_CLASS: Record<string, string> = {
  at_risk:
    'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-100',
  cooling:
    'bg-amber-100 text-amber-950 border-amber-200 dark:bg-amber-950 dark:text-amber-100',
  steady:
    'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100',
  strong:
    'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100',
  unknown:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200',
};

export function AdvisorCareQueue({
  store,
  coachId,
  title = 'Care queue',
  limit = 15,
  onMessage,
}: Props) {
  const items = buildCareQueue(store, { coachId, limit });

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/30 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-amber-50">
            <HeartHandshake className="w-4 h-4 text-amber-700" />
            {title}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-amber-100/80 mt-0.5">
            Members who may need a personal touch — sorted by relationship risk.
          </p>
        </div>
        <Link
          href="/dashboard/fitgraph/care"
          className="text-[11px] font-bold text-amber-900 underline dark:text-amber-200"
        >
          Full queue
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-amber-200/70">
          No at-risk or cooling members right now. Keep showing up.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.client_id}
              className="rounded-xl border border-amber-200/80 bg-white/90 dark:border-amber-800 dark:bg-slate-950/50 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-50 truncate">
                    {item.client_name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.coach_name
                      ? `Coach: ${item.coach_name}`
                      : 'No assigned coach'}
                    {item.health.metrics.days_since_attended != null
                      ? ` · ${item.health.metrics.days_since_attended}d since class`
                      : ''}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
                    LEVEL_CLASS[item.health.level] || LEVEL_CLASS.unknown
                  }`}
                >
                  {item.health.level === 'at_risk' ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : null}
                  {item.health.label} · {item.health.score}
                </span>
              </div>
              {item.health.suggested_actions[0] ? (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  → {item.health.suggested_actions[0].title}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Link
                  href="/dashboard/fitgraph/clients"
                  className="text-[11px] font-bold text-sky-700 dark:text-sky-300"
                >
                  Open clients
                </Link>
                <Link
                  href="/dashboard/fitgraph/messages"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 dark:text-fuchsia-300"
                  onClick={() => onMessage?.(item.client_id)}
                >
                  <MessageSquare className="w-3 h-3" /> Message
                </Link>
                <Link
                  href="/dashboard/fitgraph/calendar"
                  className="text-[11px] font-bold text-amber-800 dark:text-amber-200"
                >
                  Book class
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AdvisorCareQueue;
