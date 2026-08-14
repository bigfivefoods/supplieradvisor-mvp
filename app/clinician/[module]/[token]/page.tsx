'use client';

/**
 * Clinician diary portal — parity with GymAdvisor coach portal.
 * /clinician/{dentalgraph|physiograph|medicalgraph|psychiatrygraph}/{token}
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Repeat,
  User,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';

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
  }>;
  services: Array<{
    id: string;
    code?: string;
    name: string;
    default_duration_min?: number;
  }>;
  rooms?: string[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(new Date().toISOString().slice(0, 10))
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [patientFor, setPatientFor] = useState('');
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
    service_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
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

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setMsg(null);
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
      if (data.message) setMsg(String(data.message));
      return data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      throw e;
    } finally {
      setBusy(false);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6 sticky top-0 z-20 bg-slate-950/95 backdrop-blur">
        <div className="max-w-3xl mx-auto">
          <div className="text-[10px] font-black uppercase tracking-widest text-sky-400">
            Clinician diary · {brand}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-2 min-w-0">
              {portal.clinician.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portal.clinician.photo_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-sky-500/40 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-sky-400" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-black truncate">
                  {portal.clinician.name}
                </h1>
                {(portal.clinician.roles || []).length > 0 && (
                  <p className="text-[10px] text-sky-200/80 truncate">
                    {(portal.clinician.roles || []).join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowProfile(true)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-3 py-1.5 text-xs font-black text-slate-100"
              >
                <User className="w-3.5 h-3.5" /> Bio
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1 rounded-full bg-sky-500 text-sky-950 px-3 py-1.5 text-xs font-black"
              >
                <Plus className="w-3.5 h-3.5" /> New appointment
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Edit and delete diary entries · book patients · mark attendance ·
            waitlist promotes automatically
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              className="p-2 rounded-xl border border-slate-700"
              onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold tabular-nums flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-sky-400" />
              {weekStart} → {weekEnd}
            </span>
            <button
              type="button"
              className="p-2 rounded-xl border border-slate-700"
              onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {showProfile && portal ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Your bio & qualifications</h2>
              <button
                type="button"
                onClick={() => setShowProfile(false)}
                className="text-xs font-bold text-slate-400"
              >
                Close
              </button>
            </div>
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
              className="w-full rounded-xl bg-sky-500 py-2 text-sm font-black text-sky-950 disabled:opacity-50"
              onClick={() => {
                const publicBio = (
                  document.getElementById(
                    'clinician-public-bio'
                  ) as HTMLTextAreaElement | null
                )?.value;
                const bio = (
                  document.getElementById('clinician-bio') as HTMLTextAreaElement | null
                )?.value;
                void post({
                  action: 'update_profile',
                  public_bio: publicBio,
                  bio,
                }).then(() => setShowProfile(false));
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
        </div>
      ) : null}

      <main className="max-w-3xl mx-auto px-3 py-4 sm:px-6 space-y-3">
        {error && (
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}
        {msg && (
          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {days.map((d) => {
            const list = portal.by_date?.[d] || [];
            const label = new Date(d + 'T12:00:00').toLocaleDateString(
              undefined,
              { weekday: 'short', day: 'numeric' }
            );
            return (
              <div
                key={d}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2 min-h-[6.5rem]"
              >
                <div className="text-[10px] font-black uppercase text-sky-400/90 mb-1.5">
                  {label}
                </div>
                <div className="space-y-1">
                  {list.length === 0 ? (
                    <p className="text-[10px] text-slate-600 text-center py-3">
                      —
                    </p>
                  ) : (
                    list.map((card) => (
                      <button
                        key={card.appointment.id}
                        type="button"
                        onClick={() => setOpenId(card.appointment.id)}
                        className="w-full text-left rounded-xl border border-slate-700 bg-slate-950/60 px-2 py-1.5 hover:border-sky-500/60"
                      >
                        <div className="text-[11px] font-black tabular-nums text-sky-200">
                          {String(card.appointment.start_time).slice(0, 5)}
                        </div>
                        <div className="text-[10px] font-semibold truncate">
                          {card.service_name || 'Appointment'}
                        </div>
                        <div className="text-[9px] text-slate-500 flex gap-1 items-center">
                          <span>
                            P{card.planned}/{card.capacity}
                          </span>
                          <span>A{card.attended}</span>
                          {card.appointment.series_id ? (
                            <Repeat className="w-2.5 h-2.5 text-sky-500" />
                          ) : null}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {portal.appointments.length === 0 && (
          <p className="text-center text-slate-500 py-10 text-sm">
            No appointments this week. Tap <strong>New appointment</strong> to
            add one.
          </p>
        )}
      </main>

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
                          {r.status}
                          {r.soft_block
                            ? ' · ⚠ soft-block (no-shows)'
                            : ''}
                          {r.injured ? ' · clinical alert' : ''}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          className={`p-1.5 rounded-lg border text-xs ${
                            r.actual === 'attended'
                              ? 'bg-emerald-600 border-emerald-600'
                              : 'border-slate-600'
                          }`}
                          title="Attended"
                          onClick={() =>
                            void post({
                              action: 'mark_attendance',
                              booking_id: r.booking_id,
                              status: 'attended',
                            })
                          }
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={`p-1.5 rounded-lg border text-xs ${
                            r.actual === 'no_show'
                              ? 'bg-rose-600 border-rose-600'
                              : 'border-slate-600'
                          }`}
                          title="No-show"
                          onClick={() =>
                            void post({
                              action: 'mark_attendance',
                              booking_id: r.booking_id,
                              status: 'no_show',
                            })
                          }
                        >
                          <UserX className="w-3.5 h-3.5" />
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

            <div className="flex flex-wrap gap-2 items-end border-t border-slate-800 pt-3">
              <select
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={patientFor}
                onChange={(e) => setPatientFor(e.target.value)}
              >
                <option value="">Book patient…</option>
                {portal.patients.map((p) => (
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
              value={create.service_id}
              onChange={(e) =>
                setCreate((f) => ({ ...f, service_id: e.target.value }))
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
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Room / location"
              value={create.location}
              onChange={(e) =>
                setCreate((f) => ({ ...f, location: e.target.value }))
              }
            />
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
            <button
              type="button"
              disabled={busy || !create.service_id}
              className="w-full rounded-xl bg-sky-500 text-sky-950 py-2.5 text-sm font-black disabled:opacity-50"
              onClick={() =>
                void post({
                  action: 'create_appointment',
                  service_id: create.service_id,
                  date: create.date,
                  start_time: create.start_time,
                  duration_min: Number(create.duration_min) || 45,
                  location: create.location || undefined,
                  patient_id: create.patient_id || undefined,
                  public: create.public,
                }).then(() => setShowCreate(false))
              }
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
