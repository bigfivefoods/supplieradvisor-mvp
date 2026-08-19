'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { fc } from '@/components/fitness/FitForm';
import { parseBilledZar } from '@/lib/fitness/class-allocate';
import {
  subscriptionChargeZar,
  type FitClient,
  type FitMembershipPlan,
  type FitSubscription,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import { listSubscribeClasses } from '@/lib/fitness/vuka-class-catalog';

type PostFn = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

const STATUSES: FitSubscription['status'][] = [
  'active',
  'trialing',
  'paused',
  'past_due',
  'cancelled',
  'expired',
];

type Filter = 'all' | 'members' | 'private' | 'both' | 'open';

function classOptionLabel(p: FitMembershipPlan): string {
  const when = p.schedule_label ? ` · ${p.schedule_label}` : '';
  return `${p.name}${when} · R${Number(p.price_zar || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
  })}`;
}

function money(n: number): string {
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function parseRate(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

type Draft = {
  member: boolean;
  privateClient: boolean;
  planId: string;
  planIds: string[];
  coachId: string;
  charged: string;
  privateRate: string;
  status: FitSubscription['status'];
};

export function MemberAllocateTable({
  store,
  post,
  saving,
  classSubscribe,
  defaultOnlyOpen = false,
}: {
  store: FitgraphStore;
  post: PostFn;
  saving: boolean;
  classSubscribe: boolean;
  defaultOnlyOpen?: boolean;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>(
    defaultOnlyOpen ? 'open' : 'all'
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const coaches = useMemo(
    () => (store.coaches || []).filter((c) => c.active !== false),
    [store.coaches]
  );

  const classes = useMemo(() => {
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
      (store.subscriptions || []).filter(
        (s) => s.status === 'active' || s.status === 'trialing'
      ),
    [store]
  );

  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return store.clients
      .filter((c) => c.active !== false)
      .filter((c) =>
        needle
          ? `${c.name} ${c.code} ${c.notes || ''}`.toLowerCase().includes(needle)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store.clients, q]);

  const isOnClass = (c: FitClient) =>
    activeSubs.some((s) => s.client_id === c.id) ||
    Boolean(c.membership_plan_id);

  const visible = useMemo(() => {
    return people.filter((c) => {
      const member = isOnClass(c);
      const priv = c.private_client === true;
      if (filter === 'members') return member;
      if (filter === 'private') return priv;
      if (filter === 'both') return member && priv;
      if (filter === 'open') return !member && !priv;
      return true;
    });
  }, [people, activeSubs, filter]);

  const defaultDraft = (c: FitClient): Draft => {
    const mine = (store.subscriptions || []).filter((s) => s.client_id === c.id);
    const live = mine.filter(
      (s) => s.status === 'active' || s.status === 'trialing'
    );
    const primary =
      live.find((s) => {
        const p = classes.find((x) => x.id === s.plan_id);
        return p && p.addon !== true;
      }) ||
      live[0] ||
      mine[0];
    const plan = primary
      ? classes.find((p) => p.id === primary.plan_id)
      : undefined;
    const billed = parseBilledZar(c.notes);
    const classActual =
      primary != null
        ? subscriptionChargeZar(primary, plan)
        : c.agreed_rate_zar != null
          ? c.agreed_rate_zar
          : billed;
    const planCoach = plan?.default_coach_id || '';
    const planIds = live
      .map((s) => s.plan_id)
      .filter((id) => classes.some((p) => p.id === id));
    const onClass = planIds.length > 0 || Boolean(c.membership_plan_id);
    return {
      member: onClass || c.private_client !== true,
      privateClient: c.private_client === true,
      planId: primary?.plan_id || c.membership_plan_id || planIds[0] || '',
      planIds:
        planIds.length > 0
          ? planIds
          : c.membership_plan_id
            ? [c.membership_plan_id]
            : [],
      coachId: c.coach_id || planCoach || '',
      charged:
        classActual != null && classActual !== 0 ? String(classActual) : '',
      privateRate:
        c.private_rate_zar != null ? String(c.private_rate_zar) : '',
      status: primary?.status || 'active',
    };
  };

  const draftFor = (c: FitClient): Draft => drafts[c.id] || defaultDraft(c);

  const setDraft = (id: string, patch: Partial<Draft>) => {
    const current = draftFor(store.clients.find((c) => c.id === id)!);
    setDrafts((d) => ({ ...d, [id]: { ...current, ...patch } }));
  };

  const save = async (c: FitClient) => {
    const d = draftFor(c);
    if (!d.member && !d.privateClient) {
      toast.error('Tick Member, Private client, or both');
      return;
    }
    const planIds = classSubscribe
      ? d.planIds.filter(Boolean)
      : d.planId
        ? [d.planId]
        : [];
    if (d.member && !planIds.length) {
      toast.error(classSubscribe ? 'Select the classes they are booked to' : 'Select a plan');
      return;
    }
    if (d.privateClient && !d.coachId) {
      toast.error('Select the coach for this private client');
      return;
    }
    const chargedZar = parseRate(d.charged);
    const privateRateZar = parseRate(d.privateRate);
    if (Number.isNaN(chargedZar as number)) {
      toast.error('Class actual rate must be a number');
      return;
    }
    if (Number.isNaN(privateRateZar as number)) {
      toast.error('Private rate must be a number');
      return;
    }
    setBusyId(c.id);
    try {
      const data = await post({
        action: 'allocate_member',
        client_id: c.id,
        member: d.member,
        private_client: d.privateClient,
        plan_id: planIds[0] || null,
        plan_ids: planIds,
        coach_id: d.coachId || null,
        charged_zar: chargedZar,
        private_rate_zar: privateRateZar,
        status: d.status,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      toast.success((data?.message as string) || 'Saved');
    } catch {
      /* toast */
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    all: people.length,
    members: people.filter((c) => isOnClass(c)).length,
    private: people.filter((c) => c.private_client === true).length,
    both: people.filter((c) => isOnClass(c) && c.private_client === true)
      .length,
    open: people.filter((c) => !isOnClass(c) && c.private_client !== true)
      .length,
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Tick <strong>Member</strong> and/or <strong>Private client</strong> —
        someone can be both. Member gets a class and a class actual rate.
        Private client gets a coach and a private rate.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[14rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          placeholder="Search people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(
          [
            ['all', `All ${counts.all}`],
            ['members', `Members ${counts.members}`],
            ['private', `Private ${counts.private}`],
            ['both', `Both ${counts.both}`],
            ['open', `Unallocated ${counts.open}`],
          ] as Array<[Filter, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              filter === k
                ? 'border-yellow-500 bg-yellow-300 text-yellow-950'
                : 'border-slate-200 bg-white text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-yellow-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {classes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No {classSubscribe ? 'classes' : 'plans'} yet.{' '}
          <a
            href="/dashboard/fitgraph/memberships"
            className="font-bold text-yellow-700 underline dark:text-yellow-300"
          >
            Add one
          </a>{' '}
          first. Private clients can still be saved with a coach and rate.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No people in this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-yellow-200 bg-white dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-yellow-50 text-left text-[10px] font-black uppercase tracking-wider text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
              <tr>
                <th className="px-3 py-2.5">Person</th>
                <th className="px-3 py-2.5">Roles</th>
                <th className="px-3 py-2.5">
                  {classSubscribe ? 'Classes booked' : 'Plan'}
                </th>
                <th className="px-3 py-2.5">Membership rate</th>
                <th className="px-3 py-2.5">Class actual rate</th>
                <th className="px-3 py-2.5">Coach</th>
                <th className="px-3 py-2.5">Private rate</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const d = draftFor(c);
                const selectedPlans = classes.filter((p) =>
                  (d.planIds.length ? d.planIds : d.planId ? [d.planId] : []).includes(
                    p.id
                  )
                );
                const classRate = selectedPlans.length
                  ? selectedPlans.reduce(
                      (n, p) => n + (Number(p.price_zar) || 0),
                      0
                    )
                  : null;
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
                        {d.member && d.privateClient
                          ? ' · member + private'
                          : d.privateClient
                            ? ' · private'
                            : d.member
                              ? ' · member'
                              : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold">
                        <input
                          type="checkbox"
                          checked={d.member}
                          onChange={(e) =>
                            setDraft(c.id, { member: e.target.checked })
                          }
                        />
                        Member
                      </label>
                      <label className="mt-1 flex items-center gap-1.5 text-[11px] font-bold">
                        <input
                          type="checkbox"
                          checked={d.privateClient}
                          onChange={(e) =>
                            setDraft(c.id, {
                              privateClient: e.target.checked,
                            })
                          }
                        />
                        Private client
                      </label>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {classSubscribe ? (
                        <div
                          className={`max-h-36 min-w-[14rem] overflow-y-auto rounded-xl border px-2 py-1.5 ${
                            d.member
                              ? 'border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                              : 'border-slate-100 bg-slate-50 opacity-60'
                          }`}
                        >
                          {classes.map((p) => {
                            const on = d.planIds.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className="flex items-start gap-2 py-0.5 text-[11px]"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  disabled={!d.member}
                                  checked={on}
                                  onChange={() => {
                                    const planIds = on
                                      ? d.planIds.filter((id) => id !== p.id)
                                      : [...d.planIds, p.id];
                                    const next: Partial<Draft> = {
                                      planIds,
                                      planId: planIds[0] || '',
                                      member: true,
                                    };
                                    if (
                                      !d.coachId &&
                                      !d.privateClient &&
                                      p.default_coach_id
                                    ) {
                                      next.coachId = p.default_coach_id;
                                    }
                                    if (
                                      !d.charged.trim() &&
                                      Number(p.price_zar || 0) > 0
                                    ) {
                                      next.charged = String(p.price_zar);
                                    }
                                    setDraft(c.id, next);
                                  }}
                                />
                                <span>
                                  <span className="font-semibold">{p.name}</span>
                                  {p.schedule_label ? (
                                    <span className="text-slate-500">
                                      {' '}
                                      · {p.schedule_label}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <select
                          className={fc()}
                          value={d.planId}
                          disabled={!d.member}
                          onChange={(e) => {
                            const planId = e.target.value;
                            const plan = classes.find((p) => p.id === planId);
                            const next: Partial<Draft> = {
                              planId,
                              planIds: planId ? [planId] : [],
                            };
                            if (
                              plan &&
                              !d.coachId &&
                              !d.privateClient &&
                              plan.default_coach_id
                            ) {
                              next.coachId = plan.default_coach_id;
                            }
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
                            {d.member ? 'Select plan…' : '—'}
                          </option>
                          {classes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {classOptionLabel(p)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle tabular-nums">
                      {d.member && classRate != null ? (
                        <div>
                          <div className="font-semibold">{money(classRate)}</div>
                          <div className="text-[10px] text-slate-500">
                            {selectedPlans.length > 1
                              ? `${selectedPlans.length} classes`
                              : 'from class'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        className={`${fc()} max-w-[8.5rem] tabular-nums`}
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!d.member}
                        placeholder={
                          classRate != null ? String(classRate) : 'Agreed'
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
                        value={d.coachId}
                        disabled={!d.privateClient && !d.member}
                        onChange={(e) =>
                          setDraft(c.id, { coachId: e.target.value })
                        }
                      >
                        <option value="">
                          {d.privateClient ? 'Select coach…' : 'Coach…'}
                        </option>
                        {coaches.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        className={`${fc()} max-w-[8.5rem] tabular-nums`}
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!d.privateClient}
                        placeholder="Private / PT"
                        value={d.privateRate}
                        onChange={(e) =>
                          setDraft(c.id, { privateRate: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <select
                        className={fc()}
                        value={d.status}
                        disabled={!d.member}
                        onChange={(e) =>
                          setDraft(c.id, {
                            status: e.target.value as FitSubscription['status'],
                          })
                        }
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={saving && busyId === c.id}
                        onClick={() => void save(c)}
                        className="rounded-xl bg-yellow-400 px-3 py-1.5 text-xs font-black text-yellow-950 disabled:opacity-50"
                      >
                        Save
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
  );
}
