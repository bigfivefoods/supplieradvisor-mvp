'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, History } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

type Event = {
  id: number;
  actor_user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  summary: string;
  created_at: string;
};

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ActivityFeed({
  limit = 25,
  title = 'Recent activity',
  className = '',
}: {
  limit?: number;
  title?: string;
  className?: string;
}) {
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/audit/activity?companyId=${companyId}&limit=${limit}`
      );
      const json = await res.json();
      if (res.ok) {
        setEvents(json.events || []);
        setWarning(json.warning || null);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`rounded-3xl border border-neutral-200 bg-white overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-100">
        <History className="w-4 h-4 text-[#00b4d8]" />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto text-[11px] font-semibold text-[#0077b6] hover:underline"
        >
          Refresh
        </button>
      </div>
      {warning && (
        <div className="px-5 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
          {warning}
        </div>
      )}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
        </div>
      ) : events.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-neutral-500">
          No audited actions yet. Period locks, QA, bank allocate, and escrow will appear here.
        </div>
      ) : (
        <ul className="divide-y max-h-[28rem] overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="px-5 py-3 hover:bg-neutral-50/80">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-snug">
                    {e.summary || e.action}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5 font-mono truncate">
                    {e.action}
                    {e.entity_type ? ` · ${e.entity_type}` : ''}
                    {e.entity_id ? ` #${e.entity_id}` : ''}
                  </p>
                </div>
                <time className="text-[10px] text-neutral-400 shrink-0 whitespace-nowrap">
                  {formatWhen(e.created_at)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
