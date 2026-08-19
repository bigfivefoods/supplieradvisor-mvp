'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  Copy,
  Link2,
  Mail,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { MEMBERSHIP_STATUSES, type FitClient, type FitCoach, type FitMembershipPlan } from '@/lib/fitness/fitgraph';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';
import { memberDebitBankComplete } from '@/lib/fitness/member-debit-bank';
import {
  InlineSelect,
  InlineText,
  InlineToggleSelect,
} from '@/components/services/InlineListFields';

export type ClientListFilter = 'all' | 'active' | 'private' | 'injured';

function matchesFilter(c: FitClient, filter: ClientListFilter) {
  if (filter === 'private') return c.private_client === true;
  if (filter === 'injured') return isInjured(c.health);
  if (filter === 'active') {
    return c.active !== false && (c.membership_status || 'active') === 'active';
  }
  return true;
}

function matchesQuery(
  c: FitClient,
  q: string,
  coachName?: string
) {
  if (!q) return true;
  const blob = [
    c.name,
    c.code,
    c.email,
    c.phone,
    c.id_number,
    c.membership_status,
    coachName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

export function GymClientDeskList({
  clients,
  plans,
  coaches,
  collectBank,
  requireBank,
  saving,
  listEditId,
  setListEditId,
  filter,
  onFilter,
  onPatch,
  onFreeze,
  onInvite,
  onCopyPortal,
  onIssuePortal,
  onProfile,
  onDelete,
  toolbar,
  open,
  onOpenChange,
}: {
  clients: FitClient[];
  plans: FitMembershipPlan[];
  coaches: FitCoach[];
  collectBank: boolean;
  requireBank: boolean;
  saving: boolean;
  listEditId: string | null;
  setListEditId: (id: string | null) => void;
  filter: ClientListFilter;
  onFilter: (f: ClientListFilter) => void;
  onPatch: (
    client: FitClient,
    patch: Partial<FitClient> & Record<string, unknown>
  ) => void;
  onFreeze: (c: FitClient, freeze: boolean) => void;
  onInvite: (c: FitClient) => void;
  onCopyPortal: (token: string) => void;
  onIssuePortal: (clientId: string) => void;
  onProfile: (c: FitClient) => void;
  onDelete: (c: FitClient) => void;
  toolbar?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (!matchesFilter(c, filter)) return false;
      const coach = coaches.find((x) => x.id === c.coach_id);
      return matchesQuery(c, q, coach?.name);
    });
  }, [clients, coaches, filter, q]);

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-300 bg-sky-50/80 dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/50">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-sky-800 transition-transform dark:text-cyan-200 ${
              open ? '' : '-rotate-90'
            }`}
          />
          <span className="text-sm font-black text-slate-900 dark:text-cyan-50">
            Client list
          </span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-black tabular-nums text-sky-900 dark:bg-cyan-900 dark:text-cyan-100">
            {filtered.length}
            {filtered.length !== clients.length ? ` / ${clients.length}` : ''}
          </span>
        </button>
        {toolbar}
      </div>

      {open ? (
        <div className="space-y-3 border-t border-cyan-200/80 bg-white/70 px-4 py-4 dark:border-cyan-800 dark:bg-cyan-950/40">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Search name, code, email, coach…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {(
              [
                ['all', 'All'],
                ['active', 'Active'],
                ['private', 'Private'],
                ['injured', 'Injured'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onFilter(id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                  filter === id
                    ? 'bg-sky-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 dark:border-white/15 dark:bg-neutral-900 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/15">
              No members match this search.
            </p>
          ) : (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {filtered.map((c) => {
                const plan = plans.find((p) => p.id === c.membership_plan_id);
                const coach = coaches.find((x) => x.id === c.coach_id);
                const injured = isInjured(c.health);
                const isPrivate = c.private_client === true;
                const rowEditing = listEditId === c.id;
                const familyN = (c.family || []).filter(
                  (m) => m.active !== false
                ).length;
                return (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-950"
                  >
                    <div className="flex items-start gap-3">
                      {c.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.photo_url}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-sky-100"
                        />
                      ) : (
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-400">
                          {(c.name || '?').slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {rowEditing ? (
                            <InlineText
                              value={c.name || ''}
                              placeholder="Name"
                              wide
                              onSave={(name) => onPatch(c, { name })}
                              disabled={saving}
                            />
                          ) : (
                            <p className="font-black text-slate-900 dark:text-white">
                              {c.name || '—'}
                            </p>
                          )}
                          {c.identity?.status === 'verified' ? (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                              ✓ ID
                            </span>
                          ) : null}
                          {familyN > 0 ? (
                            <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-800">
                              +{familyN} family
                            </span>
                          ) : null}
                          {c.booking_soft_block ? (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-900">
                              no-show risk
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {rowEditing ? (
                            <InlineText
                              value={c.code || ''}
                              placeholder="Code"
                              onSave={(code) => onPatch(c, { code })}
                              disabled={saving}
                            />
                          ) : (
                            <span className="font-semibold">
                              {c.code || 'No code'}
                            </span>
                          )}
                          {' · '}
                          {plan?.code || 'No plan'}
                          {coach ? ` · ${coach.name}` : isPrivate ? ' · Coach unassigned' : ''}
                          {c.email ? ` · ${c.email}` : ''}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span
                            className={
                              isPrivate
                                ? 'rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-black uppercase text-yellow-900'
                                : 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600'
                            }
                          >
                            {isPrivate ? 'Private' : 'Gym'}
                          </span>
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                            {c.membership_status || 'active'}
                          </span>
                          <span
                            className={
                              injured
                                ? 'rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800'
                                : 'rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500'
                            }
                          >
                            {healthSummaryLabel(c.health)}
                          </span>
                          {collectBank ? (
                            memberDebitBankComplete(c) ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                                Debit on file
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">
                                {requireBank ? 'Debit needed' : 'No debit'}
                              </span>
                            )
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            rowEditing
                              ? 'text-emerald-700'
                              : 'text-sky-700'
                          }`}
                          onClick={() =>
                            setListEditId(rowEditing ? null : c.id)
                          }
                        >
                          <Pencil className="h-3 w-3" />
                          {rowEditing ? 'Done' : 'Quick edit'}
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-bold text-slate-600"
                          onClick={() => onProfile(c)}
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600"
                          onClick={() => onDelete(c)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {rowEditing ? (
                      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
                        <InlineToggleSelect
                          value={isPrivate}
                          trueLabel="Private client"
                          falseLabel="Gym member"
                          disabled={saving}
                          onSave={(private_client) =>
                            onPatch(c, { private_client })
                          }
                        />
                        <InlineSelect
                          value={c.membership_plan_id || ''}
                          emptyLabel="No plan"
                          disabled={saving}
                          options={plans.map((p) => ({
                            value: p.id,
                            label: `${p.code} · ${p.name}`,
                          }))}
                          onSave={(membership_plan_id) =>
                            onPatch(c, {
                              membership_plan_id: membership_plan_id || null,
                            })
                          }
                        />
                        <span className="inline-flex flex-col gap-1">
                          <InlineSelect
                            value={c.membership_status || 'active'}
                            allowEmpty={false}
                            disabled={saving}
                            options={MEMBERSHIP_STATUSES.map((s) => ({
                              value: s,
                              label: s,
                            }))}
                            onSave={(membership_status) =>
                              onPatch(c, { membership_status })
                            }
                          />
                          <button
                            type="button"
                            className="text-left text-[10px] font-bold text-yellow-700 underline"
                            onClick={() =>
                              onFreeze(c, c.membership_status !== 'frozen')
                            }
                          >
                            {c.membership_status === 'frozen'
                              ? 'Unfreeze'
                              : 'Freeze'}
                          </button>
                        </span>
                        <InlineSelect
                          value={c.coach_id || ''}
                          emptyLabel={
                            isPrivate ? 'Coach required…' : 'No coach'
                          }
                          disabled={saving}
                          options={coaches
                            .filter((x) => x.active !== false)
                            .map((x) => ({
                              value: x.id,
                              label: x.name,
                            }))}
                          onSave={(coach_id) =>
                            onPatch(c, { coach_id: coach_id || null })
                          }
                        />
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2 dark:border-white/10">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700"
                        onClick={() => onInvite(c)}
                      >
                        <Mail className="h-3 w-3" />
                        {c.invite_status === 'pending'
                          ? 'Resend invite'
                          : c.invite_status === 'accepted'
                            ? 'Re-invite'
                            : 'Invite'}
                      </button>
                      {c.invite_status ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            c.invite_status === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.invite_status === 'pending'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.invite_status}
                        </span>
                      ) : null}
                      {c.portal_token ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-700"
                          onClick={() => onCopyPortal(c.portal_token!)}
                        >
                          <Copy className="h-3 w-3" /> Copy portal
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-800"
                        onClick={() => onIssuePortal(c.id)}
                      >
                        <Link2 className="h-3 w-3" />
                        {c.portal_token ? 'Re-issue' : 'Issue portal'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <p className="border-t border-cyan-200/80 px-4 py-2 text-[11px] text-sky-900/80 dark:border-cyan-800 dark:text-cyan-200/80">
          Collapsed — open to search, edit, invite, or download the book.
        </p>
      )}
    </section>
  );
}
