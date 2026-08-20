'use client';

/**
 * HireAdvisor® B2C customer portal — mobile-first PWA surface.
 * Browse catalogue · request hire · KYC · track status · handovers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  MapPin,
  Package,
  Percent,
  Shield,
  Truck,
  User,
  X,
} from 'lucide-react';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';
import { B2cAutoLinkBanner } from '@/components/b2c/B2cAutoLinkBanner';
import { AdvisorAnnouncementFeed } from '@/components/services/AdvisorAnnouncementFeed';
import { B2cHireHowItWorks } from '@/components/b2c/B2cHireJourney';
import { B2cDiaryView, type MemberCalEvent } from '@/components/b2c/B2cMemberCalendar';
import { MemberAdvisorShell } from '@/components/advisors/MemberAdvisorShell';
import {
  downloadMemberEventIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
} from '@/lib/b2c/calendar-links';

const PORTAL_TOKEN_KEY = 'sa_hiregraph_customer_token';

type ReqChip = { key: string; label: string; met?: boolean };

type CatalogueItem = {
  id: string;
  code: string;
  title: string;
  description?: string;
  category_id: string;
  category_name: string;
  category_short?: string;
  rate_zar: number;
  rate_unit: string;
  deposit_zar?: number | null;
  default_deposit_pct?: number | null;
  location?: string;
  supplier_name?: string;
  needs_delivery?: boolean;
  high_value?: boolean;
  requirements: ReqChip[];
  requirements_pending: string[];
  requirements_ready: boolean;
  examples?: string[];
  busy_dates?: string[];
  includes?: string;
  excludes?: string;
  specs?: string;
  min_units?: number | null;
  fulfillment_label?: string;
  delivery_fee_zar?: number | null;
  collect_hours?: string;
  replacement_value_zar?: number | null;
  fuel_or_power?: string;
  age_or_weight_limit?: string;
  operator_included?: boolean;
  cancellation_note?: string;
  condition_notes?: string;
  delivery_radius_km?: number | null;
  setup_minutes?: number | null;
};

type MyBooking = {
  id: string;
  code: string;
  item_id?: string;
  item_title: string;
  category_id?: string;
  status: string;
  status_label: string;
  timeline: Array<{
    id: string;
    label: string;
    done: boolean;
    current: boolean;
  }>;
  start_date?: string | null;
  end_date?: string | null;
  duration_label?: string;
  can_extend?: boolean;
  units?: number | null;
  qty?: number | null;
  rental_zar?: number | null;
  deposit_zar?: number | null;
  customer_commission_zar?: number | null;
  customer_pays_zar?: number | null;
  delivery_address?: string;
  requirements_pending: ReqChip[];
  handovers: Array<{
    id: string;
    type: string;
    at?: string | null;
    condition_notes?: string;
    damage_zar?: number | null;
    deposit_released?: boolean;
  }>;
  can_cancel?: boolean;
};

type Portal = {
  brand: string;
  bio?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  primary_color?: string;
  allow_booking?: boolean;
  commercial: {
    customer_commission_pct: number;
    supplier_commission_pct: number;
    note: string;
  };
  customer: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    delivery_default?: string | null;
  };
  kyc: {
    met: ReqChip[];
    available: ReqChip[];
    common: ReqChip[];
  };
  categories: Array<{
    id: string;
    name: string;
    short: string;
    item_count: number;
  }>;
  catalogue: CatalogueItem[];
  my_bookings: MyBooking[];
  stats: {
    catalogue: number;
    my_hires: number;
    open: number;
    needs_docs: number;
    kyc_met: number;
  };
  announcements?: Array<{
    id: string;
    title: string;
    body: string;
    pinned?: boolean;
    cta_label?: string | null;
    cta_href?: string | null;
  }>;
};

type Quote = {
  item_title: string;
  rate_zar: number;
  rate_unit: string;
  units: number;
  qty: number;
  duration_label?: string;
  start_date?: string | null;
  end_date?: string | null;
  fees: {
    rentalZar: number;
    depositZar: number;
    customerCommissionZar: number;
    customerPaysZar: number;
    customerCommissionPct: number;
  };
  pending: ReqChip[];
  ready: boolean;
};

export default function HireCustomerPortalPage() {
  const { token } = useParams() as { token: string };
  const searchParams = useSearchParams();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<
    'browse' | 'hires' | 'calendar' | 'requirements' | 'account'
  >('browse');
  const [extendEnd, setExtendEnd] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<CatalogueItem | null>(null);
  const [bookForm, setBookForm] = useState({
    start_date: '',
    end_date: '',
    units: '1',
    qty: '1',
    delivery_address: '',
    notes: '',
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [kycKeys, setKycKeys] = useState<string[]>([]);
  const [profile, setProfile] = useState({
    email: '',
    phone: '',
    delivery_default: '',
  });
  const [detailBooking, setDetailBooking] = useState<MyBooking | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/hiregraph/customer?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal not found');
      setPortal(data.portal);
      const kyc = (data.portal?.kyc?.met || []).map(
        (r: ReqChip) => r.key
      ) as string[];
      setKycKeys(kyc);
      const c = data.portal?.customer;
      if (c) {
        setProfile({
          email: c.email || '',
          phone: c.phone || '',
          delivery_default: c.delivery_default || '',
        });
        setBookForm((f) => ({
          ...f,
          delivery_address: f.delivery_address || c.delivery_default || '',
        }));
      }
      try {
        localStorage.setItem(PORTAL_TOKEN_KEY, token);
      } catch {
        /* ignore */
      }
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
    const t = searchParams.get('tab');
    if (
      t === 'browse' ||
      t === 'hires' ||
      t === 'calendar' ||
      t === 'requirements' ||
      t === 'account'
    ) {
      setTab(t);
    }
  }, [searchParams]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/hiregraph/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.portal) {
      setPortal(data.portal);
      const kyc = (data.portal?.kyc?.met || []).map(
        (r: ReqChip) => r.key
      ) as string[];
      setKycKeys(kyc);
    }
    return data;
  };

  const refreshQuote = useCallback(
    async (
      itemId: string,
      units: string,
      qty: string,
      start?: string,
      end?: string
    ) => {
      try {
        const res = await fetch('/api/public/hiregraph/customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            action: 'quote',
            item_id: itemId,
            units: Number(units) || 1,
            qty: Number(qty) || 1,
            start_date: start || null,
            end_date: end || null,
          }),
        });
        const data = await res.json();
        if (res.ok && data.quote) setQuote(data.quote);
      } catch {
        /* soft */
      }
    },
    [token]
  );

  useEffect(() => {
    if (!selectedItem) {
      setQuote(null);
      return;
    }
    void refreshQuote(
      selectedItem.id,
      bookForm.units,
      bookForm.qty,
      bookForm.start_date,
      bookForm.end_date
    );
  }, [
    selectedItem,
    bookForm.units,
    bookForm.qty,
    bookForm.start_date,
    bookForm.end_date,
    refreshQuote,
  ]);

  const filteredCatalogue = useMemo(() => {
    if (!portal) return [];
    const q = search.trim().toLowerCase();
    return portal.catalogue.filter((i) => {
      if (categoryFilter && i.category_id !== categoryFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.category_name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    });
  }, [portal, categoryFilter, search]);

  const requestHire = async () => {
    if (!selectedItem) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'book',
        item_id: selectedItem.id,
        start_date: bookForm.start_date || null,
        end_date: bookForm.end_date || null,
        units: Number(bookForm.units) || 1,
        qty: Number(bookForm.qty) || 1,
        delivery_address: bookForm.delivery_address,
        notes: bookForm.notes,
      });
      setMsg(data.message || 'Hire requested');
      setSelectedItem(null);
      setTab('hires');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const cancelHire = async (id: string) => {
    if (!confirm('Cancel this hire request?')) return;
    setBusy(true);
    setError(null);
    try {
      const data = await post({ action: 'cancel', booking_id: id });
      setMsg(data.message || 'Cancelled');
      setDetailBooking(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const saveKyc = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await post({
        action: 'set_kyc',
        requirements_met: kycKeys,
      });
      setMsg(data.message || 'Requirements saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await post({
        action: 'update_profile',
        email: profile.email,
        phone: profile.phone,
        delivery_default: profile.delivery_default,
      });
      setMsg(data.message || 'Saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleKyc = (key: string) => {
    setKycKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const color = portal?.primary_color || '#0891b2';
  const zar = (n: number | null | undefined) =>
    n != null && Number.isFinite(Number(n))
      ? `R${Number(n).toLocaleString('en-ZA')}`
      : '—';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <p className="font-black text-slate-900">Portal unavailable</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!portal) return null;

  return (
    <MemberAdvisorShell
      color={color}
      appHref={`/me?link=${encodeURIComponent(token)}`}
      fromClass="from-cyan-50"
      tab={tab}
      onTab={(id) => {
        setTab(id as typeof tab);
        setError(null);
        setMsg(null);
      }}
      tabs={[
        { id: 'browse', label: 'Browse' },
        {
          id: 'hires',
          label: 'My hires',
          badge: portal.stats.open || undefined,
        },
        { id: 'calendar', label: 'Calendar' },
        {
          id: 'requirements',
          label: 'Docs',
          badge: portal.stats.needs_docs || undefined,
        },
        { id: 'account', label: 'Account' },
      ]}
      header={
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            HireAdvisor® · customer portal
          </p>
          <h1 className="mt-1 text-xl font-black md:text-3xl">{portal.brand}</h1>
          {portal.bio ? (
            <p className="mt-1 max-w-2xl text-sm text-white/90 md:line-clamp-3 line-clamp-2">
              {portal.bio}
            </p>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">{portal.customer.name}</p>
              <p className="text-xs text-white/85">
                {[portal.customer.city, portal.customer.phone]
                  .filter(Boolean)
                  .join(' · ') || 'Your hire account'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-white/20 px-2.5 py-1">
              {portal.stats.catalogue} items
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1">
              {portal.stats.open} open hires
            </span>
            {portal.stats.needs_docs > 0 ? (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-amber-950">
                {portal.stats.needs_docs} need docs
              </span>
            ) : null}
            {Number(portal.commercial.customer_commission_pct) > 0 ? (
              <span className="rounded-full bg-white/20 px-2.5 py-1">
                {portal.commercial.customer_commission_pct}% platform fee
              </span>
            ) : (
              <span className="rounded-full bg-emerald-400/90 px-2.5 py-1 text-emerald-950">
                Free to use
              </span>
            )}
          </div>
        </div>
      }
    >
        <PopiaConsentNotice brand={portal.brand} />
        <B2cAutoLinkBanner token={token} tone="cyan" />
        <AdvisorAnnouncementFeed items={portal.announcements} />

        {(msg || error) && (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              error
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {error || msg}
          </div>
        )}

        {/* ── Browse ───────────────────────────────────────────── */}
        {tab === 'browse' && (
          <div className="space-y-3">
            <B2cHireHowItWorks compact />
            <div className="rounded-2xl border border-cyan-100 bg-white p-3">
              <p className="flex items-start gap-2 text-[11px] text-slate-600">
                <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" />
                {portal.commercial.note}
              </p>
            </div>

            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              placeholder="Search gear…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {portal.categories.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('')}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    !categoryFilter
                      ? 'bg-cyan-700 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  All
                </button>
                {portal.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCategoryFilter((prev) =>
                        prev === c.id ? '' : c.id
                      )
                    }
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                      categoryFilter === c.id
                        ? 'bg-cyan-700 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {c.short} ({c.item_count})
                  </button>
                ))}
              </div>
            ) : null}

            {filteredCatalogue.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No hire items listed yet. Check back soon.
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {filteredCatalogue.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem(item);
                        setMsg(null);
                        setError(null);
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-cyan-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">
                            {item.category_short || item.category_name}
                            {item.high_value ? ' · high value' : ''}
                          </p>
                          <p className="font-black text-slate-900">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.code}
                            {item.location ? ` · ${item.location}` : ''}
                            {item.supplier_name
                              ? ` · ${item.supplier_name}`
                              : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-black text-cyan-800">
                            {zar(item.rate_zar)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            / {item.rate_unit}
                          </p>
                        </div>
                      </div>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                          {item.description}
                        </p>
                      ) : null}
                      {item.includes ? (
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                          Includes {item.includes}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {item.requirements_ready ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <Check className="h-3 w-3" /> Docs ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            {item.requirements_pending.length} docs needed
                          </span>
                        )}
                        {item.fulfillment_label ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            <Truck className="h-3 w-3" /> {item.fulfillment_label}
                          </span>
                        ) : item.needs_delivery ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            <Truck className="h-3 w-3" /> Delivery
                          </span>
                        ) : null}
                        {item.deposit_zar != null ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {zar(item.deposit_zar)} deposit
                          </span>
                        ) : null}
                        <span className="ml-auto text-[10px] font-bold text-cyan-700">
                          Request <ChevronRight className="inline h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── My hires ─────────────────────────────────────────── */}
        {tab === 'hires' && (
          <div className="space-y-3">
            {portal.my_bookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-700">
                  No hires yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Browse the catalogue and request gear for your dates.
                </p>
                <button
                  type="button"
                  onClick={() => setTab('browse')}
                  className="mt-4 rounded-full bg-cyan-700 px-4 py-2 text-xs font-bold text-white"
                >
                  Browse gear
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {portal.my_bookings.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() =>
                        setDetailBooking(
                          detailBooking?.id === b.id ? null : b
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            {b.code} · {b.status_label}
                          </p>
                          <p className="font-black text-slate-900">
                            {b.item_title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {b.duration_label ||
                              [b.start_date, b.end_date]
                                .filter(Boolean)
                                .join(' → ') ||
                              'Dates TBC'}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-cyan-800">
                          {zar(b.customer_pays_zar)}
                        </p>
                      </div>
                      {/* mini timeline */}
                      <div className="mt-3 flex gap-0.5">
                        {b.timeline
                          .filter((s) => s.id !== 'cancelled' && s.id !== 'disputed')
                          .map((s) => (
                            <div
                              key={s.id}
                              title={s.label}
                              className={`h-1.5 flex-1 rounded-full ${
                                s.done
                                  ? 'bg-cyan-600'
                                  : s.current
                                    ? 'bg-cyan-400'
                                    : 'bg-slate-200'
                              }`}
                            />
                          ))}
                      </div>
                    </button>

                    {detailBooking?.id === b.id ? (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                        <div className="grid grid-cols-2 gap-1 text-slate-700">
                          <span>Rental</span>
                          <span className="text-right font-bold">
                            {zar(b.rental_zar)}
                          </span>
                          {Number(portal.commercial.customer_commission_pct) >
                            0 || Number(b.customer_commission_zar) > 0 ? (
                            <>
                              <span>
                                Platform fee (
                                {portal.commercial.customer_commission_pct}%)
                              </span>
                              <span className="text-right font-bold">
                                {zar(b.customer_commission_zar)}
                              </span>
                            </>
                          ) : null}
                          <span>Deposit (refundable)</span>
                          <span className="text-right font-bold">
                            {zar(b.deposit_zar)}
                          </span>
                          <span className="font-black">You pay</span>
                          <span className="text-right font-black text-cyan-800">
                            {zar(b.customer_pays_zar)}
                          </span>
                        </div>
                        {b.can_extend ? (
                          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-2">
                            <p className="font-black text-cyan-950">
                              Extend if the item is free
                            </p>
                            <div className="mt-2 flex gap-2">
                              <input
                                type="date"
                                className="flex-1 rounded-lg border px-2 py-1"
                                min={b.end_date || b.start_date || undefined}
                                value={extendEnd}
                                onChange={(e) => setExtendEnd(e.target.value)}
                              />
                              <button
                                type="button"
                                disabled={busy || !extendEnd}
                                className="rounded-lg bg-cyan-700 px-2 py-1 font-black text-white disabled:opacity-50"
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const data = await post({
                                      action: 'extend',
                                      booking_id: b.id,
                                      end_date: extendEnd,
                                    });
                                    setMsg(data.message || 'Extended');
                                    setExtendEnd('');
                                  } catch (e) {
                                    setError(
                                      e instanceof Error
                                        ? e.message
                                        : 'Could not extend'
                                    );
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                Extend
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {b.delivery_address ? (
                          <p className="flex items-start gap-1 text-slate-600">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                            {b.delivery_address}
                          </p>
                        ) : null}
                        {b.requirements_pending.length > 0 ? (
                          <div className="rounded-xl bg-amber-50 px-2.5 py-2 text-amber-950">
                            <p className="font-bold">Still needed:</p>
                            <p>
                              {b.requirements_pending
                                .map((r) => r.label)
                                .join(', ')}
                            </p>
                            <button
                              type="button"
                              onClick={() => setTab('requirements')}
                              className="mt-1 font-bold text-amber-900 underline"
                            >
                              Update documents
                            </button>
                          </div>
                        ) : null}
                        {b.handovers.length > 0 ? (
                          <div>
                            <p className="font-bold text-slate-800">
                              Handovers
                            </p>
                            <ul className="mt-1 space-y-1">
                              {b.handovers.map((h) => (
                                <li
                                  key={h.id}
                                  className="rounded-lg bg-slate-50 px-2 py-1.5"
                                >
                                  <span className="font-bold uppercase">
                                    {h.type}
                                  </span>
                                  {h.at
                                    ? ` · ${new Date(h.at).toLocaleString()}`
                                    : ''}
                                  {h.condition_notes
                                    ? ` — ${h.condition_notes}`
                                    : ''}
                                  {h.damage_zar
                                    ? ` · damage ${zar(h.damage_zar)}`
                                    : ''}
                                  {h.deposit_released
                                    ? ' · deposit released'
                                    : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {b.start_date ? (
                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href={googleCalendarUrl({
                                id: `hire-${b.id}`,
                                title: `${b.item_title} hire`,
                                date: String(b.start_date).slice(0, 10),
                                end_date: String(
                                  b.end_date || b.start_date
                                ).slice(0, 10),
                                all_day: true,
                                location: b.delivery_address || portal.brand,
                                description: `${portal.brand} · ${b.status_label}`,
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                            >
                              Google
                            </a>
                            <a
                              href={outlookCalendarUrl({
                                id: `hire-${b.id}`,
                                title: `${b.item_title} hire`,
                                date: String(b.start_date).slice(0, 10),
                                end_date: String(
                                  b.end_date || b.start_date
                                ).slice(0, 10),
                                all_day: true,
                                location: b.delivery_address || portal.brand,
                                description: `${portal.brand} · ${b.status_label}`,
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                            >
                              Outlook
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                downloadMemberEventIcs({
                                  id: `hire-${b.id}`,
                                  title: `${b.item_title} hire`,
                                  date: String(b.start_date).slice(0, 10),
                                  end_date: String(
                                    b.end_date || b.start_date
                                  ).slice(0, 10),
                                  all_day: true,
                                  location: b.delivery_address || portal.brand,
                                  description: `${portal.brand} · ${b.status_label}`,
                                })
                              }
                              className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                            >
                              Apple / .ics
                            </button>
                          </div>
                        ) : null}
                        {b.can_cancel ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void cancelHire(b.id)}
                            className="w-full rounded-xl border border-rose-200 py-2 font-bold text-rose-700"
                          >
                            Cancel request
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'calendar' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Your hire dates. Add them to Google, Outlook or Apple Calendar.
              Filter by category, then open My hires to extend if the extra days
              are free.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('')}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                  !categoryFilter
                    ? 'bg-cyan-700 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                All
              </button>
              {portal.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                    categoryFilter === c.id
                      ? 'bg-cyan-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {c.short || c.name}
                </button>
              ))}
            </div>
            <B2cDiaryView
              events={portal.my_bookings
                .filter(
                  (b) =>
                    Boolean(b.start_date) &&
                    b.status !== 'cancelled' &&
                    (!categoryFilter || b.category_id === categoryFilter)
                )
                .map((b) => {
                  const ev = {
                    id: `hire-${b.id}`,
                    source: 'hire' as const,
                    brand: portal.brand,
                    title: b.item_title,
                    date: String(b.start_date).slice(0, 10),
                    end_date: String(b.end_date || b.start_date).slice(0, 10),
                    all_day: true,
                    location: b.delivery_address || portal.city || portal.brand,
                    href: `?tab=hires`,
                    status: b.status_label,
                    description: `${portal.brand} · ${b.status_label}`,
                  };
                  return {
                    ...ev,
                    google_url: googleCalendarUrl(ev),
                    outlook_url: outlookCalendarUrl(ev),
                  } satisfies MemberCalEvent;
                })}
            />
          </div>
        )}

        {/* ── Requirements ─────────────────────────────────────── */}
        {tab === 'requirements' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-cyan-900">
                <Shield className="h-4 w-4" />
                <h2 className="text-sm font-black">Hire requirements</h2>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Tick what you already have. Different gear needs different
                checks (e.g. jumping castles need power, flat ground, adult
                supervision).
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(portal.kyc.common.length
                  ? portal.kyc.common
                  : portal.kyc.available
                ).map((r) => {
                  const on = kycKeys.includes(r.key);
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => toggleKyc(r.key)}
                      className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${
                        on
                          ? 'border-cyan-600 bg-cyan-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {on ? '✓ ' : ''}
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveKyc()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save requirements
              </button>
            </div>
          </div>
        )}

        {/* ── Account ──────────────────────────────────────────── */}
        {tab === 'account' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-black text-slate-900">
                Contact preferences
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Used for hire confirmations. Your main account still lives with
                the hire company&apos;s customer book.
              </p>
              <label className="mt-3 block text-xs font-bold">
                Email
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                />
              </label>
              <label className="mt-2 block text-xs font-bold">
                Phone
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                  inputMode="tel"
                />
              </label>
              <label className="mt-2 block text-xs font-bold">
                Default delivery / site address
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={profile.delivery_default}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      delivery_default: e.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveProfile()}
                className="mt-4 w-full rounded-xl bg-cyan-700 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                Save preferences
              </button>
            </div>
            {(portal.contact_phone || portal.contact_email) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                <p className="font-bold text-slate-900">Contact the hire desk</p>
                {portal.contact_phone ? (
                  <p className="mt-1">
                    <a
                      href={`tel:${portal.contact_phone}`}
                      className="font-bold text-cyan-800"
                    >
                      {portal.contact_phone}
                    </a>
                  </p>
                ) : null}
                {portal.contact_email ? (
                  <p className="mt-1">
                    <a
                      href={`mailto:${portal.contact_email}`}
                      className="font-bold text-cyan-800"
                    >
                      {portal.contact_email}
                    </a>
                  </p>
                ) : null}
              </div>
            )}
            <p className="text-center text-[10px] text-slate-400">
              Tip: add this page to your home screen for quick re-booking.
              Powered by HireAdvisor® · SupplierAdvisor
            </p>
          </div>
        )}

      {/* ── Request hire sheet ─────────────────────────────────── */}
      {selectedItem ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">
                  {selectedItem.category_name}
                </p>
                <h2 className="text-lg font-black text-slate-900">
                  {selectedItem.title}
                </h2>
                <p className="text-sm font-bold text-cyan-800">
                  {zar(selectedItem.rate_zar)} / {selectedItem.rate_unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedItem.description ? (
              <p className="mb-3 text-sm text-slate-600">
                {selectedItem.description}
              </p>
            ) : null}

            <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
              {selectedItem.location ? (
                <>
                  <dt className="text-slate-500">Where</dt>
                  <dd className="text-right font-bold">
                    {selectedItem.location}
                  </dd>
                </>
              ) : null}
              {selectedItem.fulfillment_label ? (
                <>
                  <dt className="text-slate-500">How you get it</dt>
                  <dd className="text-right font-bold">
                    {selectedItem.fulfillment_label}
                  </dd>
                </>
              ) : null}
              {selectedItem.collect_hours ? (
                <>
                  <dt className="text-slate-500">Collect hours</dt>
                  <dd className="text-right font-bold">
                    {selectedItem.collect_hours}
                  </dd>
                </>
              ) : null}
              {selectedItem.delivery_fee_zar != null ? (
                <>
                  <dt className="text-slate-500">Delivery</dt>
                  <dd className="text-right font-bold">
                    {zar(selectedItem.delivery_fee_zar)}
                    {selectedItem.delivery_radius_km
                      ? ` · ${selectedItem.delivery_radius_km} km`
                      : ''}
                  </dd>
                </>
              ) : null}
              {selectedItem.min_units && selectedItem.min_units > 1 ? (
                <>
                  <dt className="text-slate-500">Minimum</dt>
                  <dd className="text-right font-bold">
                    {selectedItem.min_units} {selectedItem.rate_unit}s
                  </dd>
                </>
              ) : null}
              {selectedItem.deposit_zar != null ? (
                <>
                  <dt className="text-slate-500">Deposit</dt>
                  <dd className="text-right font-bold">
                    {zar(selectedItem.deposit_zar)} refundable
                  </dd>
                </>
              ) : null}
              {selectedItem.replacement_value_zar != null ? (
                <>
                  <dt className="text-slate-500">If lost / written off</dt>
                  <dd className="text-right font-bold">
                    {zar(selectedItem.replacement_value_zar)}
                  </dd>
                </>
              ) : null}
              {selectedItem.operator_included ? (
                <>
                  <dt className="text-slate-500">Operator</dt>
                  <dd className="text-right font-bold">Included</dd>
                </>
              ) : null}
              {selectedItem.setup_minutes ? (
                <>
                  <dt className="text-slate-500">Setup time</dt>
                  <dd className="text-right font-bold">
                    {selectedItem.setup_minutes} min
                  </dd>
                </>
              ) : null}
              {selectedItem.fuel_or_power ? (
                <>
                  <dt className="text-slate-500">Power / fuel</dt>
                  <dd className="text-right font-bold">
                    {selectedItem.fuel_or_power}
                  </dd>
                </>
              ) : null}
              {selectedItem.age_or_weight_limit ? (
                <>
                  <dt className="text-slate-500">Age / weight</dt>
                  <dd className="text-right font-bold">
                    {selectedItem.age_or_weight_limit}
                  </dd>
                </>
              ) : null}
            </dl>
            {selectedItem.includes ? (
              <p className="mb-1 text-[12px] text-slate-600">
                <span className="font-black text-slate-800">Included: </span>
                {selectedItem.includes}
              </p>
            ) : null}
            {selectedItem.excludes ? (
              <p className="mb-1 text-[12px] text-slate-600">
                <span className="font-black text-slate-800">Bring yourself: </span>
                {selectedItem.excludes}
              </p>
            ) : null}
            {selectedItem.specs ? (
              <p className="mb-1 text-[12px] text-slate-600">
                <span className="font-black text-slate-800">Specs: </span>
                {selectedItem.specs}
              </p>
            ) : null}
            {selectedItem.condition_notes ? (
              <p className="mb-1 text-[12px] text-slate-600">
                <span className="font-black text-slate-800">Condition: </span>
                {selectedItem.condition_notes}
              </p>
            ) : null}
            {selectedItem.cancellation_note ? (
              <p className="mb-3 text-[12px] text-slate-600">
                <span className="font-black text-slate-800">Cancel: </span>
                {selectedItem.cancellation_note}
              </p>
            ) : null}

            {!portal.allow_booking ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Online requests are paused. Contact the hire desk to book.
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-bold">
                    Start
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.start_date}
                      onChange={(e) =>
                        setBookForm((f) => ({
                          ...f,
                          start_date: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs font-bold">
                    End
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.end_date}
                      onChange={(e) =>
                        setBookForm((f) => ({
                          ...f,
                          end_date: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <p className="sm:col-span-2 text-xs font-bold text-cyan-900">
                    Duration follows your dates (
                    {quote?.duration_label ||
                      `${bookForm.units || 1} ${selectedItem.rate_unit}${
                        bookForm.units === '1' ? '' : 's'
                      }`}
                    )
                  </p>
                  {(selectedItem.busy_dates || []).length > 0 ? (
                    <div className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                      <p className="font-black text-slate-800">Already hired</p>
                      <p className="mt-1">
                        {selectedItem.busy_dates!.slice(0, 12).join(', ')}
                        {selectedItem.busy_dates!.length > 12 ? '…' : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="sm:col-span-2 text-[11px] text-emerald-800">
                      No overlapping hires on the book yet.
                    </p>
                  )}
                  <label className="text-xs font-bold">
                    Qty
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.qty}
                      onChange={(e) =>
                        setBookForm((f) => ({ ...f, qty: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-xs font-bold sm:col-span-2">
                    Delivery / site address
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.delivery_address}
                      onChange={(e) =>
                        setBookForm((f) => ({
                          ...f,
                          delivery_address: e.target.value,
                        }))
                      }
                      placeholder="Where should gear go?"
                    />
                  </label>
                  <label className="text-xs font-bold sm:col-span-2">
                    Notes
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.notes}
                      onChange={(e) =>
                        setBookForm((f) => ({ ...f, notes: e.target.value }))
                      }
                    />
                  </label>
                </div>

                {quote ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs">
                    <p className="font-black text-emerald-950">Quote preview</p>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-emerald-950">
                      <span>Rental</span>
                      <span className="text-right font-bold">
                        {zar(quote.fees.rentalZar)}
                      </span>
                      {Number(quote.fees.customerCommissionPct) > 0 ||
                      Number(quote.fees.customerCommissionZar) > 0 ? (
                        <>
                          <span>
                            Your fee ({quote.fees.customerCommissionPct}%)
                          </span>
                          <span className="text-right font-bold">
                            {zar(quote.fees.customerCommissionZar)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>Platform fee</span>
                          <span className="text-right font-bold text-emerald-800">
                            Free
                          </span>
                        </>
                      )}
                      <span>Deposit (refundable)</span>
                      <span className="text-right font-bold">
                        {zar(quote.fees.depositZar)}
                      </span>
                      <span className="font-black">You pay</span>
                      <span className="text-right font-black">
                        {zar(quote.fees.customerPaysZar)}
                      </span>
                    </div>
                    {quote.pending.length ? (
                      <p className="mt-2 text-amber-900">
                        After request you&apos;ll need:{' '}
                        {quote.pending.map((p) => p.label).join(', ')}
                      </p>
                    ) : (
                      <p className="mt-2 text-emerald-800">
                        Requirements look complete for this item.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1">
                  {selectedItem.requirements.map((r) => (
                    <span
                      key={r.key}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.met
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.met ? '✓ ' : ''}
                      {r.label}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void requestHire()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 py-3.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  Request this hire
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </MemberAdvisorShell>
  );
}
