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

type Kind = 'member' | 'private';
type Filter = 'all' | 'members' | 'private' | 'open';

function classOptionLabel(p: FitMembershipPlan): string {
  const when = p.schedule_label ? ` · ${p.schedule_label}` : '';
  return `${p.name}${when} · R${Number(p.price_zar || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
  })}`;
}

function money(n: number): string {
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

type Draft = {
  kind: Kind;
  planId: string;
  coachId: string;
  charged: string;
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

  const members = useMemo(() => {
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

  const visible = useMemo(() => {
    return members.filter((c) => {
      if (filter === 'members') return c.private_client !== true;
      if (filter === 'private') return c.private_client === true;
      if (filter === 'open') {
        return (
          !activeSubs.some((s) => s.client_id === c.id) &&
          !c.coach_id &&
          c.private_client !== true
        );
      }
      return true;
    });
  }, [members, activeSubs, filter]);

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
    const charged =
      c.agreed_rate_zar != null
        ? c.agreed_rate_zar
        : primary != null
          ? subscriptionChargeZar(primary, plan)
          : billed;
    const planCoach = plan?.default_coach_id || '';
    return {
      kind: c.private_client === true ? 'private' : 'member',
      planId: primary?.plan_id || c.membership_plan_id || '',
      coachId: c.coach_id || planCoach || '',
      charged: charged != null && charged !== 0 ? String(charged) : '',
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
    if (d.kind === 'member' && !d.planId) {
      toast.error(classSubscribe ? 'Select a class' : 'Select a plan');
      return;
    }
    if (d.kind === 'private' && !d.coachId) {
      toast.error('Select the coach for this private client');
      return;
    }
    const chargedRaw = d.charged.trim();
    const chargedZar =
      chargedRaw === '' ? null : Number(chargedRaw.replace(',', '.'));
    if (chargedZar != null && !Number.isFinite(chargedZar)) {
      toast.error('Client actual rate must be a number');
      return;
    }
    setBusyId(c.id);
    try {
      const data = await post({
        action: 'allocate_member',
        client_id: c.id,
        kind: d.kind,
        plan_id: d.planId || null,
        coach_id: d.coachId || null,
        charged_zar: chargedZar,
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
    all: members.length,
    members: members.filter((c) => c.private_client !== true).length,
    private: members.filter((c) => c.private_client === true).length,
    open: members.filter(
      (c) =>
        !activeSubs.some((s) => s.client_id === c.id) &&
        !c.coach_id &&
        c.private_client !== true
    ).length,
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        <strong>Member</strong> = class + coach. <strong>Private client</strong> =
        coach (class optional).{' '}
        <strong>Membership rate</strong> comes from the class.{' '}
        <strong>Client actual rate</strong> is the agreed amount if different.
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
          first. Private clients can still be saved with a coach only.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No people in this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-yellow-200 bg-white dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-yellow-50 text-left text-[10px] font-black uppercase tracking-wider text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
              <tr>
                <th className="px-3 py-2.5">Person</th>
                <th className="px-3 py-2.5">Kind</th>
                <th className="px-3 py-2.5">
                  {classSubscribe ? 'Class' : 'Plan'}
                </th>
                <th className="px-3 py-2.5">Coach</th>
                <th className="px-3 py-2.5">Membership rate</th>
                <th className="px-3 py-2.5">Client actual rate</th>
                <th className="px-3 py-2.5">Status</th>
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
                        {d.kind === 'private' ? ' · private' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <select
                        className={fc()}
                        value={d.kind}
                        onChange={(e) =>
                          setDraft(c.id, {
                            kind: e.target.value as Kind,
                          })
                        }
                      >
                        <option value="member">Member</option>
                        <option value="private">Private client</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <select
                        className={fc()}
                        value={d.planId}
                        onChange={(e) => {
                          const planId = e.target.value;
                          const plan = classes.find((p) => p.id === planId);
                          const next: Partial<Draft> = { planId };
                          if (plan && !d.coachId && plan.default_coach_id) {
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
                          {d.kind === 'private'
                            ? 'Class optional…'
                            : classSubscribe
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
                    <td className="px-3 py-2 align-middle">
                      <select
                        className={fc()}
                        value={d.coachId}
                        onChange={(e) =>
                          setDraft(c.id, { coachId: e.target.value })
                        }
                      >
                        <option value="">
                          {d.kind === 'private'
                            ? 'Select coach…'
                            : 'Coach…'}
                        </option>
                        {coaches.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-middle tabular-nums">
                      {classRate != null ? (
                        <div>
                          <div className="font-semibold">{money(classRate)}</div>
                          <div className="text-[10px] text-slate-500">
                            from class
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          {d.kind === 'private' ? 'No class' : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        className={`${fc()} max-w-[8.5rem] tabular-nums`}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={
                          classRate != null ? String(classRate) : 'Agreed'
                        }
                        value={d.charged}
                        onChange={(e) =>
                          setDraft(c.id, { charged: e.target.value })
                        }
                      />
                      {billed != null &&
                      (d.charged === '' ||
                        Math.abs(billed - Number(d.charged || 0)) > 0.009) ? (
                        <div className="text-[10px] text-slate-500">
                          desk {money(billed)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <select
                        className={fc()}
                        value={d.status}
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
