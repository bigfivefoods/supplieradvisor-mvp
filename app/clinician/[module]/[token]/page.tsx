'use client';

/**
 * Clinician diary portal — parity with GymAdvisor coach portal.
 * /clinician/{dentalgraph|physiograph|medicalgraph|psychiatrygraph}/{token}
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { PersonQualificationsEditor } from '@/components/services/PersonQualificationsEditor';
import type { PersonQualification } from '@/lib/services/person-qualifications';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { MemberPortalWeekCalendar } from '@/components/advisors/MemberPortalWeekCalendar';
import { ClinicianPwaVisitCare } from '@/components/clinic/ClinicianPwaVisitCare';
import {
  AdvisorWorkPwaChrome,
  type AdvisorWorkTab,
} from '@/components/services/AdvisorWorkPwaChrome';
import { OwnerWorkspaceCta } from '@/components/advisors/OwnerWorkspaceCta';

type RosterRow = {
  booking_id: string;
  patient_id: string;
  status: string;
  plan: boolean;
  actual: 'pending' | 'attended' | 'no_show' | 'cancelled';
  name: string;
  email?: string;
  phone?: string;
  soft_block?: boolean;
  no_show_count?: number;
  injured?: boolean;
};

type PortalCard = {
  appointment: {
    id: string;
    service_id?: string;
    date: string;
    start_time: string;
    duration_min?: number | null;
    location?: string;
    public?: boolean;
    status: string;
    series_id?: string | null;
    notes?: string;
  };
  service_name?: string;
  capacity: number;
  planned: number;
  waitlist: number;
  attended: number;
  no_show: number;
  roster: RosterRow[];
};

type Portal = {
  clinician: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    roles?: string[];
    bio?: string;
    public_bio?: string;
    photo_url?: string;
    qualifications?: PersonQualification[];
    can_manage?: boolean;
  };
  from: string;
  to: string;
  appointments: PortalCard[];
  by_date: Record<string, PortalCard[]>;
  patients: Array<{
    id: string;
    code?: string;
    name: string;
    email?: string;
    soft_block?: boolean;
    no_show_count?: number;
    medical?: import('@/lib/clinic/patient-medical').PatientMedicalRecord | null;
    client_notes?: import('@/lib/clinic/clinic-movements').PatientClientNote[];
    shared_movements?: import('@/lib/clinic/clinic-movements').PatientMovementShare[];
  }>;
  services: Array<{
    id: string;
    code?: string;
    name: string;
    default_duration_min?: number;
  }>;
  rooms?: string[];
  visit_notes?: import('@/lib/services/advisor-clinical').VisitNote[];
  movements?: import('@/lib/clinic/clinic-movements').ClinicMovement[];
};

function mondayOf(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + monOffset);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ClinicianPortalPage() {
  const { module: mod, token } = useParams() as {
    module: string;
    token: string;
  };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [brand, setBrand] = useState('Practice');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(new Date().toISOString().slice(0, 10))
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [workTab, setWorkTab] = useState<AdvisorWorkTab>('today');
  const [patientFor, setPatientFor] = useState('');
  const [attendOverride, setAttendOverride] = useState<
    Record<string, 'attended' | 'no_show' | 'booked'>
  >({});
  const attendChain = useRef(Promise.resolve());
  const [edit, setEdit] = useState({
    service_id: '',
    date: '',
    start_time: '09:00',
    duration_min: '45',
    location: '',
    status: 'scheduled',
    public: false,
    notes: '',
    edit_scope: 'one' as 'one' | 'future',
  });
  const [create, setCreate] = useState({
    appointment_kind: 'consult' as 'consult' | 'personal',
    personal_reason: 'personal',
    notes: '',
    service_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '10:00',
    duration_min: '45',
    location: '',
    patient_id: '',
    public: false,
  });

  const weekEnd = useMemo(() => addDaysIso(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart]
  );

  const load = useCallback(async () => {
    if (!token || !mod) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        module: mod,
        token,
        from: weekStart,
        to: weekEnd,
      });
      const res = await fetch(`/api/public/advisor/clinician?${q}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPortal(data.portal);
      setBrand(data.brand || 'Practice');
      setCompanyId(
        Number.isFinite(Number(data.company_id)) ? Number(data.company_id) : null
      );
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, mod, weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (
    body: Record<string, unknown>,
    opts?: { quiet?: boolean }
  ) => {
    if (!opts?.quiet) setBusy(true);
    setError(null);
    if (!opts?.quiet) setMsg(null);
    try {
      const res = await fetch('/api/public/advisor/clinician', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: mod,
          token,
          from: weekStart,
          to: weekEnd,
          ...body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      if (data.portal) setPortal(data.portal);
      if (data.message && !opts?.quiet) setMsg(String(data.message));
      return data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      throw e;
    } finally {
      if (!opts?.quiet) setBusy(false);
    }
  };

  const openCard = portal?.appointments.find(
    (c) => c.appointment.id === openId
  );

  useEffect(() => {
    if (!openCard) return;
    const a = openCard.appointment;
    setEdit({
      service_id: a.service_id || '',
      date: a.date,
      start_time: String(a.start_time || '09:00').slice(0, 5),
      duration_min: String(a.duration_min || 45),
      location: a.location || '',
      status: a.status || 'scheduled',
      public: a.public === true,
      notes: a.notes || '',
      edit_scope: 'one',
    });
  }, [openCard?.appointment.id]);

  if (loading && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <p className="text-rose-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!portal) return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayCards = portal.appointments.filter(
    (c) => c.appointment.date === todayIso
  );
  const workAccent =
    mod === 'physiograph'
      ? '#0d9488'
      : mod === 'dentalgraph'
        ? '#0284c7'
        : mod === 'psychiatrygraph'
          ? '#6366f1'
          : '#059669';

  return (
    <AdvisorWorkPwaChrome
      brand={brand}
      name={portal.clinician.name}
      photoUrl={portal.clinician.photo_url}
      eyebrow={`Clinician · ${brand}`}
      accent={workAccent}
      tab={workTab}
      onTab={setWorkTab}
    >
      {error ? (
        <div className="mb-3 rounded-2xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
      {msg ? (
        <div className="mb-3 rounded-2xl border border-emerald-900/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {msg}
        </div>
      ) : null}

      {workTab === 'today' ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            {todayCards.length
              ? `${todayCards.length} appointment${todayCards.length === 1 ? '' : 's'} today`
              : 'Nothing on your diary today. Open Diary or add an appointment.'}
          </p>
          {todayCards.map((card) => (
            <button
              key={card.appointment.id}
              type="button"
              onClick={() => setOpenId(card.appointment.id)}
              className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-left"
            >
              <div className="text-lg font-black">
                {String(card.appointment.start_time).slice(0, 5)} ·{' '}
                {card.service_name || 'Appointment'}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {card.appointment.location || '—'} · {card.planned}/
                {card.capacity} booked
                {card.waitlist ? ` · ${card.waitlist} waitlist` : ''}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex w-full items-center justify-center gap-1 rounded-2xl py-3 text-sm font-black text-slate-950"
            style={{ background: workAccent }}
          >
            <Plus className="h-4 w-4" /> New appointment
          </button>
        </div>
      ) : null}

      {workTab === 'diary' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-700 p-2"
              onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex items-center gap-1 text-xs font-bold tabular-nums">
              <CalendarDays className="h-3.5 w-3.5" style={{ color: workAccent }} />
              {weekStart} → {weekEnd}
            </span>
            <button
              type="button"
              className="rounded-xl border border-slate-700 p-2"
              onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black text-slate-950"
              style={{ background: workAccent }}
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <MemberPortalWeekCalendar
            theme="dark"
            color={workAccent}
            hideNav
            weekStart={weekStart}
            events={days.flatMap((d) =>
              (portal.by_date?.[d] || []).map((card) => ({
                id: card.appointment.id,
                date: d,
                start_time: String(card.appointment.start_time).slice(0, 5),
                duration_min: card.appointment.duration_min,
                title: card.service_name || 'Appointment',
                person: `P${card.planned}/${card.capacity}`,
                my_status: 'scheduled',
              }))
            )}
            onSelect={(ev) => setOpenId(ev.id)}
            emptyLabel="No appointments this week. Tap New to add one."
          />
        </div>
      ) : null}

      {workTab === 'people' ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">
            Patients on your file. Open an appointment from Today or Diary to
            book them and mark attendance.
          </p>
          {portal.patients.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="font-bold">{p.name}</div>
              <div className="text-[11px] text-slate-400">
                {p.code ? `${p.code} · ` : ''}
                {p.email || 'No email'}
                {p.soft_block ? ' · ⚠ soft-block' : ''}
                {p.no_show_count ? ` · ${p.no_show_count} no-show` : ''}
              </div>
            </div>
          ))}
          {!portal.patients.length ? (
            <p className="text-sm text-slate-500">No patients on file yet.</p>
          ) : null}
        </div>
      ) : null}

      {workTab === 'inbox' ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
          Messages with patients and the front desk will show here.
        </div>
      ) : null}

      {workTab === 'me' ? (
        <div className="space-y-3">
          <OwnerWorkspaceCta companyId={companyId} brand={brand} />
          <h2 className="text-sm font-black">
            Your email, ID, bio & qualifications
          </h2>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            type="email"
            placeholder="Login email"
            defaultValue={portal.clinician.email || ''}
            id="clinician-email"
          />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="SA ID / passport number"
            defaultValue={portal.clinician.id_number || ''}
            id="clinician-id-number"
          />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Phone"
            defaultValue={portal.clinician.phone || ''}
            id="clinician-phone"
          />
          <textarea
            className="w-full min-h-[4rem] resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Public bio patients see on the website"
            defaultValue={portal.clinician.public_bio || ''}
            id="clinician-public-bio"
          />
          <textarea
            className="w-full min-h-[3rem] resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Internal notes / full bio"
            defaultValue={portal.clinician.bio || ''}
            id="clinician-bio"
          />
          <button
            type="button"
            disabled={busy}
            className="w-full rounded-xl py-2 text-sm font-black text-slate-950 disabled:opacity-50"
            style={{ background: workAccent }}
            onClick={() => {
              const publicBio = (
                document.getElementById(
                  'clinician-public-bio'
                ) as HTMLTextAreaElement | null
              )?.value;
              const bio = (
                document.getElementById('clinician-bio') as HTMLTextAreaElement | null
              )?.value;
              const email = (
                document.getElementById(
                  'clinician-email'
                ) as HTMLInputElement | null
              )?.value;
              const idNumber = (
                document.getElementById(
                  'clinician-id-number'
                ) as HTMLInputElement | null
              )?.value;
              const phone = (
                document.getElementById(
                  'clinician-phone'
                ) as HTMLInputElement | null
              )?.value;
              void post({
                action: 'update_profile',
                email,
                id_number: idNumber,
                phone,
                public_bio: publicBio,
                bio,
              });
            }}
          >
            Save bio
          </button>
          <PersonQualificationsEditor
            qualifications={portal.clinician.qualifications || []}
            onChange={async (next) => {
              await post({ action: 'update_profile', qualifications: next });
            }}
            uploadFile={async (file) => {
              const fd = new FormData();
              fd.set('module', mod);
              fd.set('token', token);
              fd.set('action', 'upload_certificate');
              fd.set('file', file);
              const res = await fetch('/api/public/advisor/clinician', {
                method: 'POST',
                body: fd,
              });
              const data = await res.json();
              if (!res.ok || !data.url) {
                throw new Error(data.error || 'Upload failed');
              }
              return {
                url: String(data.url),
                fileName: String(data.fileName || file.name),
              };
            }}
            disabled={busy}
            toneClass="border-slate-700 bg-slate-950/60"
          />
        </div>
      ) : null}

      {openCard && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-4">
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                  {openCard.appointment.date} ·{' '}
                  {String(openCard.appointment.start_time).slice(0, 5)}
                  {openCard.appointment.series_id ? ' · series' : ''}
                </p>
                <h3 className="text-lg font-black">
                  {openCard.service_name || 'Appointment'}
                </h3>
                <p className="text-xs text-slate-400">
                  {openCard.appointment.location || '—'} · Plan{' '}
                  {openCard.planned}/{openCard.capacity}
                </p>
              </div>
              <button type="button" onClick={() => setOpenId(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 rounded-2xl border border-sky-500/30 bg-sky-950/20 p-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                Edit calendar entry
              </h4>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={edit.service_id}
                onChange={(e) =>
                  setEdit((f) => ({ ...f, service_id: e.target.value }))
                }
              >
                <option value="">Service…</option>
                {portal.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={edit.date}
                  onChange={(e) =>
                    setEdit((f) => ({ ...f, date: e.target.value }))
                  }
                />
                <input
                  type="time"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={edit.start_time}
                  onChange={(e) =>
                    setEdit((f) => ({ ...f, start_time: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={5}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Duration min"
                  value={edit.duration_min}
                  onChange={(e) =>
                    setEdit((f) => ({ ...f, duration_min: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={edit.status}
                  onChange={(e) =>
                    setEdit((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Room / location"
                value={edit.location}
                onChange={(e) =>
                  setEdit((f) => ({ ...f, location: e.target.value }))
                }
              />
              {openCard.appointment.series_id ? (
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={edit.edit_scope}
                  onChange={(e) =>
                    setEdit((f) => ({
                      ...f,
                      edit_scope: e.target.value as 'one' | 'future',
                    }))
                  }
                >
                  <option value="one">Edit this date only</option>
                  <option value="future">Edit this and future</option>
                </select>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={edit.public}
                  onChange={(e) =>
                    setEdit((f) => ({ ...f, public: e.target.checked }))
                  }
                />
                Publish on website diary
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl bg-sky-500 text-sky-950 px-3 py-2 text-xs font-black disabled:opacity-50"
                  onClick={() =>
                    void post({
                      action: 'update_appointment',
                      appointment_id: openCard.appointment.id,
                      service_id: edit.service_id,
                      date: edit.date,
                      start_time: edit.start_time,
                      duration_min: Number(edit.duration_min) || 45,
                      location: edit.location,
                      status: edit.status,
                      public: edit.public,
                      notes: edit.notes,
                      edit_scope: edit.edit_scope,
                    })
                  }
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                  ) : null}{' '}
                  Save changes
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-200"
                  onClick={() => {
                    if (
                      !confirm(
                        `Delete this appointment on ${openCard.appointment.date}?`
                      )
                    )
                      return;
                    let deleteSeries = false;
                    if (openCard.appointment.series_id) {
                      deleteSeries = confirm(
                        'This is part of a series. OK = delete entire series, Cancel = this date only.'
                      );
                    }
                    void post({
                      action: 'delete_appointment',
                      appointment_id: openCard.appointment.id,
                      delete_series: deleteSeries,
                    }).then(() => setOpenId(null));
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Patients · mark attendance
              </h4>
              {openCard.roster.length === 0 ? (
                <p className="text-sm text-slate-500">Nobody booked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {openCard.roster.map((r) => (
                    <li
                      key={r.booking_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold">{r.name}</div>
                        <div className="text-[10px] uppercase text-slate-500">
                          {attendOverride[r.booking_id] || r.actual || r.status}
                          {r.soft_block
                            ? ' · ⚠ soft-block (no-shows)'
                            : ''}
                          {r.injured ? ' · clinical alert' : ''}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className={`inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                            (attendOverride[r.booking_id] || r.actual) ===
                            'attended'
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-600'
                          }`}
                          title="Attended — tap once to save"
                          onClick={() => {
                            setAttendOverride((prev) => ({
                              ...prev,
                              [r.booking_id]: 'attended',
                            }));
                            attendChain.current = attendChain.current.then(() =>
                              post(
                                {
                                  action: 'mark_attendance',
                                  booking_id: r.booking_id,
                                  appointment_id: openCard.appointment.id,
                                  patient_id: r.patient_id,
                                  status: 'attended',
                                },
                                { quiet: true }
                              )
                                .then(() => {
                                  setAttendOverride((prev) => {
                                    const next = { ...prev };
                                    if (next[r.booking_id] === 'attended') {
                                      delete next[r.booking_id];
                                    }
                                    return next;
                                  });
                                })
                                .catch(() => {
                                  setAttendOverride((prev) => {
                                    const next = { ...prev };
                                    if (next[r.booking_id] === 'attended') {
                                      delete next[r.booking_id];
                                    }
                                    return next;
                                  });
                                })
                            );
                          }}
                        >
                          <Check className="w-4 h-4" />
                          Came
                        </button>
                        <button
                          type="button"
                          className={`inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                            (attendOverride[r.booking_id] || r.actual) ===
                            'no_show'
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'border-slate-600'
                          }`}
                          title="Did not attend — tap once to save"
                          onClick={() => {
                            setAttendOverride((prev) => ({
                              ...prev,
                              [r.booking_id]: 'no_show',
                            }));
                            attendChain.current = attendChain.current.then(() =>
                              post(
                                {
                                  action: 'mark_attendance',
                                  booking_id: r.booking_id,
                                  appointment_id: openCard.appointment.id,
                                  patient_id: r.patient_id,
                                  status: 'no_show',
                                },
                                { quiet: true }
                              )
                                .then(() => {
                                  setAttendOverride((prev) => {
                                    const next = { ...prev };
                                    if (next[r.booking_id] === 'no_show') {
                                      delete next[r.booking_id];
                                    }
                                    return next;
                                  });
                                })
                                .catch(() => {
                                  setAttendOverride((prev) => {
                                    const next = { ...prev };
                                    if (next[r.booking_id] === 'no_show') {
                                      delete next[r.booking_id];
                                    }
                                    return next;
                                  });
                                })
                            );
                          }}
                        >
                          <UserX className="w-4 h-4" />
                          Didn’t
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="px-2 py-1 rounded-lg border border-slate-600 text-[10px] font-bold"
                          onClick={() =>
                            void post({
                              action: 'cancel_booking',
                              booking_id: r.booking_id,
                            })
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ClinicianPwaVisitCare
              module={mod}
              appointmentId={openCard.appointment.id}
              clinicianName={portal.clinician.name}
              roster={openCard.roster}
              patients={portal.patients}
              visitNotes={portal.visit_notes}
              movements={portal.movements}
              busy={busy}
              post={async (body) => post(body)}
            />

            <div className="flex flex-wrap gap-2 items-end border-t border-slate-800 pt-3">
              <select
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={patientFor}
                onChange={(e) => setPatientFor(e.target.value)}
              >
                <option value="">Book patient…</option>
                {portal.patients
                  .filter(
                    (p) =>
                      !openCard.roster.some(
                        (r) =>
                          r.patient_id === p.id && r.status !== 'cancelled'
                      )
                  )
                  .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.soft_block ? ' ⚠' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !patientFor}
                className="rounded-xl bg-sky-500 text-sky-950 px-3 py-2 text-xs font-black inline-flex items-center gap-1"
                onClick={() =>
                  void post({
                    action: 'book_patient',
                    appointment_id: openCard.appointment.id,
                    patient_id: patientFor,
                  }).then(() => setPatientFor(''))
                }
              >
                <UserPlus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex justify-between">
              <h3 className="font-black">New appointment</h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={create.appointment_kind}
              onChange={(e) =>
                setCreate((f) => ({
                  ...f,
                  appointment_kind: e.target.value as 'consult' | 'personal',
                  public: e.target.value === 'personal' ? false : f.public,
                }))
              }
            >
              <option value="consult">Patient appointment</option>
              <option value="personal">Own time / leave</option>
            </select>
            {create.appointment_kind === 'personal' ? (
              <>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={create.personal_reason}
                  onChange={(e) =>
                    setCreate((f) => ({
                      ...f,
                      personal_reason: e.target.value,
                      start_time:
                        e.target.value === 'leave' ? '08:00' : f.start_time,
                      end_time:
                        e.target.value === 'leave' ? '17:00' : f.end_time,
                    }))
                  }
                >
                  <option value="personal">Personal</option>
                  <option value="leave">Leave</option>
                  <option value="admin">Admin / paperwork</option>
                  <option value="other">Other</option>
                </select>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Note (optional)"
                  value={create.notes}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </>
            ) : (
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={create.service_id}
              onChange={(e) =>
                setCreate((f) => ({ ...f, service_id: e.target.value }))
              }
            >
              <option value="">Service…</option>
              {portal.services
                .filter((s) => s.code !== 'SYS_PERSONAL')
                .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.date}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, date: e.target.value }))
                }
              />
              <input
                type="time"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.start_time}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, start_time: e.target.value }))
                }
              />
              <input
                type="time"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm col-span-2"
                value={create.end_time}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, end_time: e.target.value }))
                }
              />
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Room / location"
              value={create.location}
              onChange={(e) =>
                setCreate((f) => ({ ...f, location: e.target.value }))
              }
            />
            {create.appointment_kind !== 'personal' ? (
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={create.patient_id}
              onChange={(e) =>
                setCreate((f) => ({ ...f, patient_id: e.target.value }))
              }
            >
              <option value="">Patient (optional)…</option>
              {portal.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            ) : (
              <p className="text-[11px] text-slate-400">
                Blocks your diary. Patients cannot book this time.
              </p>
            )}
            <button
              type="button"
              disabled={
                busy ||
                (create.appointment_kind !== 'personal' && !create.service_id)
              }
              className="w-full rounded-xl bg-sky-500 text-sky-950 py-2.5 text-sm font-black disabled:opacity-50"
              onClick={() =>
                void post({
                  action: 'create_appointment',
                  appointment_kind: create.appointment_kind,
                  personal_reason: create.personal_reason,
                  notes: create.notes || undefined,
                  service_id: create.service_id,
                  date: create.date,
                  start_time: create.start_time,
                  end_time: create.end_time,
                  duration_min: Number(create.duration_min) || 45,
                  location: create.location || undefined,
                  patient_id:
                    create.appointment_kind === 'personal'
                      ? undefined
                      : create.patient_id || undefined,
                  public: create.public,
                }).then(() => setShowCreate(false))
              }
            >
              Create
            </button>
          </div>
        </div>
      )}
    </AdvisorWorkPwaChrome>
  );
}
