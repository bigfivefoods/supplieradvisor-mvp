'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Copy, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import {
  DataTable,
  FormCard,
  ListRowCard,
  StatRow,
  fc,
  toneLinkClass,
} from '@/components/fitness/FitForm';
import {
  COACH_RATE_BASES,
  formatCoachRate,
  getCoachSpecialtyOptions,
  type FitCoach,
  type FitContractDoc,
} from '@/lib/fitness/fitgraph';
import { FitContractDocsPanel } from '@/components/fitness/FitContractDocs';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatEngagement(c: FitCoach) {
  const start =
    c.start_date || (c.created_at ? c.created_at.slice(0, 10) : null);
  if (!start && !c.end_date) return 'No engagement dates set';
  if (c.end_date) return `${start || '—'} → ${c.end_date} · Ended`;
  return `Started ${start || '—'} · Active`;
}

type CoachDraft = {
  start_date: string;
  end_date: string;
  rate_zar: string;
  rate_basis: string;
  rate_note: string;
};

type ProfileDraft = {
  code: string;
  name: string;
  email: string;
  phone: string;
  specialties: string[];
  public_bio: string;
  bio: string;
  photo_url: string;
  color: string;
  can_manage_classes: boolean;
  active: boolean;
};

function emptyForm() {
  return {
    code: '',
    name: '',
    email: '',
    phone: '',
    specialties: ['General'] as string[],
    public_bio: '',
    bio: '',
    photo_url: '',
    start_date: todayIso(),
    end_date: '',
    rate_zar: '',
    rate_basis: 'per_class',
    rate_note: '',
  };
}

function profileFromCoach(c: FitCoach): ProfileDraft {
  return {
    code: c.code || '',
    name: c.name || '',
    email: c.email || '',
    phone: c.phone || '',
    specialties:
      c.specialties && c.specialties.length ? [...c.specialties] : ['General'],
    public_bio: c.public_bio || '',
    bio: c.bio || '',
    photo_url: c.photo_url || '',
    color: c.color || '#d97706',
    can_manage_classes: c.can_manage_classes !== false,
    active: c.active !== false && !c.end_date,
  };
}

function toggleInSpecialties(list: string[], s: string): string[] {
  const has = list.includes(s);
  if (has) {
    const next = list.filter((x) => x !== s);
    return next.length ? next : ['General'];
  }
  return [...list.filter((x) => x !== 'General'), s];
}

export default function CoachesPage() {
  const { companyId, store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState(emptyForm);
  /** coachId → draft engagement + rate for inline edit */
  const [dateDrafts, setDateDrafts] = useState<Record<string, CoachDraft>>({});
  /** coachId → profile draft while editing details */
  const [profileDrafts, setProfileDrafts] = useState<
    Record<string, ProfileDraft>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [endNote, setEndNote] = useState<Record<string, string>>({});
  const [newSpecialty, setNewSpecialty] = useState('');
  const [editSpecialtyFrom, setEditSpecialtyFrom] = useState<string | null>(
    null
  );
  const [editSpecialtyTo, setEditSpecialtyTo] = useState('');

  const specialtyOptions = useMemo(
    () => (store ? getCoachSpecialtyOptions(store) : []),
    [store]
  );

  const toggleSpecialty = (s: string) => {
    setForm((f) => ({
      ...f,
      specialties: toggleInSpecialties(f.specialties, s),
    }));
  };

  const profileFor = (c: FitCoach): ProfileDraft =>
    profileDrafts[c.id] || profileFromCoach(c);

  const setProfile = (id: string, patch: Partial<ProfileDraft>) => {
    setProfileDrafts((prev) => {
      const coach = store?.coaches.find((x) => x.id === id);
      const base =
        prev[id] || (coach ? profileFromCoach(coach) : profileFromCoach({
          id,
          code: '',
          name: '',
          created_at: new Date().toISOString(),
        }));
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const startEdit = (c: FitCoach) => {
    setProfileDrafts((prev) => ({ ...prev, [c.id]: profileFromCoach(c) }));
    setEditingId(c.id);
  };

  const cancelEdit = (id: string) => {
    setEditingId((cur) => (cur === id ? null : cur));
    setProfileDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const draftFor = (c: FitCoach): CoachDraft => {
    const d = dateDrafts[c.id];
    if (d) return d;
    return {
      start_date:
        c.start_date || (c.created_at ? c.created_at.slice(0, 10) : todayIso()),
      end_date: c.end_date || '',
      rate_zar:
        c.rate_zar != null && Number.isFinite(Number(c.rate_zar))
          ? String(c.rate_zar)
          : '',
      rate_basis: String(c.rate_basis || 'per_class'),
      rate_note: c.rate_note || '',
    };
  };

  const setDraft = (id: string, patch: Partial<CoachDraft>) => {
    setDateDrafts((prev) => {
      const coach = store?.coaches.find((x) => x.id === id);
      const existing = prev[id];
      const seeded: CoachDraft = existing || {
        start_date:
          coach?.start_date ||
          (coach?.created_at ? coach.created_at.slice(0, 10) : todayIso()),
        end_date: coach?.end_date || '',
        rate_zar:
          coach?.rate_zar != null && Number.isFinite(Number(coach.rate_zar))
            ? String(coach.rate_zar)
            : '',
        rate_basis: String(coach?.rate_basis || 'per_class'),
        rate_note: coach?.rate_note || '',
      };
      return { ...prev, [id]: { ...seeded, ...patch } };
    });
  };

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'coaches',
      action: 'upsert',
      record: {
        code: form.code,
        name: form.name,
        email: form.email,
        phone: form.phone,
        public_bio: form.public_bio,
        bio: form.bio || form.public_bio,
        photo_url: form.photo_url || undefined,
        specialties: form.specialties.length
          ? form.specialties
          : ['General'],
        can_manage_classes: true,
        start_date: form.start_date || todayIso(),
        end_date: form.end_date || null,
        rate_zar: form.rate_zar === '' ? null : Number(form.rate_zar),
        rate_basis: form.rate_basis || 'per_class',
        rate_note: form.rate_note || undefined,
      },
    });
    toast.success('Coach saved — they can update bio on their portal');
    setForm(emptyForm());
  };

  const saveDates = async (c: FitCoach) => {
    const d = draftFor(c);
    if (!d.start_date) {
      toast.error('Start date required');
      return;
    }
    if (d.end_date && d.end_date < d.start_date) {
      toast.error('End date cannot be before start date');
      return;
    }
    if (d.rate_zar !== '' && Number.isNaN(Number(d.rate_zar))) {
      toast.error('Rate must be a number (ZAR)');
      return;
    }
    await post({
      entity: 'coaches',
      action: 'upsert',
      record: {
        id: c.id,
        code: c.code,
        name: c.name,
        start_date: d.start_date,
        end_date: d.end_date || null,
        rate_zar: d.rate_zar === '' ? null : Number(d.rate_zar),
        rate_basis: d.rate_basis || 'per_class',
        rate_note: d.rate_note || '',
        ended_note: endNote[c.id] || undefined,
      },
    });
    setDateDrafts((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    toast.success('Engagement, rate and dates saved');
  };

  const endTenure = async (c: FitCoach) => {
    const d = draftFor(c);
    const end = d.end_date || todayIso();
    await post({
      action: 'close_coach_engagement',
      coachId: c.id,
      end_date: end,
      note: endNote[c.id] || undefined,
      reason: 'owner_ended',
    });
    setDateDrafts((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    toast.success('Engagement ended — saved to history');
  };

  const rehire = async (c: FitCoach) => {
    const d = draftFor(c);
    const start = d.start_date && d.start_date > (c.end_date || '')
      ? d.start_date
      : todayIso();
    await post({
      action: 'rehire_coach',
      coachId: c.id,
      start_date: start,
    });
    setDateDrafts((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    toast.success('Coach rehired — new engagement started, history kept');
  };

  const saveCoachContracts = async (
    c: FitCoach,
    contracts: FitContractDoc[]
  ) => {
    await post({
      entity: 'coaches',
      action: 'upsert',
      record: {
        id: c.id,
        code: c.code,
        name: c.name,
        contracts,
      },
    });
  };

  const saveDetails = async (c: FitCoach) => {
    const p = profileFor(c);
    if (!p.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'coaches',
      action: 'upsert',
      record: {
        id: c.id,
        code: p.code.trim() || c.code,
        name: p.name.trim(),
        email: p.email.trim(),
        phone: p.phone.trim(),
        specialties: p.specialties.length ? p.specialties : ['General'],
        public_bio: p.public_bio,
        bio: p.bio || p.public_bio,
        photo_url: p.photo_url.trim() || '',
        color: p.color || undefined,
        can_manage_classes: p.can_manage_classes,
        // Only force active when ending is not already set via end_date
        active: p.active,
        // Preserve engagement fields (don't wipe when editing profile)
        start_date: c.start_date ?? undefined,
        end_date: c.end_date ?? null,
        rate_zar: c.rate_zar ?? null,
        rate_basis: c.rate_basis ?? undefined,
        rate_note: c.rate_note ?? undefined,
        contracts: c.contracts || [],
        history: c.history || [],
      },
    });
    setEditingId(null);
    setProfileDrafts((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    toast.success('Coach details updated');
  };

  const addSpecialty = async () => {
    const name = newSpecialty.trim();
    if (!name) {
      toast.error('Enter a specialty name');
      return;
    }
    await post({
      action: 'manage_specialties',
      op: 'add',
      name,
    });
    setNewSpecialty('');
    toast.success(`Specialty “${name}” added`);
  };

  const saveRenameSpecialty = async () => {
    if (!editSpecialtyFrom) return;
    const to = editSpecialtyTo.trim();
    if (!to) {
      toast.error('Enter the new name');
      return;
    }
    await post({
      action: 'manage_specialties',
      op: 'rename',
      from: editSpecialtyFrom,
      to,
    });
    toast.success(`Renamed to “${to}” (updated on coaches too)`);
    setEditSpecialtyFrom(null);
    setEditSpecialtyTo('');
  };

  const removeSpecialty = async (name: string) => {
    if (
      !confirm(
        `Remove “${name}” from the specialty list? Coaches keep it on their profile unless you strip it.`
      )
    ) {
      return;
    }
    const strip = confirm(
      'Also remove this specialty from all coaches who have it selected?'
    );
    await post({
      action: 'manage_specialties',
      op: 'remove',
      name,
      strip_from_coaches: strip,
    });
    toast.success(`Specialty “${name}” removed from catalogue`);
    if (editSpecialtyFrom === name) {
      setEditSpecialtyFrom(null);
      setEditSpecialtyTo('');
    }
  };

  const issuePortal = async (coachId: string) => {
    const data = await post({
      action: 'issue_coach_portal',
      coachId,
    });
    const tok = data?.portal_token as string | undefined;
    if (tok && typeof window !== 'undefined') {
      const url = `${window.location.origin}/coach/fitgraph/${encodeURIComponent(tok)}`;
      await navigator.clipboard.writeText(url);
      toast.success('Coach portal link copied');
    } else {
      toast.success('Portal token issued');
    }
  };

  const copyPortal = async (tok: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/coach/fitgraph/${encodeURIComponent(tok)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Copied portal link');
  };

  const activeCount =
    store?.coaches.filter((c) => c.active !== false && !c.end_date).length || 0;
  const endedCount =
    store?.coaches.filter((c) => c.end_date || c.active === false).length || 0;

  return (
    <FitgraphWorkbench
      title="Coaches"
      titleAccent="trainers"
      description="Add and edit coaches: name, contact, specialties (create your own catalogue), bios, photo, PDF contracts, pay rates, and engagement dates. Issue portal links so coaches can also update their own profile and classes."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/fitgraph/coach-calendar"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 dark:!border-amber-400 dark:!bg-amber-950 dark:text-amber-200"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Open coach calendar
            </Link>
          </div>
          <StatRow
            tone="coach"
            items={[
              {
                label: 'Coaches',
                value: Number(summary?.coachCount) || store.coaches.length,
              },
              {
                label: 'Active now',
                value: activeCount,
              },
              {
                label: 'Ended / inactive',
                value: endedCount,
              },
              {
                label: 'Specialties',
                value: specialtyOptions.length,
              },
              {
                label: 'With portal',
                value: store.coaches.filter((c) => c.portal_token).length,
              },
            ]}
          />

          {/* Owner-managed specialty catalogue */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 dark:border-amber-700/50 dark:bg-amber-950/40">
            <div>
              <h3 className="text-sm font-black text-amber-950 dark:text-amber-50">
                Coach specialties
              </h3>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 mt-0.5">
                Create and edit the list coaches can pick from. Renaming updates
                every coach who has that specialty.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {specialtyOptions.map((s) => (
                <div
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white pl-2.5 pr-1 py-0.5 text-[11px] font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100"
                >
                  {editSpecialtyFrom === s ? (
                    <input
                      className="w-28 rounded-md border border-amber-400 bg-white px-1.5 py-0.5 text-[11px] font-bold dark:bg-amber-900"
                      value={editSpecialtyTo}
                      autoFocus
                      onChange={(e) => setEditSpecialtyTo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveRenameSpecialty();
                        if (e.key === 'Escape') {
                          setEditSpecialtyFrom(null);
                          setEditSpecialtyTo('');
                        }
                      }}
                    />
                  ) : (
                    <span>{s}</span>
                  )}
                  {editSpecialtyFrom === s ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveRenameSpecialty()}
                        className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditSpecialtyFrom(null);
                          setEditSpecialtyTo('');
                        }}
                        className="rounded-full px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-amber-200"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        title="Edit name"
                        disabled={saving}
                        onClick={() => {
                          setEditSpecialtyFrom(s);
                          setEditSpecialtyTo(s);
                        }}
                        className="rounded-full p-1 hover:bg-amber-100 dark:hover:bg-amber-900"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Remove from list"
                        disabled={saving}
                        onClick={() => void removeSpecialty(s)}
                        className="rounded-full p-1 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className={fc() + ' max-w-xs'}
                placeholder="New specialty (e.g. Mobility)"
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addSpecialty();
                  }
                }}
              />
              <button
                type="button"
                disabled={saving || !newSpecialty.trim()}
                onClick={() => void addSpecialty()}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add specialty
              </button>
            </div>
          </div>

          <FormCard
            tone="coach"
            title="Add coach"
            onSubmit={() => void add()}
            saving={saving}
          >
            <input
              className={fc()}
              placeholder="Code"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Start date
              </span>
              <input
                className={fc() + ' mt-1'}
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                End date (optional)
              </span>
              <input
                className={fc() + ' mt-1'}
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_date: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Rate (ZAR)
              </span>
              <input
                className={fc() + ' mt-1'}
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 350"
                value={form.rate_zar}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rate_zar: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Rate basis
              </span>
              <select
                className={fc() + ' mt-1'}
                value={form.rate_basis}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rate_basis: e.target.value }))
                }
              >
                {COACH_RATE_BASES.map((b) => (
                  <option key={b} value={b}>
                    {b.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <input
              className={fc()}
              placeholder="Rate note (optional, e.g. incl. travel)"
              value={form.rate_note}
              onChange={(e) =>
                setForm((f) => ({ ...f, rate_note: e.target.value }))
              }
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
                Specialties (select all that apply)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {specialtyOptions.map((s) => {
                  const on = form.specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        on
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-amber-200 bg-white text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <ProfilePhotoField
              companyId={companyId}
              value={form.photo_url}
              onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))}
              kind="coach_photo"
              label="Coach photo"
              description="Upload a headshot for the coach bio and website (JPG/PNG/WebP · under 8MB)."
              disabled={saving}
              accentClass="border-amber-300 dark:border-amber-500"
            />
            <textarea
              className={fc() + ' min-h-[3.5rem] resize-y sm:col-span-2'}
              placeholder="Public bio (members see this on website)"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
            <textarea
              className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
              placeholder="Internal notes / full bio (gym office)"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </FormCard>

          <div className="space-y-2">
            {store.coaches.map((c) => {
              const draft = draftFor(c);
              const isActive = c.active !== false && !c.end_date;
              const hist = c.history || [];
              const showHist = historyOpen[c.id];
              const isEditing = editingId === c.id;
              const profile = profileFor(c);
              return (
                <ListRowCard
                  key={c.id}
                  tone="coach"
                  actions={
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 border border-amber-300 rounded-xl px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:text-amber-100 dark:border-amber-500/50 dark:bg-amber-950 dark:hover:bg-amber-900/50"
                        onClick={() =>
                          isEditing ? cancelEdit(c.id) : startEdit(c)
                        }
                      >
                        {isEditing ? 'Close edit' : 'Edit details'}
                      </button>
                      {c.portal_token ? (
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 text-xs font-bold ${toneLinkClass('coach')}`}
                          onClick={() => void copyPortal(c.portal_token!)}
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy portal link
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-2.5 py-1.5 hover:bg-slate-50 dark:text-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-900/40"
                        onClick={() => void issuePortal(c.id)}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        {c.portal_token ? 'Re-issue portal' : 'Issue portal'}
                      </button>
                      <button
                        type="button"
                        className="text-rose-600 dark:text-rose-400 text-xs font-bold"
                        onClick={() => {
                          if (
                            !confirm(
                              `Remove coach ${c.name}? This does not delete class history.`
                            )
                          ) {
                            return;
                          }
                          void post({
                            entity: 'coaches',
                            action: 'delete',
                            id: c.id,
                          });
                        }}
                      >
                        Remove
                      </button>
                    </>
                  }
                >
                  <div className="flex items-start gap-2">
                    {c.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photo_url}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-amber-200 dark:border-amber-600 shrink-0"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-900 dark:text-amber-50 flex flex-wrap items-center gap-2">
                        <span>
                          {c.code} · {c.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {isActive ? 'Active' : 'Ended'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-amber-200/80">
                        {(c.specialties || []).join(', ') || '—'}
                        {c.email ? ` · ${c.email}` : ''}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </div>
                      <div className="text-[11px] font-semibold text-amber-900/90 dark:text-amber-200 mt-0.5">
                        {formatEngagement(c)}
                        {' · '}
                        {formatCoachRate(c.rate_zar, c.rate_basis)}
                        {hist.length > 0
                          ? ` · ${hist.length} prior stint${hist.length === 1 ? '' : 's'}`
                          : ''}
                      </div>
                      {c.public_bio && !isEditing && (
                        <p className="text-[11px] text-slate-600 dark:text-amber-100/80 mt-1">
                          {c.public_bio}
                        </p>
                      )}

                      {/* Full profile edit (owner) */}
                      {isEditing && (
                        <div className="mt-3 rounded-xl border border-amber-300 bg-white p-3 space-y-2 dark:border-amber-600 dark:bg-amber-950/50">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Edit coach details
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                                Code
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                value={profile.code}
                                onChange={(e) =>
                                  setProfile(c.id, { code: e.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                                Name *
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                value={profile.name}
                                onChange={(e) =>
                                  setProfile(c.id, { name: e.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                                Email
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                type="email"
                                value={profile.email}
                                onChange={(e) =>
                                  setProfile(c.id, { email: e.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                                Phone
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                value={profile.phone}
                                onChange={(e) =>
                                  setProfile(c.id, { phone: e.target.value })
                                }
                              />
                            </label>
                            <div className="sm:col-span-2">
                              <ProfilePhotoField
                                companyId={companyId}
                                value={profile.photo_url}
                                onChange={(url) =>
                                  setProfile(c.id, { photo_url: url })
                                }
                                kind="coach_photo"
                                label="Coach photo"
                                description="Upload or replace the coach headshot."
                                disabled={saving}
                                accentClass="border-amber-300 dark:border-amber-500"
                              />
                            </div>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                                Colour
                              </span>
                              <input
                                className={fc() + ' mt-0.5 h-10'}
                                type="color"
                                value={profile.color || '#d97706'}
                                onChange={(e) =>
                                  setProfile(c.id, { color: e.target.value })
                                }
                              />
                            </label>
                            <div className="flex flex-col justify-end gap-1.5 pb-0.5">
                              <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-amber-100">
                                <input
                                  type="checkbox"
                                  checked={profile.can_manage_classes}
                                  onChange={(e) =>
                                    setProfile(c.id, {
                                      can_manage_classes: e.target.checked,
                                    })
                                  }
                                />
                                Can manage own classes
                              </label>
                              <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-amber-100">
                                <input
                                  type="checkbox"
                                  checked={profile.active}
                                  onChange={(e) =>
                                    setProfile(c.id, {
                                      active: e.target.checked,
                                    })
                                  }
                                />
                                Active (shown in lists)
                              </label>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
                              Specialties
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {specialtyOptions.map((s) => {
                                const on = profile.specialties.includes(s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() =>
                                      setProfile(c.id, {
                                        specialties: toggleInSpecialties(
                                          profile.specialties,
                                          s
                                        ),
                                      })
                                    }
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                      on
                                        ? 'border-amber-500 bg-amber-500 text-white'
                                        : 'border-amber-200 bg-white text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <textarea
                            className={fc() + ' min-h-[3.5rem] resize-y'}
                            placeholder="Public bio (members see this)"
                            value={profile.public_bio}
                            onChange={(e) =>
                              setProfile(c.id, {
                                public_bio: e.target.value,
                              })
                            }
                          />
                          <textarea
                            className={fc() + ' min-h-[3rem] resize-y'}
                            placeholder="Internal notes / full bio (gym office)"
                            value={profile.bio}
                            onChange={(e) =>
                              setProfile(c.id, { bio: e.target.value })
                            }
                          />
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void saveDetails(c)}
                              className="rounded-xl bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              Save coach details
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => cancelEdit(c.id)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-amber-600/40 dark:bg-amber-950 dark:text-amber-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Engagement + rate (owner) */}
                      <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5 dark:border-amber-700/50 dark:bg-amber-950/40">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
                          Engagement & rate (owner)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                              Start date
                            </span>
                            <input
                              className={fc() + ' mt-0.5'}
                              type="date"
                              value={draft.start_date}
                              onChange={(e) =>
                                setDraft(c.id, { start_date: e.target.value })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                              End date
                            </span>
                            <input
                              className={fc() + ' mt-0.5'}
                              type="date"
                              value={draft.end_date}
                              onChange={(e) =>
                                setDraft(c.id, { end_date: e.target.value })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                              Rate (ZAR)
                            </span>
                            <input
                              className={fc() + ' mt-0.5'}
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="e.g. 350"
                              value={draft.rate_zar}
                              onChange={(e) =>
                                setDraft(c.id, { rate_zar: e.target.value })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-amber-200/70">
                              Rate basis
                            </span>
                            <select
                              className={fc() + ' mt-0.5'}
                              value={draft.rate_basis}
                              onChange={(e) =>
                                setDraft(c.id, { rate_basis: e.target.value })
                              }
                            >
                              {COACH_RATE_BASES.map((b) => (
                                <option key={b} value={b}>
                                  {b.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <input
                          className={fc() + ' mt-2'}
                          placeholder="Rate note (optional)"
                          value={draft.rate_note}
                          onChange={(e) =>
                            setDraft(c.id, { rate_note: e.target.value })
                          }
                        />
                        <input
                          className={fc() + ' mt-2'}
                          placeholder="Note when ending (optional)"
                          value={endNote[c.id] || ''}
                          onChange={(e) =>
                            setEndNote((n) => ({
                              ...n,
                              [c.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveDates(c)}
                            className="rounded-xl bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            Save dates & rate
                          </button>
                          {isActive ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void endTenure(c)}
                              className="rounded-xl border border-rose-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-200 disabled:opacity-50"
                            >
                              End tenure
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void rehire(c)}
                              className="rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-200 disabled:opacity-50"
                            >
                              Rehire / new start
                            </button>
                          )}
                          {hist.length > 0 || c.end_date ? (
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryOpen((h) => ({
                                  ...h,
                                  [c.id]: !h[c.id],
                                }))
                              }
                              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-amber-600/40 dark:bg-amber-950 dark:text-amber-100"
                            >
                              {showHist ? 'Hide history' : 'Show history'}
                            </button>
                          ) : null}
                        </div>

                        {showHist && (
                          <ul className="mt-2 space-y-1 border-t border-amber-200/60 pt-2 dark:border-amber-700/40">
                            {/* Current closed period if ended but still on coach row */}
                            {c.end_date ? (
                              <li className="text-[11px] text-slate-700 dark:text-amber-100">
                                <span className="font-bold">Current (ended):</span>{' '}
                                {c.start_date || '—'} → {c.end_date}
                                {' · '}
                                {formatCoachRate(c.rate_zar, c.rate_basis)}
                              </li>
                            ) : (
                              <li className="text-[11px] text-slate-700 dark:text-amber-100">
                                <span className="font-bold">Current:</span>{' '}
                                {c.start_date || '—'} → present
                                {' · '}
                                {formatCoachRate(c.rate_zar, c.rate_basis)}
                              </li>
                            )}
                            {hist.length === 0 ? (
                              <li className="text-[11px] text-slate-500 dark:text-amber-200/60">
                                No prior engagements yet.
                              </li>
                            ) : (
                              hist.map((h) => (
                                <li
                                  key={h.id}
                                  className="text-[11px] text-slate-600 dark:text-amber-100/90"
                                >
                                  <span className="font-semibold">
                                    {h.start_date} → {h.end_date}
                                  </span>
                                  {' · '}
                                  {formatCoachRate(h.rate_zar, h.rate_basis)}
                                  {h.ended_reason
                                    ? ` · ${h.ended_reason}`
                                    : ''}
                                  {h.note ? ` — ${h.note}` : ''}
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </div>

                      <div className="mt-3">
                        <FitContractDocsPanel
                          companyId={companyId}
                          contracts={c.contracts || []}
                          onChange={(next) => void saveCoachContracts(c, next)}
                          title="Coach contract PDFs"
                          description="Employment agreements, NDAs, or rate letters for this coach (owner only — not on the public website)."
                          defaultKind="coach_agreement"
                          disabled={saving}
                          toneClass="border-amber-200/80 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/30"
                        />
                      </div>
                    </div>
                  </div>
                  {c.portal_token && (
                    <p
                      className={`text-[10px] mt-1 font-mono truncate max-w-md ${toneLinkClass('coach')}`}
                    >
                      Portal active
                    </p>
                  )}
                </ListRowCard>
              );
            })}
          </div>

          <DataTable
            tone="coach"
            headers={[
              'Code',
              'Name',
              'Specialties',
              'Rate',
              'Start',
              'End',
              'Status',
              'Portal',
            ]}
            rows={store.coaches.map((c) => ({
              id: c.id,
              cells: [
                c.code,
                c.name,
                (c.specialties || []).join(', ') || '—',
                formatCoachRate(c.rate_zar, c.rate_basis),
                c.start_date ||
                  (c.created_at ? c.created_at.slice(0, 10) : '—'),
                c.end_date || '—',
                c.active !== false && !c.end_date ? 'Active' : 'Ended',
                c.portal_token ? 'Yes' : 'No',
              ],
            }))}
            onDelete={(id) =>
              void post({ entity: 'coaches', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
