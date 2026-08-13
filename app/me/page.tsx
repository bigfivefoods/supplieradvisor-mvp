'use client';

/**
 * SA Member App — B2C personal app (PWA).
 * Bottom tabs: Home · Shop · Brands · Check-in · Account
 * PWA — hire / sale marketplace, gym book/check-in, reviews.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  Dumbbell,
  ExternalLink,
  HeartPulse,
  Link2,
  Loader2,
  LogOut,
  Package,
  QrCode,
  Sparkles,
  Stethoscope,
  Star,
  Store,
  User,
  WalletCards,
  Building2,
} from 'lucide-react';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import {
  B2cAppShell,
  B2cInstallChip,
  type B2cTab,
} from '@/components/b2c/B2cAppChrome';
import { B2cShopPeek, B2cShopTab } from '@/components/b2c/B2cShopTab';
import { B2cHireJourneyList } from '@/components/b2c/B2cHireJourney';
import { B2cIdentityCard } from '@/components/b2c/B2cIdentityCard';
import type { B2cHireJourney } from '@/lib/b2c/hire-journeys';
import { toast } from 'sonner';
import EnablePushButton from '@/components/pwa/EnablePushButton';

type Membership = {
  id: string;
  kind: string;
  kind_label?: string;
  company_id: number;
  company_name: string;
  brand?: string | null;
  portal_path: string;
  portal_token?: string | null;
  checkin_path?: string | null;
  ref_label?: string | null;
  capabilities: string[];
};

type Profile = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  id_number?: string | null;
  memberships: Membership[];
};

type ActivityItem = {
  id: string;
  kind: string;
  tone: string;
  title: string;
  subtitle: string;
  href: string;
  when?: string | null;
  badge?: string | null;
};

function kindIcon(kind: string) {
  if (kind === 'hire') return Package;
  if (kind === 'gym') return Dumbbell;
  if (kind === 'physio') return HeartPulse;
  if (kind === 'dental') return Sparkles;
  if (kind === 'medical') return Stethoscope;
  if (kind === 'psychiatry') return Brain;
  return WalletCards;
}

function kindTone(kind: string) {
  if (kind === 'hire') return 'from-cyan-500 to-sky-700 border-cyan-200';
  if (kind === 'gym') return 'from-violet-500 to-purple-800 border-violet-200';
  if (kind === 'physio') return 'from-teal-500 to-emerald-800 border-teal-200';
  if (kind === 'dental') return 'from-sky-400 to-blue-800 border-sky-200';
  if (kind === 'medical') return 'from-indigo-500 to-slate-800 border-indigo-200';
  if (kind === 'psychiatry') return 'from-rose-500 to-fuchsia-900 border-rose-200';
  return 'from-slate-500 to-slate-700 border-slate-200';
}

function kindActionLabel(kind: string) {
  if (kind === 'hire') return 'Order';
  if (kind === 'gym') return 'Book class';
  return 'Book';
}

function MeAppInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [tab, setTab] = useState<B2cTab>('home');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [installHint, setInstallHint] = useState(false);
  const [hasBusiness, setHasBusiness] = useState(false);
  const [businessCount, setBusinessCount] = useState(0);
  const [city, setCity] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [journeys, setJourneys] = useState<B2cHireJourney[]>([]);
  const [verification, setVerification] = useState<{
    status?: string;
    is_verified?: boolean;
    verified_name?: string | null;
    completeness?: { score: number; max: number; missing: string[] };
  } | null>(null);
  const joinBrand = search?.get('brand') || '';
  const joinKind = search?.get('kind') || '';
  const isJoin = search?.get('join') === '1' || Boolean(joinBrand);

  // Deep links: ?tab=shop|checkin|memberships|account  ?link=
  useEffect(() => {
    const t = search?.get('tab');
    if (
      t === 'home' ||
      t === 'shop' ||
      t === 'memberships' ||
      t === 'checkin' ||
      t === 'account'
    ) {
      setTab(t);
    }
    const link = search?.get('link') || search?.get('token') || '';
    if (link) {
      setLinkToken(link);
      setTab('checkin');
    }
  }, [search]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone
      );
    setInstallHint(!standalone);
  }, []);

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams();
      const em = extractEmailFromPrivyUser(user);
      if (em) q.set('email', em);
      const res = await fetch(
        `/api/b2c/me${q.toString() ? `?${q}` : ''}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setProfile(data.profile);
      setActivity(Array.isArray(data.activity) ? data.activity : []);
      setName(data.profile?.full_name || '');
      setPhone(data.profile?.phone || '');
      setEmail(
        data.profile?.email || extractEmailFromPrivyUser(user) || ''
      );
      setHasBusiness(Boolean(data.has_business || data.workspace?.has_business));
      setBusinessCount(
        Number(data.business_count || data.workspace?.business_count || 0)
      );
      setCity(data.profile?.city || '');
      setIdNumber(data.profile?.id_number || '');
      setJourneys(Array.isArray(data.journeys) ? data.journeys : []);
      setVerification(data.verification || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load account');
    } finally {
      setLoading(false);
    }
  }, [authenticated, user]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setLoading(false);
      return;
    }
    void load();
  }, [ready, authenticated, load]);

  const memberships = useMemo(
    () => (profile?.memberships || []).filter((m) => m),
    [profile]
  );
  const hireCount = memberships.filter((m) => m.kind === 'hire').length;
  const gymCount = memberships.filter((m) => m.kind === 'gym').length;
  const clinicCount = memberships.filter((m) =>
    ['physio', 'dental', 'medical', 'psychiatry'].includes(m.kind)
  ).length;
  const checkinReady = memberships.filter((m) => m.checkin_path).length;

  const goTab = (t: B2cTab) => {
    setTab(t);
    const params = new URLSearchParams(search?.toString() || '');
    if (t === 'home') params.delete('tab');
    else params.set('tab', t);
    const qs = params.toString();
    router.replace(qs ? `/me?${qs}` : '/me', { scroll: false });
  };

  const doLink = async (tokenOverride?: string) => {
    const token = (tokenOverride || linkToken).trim();
    if (!token) {
      toast.error('Paste a portal link first');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/b2c/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: email || extractEmailFromPrivyUser(user),
          full_name: name || undefined,
          phone: phone || undefined,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Link failed');
      toast.success(data.message || 'Linked');
      setLinkToken('');
      setProfile(data.profile);
      setTab('memberships');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/b2c/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          full_name: name,
          phone,
          email,
          city,
          id_number: idNumber,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setProfile(data.profile);
      toast.success('Saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (id: string) => {
    if (!confirm('Remove this brand from your app?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/b2c/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlink',
          membership_id: id,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unlink failed');
      setProfile(data.profile);
      toast.success('Removed');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Unlink failed');
    } finally {
      setBusy(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────
  if (!ready || (authenticated && loading)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0c4a6e] text-white">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 shadow-lg">
          <Sparkles className="h-8 w-8" />
        </div>
        <p className="text-sm font-black tracking-wide">SA Member</p>
        <Loader2 className="mt-4 h-6 w-6 animate-spin text-sky-200" />
      </div>
    );
  }

  // ── Login wall (app store style) ─────────────────────────────────
  if (!authenticated) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#0c4a6e] via-[#0077b6] to-[#38bdf8]">
        <div
          className="flex flex-1 flex-col justify-end px-5 pb-8 pt-16 text-white"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white shadow-2xl shadow-sky-900/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sa-icon-192.png"
                alt=""
                className="h-14 w-14 rounded-2xl"
              />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-100">
              Personal app · always free
            </p>
            <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight">
              SA Member
            </h1>
            <p className="mt-3 text-base text-sky-50/95">
              {isJoin && joinBrand
                ? `${joinBrand} invited you to create a free SA Member profile on your phone.`
                : 'One personal app: shop what is for sale or hire, book gym and clinic brands, check in, and keep every membership on this wallet. If you also run a company, that workspace stays separate.'}
            </p>

            <div className="mt-8 space-y-2">
              {[
                {
                  icon: Package,
                  t: 'Hire & track',
                  d: 'Request gear, complete docs, follow status',
                },
                {
                  icon: Dumbbell,
                  t: 'Gym & check-in',
                  d: 'Book classes and scan the gym QR',
                },
                {
                  icon: Stethoscope,
                  t: 'Clinic Advisors',
                  d: 'Physio, dental, medical, psychiatry bookings',
                },
                {
                  icon: Store,
                  t: 'Shop sale & hire',
                  d: 'See what brands are selling or hiring out',
                },
                {
                  icon: User,
                  t: 'Your profile',
                  d: 'Create it yourself and verify your ID',
                },
              ].map(({ icon: Icon, t, d }) => (
                <div
                  key={t}
                  className="flex items-center gap-3 rounded-2xl bg-white/12 px-3 py-3 backdrop-blur"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black">{t}</p>
                    <p className="text-[11px] text-sky-100/90">{d}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                void login({ loginMethods: ['email', 'google', 'apple'] })
              }
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-base font-black text-[#0077b6] shadow-xl"
            >
              Create free account
              <ArrowRight className="h-5 w-5" />
            </button>
            <p className="mt-3 text-center text-[11px] text-sky-100/80">
              Free · email or Google · first time creates your wallet · already
              have an account? Same button signs you in
            </p>
            <p className="mt-4 text-center text-[11px] text-sky-100/70">
              Also run a company?{' '}
              <Link href="/join" className="font-bold underline">
                Register a business
              </Link>
              {' · '}
              <Link href="/login" className="font-bold underline">
                Company login
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    profile?.full_name || name || user?.email?.address?.split('@')[0] || 'You';

  const headerForTab: Record<B2cTab, { title: string; sub?: string }> = {
    home: {
      title: `Hi, ${displayName.split(' ')[0]}`,
      sub: 'Your member app',
    },
    shop: {
      title: 'Shop',
      sub: 'For sale · hire · book',
    },
    memberships: {
      title: 'Your brands',
      sub: `${memberships.length} linked`,
    },
    checkin: {
      title: 'Check-in & link',
      sub: 'Door QR · portal links',
    },
    account: {
      title: 'Your profile',
      sub: verification?.is_verified
        ? 'Verified member'
        : profile?.email || email || undefined,
    },
  };

  return (
    <B2cAppShell
      tab={tab}
      onTab={goTab}
      headerTitle={headerForTab[tab].title}
      headerSubtitle={headerForTab[tab].sub}
      headerRight={
        <div className="flex items-center gap-2">
          {installHint ? <B2cInstallChip /> : null}
          <button
            type="button"
            onClick={() => void logout().then(() => router.refresh())}
            className="rounded-full bg-white/15 p-2"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      }
      badge={{
        memberships: memberships.length || undefined,
        checkin: checkinReady || undefined,
      }}
    >
      {/* ── HOME ─────────────────────────────────────────────── */}
      {tab === 'home' && (
        <div className="space-y-4">
          {isJoin && joinBrand ? (
            <div className="rounded-2xl border border-sky-200 bg-white p-3 text-sm shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#0077b6]">
                Brand invite
              </p>
              <p className="font-black text-slate-900">{joinBrand}</p>
              <p className="text-[11px] text-slate-500">
                Create your profile and verify yourself. If this brand already
                has your email or phone, it will appear under Brands
                {joinKind ? ` (${joinKind})` : ''}.
              </p>
            </div>
          ) : null}

          {verification &&
          verification.completeness &&
          verification.completeness.score < verification.completeness.max ? (
            <button
              type="button"
              onClick={() => goTab('account')}
              className="flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-white p-3 text-left shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-[#0077b6]">
                <User className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900">
                  Finish your profile
                </p>
                <p className="text-[11px] text-slate-500">
                  {verification.completeness.score}/{verification.completeness.max}{' '}
                  complete
                  {verification.completeness.missing.length
                    ? ` · add ${verification.completeness.missing.join(', ')}`
                    : ''}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ) : null}

          {journeys.length > 0 ? (
            <B2cHireJourneyList journeys={journeys} />
          ) : null}

          {hasBusiness ? (
            <Link
              href="/dashboard/select-company"
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900">
                  You also run a business
                </p>
                <p className="text-[11px] text-slate-500">
                  {businessCount === 1
                    ? 'Open your company workspace'
                    : `Open one of ${businessCount} companies`}{' '}
                  — it will not mix into this personal wallet
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          ) : null}

          {installHint ? (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event('sa-open-install'))
              }
              className="flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-white p-3 text-left shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-[#0077b6]">
                <Download className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900">
                  Install SA Member
                </p>
                <p className="text-[11px] text-slate-500">
                  Add to home screen for a full-screen app experience
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ) : null}

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setTab('memberships')}
              className="rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-700 p-2.5 text-left text-white shadow-md"
            >
              <Package className="h-4 w-4 opacity-90" />
              <p className="mt-1.5 text-xl font-black">{hireCount}</p>
              <p className="text-[9px] font-bold opacity-90">Hire</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('memberships')}
              className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-800 p-2.5 text-left text-white shadow-md"
            >
              <Dumbbell className="h-4 w-4 opacity-90" />
              <p className="mt-1.5 text-xl font-black">{gymCount}</p>
              <p className="text-[9px] font-bold opacity-90">Gym</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('memberships')}
              className="rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-800 p-2.5 text-left text-white shadow-md"
            >
              <Stethoscope className="h-4 w-4 opacity-90" />
              <p className="mt-1.5 text-xl font-black">{clinicCount}</p>
              <p className="text-[9px] font-bold opacity-90">Clinic</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('checkin')}
              className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-800 p-2.5 text-left text-white shadow-md"
            >
              <QrCode className="h-4 w-4 opacity-90" />
              <p className="mt-1.5 text-xl font-black">{checkinReady}</p>
              <p className="text-[9px] font-bold opacity-90">Check-in</p>
            </button>
          </div>

          {activity.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-black text-slate-900">
                Up next
              </h2>
              <ul className="space-y-2">
                {activity.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm active:scale-[0.99] ${
                        a.tone === 'alert' || a.tone === 'docs'
                          ? 'border-amber-300'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-900">
                          {a.title}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {a.subtitle}
                          {a.when
                            ? ` · ${String(a.when).slice(0, 10)}`
                            : ''}
                        </p>
                      </div>
                      {a.badge ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {a.badge}
                        </span>
                      ) : null}
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <B2cShopPeek onOpen={() => goTab('shop')} />

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Quick actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goTab('shop')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Store className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Shop
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Sale · hire · book
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => goTab('checkin')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <QrCode className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Check in
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    At the gym door
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('checkin')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Link2 className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Link brand
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Paste portal link
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('memberships')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Order / book
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Open a brand portal
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('account')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <User className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Profile
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Name · phone · email
                  </span>
                </span>
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">
                Recent brands
              </h2>
              {memberships.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setTab('memberships')}
                  className="text-[11px] font-bold text-[#0077b6]"
                >
                  See all
                </button>
              ) : null}
            </div>
            {memberships.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-5 py-10 text-center">
                <WalletCards className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-800">
                  No brands yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Your dentist on DentalAdvisor and your gym on GymAdvisor
                  stay as separate brand cards. Get a portal link from either,
                  or sign in with the same email they have on file.
                </p>
                <button
                  type="button"
                  onClick={() => setTab('checkin')}
                  className="mt-4 rounded-full bg-[#0077b6] px-5 py-2.5 text-xs font-black text-white"
                >
                  Link a brand
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {memberships.slice(0, 4).map((m) => {
                  const Icon = kindIcon(m.kind);
                  return (
                    <li key={m.id}>
                      <Link
                        href={m.portal_path}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm active:scale-[0.99]"
                      >
                        <span
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow ${kindTone(m.kind)}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-900">
                            {m.brand || m.company_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {m.kind_label || m.kind}
                            {m.ref_label ? ` · ${m.ref_label}` : ''}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ── SHOP / MARKETPLACE ──────────────────────────────── */}
      {tab === 'shop' && (
        <B2cShopTab
          memberships={memberships.map((m) => ({
            kind: m.kind,
            company_id: m.company_id,
            portal_path: m.portal_path,
          }))}
        />
      )}

      {/* ── BRANDS / MEMBERSHIPS ─────────────────────────────── */}
      {tab === 'memberships' && (
        <div className="space-y-3">
          <p className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Each brand is its own card. Your dentist and your gym do not share
            bookings, payments or medical notes — they only share this login.
          </p>
          {memberships.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <p className="text-sm font-black text-slate-800">
                Link your first brand
              </p>
              <button
                type="button"
                onClick={() => setTab('checkin')}
                className="mt-4 rounded-full bg-[#0077b6] px-5 py-2.5 text-xs font-black text-white"
              >
                Add portal link
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {memberships.map((m) => {
                const Icon = kindIcon(m.kind);
                return (
                  <li
                    key={m.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div
                      className={`bg-gradient-to-r px-4 py-3 text-white ${kindTone(m.kind)}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-black">
                            {m.brand || m.company_name}
                          </p>
                          <p className="text-[11px] text-white/85">
                            {m.kind_label || m.kind}
                            {m.ref_label ? ` · ${m.ref_label}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 p-3">
                      <Link
                        href={m.portal_path}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#0077b6] px-3 py-2.5 text-xs font-black text-white min-w-[7rem]"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={m.portal_path}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-800"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />{' '}
                        {kindActionLabel(m.kind)}
                      </Link>
                      {m.checkin_path ? (
                        <Link
                          href={`${m.checkin_path}${
                            m.portal_token
                              ? `?member=${encodeURIComponent(m.portal_token)}`
                              : ''
                          }`}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-900"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Check in
                        </Link>
                      ) : null}
                      <Link
                        href={`/r/${m.company_id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-950"
                      >
                        <Star className="h-3.5 w-3.5" /> Review
                      </Link>
                      <button
                        type="button"
                        onClick={() => void unlink(m.id)}
                        className="ml-auto text-[10px] font-bold text-slate-400"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── CHECK-IN + LINK ──────────────────────────────────── */}
      {tab === 'checkin' && (
        <div className="space-y-4">
          <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-900">
              <QrCode className="h-5 w-5" />
              <h2 className="text-sm font-black">Gym door check-in</h2>
            </div>
            <p className="mt-1 text-xs text-emerald-900/80">
              At reception, open your gym below or scan the gym QR with your
              camera.
            </p>
            {memberships.filter((m) => m.checkin_path).length === 0 ? (
              <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-600">
                Link a gym membership first — check-in appears here
                automatically.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {memberships
                  .filter((m) => m.checkin_path)
                  .map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`${m.checkin_path}${
                          m.portal_token
                            ? `?member=${encodeURIComponent(m.portal_token)}`
                            : ''
                        }`}
                        className="flex items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white shadow active:scale-[0.99]"
                      >
                        <span className="truncate">
                          Check in · {m.brand || m.company_name}
                        </span>
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <Link2 className="h-5 w-5 text-[#0077b6]" />
              <h2 className="text-sm font-black">Link a portal</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Paste any Advisor portal link from your invite email / WhatsApp
              — Hire, Gym, Physio, Dental, Medical or Psychiatry.
            </p>
            <input
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-mono"
              placeholder="https://…/member/physiograph/… or /hire/…"
              value={linkToken}
              onChange={(e) => setLinkToken(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !linkToken.trim()}
              onClick={() => void doLink()}
              className="mt-2 w-full rounded-2xl bg-[#0077b6] py-3.5 text-sm font-black text-white disabled:opacity-50 active:scale-[0.99]"
            >
              {busy ? 'Linking…' : 'Add to my app'}
            </button>
          </section>
        </div>
      )}

      {/* ── ACCOUNT ──────────────────────────────────────────── */}
      {tab === 'account' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-semibold text-emerald-950">
            SA Member is free. Brands may charge their own gym, clinic or hire
            prices — SupplierAdvisor® never bills this personal wallet.
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-[#0077b6] text-xl font-black text-white">
              {(displayName[0] || 'U').toUpperCase()}
              {verification?.is_verified ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                  ✓
                </span>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate font-black text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {email || 'No email yet'}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#0077b6]">
                {verification?.is_verified
                  ? 'Identity verified'
                  : verification?.completeness
                    ? `${verification.completeness.score}/${verification.completeness.max} profile complete`
                    : 'Create your personal profile'}
              </p>
            </div>
          </div>

          <B2cIdentityCard
            initial={verification}
            idNumber={idNumber}
            onIdNumberChange={setIdNumber}
            onChange={(v) =>
              setVerification((prev) => ({ ...(prev || {}), ...v }))
            }
          />

          {hasBusiness ? (
            <Link
              href="/dashboard/select-company"
              className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900">
                  Open my business
                </p>
                <p className="text-[11px] text-slate-500">
                  {businessCount === 1
                    ? '1 company workspace'
                    : `${businessCount} company workspaces`}{' '}
                  · operator books stay off this profile
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          ) : (
            <Link
              href="/join"
              className="flex items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white p-4"
            >
              <Building2 className="h-5 w-5 text-slate-400" />
              <span>
                <span className="block text-sm font-black text-slate-900">
                  Also run a company?
                </span>
                <span className="block text-[11px] text-slate-500">
                  Register a business — this personal wallet stays yours
                </span>
              </span>
            </Link>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Notifications</h2>
            <p className="mt-1 text-xs text-slate-500">
              Get reminded about hires, classes and check-in.
            </p>
            <div className="mt-3">
              <EnablePushButton />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Profile</h2>
            <label className="mt-3 block text-[11px] font-bold text-slate-600">
              Full name
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="mt-2 block text-[11px] font-bold text-slate-600">
              Email
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </label>
            <label className="mt-2 block text-[11px] font-bold text-slate-600">
              Phone
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </label>
            <label className="mt-2 block text-[11px] font-bold text-slate-600">
              City
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveProfile()}
              className="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              Save changes
            </button>
          </section>

          {installHint ? (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event('sa-open-install'))
              }
              className="flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-left"
            >
              <Download className="h-5 w-5 text-[#0077b6]" />
              <span>
                <span className="block text-sm font-black text-slate-900">
                  Install SA Member
                </span>
                <span className="block text-[11px] text-slate-500">
                  Full-screen app on your home screen
                </span>
              </span>
            </button>
          ) : (
            <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" /> Running as installed app
            </p>
          )}

          <button
            type="button"
            onClick={() => void logout().then(() => router.refresh())}
            className="w-full rounded-2xl border border-rose-200 py-3 text-sm font-bold text-rose-700"
          >
            Log out
          </button>

          <p className="text-center text-[10px] text-slate-400">
            Same login for personal and business. Company operators pick a
            workspace at{' '}
            <Link href="/dashboard/select-company" className="font-bold underline">
              select company
            </Link>
            .
          </p>
        </div>
      )}
    </B2cAppShell>
  );
}

export default function MeMemberAppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#0c4a6e]">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      }
    >
      <MeAppInner />
    </Suspense>
  );
}
