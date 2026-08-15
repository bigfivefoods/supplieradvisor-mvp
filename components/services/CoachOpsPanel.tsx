'use client';

/**
 * Coach ops on owner coaches page: payout snapshot, performance, private clients.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  computeCoachPerformance,
  computeCoachPayoutSnapshot,
  formatZar,
  privateClientsForCoach,
} from '@/lib/fitness/fitgraph-coach-ops';
import type { FitCoach, FitgraphStore } from '@/lib/fitness/fitgraph';

type Props = {
  store: FitgraphStore;
  coach: FitCoach;
  saving?: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  onRefresh?: () => void;
};

export function CoachOpsPanel({
  store,
  coach,
  saving,
  post,
  onRefresh,
}: Props) {
  const [period, setPeriod] = useState(30);
  const [assignId, setAssignId] = useState('');

  const payout = useMemo(
    () => computeCoachPayoutSnapshot(store, coach.id, period),
    [store, coach.id, period]
  );
  const perf = useMemo(
    () => computeCoachPerformance(store, coach.id, period),
    [store, coach.id, period]
  );
  const privateClients = useMemo(
    () => privateClientsForCoach(store, coach.id),
    [store, coach.id]
  );

  const assignable = store.clients.filter(
    (c) =>
      c.active !== false &&
      c.id &&
      (!c.private_client || c.coach_id === coach.id)
  );

  const assignPrivate = async () => {
    if (!assignId) {
      toast.error('Select a member');
      return;
    }
    const client = store.clients.find((c) => c.id === assignId);
    if (!client) return;
    await post({
      entity: 'clients',
      action: 'upsert',
      record: {
        ...client,
        id: client.id,
        private_client: true,
        coach_id: coach.id,
      },
    });
    toast.success(`${client.name} assigned as private client`);
    setAssignId('');
    onRefresh?.();
  };

  const unassign = async (clientId: string) => {
    const client = store.clients.find((c) => c.id === clientId);
    if (!client) return;
    await post({
      entity: 'clients',
      action: 'upsert',
      record: {
        ...client,
        id: client.id,
        private_client: false,
        coach_id: client.coach_id === coach.id ? null : client.coach_id,
      },
    });
    toast.success('Private client unassigned');
    onRefresh?.();
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-700/50 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
          Coach ops · performance & private clients
        </p>
        <select
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold dark:border-amber-600 dark:bg-amber-950"
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
        >
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {perf ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg bg-white/80 dark:bg-slate-950/40 px-2 py-1.5 border border-amber-100 dark:border-amber-800">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Sessions</div>
            <div className="font-black text-slate-900 dark:text-slate-50">{perf.sessions}</div>
          </div>
          <div className="rounded-lg bg-white/80 dark:bg-slate-950/40 px-2 py-1.5 border border-amber-100 dark:border-amber-800">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Attendance</div>
            <div className="font-black text-slate-900 dark:text-slate-50">
              {perf.attendance_rate != null ? `${perf.attendance_rate}%` : '—'}
            </div>
          </div>
          <div className="rounded-lg bg-white/80 dark:bg-slate-950/40 px-2 py-1.5 border border-amber-100 dark:border-amber-800">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Avg feel</div>
            <div className="font-black text-slate-900 dark:text-slate-50">
              {perf.avg_member_feel != null ? `${perf.avg_member_feel}/5` : '—'}
            </div>
          </div>
          <div className="rounded-lg bg-white/80 dark:bg-slate-950/40 px-2 py-1.5 border border-amber-100 dark:border-amber-800">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Private clients</div>
            <div className="font-black text-slate-900 dark:text-slate-50">{perf.private_clients}</div>
          </div>
        </div>
      ) : null}

      {payout ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white/70 dark:bg-slate-950/40 px-2.5 py-2 text-xs">
          <p className="font-bold text-slate-800 dark:text-amber-50">Payout snapshot (tracking only)</p>
          <p className="text-slate-600 dark:text-amber-100/80 mt-0.5">
            {payout.classes_taught} classes · ~{payout.hours_approx}h · {payout.total_attended} attended · Est.{' '}
            <span className="font-black">{formatZar(payout.estimated_due_zar)}</span>{' '}
            ({payout.rate_basis.replace(/_/g, ' ')})
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{payout.note}</p>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">
          Private clients
        </p>
        {privateClients.length === 0 ? (
          <p className="text-[11px] text-slate-500 mb-1.5">None assigned.</p>
        ) : (
          <ul className="space-y-1 mb-2">
            {privateClients.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
                <button
                  type="button"
                  disabled={saving}
                  className="text-[10px] font-bold text-rose-600"
                  onClick={() => void unassign(c.id)}
                >
                  Unassign
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <select
            className="flex-1 min-w-[8rem] rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-[11px] dark:border-amber-600 dark:bg-amber-950"
            value={assignId}
            onChange={(e) => setAssignId(e.target.value)}
          >
            <option value="">Assign member…</option>
            {assignable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.private_client && c.coach_id === coach.id ? ' (already)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || !assignId}
            onClick={() => void assignPrivate()}
            className="rounded-xl bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Assign private
          </button>
        </div>
      </div>
    </div>
  );
}

export default CoachOpsPanel;
