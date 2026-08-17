'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Check, Loader2, Users } from 'lucide-react';
import { gymBrandColor } from '@/lib/fitness/fitgraph';
import { GymShopPay } from '@/components/fitness/GymShopPay';
import type { GymShopItem } from '@/lib/fitness/gym-shop';

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
  primary_color?: string;
  from: string;
  to: string;
  sessions: PublicSession[];
  coaches: Array<{
    code: string;
    name: string;
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (error && !calendar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-rose-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!calendar) return null;

  // Group by date
  const byDate = new Map<string, PublicSession[]>();
  for (const s of calendar.sessions) {
    const list = byDate.get(s.date) || [];
    list.push(s);
    byDate.set(s.date, list);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header
        className="border-b border-slate-200/80 px-4 py-6 sm:px-8"
        style={{ borderBottomColor: `${color}33` }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" style={{ color }} />
            Class schedule
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1" style={{ color }}>
            {calendar.brand}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {calendar.timezone || 'Africa/Johannesburg'} · {calendar.from} →{' '}
            {calendar.to}
          </p>
          {(calendar.contact_email || calendar.contact_phone) && (
            <p className="text-xs text-slate-500 mt-2">
              {[calendar.contact_email, calendar.contact_phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {calendar.bio && (
            <p className="text-sm text-slate-600 mt-3 max-w-2xl leading-relaxed">
              {calendar.bio}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-8 space-y-8">
        {doneMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4" /> {doneMsg}
          </div>
        )}
        {portalToken ? (
          <a
            href={`/member/fitgraph/${encodeURIComponent(portalToken)}`}
            className="block rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-950"
          >
            Open your member portal to book classes
          </a>
        ) : null}
        {error && calendar && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {byDate.size === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">
            No public classes in this window. Check back soon.
          </p>
        ) : (
          [...byDate.entries()].map(([date, sessions]) => (
            <section key={date}>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                {date}
              </h2>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-sm">
                        {s.start_time}
                        {s.end_time ? `–${s.end_time}` : ''} · {s.class_name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {s.coach_name || 'Coach TBC'}
                        {s.location ? ` · ${s.location}` : ''}
                        {' · '}
                        <span className="inline-flex items-center gap-0.5">
                          <Users className="w-3 h-3" />
                          {s.full
                            ? 'Full'
                            : `${s.spots_left} spot${s.spots_left === 1 ? '' : 's'} left`}
                        </span>
                      </div>
                      {(s.class_plan || s.public_notes) && (
                        <div className="mt-1.5 rounded-xl bg-yellow-50 border border-yellow-100 px-2.5 py-1.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-yellow-700 mb-0.5">
                            Class plan
                          </p>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                            {s.class_plan || s.public_notes}
                          </p>
                        </div>
                      )}
                    </div>
                    {calendar.allow_booking && (
                      <button
                        type="button"
                        onClick={() => {
                          setBookingId(s.id);
                          setError(null);
                          setDoneMsg(null);
                        }}
                        className="text-xs font-bold px-3 py-2 rounded-xl text-white self-center"
                        style={{
                          backgroundColor: s.full ? '#94a3b8' : color,
                        }}
                      >
                        {s.full ? 'Join waitlist' : 'Book'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {calendar.coaches.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
              Coaches
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {calendar.coaches.map((c) => (
                <div
                  key={c.code}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="font-bold text-sm">{c.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {(c.specialties || []).join(' · ') || c.code}
                  </div>
                  {c.bio && (
                    <p className="text-[12px] text-slate-600 mt-1">{c.bio}</p>
                  )}
                  {(c.qualifications || []).length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
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
          </section>
        )}

        {shopItems.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
              Join & pay
            </h2>
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
            />
          </section>
        )}

        {(calendar.contracts || []).length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
              Contracts & policies
            </h2>
            <ul className="space-y-2">
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
                    <span className="text-[11px] font-bold shrink-0" style={{ color }}>
                      Download PDF
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

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

      <footer className="text-center text-[10px] text-slate-400 py-8">
        Powered by GymAdvisor® · SupplierAdvisor
      </footer>
    </div>
  );
}
