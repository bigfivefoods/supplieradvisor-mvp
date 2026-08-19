'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Copy, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import {
  FormCard,
  ListRowCard,
  StatRow,
  fc,
} from '@/components/clinic/MedicalForm';
import {
  PRACTITIONER_RATE_BASES,
  formatPractitionerRate,
  getDisciplineOptions,
  type MedicalContractDoc,
  type MedicalPractitioner,
} from '@/lib/clinic/medicalgraph';
import { FitContractDocsPanel } from '@/components/fitness/FitContractDocs';
import { PersonQualificationsEditor } from '@/components/services/PersonQualificationsEditor';
import { AdvisorPersonInviteRow } from '@/components/advisors/AdvisorPersonInviteRow';
import { AdvisorEngagementField } from '@/components/advisors/AdvisorEngagementField';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import { resolveAdvisorEngagement } from '@/lib/services/advisor-workforce';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import type { PersonQualification } from '@/lib/services/person-qualifications';
import {
  AdvisorIdentityPanel,
  needsAdvisorIdentity,
} from '@/components/services/AdvisorIdentityPanel';
import type { FitContractDoc } from '@/lib/fitness/fitgraph';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatEngagement(p: MedicalPractitioner) {
  const start =
    p.start_date || (p.created_at ? p.created_at.slice(0, 10) : null);
  if (!start && !p.end_date) return 'No engagement dates set';
  if (p.end_date) return `${start || '—'} → ${p.end_date} · Ended`;
  return `Started ${start || '—'} · Active`;
}

async function copyClinicianPortal(tok: string) {
  if (typeof window === 'undefined') return;
  const url = `${window.location.origin}/clinician/medicalgraph/${encodeURIComponent(tok)}`;
  await navigator.clipboard.writeText(url);
  toast.success('Clinician diary portal link copied');
}

async function copyStaffToday(tok: string) {
  if (typeof window === 'undefined') return;
  const url = `${window.location.origin}/staff/advisor/medicalgraph/${encodeURIComponent(tok)}`;
  await navigator.clipboard.writeText(url);
  toast.success('Staff today (mobile) link copied');
}

type DateDraft = {
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
  id_number: string;
  disciplines: string[];
  public_bio: string;
  bio: string;
  photo_url: string;
  can_manage: boolean;
  active: boolean;
  engagement: 'employed' | 'contractor';
};

function emptyForm() {
  return {
    code: '',
    name: '',
    email: '',
    phone: '',
    id_number: '',
    disciplines: ['General practice (GP)'] as string[],
    public_bio: '',
    bio: '',
    photo_url: '',
    start_date: todayIso(),
    end_date: '',
    rate_zar: '',
    rate_basis: 'per_session',
    rate_note: '',
    engagement: 'contractor' as 'employed' | 'contractor',
  };
}

function profileFromPerson(p: MedicalPractitioner): ProfileDraft {
  return {
    code: p.code || '',
    name: p.name || '',
    email: p.email || '',
    phone: p.phone || '',
    id_number: p.id_number || '',
    disciplines:
      p.disciplines && p.disciplines.length
        ? [...p.disciplines]
        : ['General'],
    public_bio: p.public_bio || '',
    bio: p.bio || '',
    photo_url: p.photo_url || '',
    can_manage: p.can_manage !== false,
    active: p.active !== false && !p.end_date,
    engagement: resolveAdvisorEngagement(p),
  };
}

function toggleInList(list: string[], s: string): string[] {
  const has = list.includes(s);
  if (has) {
    const next = list.filter((x) => x !== s);
    return next.length ? next : ['General'];
  }
  return [...list.filter((x) => x !== 'General'), s];
}

export default function PractitionersPage() {
  const { companyId, store, loading, saving, post, summary, load } = useMedicalgraph();
  const [form, setForm] = useState(emptyForm);
  const [dateDrafts, setDateDrafts] = useState<Record<string, DateDraft>>({});
  const [profileDrafts, setProfileDrafts] = useState<
    Record<string, ProfileDraft>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [endNote, setEndNote] = useState<Record<string, string>>({});
  const [newSkill, setNewSkill] = useState('');
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [editSkillFrom, setEditSkillFrom] = useState<string | null>(null);
  const [editSkillTo, setEditSkillTo] = useState('');

  const skillOptions = useMemo(
    () => (store ? getDisciplineOptions(store) : []),
    [store]
  );

  const toggleSkill = (s: string) => {
    setForm((f) => ({
      ...f,
      disciplines: toggleInList(f.disciplines, s),
    }));
  };

  const profileFor = (p: MedicalPractitioner): ProfileDraft =>
    profileDrafts[p.id] || profileFromPerson(p);

  const setProfile = (id: string, patch: Partial<ProfileDraft>) => {
    setProfileDrafts((prev) => {
      const person = store?.practitioners.find((x) => x.id === id);
      const base =
        prev[id] ||
        (person
          ? profileFromPerson(person)
          : profileFromPerson({
              id,
              code: '',
              name: '',
              created_at: new Date().toISOString(),
            }));
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const startEdit = (p: MedicalPractitioner) => {
    setProfileDrafts((prev) => ({ ...prev, [p.id]: profileFromPerson(p) }));
    setEditingId(p.id);
    setOpenIds((prev) => ({ ...prev, [p.id]: true }));
  };

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = !prev[id];
      if (!next) cancelEdit(id);
      return { ...prev, [id]: next };
    });
  };

  const cancelEdit = (id: string) => {
    setEditingId((cur) => (cur === id ? null : cur));
    setProfileDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const draftFor = (p: MedicalPractitioner): DateDraft => {
    const d = dateDrafts[p.id];
    if (d) return d;
    return {
      start_date:
        p.start_date ||
        (p.created_at ? p.created_at.slice(0, 10) : todayIso()),
      end_date: p.end_date || '',
      rate_zar:
        p.rate_zar != null && Number.isFinite(Number(p.rate_zar))
          ? String(p.rate_zar)
          : '',
      rate_basis: String(p.rate_basis || 'per_session'),
      rate_note: p.rate_note || '',
    };
  };

  const setDraft = (id: string, patch: Partial<DateDraft>) => {
    setDateDrafts((prev) => {
      const person = store?.practitioners.find((x) => x.id === id);
      const existing = prev[id];
      const seeded: DateDraft = existing || {
        start_date:
          person?.start_date ||
          (person?.created_at ? person.created_at.slice(0, 10) : todayIso()),
        end_date: person?.end_date || '',
        rate_zar:
          person?.rate_zar != null && Number.isFinite(Number(person.rate_zar))
            ? String(person.rate_zar)
            : '',
        rate_basis: String(person?.rate_basis || 'per_session'),
        rate_note: person?.rate_note || '',
      };
      return { ...prev, [id]: { ...seeded, ...patch } };
    });
  };

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      toast.error('Login email required — they use this to sign in and use the app');
      return;
    }
    if (!form.id_number.trim()) {
      toast.error('ID / passport number required for VerifyNow or Didit');
      return;
    }
    await post({
      entity: 'practitioners',
      action: 'upsert',
      record: {
        code: form.code,
        name: form.name,
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
        id_number: form.id_number.trim(),
        public_bio: form.public_bio,
        bio: form.bio || form.public_bio,
        photo_url: form.photo_url || undefined,
        disciplines: form.disciplines.length
          ? form.disciplines
          : ['General'],
        can_manage: true,
        start_date: form.start_date || todayIso(),
        end_date: form.end_date || null,
        rate_zar: form.rate_zar === '' ? null : Number(form.rate_zar),
        rate_basis: form.rate_basis || 'per_session',
        rate_note: form.rate_note || undefined,
        engagement: form.engagement || 'contractor',
      },
    });
    toast.success('Practitioner saved — synced to People directory');
    setForm(emptyForm());
  };

  const saveDates = async (p: MedicalPractitioner) => {
    const d = draftFor(p);
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
      entity: 'practitioners',
      action: 'upsert',
      record: {
        id: p.id,
        code: p.code,
        name: p.name,
        start_date: d.start_date,
        end_date: d.end_date || null,
        rate_zar: d.rate_zar === '' ? null : Number(d.rate_zar),
        rate_basis: d.rate_basis || 'per_session',
        rate_note: d.rate_note || '',
        ended_note: endNote[p.id] || undefined,
      },
    });
    setDateDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    toast.success('Engagement, rate and dates saved');
  };

  const endTenure = async (p: MedicalPractitioner) => {
    const d = draftFor(p);
    const end = d.end_date || todayIso();
    await post({
      action: 'close_practitioner_engagement',
      practitionerId: p.id,
      end_date: end,
      note: endNote[p.id] || undefined,
      reason: 'owner_ended',
    });
    setDateDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    toast.success('Engagement ended — saved to history');
  };

  const rehire = async (p: MedicalPractitioner) => {
    const d = draftFor(p);
    const start =
      d.start_date && d.start_date > (p.end_date || '')
        ? d.start_date
        : todayIso();
    await post({
      action: 'rehire_practitioner',
      practitionerId: p.id,
      start_date: start,
    });
    setDateDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    toast.success('Practitioner rehired — new engagement started, history kept');
  };

  const saveIdentity = async (p: MedicalPractitioner) => {
    const pr = profileFor(p);
    if (!pr.email.trim() || !pr.email.includes('@')) {
      toast.error('Login email required — they use this to sign in');
      return;
    }
    if (!pr.id_number.trim()) {
      toast.error('ID / passport number required for VerifyNow or Didit');
      return;
    }
    await post({
      entity: 'practitioners',
      action: 'upsert',
      record: {
        id: p.id,
        code: p.code,
        name: p.name,
        email: pr.email.trim().toLowerCase(),
        phone: pr.phone.trim(),
        id_number: pr.id_number.trim(),
      },
    });
    toast.success(`Saved ${p.name}’s email and ID`);
  };

  const saveQualifications = async (
    p: MedicalPractitioner,
    qualifications: PersonQualification[]
  ) => {
    await post({
      entity: 'practitioners',
      action: 'upsert',
      record: { id: p.id, code: p.code, name: p.name, qualifications },
    });
  };

  const saveContracts = async (
    p: MedicalPractitioner,
    contracts: FitContractDoc[]
  ) => {
    await post({
      entity: 'practitioners',
      action: 'upsert',
      record: {
        id: p.id,
        code: p.code,
        name: p.name,
        contracts: contracts as MedicalContractDoc[],
      },
    });
  };

  const saveDetails = async (p: MedicalPractitioner) => {
    const pr = profileFor(p);
    if (!pr.name.trim()) {
      toast.error('Name required');
      return;
    }
    if (!pr.email.trim() || !pr.email.includes('@')) {
      toast.error('Login email required — they use this to sign in and use the app');
      return;
    }
    if (!pr.id_number.trim()) {
      toast.error('ID / passport number required for VerifyNow or Didit');
      return;
    }
    await post({
      entity: 'practitioners',
      action: 'upsert',
      record: {
        id: p.id,
        code: pr.code.trim() || p.code,
        name: pr.name.trim(),
        email: pr.email.trim().toLowerCase(),
        phone: pr.phone.trim(),
        id_number: pr.id_number.trim(),
        disciplines: pr.disciplines.length ? pr.disciplines : ['General'],
        public_bio: pr.public_bio,
        bio: pr.bio || pr.public_bio,
        photo_url: pr.photo_url.trim() || '',
        can_manage: pr.can_manage,
        active: pr.active,
        engagement: pr.engagement || 'contractor',
        start_date: p.start_date ?? undefined,
        end_date: p.end_date ?? null,
        rate_zar: p.rate_zar ?? null,
        rate_basis: p.rate_basis ?? undefined,
        rate_note: p.rate_note ?? undefined,
        contracts: p.contracts || [],
        history: p.history || [],
      },
    });
    setEditingId(null);
    setProfileDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    toast.success('Practitioner details updated');
  };

  const addSkill = async () => {
    const name = newSkill.trim();
    if (!name) {
      toast.error('Enter a skill / discipline name');
      return;
    }
    await post({
      action: 'manage_disciplines',
      op: 'add',
      name,
    });
    setNewSkill('');
    toast.success(`Skill “${name}” added`);
  };

  const saveRenameSkill = async () => {
    if (!editSkillFrom) return;
    const to = editSkillTo.trim();
    if (!to) {
      toast.error('Enter the new name');
      return;
    }
    await post({
      action: 'manage_disciplines',
      op: 'rename',
      from: editSkillFrom,
      to,
    });
    toast.success(`Renamed to “${to}” (updated on practitioners too)`);
    setEditSkillFrom(null);
    setEditSkillTo('');
  };

  const removeSkill = async (name: string) => {
    if (
      !confirm(
        `Remove “${name}” from the skills list? Practitioners keep it on their profile unless you strip it.`
      )
    ) {
      return;
    }
    const strip = confirm(
      'Also remove this skill from all practitioners who have it selected?'
    );
    await post({
      action: 'manage_disciplines',
      op: 'remove',
      name,
      strip_from_practitioners: strip,
    });
    toast.success(`Skill “${name}” removed from catalogue`);
    if (editSkillFrom === name) {
      setEditSkillFrom(null);
      setEditSkillTo('');
    }
  };

  const activeCount =
    store?.practitioners.filter((p) => p.active !== false && !p.end_date)
      .length || 0;
  const endedCount =
    store?.practitioners.filter((p) => p.end_date || p.active === false)
      .length || 0;

  return (
    <MedicalgraphWorkbench
      title="Practitioners"
      titleAccent="allied health"
      description="Add and edit practitioners: name, contact, skills/disciplines (create your own catalogue), bios, photo, PDF contracts, pay rates, and engagement start/end dates — same principles as GymAdvisor coaches."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Practitioners',
                value:
                  Number(summary?.practitionerCount) ||
                  store.practitioners.length,
              },
              { label: 'Active now', value: activeCount },
              { label: 'Ended / inactive', value: endedCount },
              { label: 'Skills', value: skillOptions.length },
            ]}
          />

          <div className="space-y-2">
            {(() => {
              const incomplete = store.practitioners.filter(needsAdvisorIdentity)
                .length;
              return incomplete > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] dark:border-amber-700/50 dark:bg-amber-950/40">
                  <p className="font-semibold text-amber-950 dark:text-amber-100">
                    {incomplete} practitioner{incomplete === 1 ? '' : 's'} still
                    need a login email or ID
                  </p>
                  <button
                    type="button"
                    onClick={() => setOnlyIncomplete((v) => !v)}
                    className="text-[11px] font-black text-amber-900 underline dark:text-amber-200"
                  >
                    {onlyIncomplete ? 'Show all' : 'Show who needs details'}
                  </button>
                </div>
              ) : null;
            })()}
            {(onlyIncomplete
              ? store.practitioners.filter(needsAdvisorIdentity)
              : store.practitioners
            ).map((p) => {
              const draft = draftFor(p);
              const isActive = p.active !== false && !p.end_date;
              const hist = p.history || [];
              const showHist = historyOpen[p.id];
              const isEditing = editingId === p.id;
              const isOpen = !!openIds[p.id] || isEditing;
              const profile = profileFor(p);
              return (
                <ListRowCard
                  key={p.id}
                  actions={
                    isOpen ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 border border-emerald-300 rounded-xl px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-950 dark:hover:bg-emerald-900/50"
                        onClick={() =>
                          isEditing ? cancelEdit(p.id) : startEdit(p)
                        }
                      >
                        {isEditing ? 'Close edit' : 'Edit details'}
                      </button>
                      {p.portal_token ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 dark:text-violet-300"
                            onClick={() => void copyClinicianPortal(p.portal_token!)}
                          >
                            <Copy className="w-3.5 h-3.5" /> Diary portal
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                            onClick={() => void copyStaffToday(p.portal_token!)}
                          >
                            Staff today
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-2.5 py-1.5 hover:bg-slate-50 dark:text-emerald-100 dark:border-emerald-500/40"
                        onClick={() =>
                          void post({
                            action: 'issue_practitioner_portal',
                            practitionerId: p.id,
                          }).then(async (data) => {
                            const tok = data?.portal_token as string | undefined;
                            if (tok) await copyClinicianPortal(tok);
                            else toast.success('Portal issued');
                          })
                        }
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        {p.portal_token ? 'Re-issue portal' : 'Issue portal'}
                      </button>
                      <AdvisorPersonInviteRow
                        module="medicalgraph"
                        personId={p.id}
                        email={p.email}
                        phone={p.phone}
                        engagement={p.engagement}
                        inviteStatus={p.work_invite_status}
                        onChanged={() => void load()}
                      />
                      <button
                        type="button"
                        className="text-rose-600 dark:text-rose-400 text-xs font-bold"
                        onClick={() => {
                          if (
                            !confirm(
                              `Remove practitioner ${p.name}? This does not delete appointment history.`
                            )
                          ) {
                            return;
                          }
                          void post({
                            entity: 'practitioners',
                            action: 'delete',
                            id: p.id,
                          });
                        }}
                      >
                        Remove
                      </button>
                    </>
                    ) : undefined
                  }
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 text-left"
                    aria-expanded={isOpen}
                    onClick={() => toggleOpen(p.id)}
                  >
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photo_url}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-emerald-200 dark:border-emerald-600 shrink-0"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-[11px] font-black text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-100">
                        {(p.name || 'P').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-900 dark:text-emerald-50 flex flex-wrap items-center gap-2">
                        <span>
                          {p.code} · {p.name}
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
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                            resolveAdvisorEngagement(p) === 'employed'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
                              : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                          }`}
                        >
                          {resolveAdvisorEngagement(p) === 'employed'
                            ? 'Permanent'
                            : 'Contract'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-emerald-200/80">
                        {(p.disciplines || []).join(', ') || '—'}
                        {p.email ? ` · ${p.email}` : ' · add email'}
                        {p.id_number ? ` · ID ${p.id_number}` : ' · add ID'}
                        {(p.qualifications || []).length
                          ? ` · ${(p.qualifications || []).length} qual${(p.qualifications || []).length === 1 ? '' : 's'}`
                          : ' · add qualifications'}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-900/90 dark:text-emerald-200 mt-0.5">
                        {formatEngagement(p)}
                        {' · '}
                        {formatPractitionerRate(p.rate_zar, p.rate_basis)}
                      </div>
                    </div>
                    <ChevronDown
                      className={`mt-1 h-4 w-4 shrink-0 text-emerald-800 transition-transform dark:text-emerald-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                  <div className="mt-3">
                      {p.public_bio && !isEditing && (
                        <p className="text-[11px] text-slate-600 dark:text-emerald-100/80 mb-2">
                          {p.public_bio}
                        </p>
                      )}

                      <div className="mb-3">
                        <AdvisorIdentityPanel
                          email={profile.email}
                          idNumber={profile.id_number}
                          phone={profile.phone}
                          onChange={(patch) =>
                            setProfile(p.id, {
                              email: patch.email ?? profile.email,
                              id_number: patch.idNumber ?? profile.id_number,
                              phone: patch.phone ?? profile.phone,
                            })
                          }
                          onSave={() => saveIdentity(p)}
                          saving={saving}
                          inputClass={fc()}
                          toneClass="border-emerald-200 bg-emerald-50/70 dark:border-emerald-700/50 dark:bg-emerald-950/30"
                          personLabel={p.name || 'This practitioner'}
                        />
                      </div>

                      {isEditing && (
                        <div className="mt-3 rounded-xl border border-emerald-300 bg-white p-3 space-y-2 dark:border-emerald-600 dark:bg-emerald-950/50">
                          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Edit practitioner details
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                                Code
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                value={profile.code}
                                onChange={(e) =>
                                  setProfile(p.id, { code: e.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                                Name *
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                value={profile.name}
                                onChange={(e) =>
                                  setProfile(p.id, { name: e.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                                Login email *
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                type="email"
                                value={profile.email}
                                onChange={(e) =>
                                  setProfile(p.id, { email: e.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                                ID / passport *
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                placeholder="SA ID or passport"
                                value={profile.id_number}
                                onChange={(e) =>
                                  setProfile(p.id, { id_number: e.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                                Phone
                              </span>
                              <input
                                className={fc() + ' mt-0.5'}
                                value={profile.phone}
                                onChange={(e) =>
                                  setProfile(p.id, { phone: e.target.value })
                                }
                              />
                            </label>
                            <AdvisorEngagementField
                              value={profile.engagement}
                              onChange={(engagement) =>
                                setProfile(p.id, { engagement })
                              }
                              disabled={saving}
                            />
                            <div className="sm:col-span-2">
                              <ProfilePhotoField
                                companyId={companyId}
                                value={profile.photo_url}
                                onChange={(url) =>
                                  setProfile(p.id, { photo_url: url })
                                }
                                kind="practitioner_photo"
                                label="Practitioner photo"
                                description="Upload or replace the headshot."
                                disabled={saving}
                                accentClass="border-emerald-300 dark:border-emerald-500"
                              />
                            </div>
                            <div className="flex flex-col justify-end gap-1.5 pb-0.5 sm:col-span-2">
                              <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-emerald-100">
                                <input
                                  type="checkbox"
                                  checked={profile.can_manage}
                                  onChange={(e) =>
                                    setProfile(p.id, {
                                      can_manage: e.target.checked,
                                    })
                                  }
                                />
                                Can manage own diary
                              </label>
                              <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-emerald-100">
                                <input
                                  type="checkbox"
                                  checked={profile.active}
                                  onChange={(e) =>
                                    setProfile(p.id, {
                                      active: e.target.checked,
                                    })
                                  }
                                />
                                Active (shown in lists)
                              </label>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1.5">
                              Skills / disciplines
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {skillOptions.map((s) => {
                                const on = profile.disciplines.includes(s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() =>
                                      setProfile(p.id, {
                                        disciplines: toggleInList(
                                          profile.disciplines,
                                          s
                                        ),
                                      })
                                    }
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                      on
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-emerald-200 bg-white text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-100'
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
                            placeholder="Public bio"
                            value={profile.public_bio}
                            onChange={(e) =>
                              setProfile(p.id, {
                                public_bio: e.target.value,
                              })
                            }
                          />
                          <textarea
                            className={fc() + ' min-h-[3rem] resize-y'}
                            placeholder="Internal notes / full bio"
                            value={profile.bio}
                            onChange={(e) =>
                              setProfile(p.id, { bio: e.target.value })
                            }
                          />
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void saveDetails(p)}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Save practitioner details
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => cancelEdit(p.id)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-emerald-600/40 dark:bg-emerald-950 dark:text-emerald-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 dark:border-emerald-700/50 dark:bg-emerald-950/40">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1.5">
                          Engagement & rate (owner)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                              Start date
                            </span>
                            <input
                              className={fc() + ' mt-0.5'}
                              type="date"
                              value={draft.start_date}
                              onChange={(e) =>
                                setDraft(p.id, { start_date: e.target.value })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                              End date
                            </span>
                            <input
                              className={fc() + ' mt-0.5'}
                              type="date"
                              value={draft.end_date}
                              onChange={(e) =>
                                setDraft(p.id, { end_date: e.target.value })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                              Rate (ZAR)
                            </span>
                            <input
                              className={fc() + ' mt-0.5'}
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.rate_zar}
                              onChange={(e) =>
                                setDraft(p.id, { rate_zar: e.target.value })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-slate-600 dark:text-emerald-200/70">
                              Rate basis
                            </span>
                            <select
                              className={fc() + ' mt-0.5'}
                              value={draft.rate_basis}
                              onChange={(e) =>
                                setDraft(p.id, { rate_basis: e.target.value })
                              }
                            >
                              {PRACTITIONER_RATE_BASES.map((b) => (
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
                            setDraft(p.id, { rate_note: e.target.value })
                          }
                        />
                        <input
                          className={fc() + ' mt-2'}
                          placeholder="Note when ending (optional)"
                          value={endNote[p.id] || ''}
                          onChange={(e) =>
                            setEndNote((n) => ({
                              ...n,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveDates(p)}
                            className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Save dates & rate
                          </button>
                          {isActive ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void endTenure(p)}
                              className="rounded-xl border border-rose-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-200 disabled:opacity-50"
                            >
                              End tenure
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void rehire(p)}
                              className="rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-200 disabled:opacity-50"
                            >
                              Rehire / new start
                            </button>
                          )}
                          {hist.length > 0 || p.end_date ? (
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryOpen((h) => ({
                                  ...h,
                                  [p.id]: !h[p.id],
                                }))
                              }
                              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-emerald-600/40 dark:bg-emerald-950 dark:text-emerald-100"
                            >
                              {showHist ? 'Hide history' : 'Show history'}
                            </button>
                          ) : null}
                        </div>

                        {showHist && (
                          <ul className="mt-2 space-y-1 border-t border-emerald-200/60 pt-2 dark:border-emerald-700/40">
                            {p.end_date ? (
                              <li className="text-[11px] text-slate-700 dark:text-emerald-100">
                                <span className="font-bold">Current (ended):</span>{' '}
                                {p.start_date || '—'} → {p.end_date}
                                {' · '}
                                {formatPractitionerRate(p.rate_zar, p.rate_basis)}
                              </li>
                            ) : (
                              <li className="text-[11px] text-slate-700 dark:text-emerald-100">
                                <span className="font-bold">Current:</span>{' '}
                                {p.start_date || '—'} → present
                                {' · '}
                                {formatPractitionerRate(p.rate_zar, p.rate_basis)}
                              </li>
                            )}
                            {hist.length === 0 ? (
                              <li className="text-[11px] text-slate-500 dark:text-emerald-200/60">
                                No prior engagements yet.
                              </li>
                            ) : (
                              hist.map((h) => (
                                <li
                                  key={h.id}
                                  className="text-[11px] text-slate-600 dark:text-emerald-100/90"
                                >
                                  <span className="font-semibold">
                                    {h.start_date} → {h.end_date}
                                  </span>
                                  {' · '}
                                  {formatPractitionerRate(h.rate_zar, h.rate_basis)}
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
                        <PersonQualificationsEditor
                          qualifications={p.qualifications || []}
                          onChange={(next) => void saveQualifications(p, next)}
                          uploadFile={async (file) => {
                            const result = await uploadCompanyAssetServerFirst({
                              file,
                              companyId,
                              kind: 'qualification_certificate',
                            });
                            if (!result.url) {
                              throw new Error(result.error || 'Upload failed');
                            }
                            return {
                              url: result.url,
                              fileName: result.fileName || file.name,
                            };
                          }}
                          disabled={saving}
                          toneClass="border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-700/50 dark:bg-emerald-950/30"
                        />
                      </div>

                      <div className="mt-3">
                        <FitContractDocsPanel
                          companyId={companyId}
                          contracts={(p.contracts || []) as FitContractDoc[]}
                          onChange={(next) => void saveContracts(p, next)}
                          title="Practitioner contract PDFs"
                          description="Employment agreements, NDAs, or rate letters for this practitioner (owner only — not on the public website)."
                          defaultKind="practitioner_agreement"
                          disabled={saving}
                          toneClass="border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-700/50 dark:bg-emerald-950/30"
                        />
                      </div>
                  </div>
                  )}
                </ListRowCard>
              );
            })}
            {store.practitioners.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-emerald-200/70 py-6 text-center">
                No practitioners yet — add one below.
              </p>
            ) : null}
          </div>

          <AdvisorExpandablePanel
            title="Add skills"
            description="Create and edit the catalogue practitioners can pick from."
            open={skillsOpen}
            onToggle={() => setSkillsOpen((v) => !v)}
            accentClass="border-emerald-200 bg-emerald-50/70 dark:border-emerald-700/50 dark:bg-emerald-950/40"
            titleClass="text-emerald-950 dark:text-emerald-50"
            hintClass="text-emerald-900/80 dark:text-emerald-200/80"
          >
          {/* Owner-managed skills / disciplines catalogue */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3 dark:border-emerald-700/50 dark:bg-emerald-950/40">
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-50">
                Skills & disciplines
              </h3>
              <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 mt-0.5">
                Create and edit the list practitioners can pick from. Renaming
                updates every practitioner who has that skill.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skillOptions.map((s) => (
                <div
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white pl-2.5 pr-1 py-0.5 text-[11px] font-bold text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-100"
                >
                  {editSkillFrom === s ? (
                    <input
                      className="w-28 rounded-md border border-emerald-400 bg-white px-1.5 py-0.5 text-[11px] font-bold dark:bg-emerald-900"
                      value={editSkillTo}
                      autoFocus
                      onChange={(e) => setEditSkillTo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveRenameSkill();
                        if (e.key === 'Escape') {
                          setEditSkillFrom(null);
                          setEditSkillTo('');
                        }
                      }}
                    />
                  ) : (
                    <span>{s}</span>
                  )}
                  {editSkillFrom === s ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveRenameSkill()}
                        className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditSkillFrom(null);
                          setEditSkillTo('');
                        }}
                        className="rounded-full px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-emerald-200"
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
                          setEditSkillFrom(s);
                          setEditSkillTo(s);
                        }}
                        className="rounded-full p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Remove from list"
                        disabled={saving}
                        onClick={() => void removeSkill(s)}
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
                placeholder="New skill (e.g. Manual therapy)"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addSkill();
                  }
                }}
              />
              <button
                type="button"
                disabled={saving || !newSkill.trim()}
                onClick={() => void addSkill()}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
          </div>
          </AdvisorExpandablePanel>

          <AdvisorExpandablePanel
            title="Add a new practitioner"
            description="Name, contact, contract or permanent, rates, and bio."
            open={addOpen}
            onToggle={() => setAddOpen((v) => !v)}
            accentClass="border-emerald-200 bg-emerald-50/70 dark:border-emerald-700/50 dark:bg-emerald-950/40"
            titleClass="text-emerald-950 dark:text-emerald-50"
            hintClass="text-emerald-900/80 dark:text-emerald-200/80"
          >
          <FormCard
            title="Add practitioner"
            onSubmit={() => void add()}
            saving={saving}
          >
            <input
              className={fc()}
              placeholder="Code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <input
              className={fc()}
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Login email *
              </span>
              <input
                className={fc() + ' mt-1'}
                type="email"
                autoComplete="email"
                placeholder="name@practice.co.za"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-emerald-200/70">
                They sign in with this email to use the app.
              </span>
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                ID / passport *
              </span>
              <input
                className={fc() + ' mt-1'}
                placeholder="SA ID or passport number"
                value={form.id_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_number: e.target.value }))
                }
              />
              <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-emerald-200/70">
                VerifyNow for SA ID · Didit for passport.
              </span>
            </label>
            <input
              className={fc()}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <AdvisorEngagementField
              value={form.engagement}
              onChange={(engagement) =>
                setForm((f) => ({ ...f, engagement }))
              }
              disabled={saving}
            />
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
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
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
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
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Rate (ZAR)
              </span>
              <input
                className={fc() + ' mt-1'}
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 750"
                value={form.rate_zar}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rate_zar: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Rate basis
              </span>
              <select
                className={fc() + ' mt-1'}
                value={form.rate_basis}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rate_basis: e.target.value }))
                }
              >
                {PRACTITIONER_RATE_BASES.map((b) => (
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
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1.5">
                Skills / disciplines (select all that apply)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skillOptions.map((s) => {
                  const on = form.disciplines.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        on
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-emerald-200 bg-white text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-100'
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
              kind="practitioner_photo"
              label="Practitioner photo"
              description="Upload a headshot for the bio and clinic website (JPG/PNG/WebP · under 8MB)."
              disabled={saving}
              accentClass="border-emerald-300 dark:border-emerald-500"
            />
            <textarea
              className={fc() + ' min-h-[3.5rem] resize-y sm:col-span-2'}
              placeholder="Public bio (patients see this on website)"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
            <textarea
              className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
              placeholder="Internal notes / full bio (clinic office)"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </FormCard>
          </AdvisorExpandablePanel>

        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
