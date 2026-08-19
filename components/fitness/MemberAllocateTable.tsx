'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
import {
  MemberMembershipFacts,
  memberImportedSummaryLine,
} from '@/components/fitness/MemberMembershipFacts';

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

function rateField(raw: string, fallback: number | null): number | null {
  const parsed = parseRate(raw);
  if (parsed == null) return fallback;
  return Number.isNaN(parsed) ? NaN : parsed;
}

type Draft = {
  name: string;
  email: string;
  phone: string;
  notes: string;
  member: boolean;
  privateClient: boolean;
  planId: string;
  planIds: string[];
  charges: Record<string, string>;
  coachId: string;
  privateRate: string;
  status: FitSubscription['status'];
};

function RateInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      className={`${fc()} min-w-[8.5rem] tabular-nums text-right font-semibold`}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
    />
  );
}

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
  const [classFilter, setClassFilter] = useState('');
  const [classQ, setClassQ] = useState('');
  const [filter, setFilter] = useState<Filter>(
    defaultOnlyOpen ? 'open' : 'all'
  );
  const [openId, setOpenId] = useState<string | null>(null);
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
          ? `${c.name} ${c.code} ${c.email || ''} ${c.phone || ''} ${c.notes || ''} ${c.id_number || ''} ${c.occupation || ''} ${c.debit_bank?.bank_name || ''} ${c.debit_bank?.account_number || ''}`
              .toLowerCase()
              .includes(needle)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store.clients, q]);

  const isOnClass = (c: FitClient) =>
    activeSubs.some((s) => s.client_id === c.id) ||
    Boolean(c.membership_plan_id);

  const visible = useMemo(() => {
    const rows = people.filter((c) => {
      const member = isOnClass(c);
      const priv = c.private_client === true;
      if (filter === 'members') return member;
      if (filter === 'private') return priv;
      if (filter === 'both') return member && priv;
      if (filter === 'open') return !member && !priv;
      return true;
    });
    if (!classFilter) return rows;
    return [...rows].sort((a, b) => {
      const aOn = activeSubs.some(
        (s) => s.client_id === a.id && s.plan_id === classFilter
      )
        ? 1
        : 0;
      const bOn = activeSubs.some(
        (s) => s.client_id === b.id && s.plan_id === classFilter
      )
        ? 1
        : 0;
      return aOn - bOn || a.name.localeCompare(b.name);
    });
  }, [people, activeSubs, filter, classFilter]);

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
    const planCoach = plan?.default_coach_id || '';
    const planIds = live
      .map((s) => s.plan_id)
      .filter((id) => classes.some((p) => p.id === id));
    const onClass = planIds.length > 0 || Boolean(c.membership_plan_id);
    const charges: Record<string, string> = {};
    for (const s of live) {
      const p = classes.find((x) => x.id === s.plan_id);
      const amt = subscriptionChargeZar(s, p);
      if (amt != null && Number.isFinite(amt)) charges[s.plan_id] = String(amt);
    }
    if (
      primary &&
      !charges[primary.plan_id] &&
      (c.agreed_rate_zar != null || billed != null)
    ) {
      const fallback = c.agreed_rate_zar != null ? c.agreed_rate_zar : billed;
      if (fallback != null) charges[primary.plan_id] = String(fallback);
    }
    return {
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      notes: c.notes || '',
      member: onClass || c.private_client !== true,
      privateClient: c.private_client === true,
      planId: primary?.plan_id || c.membership_plan_id || planIds[0] || '',
      planIds:
        planIds.length > 0
          ? planIds
          : c.membership_plan_id
            ? [c.membership_plan_id]
            : [],
      charges,
      coachId: c.coach_id || planCoach || '',
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

  const selectedPlanIds = (d: Draft): string[] =>
    classSubscribe
      ? d.planIds.filter(Boolean)
      : d.planId
        ? [d.planId]
        : [];

  const totalsFor = (d: Draft) => {
    const ids = selectedPlanIds(d);
    const selected = classes.filter((p) => ids.includes(p.id));
    const standard = selected.reduce(
      (n, p) => n + (Number(p.price_zar) || 0),
      0
    );
    let actual = 0;
    let invalid = false;
    for (const p of selected) {
      const n = rateField(d.charges[p.id] || '', Number(p.price_zar) || 0);
      if (Number.isNaN(n as number)) invalid = true;
      else actual += n || 0;
    }
    return { selected, standard, actual, invalid };
  };

  const dirty = (c: FitClient, d: Draft) => {
    const base = defaultDraft(c);
    const ids = selectedPlanIds(d).slice().sort().join(',');
    const baseIds = selectedPlanIds(base).slice().sort().join(',');
    if (
      d.name !== base.name ||
      d.email !== base.email ||
      d.phone !== base.phone ||
      d.notes !== base.notes ||
      d.member !== base.member ||
      d.privateClient !== base.privateClient ||
      d.coachId !== base.coachId ||
      d.privateRate !== base.privateRate ||
      d.status !== base.status ||
      ids !== baseIds
    ) {
      return true;
    }
    return selectedPlanIds(d).some(
      (id) => (d.charges[id] || '') !== (base.charges[id] || '')
    );
  };

  const toggleClass = (c: FitClient, p: FitMembershipPlan) => {
    const d = draftFor(c);
    const charges = { ...d.charges };
    const fillCharge = () => {
      if (!String(charges[p.id] || '').trim()) {
        const list = Number(p.price_zar) || 0;
        if (list > 0) charges[p.id] = String(list);
      }
    };
    if (!classSubscribe) {
      fillCharge();
      const next: Partial<Draft> = {
        planId: p.id,
        planIds: [p.id],
        member: true,
        charges,
      };
      if (!d.coachId && !d.privateClient && p.default_coach_id) {
        next.coachId = p.default_coach_id;
      }
      setDraft(c.id, next);
      return;
    }
    const on = d.planIds.includes(p.id);
    const planIds = on
      ? d.planIds.filter((id) => id !== p.id)
      : [...d.planIds, p.id];
    if (!on) fillCharge();
    const next: Partial<Draft> = {
      planIds,
      planId: planIds[0] || '',
      member: true,
      charges,
    };
    if (!d.coachId && !d.privateClient && p.default_coach_id) {
      next.coachId = p.default_coach_id;
    }
    setDraft(c.id, next);
  };

  const save = async (c: FitClient) => {
    const d = draftFor(c);
    if (!d.name.trim()) {
      toast.error('Name required');
      return;
    }
    if (!d.member && !d.privateClient) {
      toast.error('Tick Member, Private client, or both');
      return;
    }
    const planIds = selectedPlanIds(d);
    if (d.member && !planIds.length) {
      toast.error(
        classSubscribe ? 'Select the classes they are booked to' : 'Select a plan'
      );
      return;
    }
    if (d.privateClient && !d.coachId) {
      toast.error('Select the coach for this private client');
      return;
    }
    const chargesByPlanId: Record<string, number> = {};
    let chargedTotal = 0;
    for (const id of planIds) {
      const plan = classes.find((p) => p.id === id);
      const list = Number(plan?.price_zar) || 0;
      const n = rateField(d.charges[id] || '', list);
      if (Number.isNaN(n as number)) {
        toast.error('Class actual rate must be a number');
        return;
      }
      const amt = n == null ? list : n;
      chargesByPlanId[id] = amt;
      chargedTotal += amt;
    }
    const privateRateZar = parseRate(d.privateRate);
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
        charges_by_plan_id: chargesByPlanId,
        charged_zar: d.member ? chargedTotal : privateRateZar,
        coach_id: d.coachId || null,
        private_rate_zar: privateRateZar,
        status: d.status,
        name: d.name.trim(),
        email: d.email.trim(),
        phone: d.phone.trim(),
        notes: d.notes,
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

  const classNeedle = classQ.trim().toLowerCase();
  const filteredClasses = classNeedle
    ? classes.filter((p) =>
        `${p.name} ${p.schedule_label || ''} ${p.code || ''}`
          .toLowerCase()
          .includes(classNeedle)
      )
    : classes;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Open a person, tick the classes they attend, then Save. Each class has a{' '}
        <strong>standard rate</strong> (the class list price) and an{' '}
        <strong>actual rate</strong> you charge them. Contact details save with
        the booking.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[14rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          placeholder="Search people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="min-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All classes</option>
          {classes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.schedule_label ? ` · ${p.schedule_label}` : ''}
            </option>
          ))}
        </select>
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
      {classFilter ? (
        <p className="text-[11px] text-slate-500">
          People not on this class are listed first. Use{' '}
          <strong>Add to class</strong> then set their actual rate and Save.
        </p>
      ) : null}

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
        <div className="space-y-2">
          {visible.map((c) => {
            const d = draftFor(c);
            const open = openId === c.id;
            const { selected, standard, actual } = totalsFor(d);
            const changed = dirty(c, d);
            const coachName = coaches.find((x) => x.id === d.coachId)?.name;
            const onFilteredClass =
              Boolean(classFilter) && selectedPlanIds(d).includes(classFilter);
            return (
              <article
                key={c.id}
                className={`rounded-2xl border bg-white dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40 ${
                  changed
                    ? 'border-yellow-400 ring-1 ring-yellow-300'
                    : 'border-yellow-200'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3 px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    className="mt-0.5 rounded-lg p-1 text-slate-500 hover:bg-yellow-100 dark:text-yellow-200 dark:hover:bg-yellow-900"
                    aria-expanded={open}
                    aria-label={open ? 'Hide details' : 'Assign classes'}
                    onClick={() => setOpenId(open ? null : c.id)}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-[11rem] flex-1">
                    <div className="font-semibold text-slate-900 dark:text-yellow-50">
                      {d.name || c.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-yellow-200/80">
                      {c.code}
                      {d.email ? ` · ${d.email}` : ''}
                      {d.phone ? ` · ${d.phone}` : ''}
                      {d.member && d.privateClient
                        ? ' · member + private'
                        : d.privateClient
                          ? ' · private'
                          : d.member
                            ? ' · member'
                            : ''}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-600 dark:text-yellow-100/90">
                      {memberImportedSummaryLine(c) ||
                        'No imported bank / ID on file'}
                    </div>
                  </div>
                  <div className="min-w-[14rem] flex-[2]">
                    {d.member && selected.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selected.map((p) => {
                          const list = Number(p.price_zar) || 0;
                          const charged =
                            rateField(d.charges[p.id] || '', list) ?? list;
                          const highlight = p.id === classFilter;
                          return (
                            <span
                              key={p.id}
                              className={`inline-flex max-w-full flex-col rounded-lg border px-2 py-1 ${
                                highlight
                                  ? 'border-yellow-500 bg-yellow-200 text-yellow-950'
                                  : 'border-slate-200 bg-slate-50 dark:border-yellow-700 dark:bg-yellow-900/40'
                              }`}
                            >
                              <span className="truncate text-[11px] font-semibold">
                                {p.name}
                              </span>
                              <span className="tabular-nums text-[11px] font-bold">
                                {money(Number(charged) || 0)}
                                {list > 0 && charged !== list ? (
                                  <span className="ml-1 font-medium text-slate-500 dark:text-yellow-200/80">
                                    std {money(list)}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {d.privateClient
                          ? 'No classes — private only'
                          : 'No classes booked'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-[10.5rem] text-right">
                    {d.member && selected.length ? (
                      <>
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-yellow-200/70">
                          Charged
                        </div>
                        <div className="text-base font-black tabular-nums text-slate-900 dark:text-yellow-50">
                          {money(actual)}
                        </div>
                        <div className="text-[11px] tabular-nums text-slate-500 dark:text-yellow-200/80">
                          Standard {money(standard)}
                        </div>
                      </>
                    ) : d.privateClient && d.privateRate ? (
                      <>
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-yellow-200/70">
                          Private
                        </div>
                        <div className="text-base font-black tabular-nums">
                          {money(Number(d.privateRate) || 0)}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {classFilter ? (
                      <div
                        className={`mt-1 text-[10px] font-bold ${
                          onFilteredClass
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {onFilteredClass ? 'On this class' : 'Not on this class'}
                      </div>
                    ) : null}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {classFilter && !onFilteredClass ? (
                      <button
                        type="button"
                        className="rounded-xl border border-yellow-400 bg-yellow-50 px-3 py-1.5 text-xs font-bold text-yellow-950 dark:bg-yellow-900 dark:text-yellow-50"
                        onClick={() => {
                          const p = classes.find((x) => x.id === classFilter);
                          if (p) toggleClass(c, p);
                          setOpenId(c.id);
                        }}
                      >
                        Add to class
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-yellow-700 dark:text-yellow-100"
                      onClick={() => setOpenId(open ? null : c.id)}
                    >
                      {open ? 'Close' : 'Assign'}
                    </button>
                    <button
                      type="button"
                      disabled={saving && busyId === c.id}
                      onClick={() => void save(c)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black disabled:opacity-50 ${
                        changed
                          ? 'bg-yellow-400 text-yellow-950'
                          : 'bg-yellow-200 text-yellow-950'
                      }`}
                    >
                      {saving && busyId === c.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="space-y-4 border-t border-yellow-100 px-3 py-4 sm:px-4 dark:border-yellow-800">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Name
                        <input
                          className={`${fc()} mt-1 font-semibold`}
                          value={d.name}
                          onChange={(e) =>
                            setDraft(c.id, { name: e.target.value })
                          }
                        />
                      </label>
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Email
                        <input
                          className={`${fc()} mt-1`}
                          type="email"
                          value={d.email}
                          onChange={(e) =>
                            setDraft(c.id, { email: e.target.value })
                          }
                        />
                      </label>
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Phone
                        <input
                          className={`${fc()} mt-1`}
                          value={d.phone}
                          onChange={(e) =>
                            setDraft(c.id, { phone: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Notes
                      <textarea
                        className={`${fc()} mt-1 min-h-[4.5rem]`}
                        value={d.notes}
                        onChange={(e) =>
                          setDraft(c.id, { notes: e.target.value })
                        }
                      />
                    </label>

                    <MemberMembershipFacts client={c} />

                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={d.member}
                          onChange={(e) =>
                            setDraft(c.id, { member: e.target.checked })
                          }
                        />
                        Member
                      </label>
                      <label className="flex items-center gap-2 text-sm font-bold">
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
                    </div>

                    {d.member ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-yellow-800 dark:bg-yellow-950/40">
                        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                              {classSubscribe ? 'Classes booked' : 'Plan'}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Standard is the class list price. Actual is what
                              this person pays.
                            </p>
                          </div>
                          {classSubscribe && classes.length > 6 ? (
                            <input
                              className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                              placeholder="Filter classes…"
                              value={classQ}
                              onChange={(e) => setClassQ(e.target.value)}
                            />
                          ) : null}
                        </div>

                        {classSubscribe ? (
                          <div className="space-y-2">
                            {filteredClasses.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No classes match that filter.
                              </p>
                            ) : (
                              filteredClasses.map((p) => {
                                const on = d.planIds.includes(p.id);
                                const list = Number(p.price_zar) || 0;
                                const chargedRaw = d.charges[p.id] || '';
                                const chargedN = rateField(
                                  chargedRaw,
                                  list
                                );
                                const differs =
                                  on &&
                                  chargedN != null &&
                                  !Number.isNaN(chargedN) &&
                                  chargedN !== list;
                                return (
                                  <div
                                    key={p.id}
                                    className={`rounded-xl border px-3 py-2.5 ${
                                      on
                                        ? p.id === classFilter
                                          ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/60'
                                          : 'border-yellow-300 bg-white dark:border-yellow-600 dark:bg-yellow-950'
                                        : 'border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-start gap-3">
                                      <label className="flex min-w-[14rem] flex-1 items-start gap-2">
                                        <input
                                          type="checkbox"
                                          className="mt-1"
                                          checked={on}
                                          onChange={() => toggleClass(c, p)}
                                        />
                                        <span>
                                          <span className="block font-semibold text-slate-900 dark:text-yellow-50">
                                            {p.name}
                                          </span>
                                          {p.schedule_label ? (
                                            <span className="text-[11px] text-slate-500 dark:text-yellow-200/80">
                                              {p.schedule_label}
                                            </span>
                                          ) : null}
                                        </span>
                                      </label>
                                      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:min-w-[18rem] sm:flex-1 sm:grid-cols-2 sm:gap-3">
                                        <div>
                                          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                            Standard
                                          </div>
                                          <div className="mt-1 text-sm font-black tabular-nums text-slate-900 dark:text-yellow-50">
                                            {money(list)}
                                          </div>
                                        </div>
                                        <label className="block">
                                          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                            Actual charged
                                          </div>
                                          <div className="mt-1">
                                            <RateInput
                                              disabled={!on}
                                              placeholder={
                                                list ? String(list) : '0.00'
                                              }
                                              value={on ? chargedRaw : ''}
                                              onChange={(v) =>
                                                setDraft(c.id, {
                                                  charges: {
                                                    ...d.charges,
                                                    [p.id]: v,
                                                  },
                                                  member: true,
                                                })
                                              }
                                            />
                                          </div>
                                          {differs ? (
                                            <button
                                              type="button"
                                              className="mt-1 text-[11px] font-bold text-yellow-800 underline dark:text-yellow-300"
                                              onClick={() =>
                                                setDraft(c.id, {
                                                  charges: {
                                                    ...d.charges,
                                                    [p.id]: String(list),
                                                  },
                                                })
                                              }
                                            >
                                              Use standard {money(list)}
                                            </button>
                                          ) : null}
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            <div className="flex flex-wrap items-center justify-end gap-4 px-1 pt-1 text-sm">
                              <div className="tabular-nums">
                                <span className="text-[10px] font-black uppercase text-slate-500">
                                  Standard total{' '}
                                </span>
                                <span className="font-black">
                                  {money(standard)}
                                </span>
                              </div>
                              <div className="tabular-nums">
                                <span className="text-[10px] font-black uppercase text-slate-500">
                                  Actual total{' '}
                                </span>
                                <span className="font-black">
                                  {money(actual)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(8.5rem,0.6fr)_minmax(10rem,0.8fr)]">
                            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                              Plan
                              <select
                                className={`${fc()} mt-1`}
                                value={d.planId}
                                onChange={(e) => {
                                  const planId = e.target.value;
                                  const plan = classes.find(
                                    (p) => p.id === planId
                                  );
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
                                  if (plan && !d.charges[plan.id]) {
                                    next.charges = {
                                      ...d.charges,
                                      [plan.id]: String(plan.price_zar || 0),
                                    };
                                  }
                                  setDraft(c.id, next);
                                }}
                              >
                                <option value="">Select plan…</option>
                                {classes.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {classOptionLabel(p)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                Standard
                              </div>
                              <div className="mt-2 text-sm font-black tabular-nums">
                                {selected[0]
                                  ? money(Number(selected[0].price_zar) || 0)
                                  : '—'}
                              </div>
                            </div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                              Actual charged
                              <div className="mt-1">
                                <RateInput
                                  disabled={!d.planId}
                                  placeholder={
                                    selected[0]
                                      ? String(selected[0].price_zar)
                                      : '0.00'
                                  }
                                  value={
                                    d.planId ? d.charges[d.planId] || '' : ''
                                  }
                                  onChange={(v) =>
                                    setDraft(c.id, {
                                      charges: d.planId
                                        ? { ...d.charges, [d.planId]: v }
                                        : d.charges,
                                    })
                                  }
                                />
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Coach
                        <select
                          className={`${fc()} mt-1`}
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
                        {coachName && d.privateClient ? (
                          <span className="mt-1 block text-[11px] text-slate-500">
                            Private coach: {coachName}
                          </span>
                        ) : null}
                      </label>
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Private rate
                        <div className="mt-1">
                          <RateInput
                            disabled={!d.privateClient}
                            placeholder="Private / PT"
                            value={d.privateRate}
                            onChange={(v) =>
                              setDraft(c.id, { privateRate: v })
                            }
                          />
                        </div>
                      </label>
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Status
                        <select
                          className={`${fc()} mt-1`}
                          value={d.status}
                          disabled={!d.member}
                          onChange={(e) =>
                            setDraft(c.id, {
                              status: e.target
                                .value as FitSubscription['status'],
                            })
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={saving && busyId === c.id}
                        onClick={() => void save(c)}
                        className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-black text-yellow-950 disabled:opacity-50"
                      >
                        {saving && busyId === c.id
                          ? 'Saving…'
                          : 'Save details & classes'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
