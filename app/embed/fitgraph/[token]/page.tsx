'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Check, FileText, Loader2, Users } from 'lucide-react';
import { gymBrandColor } from '@/lib/fitness/fitgraph';
import { GymShopPay } from '@/components/fitness/GymShopPay';
import type { GymShopItem } from '@/lib/fitness/gym-shop';
import {
  AdvisorPublicDayJump,
  AdvisorPublicSection,
  AdvisorPublicSite,
  AdvisorPublicStatus,
  advisorBrandInk,
  prettyPublicDate,
} from '@/components/advisors/AdvisorPublicSite';

type PublicSession = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number;
  class_name: string;
  category?: string;
  coach_name?: string;
  location?: string;
  capacity: number;
  spots_left: number;
  full: boolean;
  public_notes?: string;
  /** Planned activities for the class */
  class_plan?: string;
};

type PublicCalendar = {
  brand: string;
  bio?: string;
  timezone?: string;
  allow_booking: boolean;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  logo_url?: string | null;
  hours?: Array<{ days: string; hours: string }>;
  city?: string;
  primary_color?: string;
  from: string;
  to: string;
  sections?: {
    timetable?: boolean;
    team?: boolean;
    join?: boolean;
    policies?: boolean;
    hours?: boolean;
  };
  sessions: PublicSession[];
  coaches: Array<{
    code: string;
    name: string;
    photo_url?: string;
    specialties?: string[];
    bio?: string;
    qualifications?: Array<{
      title: string;
      issuer?: string;
      year?: string | null;
      certificates?: Array<{ file_name: string; url: string }>;
    }>;
  }>;
  plans: Array<{
    id?: string;
    code: string;
    name: string;
    price_zar: number;
    billing: string;
    description?: string;
  }>;
  programmes?: Array<{
    id: string;
    name: string;
    price_zar: number;
    billing: string;
    description?: string;
  }>;
  require_paid_membership?: boolean;
  joining?: { fee_zar: number; waived?: boolean; note?: string } | null;
  class_subscribe?: boolean;
  contracts?: Array<{
    id: string;
    title: string;
    file_name: string;
    url: string;
    kind?: string;
  }>;
};

export default function EmbedFitgraphPage() {
  const { token } = useParams() as { token: string };
  const [calendar, setCalendar] = useState<PublicCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [shop, setShop] = useState<GymShopItem[]>([]);
  const [payoutReady, setPayoutReady] = useState(true);
  const [requirePaid, setRequirePaid] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [portalToken, setPortalToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/fitgraph?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCalendar(data.calendar);
      const catalog = Array.isArray(data.shop)
        ? (data.shop as GymShopItem[])
        : [];
      setShop(catalog);
      setPayoutReady(data.payout_ready !== false);
      setRequirePaid(
        data.calendar?.require_paid_membership === true || catalog.length > 0
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const q = new URLSearchParams(window.location.search);
    const ref = q.get('ref') || q.get('reference') || q.get('trxref');
    if (
      !ref ||
      (q.get('pay') !== '1' && !String(ref).startsWith('gym-sale-'))
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setSaving(true);
      try {
        const res = await fetch('/api/public/fitgraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            action: 'verify_sale',
            reference: ref,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not confirm payment');
        if (cancelled) return;
        setDoneMsg(data.message || 'Payment recorded — membership is active');
        if (data.portal_token) setPortalToken(String(data.portal_token));
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete('pay');
          u.searchParams.delete('ref');
          u.searchParams.delete('reference');
          u.searchParams.delete('trxref');
          window.history.replaceState({}, '', `${u.pathname}${u.search}`);
        } catch {
          /* ignore */
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Payment check failed');
        }
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const book = async () => {
    if (!bookingId || !name.trim()) return;
    setSaving(true);
    setDoneMsg(null);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'book',
          session_id: bookingId,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.need_membership) {
          setShop((data.shop as GymShopItem[]) || shop);
          setPendingSession(bookingId);
          setRequirePaid(true);
          setBookingId(null);
          throw new Error(
            data.error || 'Buy a membership first — then we can book this class'
          );
        }
        throw new Error(data.error || 'Booking failed');
      }
      setDoneMsg(data.booking?.message || 'Booked');
      if (data.calendar) setCalendar(data.calendar);
      setBookingId(null);
      setName('');
      setEmail('');
      setPhone('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSaving(false);
    }
  };

  const buy = async (item: GymShopItem) => {
    if (!name.trim() || !email.includes('@')) {
      setError('Name and email are required to pay');
      return;
    }
    setBuyingId(`${item.kind}:${item.id}`);
    setError(null);
    setDoneMsg(null);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'checkout',
          kind: item.kind,
          item_id: item.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          session_id: pendingSession || bookingId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error('Paystack did not return a checkout link');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBuyingId(null);
    }
  };

  const color = gymBrandColor(calendar?.primary_color);
  const shopItems: GymShopItem[] =
    shop.length > 0
      ? shop
      : [
          ...(calendar?.plans || [])
            .filter((p) => Number(p.price_zar) > 0)
            .map((p) => ({
              kind: 'membership' as const,
              id: p.id || p.code,
              code: p.code,
              name: p.name,
              description: p.description,
              price_zar: p.price_zar,
              billing: p.billing,
            })),
          ...(calendar?.programmes || []).map((p) => ({
            kind: 'programme' as const,
            id: p.id,
            name: p.name,
            description: p.description,
            price_zar: p.price_zar,
            billing: p.billing,
          })),
        ];

  if (loading) {
    return <AdvisorPublicStatus color="#E8E830" />;
  }

  if (error && !calendar) {
    return <AdvisorPublicStatus error={error} />;
  }

  if (!calendar) return null;

  // Group by date
  const byDate = new Map<string, PublicSession[]>();
  for (const s of calendar.sessions) {
    const list = byDate.get(s.date) || [];
    list.push(s);
    byDate.set(s.date, list);
  }

  const sec = calendar.sections || {};
  const nav = [
    ...(sec.timetable !== false
      ? [{ id: 'timetable', label: 'Timetable' }]
      : []),
    ...(sec.team !== false && calendar.coaches.length
      ? [{ id: 'team', label: 'Coaches' }]
      : []),
    ...(sec.join !== false && shopItems.length
      ? [{ id: 'join', label: 'Join' }]
      : []),
    ...(sec.policies !== false && (calendar.contracts || []).length
      ? [{ id: 'policies', label: 'Policies' }]
      : []),
  ];
  const dates = [...byDate.keys()];

  return (
    <AdvisorPublicSite
      eyebrow="GymAdvisor®"
      brand={calendar.brand}
      bio={calendar.bio}
      city={calendar.city}
      phone={calendar.contact_phone}
      email={calendar.contact_email}
      websiteUrl={calendar.website_url}
      logoUrl={calendar.logo_url}
      hours={sec.hours === false ? [] : calendar.hours}
      color={color}
      showVisit={sec.hours !== false}
      payoutReady={payoutReady}
      nav={nav}
      cta={{ href: shopItems.length ? '#join' : '#timetable', label: shopItems.length ? 'Join' : 'Timetable' }}
      footerNote="Powered by GymAdvisor® · SupplierAdvisor"
    >
      {doneMsg ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="h-4 w-4" /> {doneMsg}
        </div>
      ) : null}
      {portalToken ? (
        <a
          href={`/member/fitgraph/${encodeURIComponent(portalToken)}`}
          className="block rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-950"
        >
          Open your member portal to book classes
        </a>
      ) : null}
      {error && calendar ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {sec.timetable !== false ? (
      <AdvisorPublicSection
        id="timetable"
        title="Class timetable"
        icon={<CalendarDays className="h-5 w-5" style={{ color }} />}
      >
        <p className="mb-4 text-sm text-slate-500">
          {calendar.timezone || 'Africa/Johannesburg'} ·{' '}
          {prettyPublicDate(calendar.from)} → {prettyPublicDate(calendar.to)}
        </p>
        <AdvisorPublicDayJump dates={dates} />
        {byDate.size === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            No public classes in this window. Check back soon.
          </p>
        ) : (
          <div className="space-y-8">
            {[...byDate.entries()].map(([date, sessions]) => (
              <div key={date} id={`day-${date}`} className="scroll-mt-28">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
                  {prettyPublicDate(date)}
                </h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {s.start_time}
                          {s.end_time ? `–${s.end_time}` : ''} · {s.class_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {s.coach_name || 'Coach TBC'}
                          {s.location ? ` · ${s.location}` : ''}
                          {' · '}
                          <span className="inline-flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {s.full
                              ? 'Full'
                              : `${s.spots_left} spot${s.spots_left === 1 ? '' : 's'} left`}
                          </span>
                        </p>
                        {s.class_plan || s.public_notes ? (
                          <div className="mt-2 rounded-xl border border-yellow-100 bg-yellow-50 px-2.5 py-1.5">
                            <p className="text-[9px] font-black uppercase tracking-wider text-yellow-700">
                              Class plan
                            </p>
                            <p className="whitespace-pre-wrap text-[11px] text-slate-700">
                              {s.class_plan || s.public_notes}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      {calendar.allow_booking ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBookingId(s.id);
                            setError(null);
                            setDoneMsg(null);
                          }}
                          className="mt-3 rounded-xl px-3 py-2 text-xs font-bold text-white"
                          style={{
                            backgroundColor: s.full ? '#94a3b8' : color,
                            color: s.full ? '#fff' : advisorBrandInk(color),
                          }}
                        >
                          {s.full ? 'Join waitlist' : 'Book'}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </AdvisorPublicSection>
      ) : null}

      {sec.team !== false && calendar.coaches.length > 0 ? (
        <AdvisorPublicSection
          id="team"
          title="Coaches"
          icon={<Users className="h-5 w-5" style={{ color }} />}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {calendar.coaches.map((c) => (
              <div
                key={c.code}
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
                  <p className="text-base font-black text-slate-900">{c.name}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {(c.specialties || []).join(' · ') || c.code}
                </p>
                {c.bio ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {c.bio}
                  </p>
                ) : null}
                {(c.qualifications || []).length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {c.qualifications!.map((q) => (
                      <li key={q.title}>
                        <span className="font-semibold text-slate-700">
                          {q.title}
                        </span>
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
              </div>
            ))}
          </div>
        </AdvisorPublicSection>
      ) : null}

      {sec.join !== false && shopItems.length > 0 ? (
        <AdvisorPublicSection
          id="join"
          title={
            (calendar.programmes || []).length
              ? calendar.class_subscribe
                ? 'Programmes & class subscriptions'
                : 'Programmes & join'
              : calendar.class_subscribe
                ? 'Subscribe to classes'
                : 'Join & pay'
          }
        >
          <GymShopPay
            items={shopItems}
            color={color}
            payoutReady={payoutReady}
            requirePaid={requirePaid || calendar.require_paid_membership}
            name={name}
            email={email}
            phone={phone}
            onName={setName}
            onEmail={setEmail}
            onPhone={setPhone}
            onBuy={(item) => void buy(item)}
            buyingId={buyingId}
            classSubscribe={calendar.class_subscribe === true}
          />
        </AdvisorPublicSection>
      ) : null}

      {sec.policies !== false && (calendar.contracts || []).length > 0 ? (
        <AdvisorPublicSection
          id="policies"
          title="Contracts & policies"
          icon={<FileText className="h-5 w-5" style={{ color }} />}
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {(calendar.contracts || []).map((doc) => (
              <li key={doc.id}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate">
                    {doc.title}
                    {doc.kind ? (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {String(doc.kind).replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold" style={{ color }}>
                    Download PDF
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </AdvisorPublicSection>
      ) : null}

      {bookingId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-3 shadow-xl">
            <h3 className="font-black text-lg">Book class</h3>
            <p className="text-xs text-slate-500">
              {requirePaid
                ? 'If you are not a paid member yet, we will send you to Paystack first (card / Apple Pay).'
                : 'We will reserve your spot (or waitlist if full).'}
            </p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Your name *"
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
              placeholder="Phone / WhatsApp"
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
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white inline-flex justify-center items-center gap-1.5"
                style={{ backgroundColor: color }}
                onClick={() => void book()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </AdvisorPublicSite>
  );
}
