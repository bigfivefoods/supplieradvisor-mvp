'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { StatRow } from '@/components/fitness/FitForm';
import {
  listSubscribeClasses,
  storeUsesClassSubscribe,
} from '@/lib/fitness/vuka-class-catalog';
import type { FitMembershipPlan } from '@/lib/fitness/fitgraph';

function billedFromNotes(notes?: string | null): string | null {
  const m = String(notes || '').match(/R\s*[\d]+(?:[.,]\d+)?\s*\/pm/i);
  return m ? m[0].replace(/\s+/g, '') : null;
}

function classLabel(p: FitMembershipPlan): string {
  const when = p.schedule_label ? ` · ${p.schedule_label}` : '';
  return `${p.name}${when}`;
}

export default function MembershipAllocatePage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const today = new Date().toISOString().slice(0, 10);
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const classes = useMemo(() => {
    if (!store) return [];
    if (classSubscribe) {
      const listed = listSubscribeClasses(store);
      if (listed.length) {
        return listed.map((c) => {
          const plan = store.membership_plans.find((p) => p.id === c.plan_id);
          return plan!;
        }).filter(Boolean);
      }
    }
    return [...store.membership_plans]
      .filter((p) => p.active !== false)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  }, [store, classSubscribe]);

  const members = useMemo(() => {
    if (!store) return [];
    const needle = q.trim().toLowerCase();
    return store.clients
      .filter((c) => c.active !== false)
      .filter((c) =>
        needle
          ? `${c.name} ${c.code} ${c.notes || ''}`.toLowerCase().includes(needle)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store, q]);

  const activeSubs = useMemo(
    () =>
      (store?.subscriptions || []).filter(
        (s) => s.status === 'active' || s.status === 'trialing'
      ),
    [store]
  );

  const visible = useMemo(() => {
    if (!onlyOpen) return members;
    return members.filter((c) => !activeSubs.some((s) => s.client_id === c.id));
  }, [members, activeSubs, onlyOpen]);

  const toggle = async (clientId: string, planId: string, on: boolean) => {
    if (!store) return;
    const key = `${clientId}:${planId}`;
    setBusyKey(key);
    try {
      const hit = (store.subscriptions || []).find(
        (s) =>
          s.client_id === clientId &&
          s.plan_id === planId &&
          (s.status === 'active' || s.status === 'trialing')
      );
      if (on) {
        if (hit) return;
        await post({
          entity: 'subscriptions',
          action: 'upsert',
          record: {
            client_id: clientId,
            plan_id: planId,
            status: 'active',
            started_at: today,
            auto_renew: true,
          },
        });
        toast.success('Class added');
      } else if (hit) {
        await post({
          entity: 'subscriptions',
          action: 'delete',
          id: hit.id,
        });
        toast.success('Class removed');
      }
    } catch {
      /* toast from useFitgraph */
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <FitgraphWorkbench
      title="Membership"
      titleAccent="allocate to classes"
      description={
        classSubscribe
          ? 'Tick the classes each member belongs to. Their fee is the sum of those classes. Then put the classes on Calendar and book them in.'
          : 'Assign each member to a membership plan. Status still lives on Subscriptions if you need pause or credits.'
      }
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <StatRow
            tone="owner"
            items={[
              { label: 'Members', value: store.clients.filter((c) => c.active !== false).length },
              {
                label: 'Unallocated',
                value: store.clients.filter(
                  (c) =>
                    c.active !== false &&
                    !activeSubs.some((s) => s.client_id === c.id)
                ).length,
              },
              {
                label: 'Active allocations',
                value: Number(summary?.activeSubscriptions) || activeSubs.length,
              },
              { label: 'Classes', value: classes.length },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3">
            <input
              className="min-w-[16rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              placeholder="Search members…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) => setOnlyOpen(e.target.checked)}
              />
              Only unallocated
            </label>
          </div>

          {classes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No classes yet.{' '}
              <a
                href="/dashboard/fitgraph/memberships"
                className="font-bold text-yellow-700 underline dark:text-yellow-300"
              >
                Add a class
              </a>{' '}
              first.
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              {onlyOpen
                ? 'Everyone showing has at least one class. Untick “Only unallocated” to edit them.'
                : 'No members match.'}
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((c) => {
                const mine = activeSubs.filter((s) => s.client_id === c.id);
                const mineIds = new Set(mine.map((s) => s.plan_id));
                const total = classes
                  .filter((p) => mineIds.has(p.id))
                  .reduce((n, p) => n + Number(p.price_zar || 0), 0);
                const billed = billedFromNotes(c.notes);
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-yellow-200 bg-white p-4 dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40"
                  >
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-yellow-50">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-yellow-200/80">
                          {c.code}
                          {billed ? ` · billed ${billed}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-black tabular-nums text-slate-900 dark:text-yellow-50">
                        R{total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        <span className="ml-1 text-[11px] font-bold text-slate-500">
                          /pm
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {classes.map((p) => {
                        const on = mineIds.has(p.id);
                        const key = `${c.id}:${p.id}`;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={saving && busyKey === key}
                            onClick={() => void toggle(c.id, p.id, !on)}
                            className={`rounded-full border px-2.5 py-1 text-left text-[11px] font-bold transition ${
                              on
                                ? 'border-yellow-700 bg-yellow-200 text-yellow-950 dark:border-yellow-300 dark:bg-yellow-400 dark:text-yellow-950'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-yellow-400 dark:border-white/15 dark:bg-white/5 dark:text-yellow-100'
                            }`}
                            title={`R${Number(p.price_zar || 0)}/pm`}
                          >
                            {classLabel(p)}
                            <span className="ml-1 font-semibold opacity-70">
                              R{Number(p.price_zar || 0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
