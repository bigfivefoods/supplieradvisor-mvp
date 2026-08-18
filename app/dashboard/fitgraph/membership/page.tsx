'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { StatRow, fc } from '@/components/fitness/FitForm';
import { parseBilledZar } from '@/lib/fitness/class-allocate';
import {
  subscriptionChargeZar,
  type FitClient,
  type FitMembershipPlan,
} from '@/lib/fitness/fitgraph';
import {
  listSubscribeClasses,
  storeUsesClassSubscribe,
} from '@/lib/fitness/vuka-class-catalog';

function classOptionLabel(p: FitMembershipPlan): string {
  const when = p.schedule_label ? ` · ${p.schedule_label}` : '';
  const price = Number(p.price_zar || 0);
  return `${p.name}${when} · R${price.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
  })}`;
}

function money(n: number): string {
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

type Draft = { planId: string; charged: string };

export default function MembershipAllocatePage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const classes = useMemo(() => {
    if (!store) return [];
    if (classSubscribe) {
      const listed = listSubscribeClasses(store);
      if (listed.length) {
        return listed
          .map((c) => store.membership_plans.find((p) => p.id === c.plan_id))
          .filter((p): p is FitMembershipPlan => Boolean(p));
      }
    }
    return [...store.membership_plans]
      .filter((p) => p.active !== false)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  }, [store, classSubscribe]);

  const activeSubs = useMemo(
    () =>
      (store?.subscriptions || []).filter(
        (s) => s.status === 'active' || s.status === 'trialing'
      ),
    [store]
  );

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

  const visible = useMemo(() => {
    if (!onlyOpen) return members;
    return members.filter((c) => !activeSubs.some((s) => s.client_id === c.id));
  }, [members, activeSubs, onlyOpen]);

  const defaultDraft = (c: FitClient): Draft => {
    const mine = activeSubs.filter((s) => s.client_id === c.id);
    const primary =
      mine.find((s) => {
        const p = classes.find((x) => x.id === s.plan_id);
        return p && p.addon !== true;
      }) || mine[0];
    const plan = primary
      ? classes.find((p) => p.id === primary.plan_id)
      : undefined;
    const billed = parseBilledZar(c.notes);
    const charged =
      primary != null
        ? subscriptionChargeZar(primary, plan)
        : billed;
    return {
      planId: primary?.plan_id || '',
      charged: charged != null && charged !== 0 ? String(charged) : '',
    };
  };

  const draftFor = (c: FitClient): Draft => drafts[c.id] || defaultDraft(c);

  const setDraft = (id: string, patch: Partial<Draft>) => {
    const current = store
      ? draftFor(store.clients.find((c) => c.id === id)!)
      : { planId: '', charged: '' };
    setDrafts((d) => ({ ...d, [id]: { ...current, ...patch } }));
  };

  const allocate = async (c: FitClient) => {
    const d = draftFor(c);
    if (!d.planId) {
      toast.error('Select a class');
      return;
    }
    const chargedRaw = d.charged.trim();
    const chargedZar =
      chargedRaw === '' ? null : Number(chargedRaw.replace(',', '.'));
    if (chargedZar != null && !Number.isFinite(chargedZar)) {
      toast.error('Charged rate must be a number');
      return;
    }
    setBusyId(c.id);
    try {
      const data = await post({
        action: 'allocate_member',
        client_id: c.id,
        plan_id: d.planId,
        charged_zar: chargedZar,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      toast.success((data?.message as string) || 'Allocated');
    } catch {
      /* toast from useFitgraph */
    } finally {
      setBusyId(null);
    }
  };

  return (
    <FitgraphWorkbench
      title="Membership"
      titleAccent="allocate to classes"
      description={
        classSubscribe
          ? 'List of members with the class list price and the rate you charge. Allocate each person to a class — they then appear on that class in Calendar once it is scheduled.'
          : 'Assign each member to a membership plan and set the charged rate. Status still lives on Subscriptions if you need pause or credits.'
      }
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <StatRow
            tone="owner"
            items={[
              {
                label: 'Members',
                value: store.clients.filter((c) => c.active !== false).length,
              },
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
                value:
                  Number(summary?.activeSubscriptions) || activeSubs.length,
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
          ) : visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              {onlyOpen
                ? 'Everyone showing has at least one class. Untick “Only unallocated” to edit them.'
                : 'No members match.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-yellow-200 bg-white dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-yellow-50 text-left text-[10px] font-black uppercase tracking-wider text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
                  <tr>
                    <th className="px-3 py-2.5">Member</th>
                    <th className="px-3 py-2.5">Class rate</th>
                    <th className="px-3 py-2.5">Charged /pm</th>
                    <th className="px-3 py-2.5">
                      {classSubscribe ? 'Class' : 'Plan'}
                    </th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => {
                    const d = draftFor(c);
                    const selected = classes.find((p) => p.id === d.planId);
                    const classRate = selected
                      ? Number(selected.price_zar || 0)
                      : null;
                    const billed = parseBilledZar(c.notes);
                    const extras = activeSubs.filter(
                      (s) =>
                        s.client_id === c.id &&
                        s.plan_id !== d.planId
                    ).length;
                    return (
                      <tr
                        key={c.id}
                        className="border-t border-slate-100 dark:border-white/10"
                      >
                        <td className="px-3 py-2 align-middle">
                          <div className="font-semibold text-slate-900 dark:text-yellow-50">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-yellow-200/80">
                            {c.code}
                            {extras > 0 ? ` · +${extras} more` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle tabular-nums">
                          {classRate != null ? (
                            <span className="font-semibold">
                              {money(classRate)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {billed != null &&
                          (classRate == null ||
                            Math.abs(billed - classRate) > 0.009) ? (
                            <div className="text-[10px] text-slate-500">
                              desk {money(billed)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            className={`${fc()} max-w-[8rem] tabular-nums`}
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder={
                              classRate != null
                                ? String(classRate)
                                : 'Rate'
                            }
                            value={d.charged}
                            onChange={(e) =>
                              setDraft(c.id, { charged: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <select
                            className={fc()}
                            value={d.planId}
                            onChange={(e) => {
                              const planId = e.target.value;
                              const plan = classes.find((p) => p.id === planId);
                              const next: Partial<Draft> = { planId };
                              if (
                                !d.charged.trim() &&
                                plan &&
                                Number(plan.price_zar || 0) > 0
                              ) {
                                next.charged = String(plan.price_zar);
                              }
                              setDraft(c.id, next);
                            }}
                          >
                            <option value="">
                              {classSubscribe
                                ? 'Select class…'
                                : 'Select plan…'}
                            </option>
                            {classes.map((p) => (
                              <option key={p.id} value={p.id}>
                                {classOptionLabel(p)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={saving && busyId === c.id}
                            onClick={() => void allocate(c)}
                            className="rounded-xl bg-yellow-400 px-3 py-1.5 text-xs font-black text-yellow-950 disabled:opacity-50"
                          >
                            Allocate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
