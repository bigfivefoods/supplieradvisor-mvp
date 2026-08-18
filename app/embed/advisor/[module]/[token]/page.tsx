'use client';

/**
 * Public clinic Advisor diary embed — book open public slots by practice token.
 * /embed/advisor/physiograph/{public_token}
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Check, Loader2, MapPin, Stethoscope } from 'lucide-react';
import {
  AdvisorPublicDayJump,
  AdvisorPublicSection,
  AdvisorPublicSite,
  AdvisorPublicStatus,
  prettyPublicDate,
} from '@/components/advisors/AdvisorPublicSite';

type Slot = {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  clinician_name?: string;
  location?: string;
  spots_left: number;
  full: boolean;
  public_notes?: string;
};

type Calendar = {
  brand: string;
  bio?: string;
  allow_booking: boolean;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  logo_url?: string | null;
  hours?: Array<{ days: string; hours: string }>;
  primary_color?: string;
  city?: string;
  slots: Slot[];
  clinicians?: Array<{
    name: string;
    photo_url?: string;
    disciplines?: string[];
    bio?: string;
    qualifications?: Array<{
      title: string;
      issuer?: string;
      year?: string | null;
      certificates?: Array<{ file_name: string; url: string }>;
    }>;
  }>;
  services?: Array<{ name: string; price_zar?: number }>;
  sections?: {
    diary?: boolean;
    team?: boolean;
    services?: boolean;
    pricing?: boolean;
    hours?: boolean;
    contact?: boolean;
  };
};

const MODULE_LABEL: Record<string, string> = {
  dentalgraph: 'DentalAdvisor®',
  physiograph: 'PhysioAdvisor®',
  medicalgraph: 'MedicalAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
};

export default function EmbedClinicAdvisorPage() {
  const { module: mod, token } = useParams() as {
    module: string;
    token: string;
  };
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [payoutReady, setPayoutReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !mod) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/advisor/clinic?module=${encodeURIComponent(mod)}&token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCalendar(data.calendar);
      setPayoutReady(data.payout_ready === true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [mod, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const book = async () => {
    if (!bookingId || !name.trim()) return;
    setSaving(true);
    setDoneMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/public/advisor/clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: mod,
          token,
          action: 'book',
          appointment_id: bookingId,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Book failed');
      setDoneMsg(data.message || 'Booked');
      setBookingId(null);
      void load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Book failed');
    } finally {
      setSaving(false);
    }
  };

  const color = calendar?.primary_color || '#0d9488';
  const label = MODULE_LABEL[mod] || 'Advisor';

  if (loading) {
    return <AdvisorPublicStatus color="#0d9488" />;
  }

  if (error && !calendar) {
    return <AdvisorPublicStatus error={error} />;
  }

  const sec = calendar?.sections || {};
  const nav = [
    ...(sec.diary !== false ? [{ id: 'diary', label: 'Book' }] : []),
    ...(sec.team !== false && calendar?.clinicians?.length
      ? [{ id: 'team', label: 'Team' }]
      : []),
    ...(sec.services !== false && calendar?.services?.length
      ? [{ id: 'services', label: 'Services' }]
      : []),
    ...(sec.contact !== false &&
    (calendar?.city || calendar?.contact_phone || calendar?.contact_email)
      ? [{ id: 'contact', label: 'Contact' }]
      : []),
  ];

  const byDate = new Map<string, Slot[]>();
  for (const s of calendar?.slots || []) {
    const list = byDate.get(s.date) || [];
    list.push(s);
    byDate.set(s.date, list);
  }
  const allDates = [...byDate.keys()];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekIso = weekEnd.toISOString().slice(0, 10);
  const dates = showAllDates
    ? allDates
    : allDates.filter((d) => d <= weekIso);
  const hiddenDays = allDates.length - dates.length;

  return (
    <AdvisorPublicSite
      eyebrow={label}
      brand={calendar?.brand || 'Practice'}
      bio={calendar?.bio}
      city={calendar?.city}
      phone={calendar?.contact_phone}
      email={calendar?.contact_email}
      websiteUrl={calendar?.website_url}
      logoUrl={calendar?.logo_url}
      hours={sec.hours === false ? [] : calendar?.hours}
      color={color}
      payoutReady={payoutReady}
      showVisit={sec.hours !== false && sec.contact !== false}
      nav={nav}
      cta={{ href: '#diary', label: 'Book' }}
    >
      {error ? (
        <p className="text-sm font-medium text-rose-600">{error}</p>
      ) : null}
      {doneMsg ? (
        <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0" /> {doneMsg}
        </div>
      ) : null}

      {!calendar?.allow_booking ? (
        <p className="text-sm text-slate-500">
          Online booking is paused. Contact the practice to book.
        </p>
      ) : null}

      {sec.diary !== false ? (
      <AdvisorPublicSection
        id="diary"
        title="Open diary"
        icon={<CalendarDays className="h-5 w-5" style={{ color }} />}
      >
        <AdvisorPublicDayJump dates={dates} />
        {hiddenDays > 0 ? (
          <button
            type="button"
            onClick={() => setShowAllDates(true)}
            className="mb-4 text-xs font-bold underline"
            style={{ color }}
          >
            Showing the next 7 days · {hiddenDays} more day
            {hiddenDays === 1 ? '' : 's'} later
          </button>
        ) : null}
        {showAllDates && allDates.length > 7 ? (
          <button
            type="button"
            onClick={() => setShowAllDates(false)}
            className="mb-4 text-xs font-bold underline"
            style={{ color }}
          >
            Show this week only
          </button>
        ) : null}
        {!calendar?.slots?.length ? (
          <p className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            No public slots in the next few weeks.
          </p>
        ) : (
          <div className="space-y-8">
            {dates.map((date) => (
              <div key={date} id={`day-${date}`} className="scroll-mt-28">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
                  {prettyPublicDate(date)}
                </h3>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(byDate.get(date) || []).map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black">
                          {s.start_time.slice(0, 5)} · {s.service_name}
                        </p>
                        {s.clinician_name ? (
                          <p className="mt-1 text-xs text-slate-600">
                            {s.clinician_name}
                          </p>
                        ) : null}
                        {s.location ? (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin className="h-3 w-3" /> {s.location}
                          </p>
                        ) : null}
                      </div>
                      {calendar.allow_booking ? (
                        s.full ? (
                          <button
                            type="button"
                            onClick={() => setBookingId(s.id)}
                            className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
                          >
                            Join waitlist
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setBookingId(s.id)}
                            className="mt-3 rounded-xl px-4 py-2 text-xs font-bold text-white"
                            style={{ backgroundColor: color }}
                          >
                            Book
                          </button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </AdvisorPublicSection>
      ) : null}

      {sec.team !== false &&
      calendar?.clinicians &&
      calendar.clinicians.length > 0 ? (
        <AdvisorPublicSection
          id="team"
          title="The team"
          icon={<Stethoscope className="h-5 w-5" style={{ color }} />}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {calendar.clinicians.slice(0, 12).map((c) => (
              <article
                key={c.name}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.photo_url}
                      alt=""
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white"
                      style={{ backgroundColor: color }}
                    >
                      {c.name.slice(0, 1)}
                    </div>
                  )}
                  <p className="text-base font-black">{c.name}</p>
                </div>
                {c.disciplines?.length ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {c.disciplines.join(', ')}
                  </p>
                ) : null}
                {c.bio ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {c.bio}
                  </p>
                ) : null}
                {(c.qualifications || []).length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {c.qualifications!.map((q) => (
                      <li key={q.title}>
                        {q.title}
                        {q.issuer || q.year
                          ? ` · ${[q.issuer, q.year].filter(Boolean).join(' · ')}`
                          : ''}
                        {(q.certificates || []).map((d) => (
                          <a
                            key={d.url}
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 font-bold text-sky-800"
                          >
                            Certificate
                          </a>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </AdvisorPublicSection>
      ) : null}

      {sec.services !== false &&
      calendar?.services &&
      calendar.services.length > 0 ? (
        <AdvisorPublicSection id="services" title="Services">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {calendar.services.map((svc) => (
              <li
                key={svc.name}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <span className="font-bold text-slate-900">{svc.name}</span>
                {svc.price_zar != null ? (
                  <span className="text-sm font-black tabular-nums" style={{ color }}>
                    R{Number(svc.price_zar).toLocaleString('en-ZA')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </AdvisorPublicSection>
      ) : null}

      {sec.contact !== false &&
      (calendar?.city || calendar?.contact_phone || calendar?.contact_email) ? (
      <AdvisorPublicSection id="contact" title="Contact">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {calendar?.city ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Location
              </p>
              <p className="mt-1 font-bold">{calendar.city}</p>
            </div>
          ) : null}
          {calendar?.contact_phone ? (
            <a
              href={`tel:${calendar.contact_phone.replace(/\s+/g, '')}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Phone
              </p>
              <p className="mt-1 font-bold">{calendar.contact_phone}</p>
            </a>
          ) : null}
          {calendar?.contact_email ? (
            <a
              href={`mailto:${calendar.contact_email}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Email
              </p>
              <p className="mt-1 break-all font-bold">{calendar.contact_email}</p>
            </a>
          ) : null}
        </div>
      </AdvisorPublicSection>
      ) : null}

        {bookingId ? (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 space-y-3 shadow-xl">
              <h3 className="text-lg font-black">Your details</h3>
              <p className="text-xs text-slate-500">
                We&apos;ll reserve your spot (or waitlist if full). Platform
                emails come from SupplierAdvisor® on behalf of the practice.
              </p>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Full name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold"
                  onClick={() => setBookingId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !name.trim()}
                  onClick={() => void book()}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: color }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}
    </AdvisorPublicSite>
  );
}
