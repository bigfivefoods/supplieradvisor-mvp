'use client';

/**
 * SA Member App — B2C personal app (PWA).
 * Bottom dock: Home · Places · You · Shop · Share
 * PWA — hire / sale marketplace, gym book/classes, reviews.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  Dumbbell,
  ExternalLink,
  Activity,
  HeartPulse,
  Link2,
  Loader2,
  LogOut,
  Package,
  Sparkles,
  Stethoscope,
  Star,
  Store,
  User,
  WalletCards,
  Banknote,
} from 'lucide-react';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import { AuthLoginActions } from '@/components/auth/AuthLoginActions';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';
import {
  B2cAppShell,
  B2cInstallChip,
  B2cYouAvatar,
  isYouTab,
  normalizeB2cTab,
  type B2cTab,
} from '@/components/b2c/B2cAppChrome';
import { B2cWalletShare } from '@/components/b2c/B2cWalletShare';
import { B2cShopTab } from '@/components/b2c/B2cShopTab';
import { B2cHireJourneyList } from '@/components/b2c/B2cHireJourney';
import { B2cMemberCalendar } from '@/components/b2c/B2cMemberCalendar';
import { B2cAdvisorBook } from '@/components/b2c/B2cAdvisorBook';
import { B2cIdentityCard } from '@/components/b2c/B2cIdentityCard';
import { B2cCarePanel } from '@/components/b2c/B2cCarePanel';
import { B2cMemberAccounts } from '@/components/b2c/B2cMemberAccounts';
import { B2cPhotoField } from '@/components/b2c/B2cPhotoField';
import { B2cThemeToggle } from '@/components/b2c/B2cThemeToggle';
import {
  B2cWorkspaceSwitch,
  type B2cBusinessCard,
} from '@/components/b2c/B2cWorkspaceSwitch';
import type { B2cHireJourney } from '@/lib/b2c/hire-journeys';
import { toast } from 'sonner';
import EnablePushButton from '@/components/pwa/EnablePushButton';
import { B2cLinkBusiness } from '@/components/b2c/B2cLinkBusiness';
import { setSelectedCompanyId } from '@/lib/containers/company';
import { defaultHomePathForRole } from '@/lib/business/permissions';
import {
  groupWalletAccounts,
  primaryPortal,
  shopHref,
} from '@/lib/b2c/wallet-accounts';
import {
  isWalletVisibleMembership,
  moduleLabels,
} from '@/lib/b2c/company-modules';
import { PortalFamilyMembers } from '@/components/identity/PortalFamilyMembers';
import { B2cPassportForm } from '@/components/b2c/B2cPassportForm';
import type { MemberPassport } from '@/lib/b2c/member-passport';

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
  photo_url?: string | null;
  city?: string | null;
  id_number?: string | null;
  passport?: MemberPassport;
  family?: Array<{
    id: string;
    name: string;
    relationship: string;
    date_of_birth?: string | null;
    id_number?: string;
    phone?: string;
    email?: string;
    notes?: string;
    is_minor?: boolean;
    active?: boolean;
    age?: number | null;
    relationship_label?: string;
  }>;
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
  if (kind === 'account') return Store;
  if (kind === 'gym') return Dumbbell;
  if (kind === 'physio') return HeartPulse;
  if (kind === 'dental') return Sparkles;
  if (kind === 'medical') return Stethoscope;
  if (kind === 'psychiatry') return Brain;
  if (kind === 'retail') return Store;
  return WalletCards;
}

function kindTone(kind: string) {
  if (kind === 'hire') return 'from-cyan-500 to-sky-700 border-cyan-200';
  if (kind === 'account') return 'from-emerald-500 to-teal-700 border-emerald-200';
  if (kind === 'gym') return 'from-[#E8E830] to-[#6B6B00] border-yellow-200';
  if (kind === 'physio') return 'from-teal-500 to-emerald-800 border-teal-200';
  if (kind === 'dental') return 'from-sky-400 to-blue-800 border-sky-200';
  if (kind === 'medical') return 'from-indigo-500 to-slate-800 border-indigo-200';
  if (kind === 'psychiatry') return 'from-rose-500 to-fuchsia-900 border-rose-200';
  if (kind === 'retail') return 'from-orange-500 to-amber-800 border-orange-200';
  return 'from-slate-500 to-slate-700 border-slate-200';
}

function kindActionLabel(kind: string) {
  if (kind === 'hire') return 'Order';
  if (kind === 'account') return 'Shop';
  if (kind === 'gym') return 'Book class';
  return 'Book';
}

function isClinicKind(kind: string) {
  return ['physio', 'dental', 'medical', 'psychiatry'].includes(kind);
}

function membershipBookHref(m: Membership) {
  if (isClinicKind(m.kind)) {
    return `/me?tab=book&company=${m.company_id}&kind=${encodeURIComponent(m.kind)}`;
  }
  if (m.kind === 'gym') {
    return `/me?tab=book&company=${m.company_id}&kind=gym`;
  }
  return m.portal_path;
}

function membershipRecordsHref(m: Membership) {
  return `${m.portal_path}${m.portal_path.includes('?') ? '&' : '?'}tab=profile`;
}

function membershipClassesHref(m: Membership) {
  return `${m.portal_path}${m.portal_path.includes('?') ? '&' : '?'}tab=mine`;
}

function membershipProgressHref(m: Membership) {
  return `${m.portal_path}${m.portal_path.includes('?') ? '&' : '?'}tab=progress`;
}

function MeAppInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { ready, authenticated, user, logout } = usePrivy();
  const [tab, setTab] = useState<B2cTab>(() => normalizeB2cTab(search?.get('tab')) || 'home');
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
  const [businesses, setBusinesses] = useState<B2cBusinessCard[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [city, setCity] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [passport, setPassport] = useState<MemberPassport>({});
  const [journeys, setJourneys] = useState<B2cHireJourney[]>([]);
  const [verification, setVerification] = useState<{
    status?: string;
    is_verified?: boolean;
    verified_name?: string | null;
    completeness?: { score: number; max: number; missing: string[] };
    passport?: MemberPassport;
  } | null>(null);
  const joinBrand = search?.get('brand') || '';
  const joinKind = search?.get('kind') || '';
  const joinCompany = Number(search?.get('company') || 0);
  const isJoin =
    search?.get('join') === '1' ||
    Boolean(joinBrand) ||
    (Number.isFinite(joinCompany) && joinCompany > 0);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinDone, setJoinDone] = useState(false);
  const [joinPreviewBrand, setJoinPreviewBrand] = useState(joinBrand);
  const [joinModules, setJoinModules] = useState<string[]>([]);
  const [joinAlready, setJoinAlready] = useState(false);
  const [joinOwned, setJoinOwned] = useState(false);
  const [accountDueByCompany, setAccountDueByCompany] = useState<
    Record<number, number>
  >({});
  const focusAccount = Number(search?.get('account') || 0) || null;

  // Deep links: ?tab=shop|places|you|share|calendar  ?link=
  useEffect(() => {
    const t = normalizeB2cTab(search?.get('tab'));
    if (t) {
      setTab(t);
    }
    const link = search?.get('link') || search?.get('token') || '';
    if (link) {
      setLinkToken(link);
      setTab('memberships');
    }
    if (search?.get('account') || search?.get('pay') === 'open') {
      setTab('memberships');
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

  useEffect(() => {
    const ref = search?.get('ref');
    const pay = search?.get('pay');
    if (!authenticated || !ref || pay == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/b2c/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            companyId: Number(search.get('companyId') || 0),
            reference: ref,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not confirm payment');
        if (!cancelled) toast.success(data.message || 'Payment recorded');
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Payment check failed');
        }
      } finally {
        if (cancelled || typeof window === 'undefined') return;
        const u = new URL(window.location.href);
        u.searchParams.delete('pay');
        u.searchParams.delete('ref');
        u.searchParams.delete('companyId');
        router.replace(`${u.pathname}${u.search}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, router, search]);

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
      setBusinesses(
        Array.isArray(data.businesses)
          ? data.businesses
          : Array.isArray(data.workspace?.businesses)
            ? data.workspace.businesses
            : []
      );
      setPhotoUrl(data.profile?.photo_url || '');
      setCity(data.profile?.city || '');
      setIdNumber(data.profile?.id_number || '');
      setPassport(
        data.profile?.passport || data.verification?.passport || {}
      );
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

  useEffect(() => {
    if (!isJoin || !joinCompany || joinCompany <= 0) return;
    let cancelled = false;
    void fetch(
      `/api/b2c/join?company=${joinCompany}&kind=${encodeURIComponent(joinKind || '')}`,
      { cache: 'no-store' }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.brand) return;
        setJoinPreviewBrand(String(data.brand));
        if (Array.isArray(data.modules)) setJoinModules(data.modules.map(String));
        setJoinAlready(Boolean(data.already));
        setJoinOwned(Boolean(data.you_operate));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isJoin, joinCompany, joinKind]);

  const ownedCompanyIds = useMemo(
    () => new Set(businesses.map((b) => b.id)),
    [businesses]
  );
  const memberships = useMemo(
    () =>
      (profile?.memberships || []).filter((m) =>
        isWalletVisibleMembership(m, ownedCompanyIds)
      ),
    [profile, ownedCompanyIds]
  );
  const accounts = useMemo(
    () => groupWalletAccounts(memberships),
    [memberships]
  );
  const hasHire = memberships.some((m) => m.kind === 'hire');
  const linkedCompanyIds = useMemo(
    () => accounts.map((a) => a.company_id),
    [accounts]
  );
  const firstGym = memberships.find((m) => m.kind === 'gym');

  const goTab = (t: B2cTab) => {
    const next = normalizeB2cTab(t) || (t === 'account' ? 'you' : t);
    setTab(next);
    const params = new URLSearchParams(search?.toString() || '');
    if (next === 'home') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `/me?${qs}` : '/me', { scroll: false });
  };

  const clearJoinParams = () => {
    const params = new URLSearchParams(search?.toString() || '');
    params.delete('join');
    params.delete('brand');
    params.delete('kind');
    params.delete('company');
    const qs = params.toString();
    router.replace(qs ? `/me?${qs}` : '/me', { scroll: false });
  };

  const acceptJoin = async () => {
    if (!joinCompany || joinCompany <= 0) {
      toast.error('This invite is missing the brand. Ask the desk to reprint the QR.');
      return;
    }
    setJoinBusy(true);
    try {
      const res = await fetch('/api/b2c/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: joinCompany,
          kind: joinKind || undefined,
          email: email || extractEmailFromPrivyUser(user),
          full_name: name || undefined,
          phone: phone || undefined,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join');
      if (data.membership && data.profile) {
        setProfile(data.profile);
      } else if (data.membership) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                memberships: [
                  data.membership,
                  ...(prev.memberships || []).filter(
                    (m) => m.id !== data.membership.id
                  ),
                ],
              }
            : prev
        );
      }
      setJoinDone(true);
      setJoinPreviewBrand(data.brand || joinBrand);
      if (Array.isArray(data.modules)) setJoinModules(data.modules.map(String));
      toast.success(data.message || `Joined ${data.brand || joinBrand}`);
      if (search?.get('book') === '1' || search?.get('tab') === 'book') {
        const params = new URLSearchParams();
        params.set('tab', 'book');
        params.set('company', String(joinCompany));
        if (joinKind) params.set('kind', joinKind);
        setTab('book');
        router.replace(`/me?${params}`, { scroll: false });
      } else {
        setTab('memberships');
        clearJoinParams();
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not join');
    } finally {
      setJoinBusy(false);
    }
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
          photo_url: photoUrl,
          passport,
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

  const openOwnedWorkspace = (companyId: number, brand: string) => {
    const role = businesses.find((b) => b.id === companyId)?.role;
    setSelectedCompanyId(companyId, { name: brand });
    try {
      localStorage.setItem('saWorkspace', 'business');
      window.dispatchEvent(new Event('sa:company-changed'));
    } catch {
      /* private mode */
    }
    router.push(
      role === 'sales_contractor' || role === 'finance'
        ? defaultHomePathForRole(role)
        : '/dashboard'
    );
  };

  const unlinkCompany = async (companyId: number, brand: string) => {
    if (!confirm(`Remove ${brand} from your wallet?`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/b2c/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlink_company',
          company_id: companyId,
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
      <div className="sa-member-lockup flex min-h-[100dvh] flex-col items-center justify-center bg-[#0c4a6e] text-white">
        <SaOfficialLogo
          title="SA Member"
          className="sa-logo-on-dark sa-logo-member-login h-16 w-auto"
        />
        <p className="mt-4 text-sm font-black tracking-wide">SA Member</p>
        <Loader2 className="mt-4 h-6 w-6 animate-spin text-sky-200" />
      </div>
    );
  }

  // ── Login wall (app store style) ─────────────────────────────────
  if (!authenticated) {
    return (
      <div className="sa-member-lockup flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#0c4a6e] via-[#0077b6] to-[#38bdf8] dark:from-black dark:via-[#082f49] dark:to-[#0c4a6e] lg:grid lg:grid-cols-2">
        <div
          className="absolute right-4 z-10 text-white"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <B2cThemeToggle compact />
        </div>
        <div className="hidden flex-col justify-center bg-gradient-to-br from-[#0c4a6e] via-[#0077b6] to-[#38bdf8] px-12 py-16 text-white dark:from-black dark:via-[#082f49] dark:to-[#0c4a6e] lg:flex">
          <SaOfficialLogo
            title="SA Member"
            className="sa-logo-on-dark sa-logo-member-login h-16 w-auto"
          />
          <p className="mt-8 text-[11px] font-black uppercase tracking-[0.2em] text-sky-100">
            Personal app · always free
          </p>
          <h1 className="mt-3 text-5xl font-black leading-[1.05] tracking-tight">
            SA Member
          </h1>
          <p className="mt-4 max-w-md text-lg text-sky-50/95">
            One wallet for gyms, clinics, hire and shops. Book, check in, pay
            and keep records — same login on your phone or this computer.
          </p>
        </div>
        <div
          className="flex flex-1 flex-col justify-end px-5 pb-8 pt-16 text-white lg:justify-center lg:px-12"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-md lg:max-w-lg">
            <div className="mb-6">
              <SaOfficialLogo
                title="SA Member"
                className="sa-logo-on-dark sa-logo-member-login h-16 w-auto"
              />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-100 lg:hidden">
              Personal app · always free
            </p>
            <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight lg:hidden">
              SA Member
            </h1>
            <p className="mt-3 text-base text-sky-50/95">
              {isJoin && (joinBrand || joinPreviewBrand)
                ? `${joinBrand || joinPreviewBrand} invited you to link your SA Member wallet. Sign in, then tap Accept.`
                : 'One personal wallet: link any business on this platform to manage that account — book, shop, subscriptions, records and hire. If you also run a company, switch to it after you sign in — same login.'}
            </p>

            <div className="mt-8 space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
              {[
                {
                  icon: Package,
                  t: 'Hire & track',
                  d: 'Request gear, follow the hire path, add dates to Google or Outlook',
                },
                {
                  icon: Dumbbell,
                  t: 'Gym & check-in',
                  d: 'Book classes, family, waitlist, .ics, scan the gym QR',
                },
                {
                  icon: Stethoscope,
                  t: 'Clinic Advisors',
                  d: 'Book, family, waitlist, records, pay & proof, share after consent',
                },
                {
                  icon: Store,
                  t: 'Shop sale & hire',
                  d: 'See what brands are selling or hiring out',
                },
                {
                  icon: WalletCards,
                  t: 'Your wallet',
                  d: 'Link any business — shop, book, check-in, pay, records, subscriptions',
                },
                {
                  icon: User,
                  t: 'Your profile',
                  d: 'Create it yourself and verify your ID',
                },
              ].map(({ icon: Icon, t, d }) => (
                <div
                  key={t}
                  className="flex items-center gap-3 rounded-2xl bg-white/12 px-3 py-3 text-white backdrop-blur"
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

            <div className="mt-8 lg:rounded-3xl lg:border lg:border-white/20 lg:bg-white/10 lg:p-6">
              <AuthLoginActions
                variant="onBrand"
                emailLabel="Continue with email"
              />
            </div>
            <p className="mt-3 text-center text-[11px] text-sky-100/80">
              Free · email or Google · first time creates your wallet · already
              have an account? Same button signs you in
            </p>
            <p className="mt-4 text-center text-[11px] text-sky-100/70">
              Same login opens any company you operate. After sign-in, use
              the building icon or You → Switch to business.{' '}
              <Link href="/dashboard/select-company" className="font-bold underline">
                Workspaces
              </Link>
              {' · '}
              <Link href="/join" className="font-bold underline">
                Register a business
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
      sub:
        accounts.length > 0
          ? 'Your wallet · places, shop, diary'
          : 'Add a gym, clinic or hire brand',
    },
    shop: {
      title: 'Shop',
      sub: 'Sale · hire · book a visit',
    },
    memberships: {
      title: 'Places',
      sub:
        accounts.length === 0
          ? 'Nothing linked yet'
          : `${accounts.length} ${accounts.length === 1 ? 'place' : 'places'}`,
    },
    checkin: {
      title: 'Places',
      sub:
        accounts.length === 0
          ? 'Nothing linked yet'
          : `${accounts.length} ${accounts.length === 1 ? 'place' : 'places'}`,
    },
    account: {
      title: 'You',
      sub: verification?.is_verified
        ? 'Verified member'
        : profile?.email || email || undefined,
    },
    you: {
      title: 'You',
      sub: verification?.is_verified
        ? 'Verified member'
        : profile?.email || email || undefined,
    },
    share: {
      title: 'Share',
      sub: 'Invite · places · consent',
    },
    calendar: {
      title: 'Diary',
      sub: 'Hires, classes and visits',
    },
    book: {
      title: 'Book',
      sub: 'Open times at this practice',
    },
  };

  return (
    <B2cAppShell
      tab={isYouTab(tab) ? 'you' : tab}
      onTab={goTab}
      youPhotoUrl={photoUrl || profile?.photo_url}
      youInitials={displayName}
      headerTitle={headerForTab[tab].title}
      headerSubtitle={headerForTab[tab].sub}
      headerRight={
        <div className="flex items-center gap-2">
          <B2cThemeToggle compact />
          <B2cWorkspaceSwitch
            hasBusiness={hasBusiness}
            businesses={businesses}
            variant="header"
          />
          {installHint ? <B2cInstallChip /> : null}
          <button
            type="button"
            onClick={() => void logout().then(() => router.refresh())}
            className="rounded-full bg-white/15 p-2 text-white"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      }
      badge={{
        memberships: accounts.length || undefined,
        you:
          verification?.completeness &&
          verification.completeness.score < verification.completeness.max
            ? 1
            : undefined,
      }}
    >
      {/* ── HOME ─────────────────────────────────────────────── */}
      {tab === 'home' && (
        <div className="space-y-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4 lg:col-span-7">
          {isJoin && !joinDone ? (
            <div className="rounded-3xl border border-sky-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#0077b6]">
                Link to your wallet
              </p>
              <p className="mt-0.5 text-lg font-black text-slate-900">
                {joinPreviewBrand || joinBrand || 'This brand'}
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                {joinOwned
                  ? `You operate ${joinPreviewBrand || joinBrand || 'this business'}. Link it here as a member if you also train, book or hire there — desk work stays under the building icon.`
                  : `Accept to add this business to your personal wallet. Then you can manage this account — book, shop, subscriptions and records they share with you.${
                      joinModules.length
                        ? ` This link includes ${moduleLabels(joinModules)}.`
                        : ''
                    }`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={joinBusy || !joinCompany}
                  onClick={() => void acceptJoin()}
                  className="rounded-2xl bg-[#0077b6] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {joinBusy
                    ? 'Linking…'
                    : joinOwned
                      ? `Link as member`
                      : joinAlready
                        ? `Refresh ${joinPreviewBrand || joinBrand || 'this account'}`
                        : `Accept & link ${joinPreviewBrand || joinBrand || 'this business'}`}
                </button>
                {joinOwned ? (
                  <Link
                    href="/dashboard/select-company"
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                  >
                    Open workspace
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={joinBusy}
                  onClick={clearJoinParams}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  Not now
                </button>
              </div>
              {!joinCompany ? (
                <p className="mt-2 text-[11px] text-amber-700">
                  This QR is missing the company. Ask the desk to reprint it.
                </p>
              ) : null}
            </div>
          ) : null}

          <section className="overflow-hidden rounded-[1.85rem] border border-white/70 bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-[#0c4a6e] p-5 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => goTab('you')}
                className="shrink-0"
                aria-label="Open You"
              >
                <B2cYouAvatar
                  photoUrl={photoUrl || profile?.photo_url}
                  initials={displayName}
                  size="lg"
                  active
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
                  Personal wallet
                </p>
                <h2 className="truncate text-2xl font-black tracking-tight">
                  {displayName}
                </h2>
                <p className="mt-0.5 truncate text-xs text-white/85">
                  {verification?.is_verified
                    ? 'Identity verified'
                    : email || 'Add your details on You'}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <button
                type="button"
                onClick={() => goTab('memberships')}
                className="rounded-2xl bg-white/12 px-2 py-2.5 backdrop-blur"
              >
                <p className="text-lg font-black tabular-nums">{accounts.length}</p>
                <p className="text-[10px] font-bold text-white/80">Places</p>
              </button>
              <button
                type="button"
                onClick={() => goTab('calendar')}
                className="rounded-2xl bg-white/12 px-2 py-2.5 backdrop-blur"
              >
                <p className="text-lg font-black tabular-nums">{accounts.length}</p>
                <p className="text-[10px] font-bold text-white/80">Diary</p>
              </button>
              <button
                type="button"
                onClick={() => goTab('you')}
                className="rounded-2xl bg-white/12 px-2 py-2.5 backdrop-blur"
              >
                <p className="text-lg font-black tabular-nums">
                  {verification?.completeness
                    ? `${verification.completeness.score}`
                    : '—'}
                </p>
                <p className="text-[10px] font-bold text-white/80">You</p>
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Wallet</h2>
              <button
                type="button"
                onClick={() => goTab('memberships')}
                className="text-[11px] font-bold text-[#0077b6]"
              >
                {accounts.length ? 'See all' : 'Add one'}
              </button>
            </div>
            {accounts.length === 0 ? (
              <button
                type="button"
                onClick={() => goTab('memberships')}
                className="w-full rounded-3xl border border-dashed border-sky-300 bg-white px-4 py-6 text-left shadow-sm"
              >
                <p className="text-sm font-black text-slate-900">
                  No gyms or clinics yet
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Search a brand or scan the desk QR. Companies you run stay
                  under the building icon — not here.
                </p>
              </button>
            ) : (
              <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-1 xl:grid-cols-2">
                {accounts.slice(0, 6).map((a) => {
                  const lead =
                    a.cards.find((c) => c.kind !== 'account') || a.cards[0];
                  const Icon = kindIcon(lead?.kind || 'account');
                  return (
                    <li key={a.company_id}>
                      <Link
                        href={primaryPortal(a)}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm active:scale-[0.99]"
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${kindTone(lead?.kind || 'account')}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-slate-900">
                            {a.brand}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {moduleLabels(a.kinds)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Invoices</h2>
              <button
                type="button"
                onClick={() => goTab('you')}
                className="text-[11px] font-bold text-[#0077b6]"
              >
                You
              </button>
            </div>
            <B2cMemberAccounts
              focusCompanyId={focusAccount}
              onLoaded={(list) => {
                const map: Record<number, number> = {};
                for (const row of list) {
                  map[row.company_id] =
                    (map[row.company_id] || 0) + (row.summary.open_zar || 0);
                }
                setAccountDueByCompany(map);
              }}
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black text-slate-900">
              Do this now
            </h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {firstGym ? (
                <Link
                  href={membershipClassesHref(firstGym)}
                  className="flex items-center gap-2 rounded-2xl border border-yellow-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-50 text-yellow-800">
                    <Dumbbell className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-xs font-black text-slate-900">
                      My classes
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {firstGym.brand || firstGym.company_name}
                    </span>
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => goTab('memberships')}
                  className="flex items-center gap-2 rounded-2xl border border-yellow-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-50 text-yellow-800">
                    <Dumbbell className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-xs font-black text-slate-900">
                      Find a gym
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      Link a studio
                    </span>
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => goTab('calendar')}
                className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Diary
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Hires and bookings
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => goTab('shop')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                  <Store className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Shop
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Sale and hire
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => goTab('memberships')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Link2 className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    Add a place
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Search or scan
                  </span>
                </span>
              </button>
            </div>
          </section>
          </div>

          <div className="space-y-4 lg:col-span-5">
          {authenticated ? (
            <B2cMemberCalendar
              preview
              onOpenFull={() => goTab('calendar')}
            />
          ) : null}

          {journeys.length > 0 || hasHire ? (
            <B2cHireJourneyList journeys={journeys} showHow={hasHire} />
          ) : null}
          </div>

          <div className="space-y-4 lg:col-span-12">
          <B2cCarePanel />

          {activity.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-black text-slate-900">
                Up next
              </h2>
              <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
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

          {verification &&
          verification.completeness &&
          verification.completeness.score < verification.completeness.max ? (
            <button
              type="button"
              onClick={() => goTab('you')}
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

          {hasBusiness ? (
            <B2cWorkspaceSwitch
              hasBusiness={hasBusiness}
              businesses={businesses}
            />
          ) : null}

          {installHint ? (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event('sa-open-install'))
              }
              className="flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-white p-3 text-left shadow-sm md:hidden"
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
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="space-y-6">
          <B2cAdvisorBook
            companyId={0}
            kind=""
            onNeedJoin={() => goTab('memberships')}
          />
          <B2cMemberCalendar onOpenFull={() => goTab('home')} />
        </div>
      )}

      {tab === 'book' && (
        <B2cAdvisorBook
          companyId={Number(search?.get('company') || joinCompany || 0)}
          kind={search?.get('kind') || joinKind || ''}
          onNeedJoin={() => {
            const params = new URLSearchParams(search?.toString() || '');
            params.set('join', '1');
            params.set('book', '1');
            const cid = search?.get('company') || String(joinCompany || '');
            if (cid) params.set('company', cid);
            if (search?.get('kind') || joinKind) {
              params.set('kind', search?.get('kind') || joinKind);
            }
            params.delete('tab');
            setTab('home');
            router.replace(`/me?${params.toString()}`, { scroll: false });
          }}
        />
      )}

      {/* ── SHOP / MARKETPLACE ──────────────────────────────── */}
      {tab === 'share' && (
        <B2cWalletShare
          displayName={displayName}
          places={accounts.map((a) => ({
            brand: a.brand,
            portal_path: primaryPortal(a),
          }))}
        />
      )}

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
          <p className="rounded-2xl bg-sky-50 px-3 py-2 text-[12px] text-sky-950">
            Places you use as a member — book, classes, records. Shops you
            operate stay under the building icon.
          </p>
          <B2cLinkBusiness
            linkedCompanyIds={linkedCompanyIds}
            onLinked={() => void load()}
          />
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <Link2 className="h-5 w-5 text-[#0077b6]" />
              <h2 className="text-sm font-black">Have a portal link?</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Paste the link from your email or WhatsApp.
            </p>
            <input
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-mono"
              placeholder="https://…/member/fitgraph/… or /hire/…"
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
          <div>
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
              Amounts due
            </p>
            <B2cMemberAccounts
              focusCompanyId={focusAccount}
              onLoaded={(list) => {
                const map: Record<number, number> = {};
                for (const row of list) {
                  map[row.company_id] =
                    (map[row.company_id] || 0) + (row.summary.open_zar || 0);
                }
                setAccountDueByCompany(map);
              }}
            />
          </div>
          {accounts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-sky-300 bg-white px-5 py-12 text-center">
              <p className="text-sm font-black text-slate-800">
                Add your first place
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Search above or scan the QR at reception. Your own shops do
                not appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              {accounts.map((a) => {
                const lead =
                  a.cards.find((c) => c.kind !== 'account') || a.cards[0];
                const Icon = kindIcon(lead?.kind || 'account');
                const clinic = a.cards.find((c) => isClinicKind(c.kind));
                const gym = a.cards.find((c) => c.kind === 'gym');
                const hire = a.cards.find((c) => c.kind === 'hire');
                const bookCard = clinic || gym || hire;
                const theyOperate = ownedCompanyIds.has(a.company_id);
                return (
                  <li
                    key={a.company_id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div
                      className={`bg-gradient-to-r px-4 py-3 text-white ${kindTone(lead?.kind || 'account')}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-black">
                            {a.brand}
                          </p>
                          <p className="text-[11px] text-white/85">
                            {moduleLabels(a.kinds)}
                            {theyOperate ? ' · you also run this' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 p-3">
                      <Link
                        href={primaryPortal(a)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#0077b6] px-3 py-2.5 text-xs font-black text-white min-w-[7rem]"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      {theyOperate ? (
                        <button
                          type="button"
                          onClick={() => openOwnedWorkspace(a.company_id, a.brand)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-800"
                        >
                          Workspace
                        </button>
                      ) : (
                        <Link
                          href={shopHref(a.company_id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-800"
                        >
                          <Store className="h-3.5 w-3.5" /> Shop
                        </Link>
                      )}
                      {bookCard ? (
                        <Link
                          href={membershipBookHref(bookCard)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-800"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />{' '}
                          {kindActionLabel(bookCard.kind)}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          const u = new URL(window.location.href);
                          u.searchParams.set('tab', 'memberships');
                          u.searchParams.set('account', String(a.company_id));
                          router.replace(`${u.pathname}${u.search}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-950"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        {accountDueByCompany[a.company_id]
                          ? `Due · R${accountDueByCompany[a.company_id].toLocaleString('en-ZA')}`
                          : 'Pay'}
                      </button>
                      {clinic ? (
                        <Link
                          href={membershipRecordsHref(clinic)}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-900"
                        >
                          <HeartPulse className="h-3.5 w-3.5" /> Records
                        </Link>
                      ) : null}
                      {gym ? (
                        <>
                          <Link
                            href={membershipClassesHref(gym)}
                            className="inline-flex items-center gap-1 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs font-black text-yellow-950"
                          >
                            <Dumbbell className="h-3.5 w-3.5" /> My classes
                          </Link>
                          <Link
                            href={membershipProgressHref(gym)}
                            className="inline-flex items-center gap-1 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs font-black text-yellow-950"
                          >
                            <Activity className="h-3.5 w-3.5" /> Progress
                          </Link>
                        </>
                      ) : null}
                      <Link
                        href={`/r/${a.company_id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-950"
                      >
                        <Star className="h-3.5 w-3.5" /> Review
                      </Link>
                      <button
                        type="button"
                        onClick={() => void unlinkCompany(a.company_id, a.brand)}
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

      {/* ── ACCOUNT ──────────────────────────────────────────── */}
      {isYouTab(tab) && (
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4">
          <section className="overflow-hidden rounded-[1.85rem] border border-white/70 bg-gradient-to-br from-[#0c4a6e] via-[#0077b6] to-[#00b4d8] p-5 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <B2cYouAvatar
                photoUrl={photoUrl || profile?.photo_url}
                initials={displayName}
                size="lg"
                active
              />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
                  You
                </p>
                <h2 className="truncate text-2xl font-black tracking-tight">
                  {displayName}
                </h2>
                <p className="mt-0.5 text-xs text-white/85">
                  {verification?.is_verified
                    ? 'Identity verified'
                    : verification?.completeness
                      ? `${verification.completeness.score}/${verification.completeness.max} complete`
                      : 'Your personal member profile'}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-white/80">
              This is you as a member. Companies you run stay under the
              building icon — they are not places in this wallet.
            </p>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">
              Invoices from your Advisors
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              A clinic or gym invoice lands here and in your email. Pay by
              card or send proof of payment.
            </p>
            <div className="mt-3">
              <B2cMemberAccounts
                focusCompanyId={focusAccount}
                onLoaded={(list) => {
                  const map: Record<number, number> = {};
                  for (const row of list) {
                    map[row.company_id] =
                      (map[row.company_id] || 0) + (row.summary.open_zar || 0);
                  }
                  setAccountDueByCompany(map);
                }}
              />
            </div>
          </section>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <B2cPhotoField
              value={photoUrl}
              initials={displayName}
              onChange={(url) => {
                setPhotoUrl(url);
                setProfile((prev) =>
                  prev ? { ...prev, photo_url: url || null } : prev
                );
                if (!url) {
                  void fetch('/api/b2c/me', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'update_profile',
                      photo_url: '',
                      privyUserId: getCanonicalUserId(user?.id),
                    }),
                  });
                }
              }}
            />
            <div className="mt-3 min-w-0">
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

          <B2cWorkspaceSwitch
            hasBusiness={hasBusiness}
            businesses={businesses}
          />

          <B2cThemeToggle />

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Notifications</h2>
            <p className="mt-1 text-xs text-slate-500">
              Appointments, medical updates, gym classes and hire status — on
              this phone, no company workspace required.
            </p>
            <div className="mt-3">
              <EnablePushButton mode="member" />
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
                onChange={(e) => {
                  setCity(e.target.value);
                  setPassport((p) => ({ ...p, city: e.target.value }));
                }}
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
          </div>

          <div className="space-y-4">
          <B2cPassportForm
            value={passport}
            city={city}
            onCity={setCity}
            onChange={setPassport}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveProfile()}
            className="w-full rounded-2xl bg-[#0077b6] py-3 text-sm font-black text-white disabled:opacity-50"
          >
            Save details for Advisors
          </button>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <PortalFamilyMembers
              family={profile?.family || []}
              busy={busy}
              context="wallet"
              accentClass="border-sky-200"
              buttonClass="bg-[#0077b6] hover:bg-[#023e8a]"
              onSave={async (member) => {
                setBusy(true);
                try {
                  const res = await fetch('/api/b2c/me', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'family_upsert',
                      member,
                      privyUserId: getCanonicalUserId(user?.id),
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Could not save');
                  if (data.profile) setProfile(data.profile);
                  toast.success(
                    data.message || 'Family saved on your wallet'
                  );
                } catch (e: unknown) {
                  toast.error(
                    e instanceof Error ? e.message : 'Could not save family'
                  );
                  throw e;
                } finally {
                  setBusy(false);
                }
              }}
              onRemove={async (id) => {
                setBusy(true);
                try {
                  const res = await fetch('/api/b2c/me', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'family_remove',
                      member_id: id,
                      privyUserId: getCanonicalUserId(user?.id),
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Could not remove');
                  if (data.profile) setProfile(data.profile);
                  toast.success(data.message || 'Removed');
                } catch (e: unknown) {
                  toast.error(
                    e instanceof Error ? e.message : 'Could not remove'
                  );
                  throw e;
                } finally {
                  setBusy(false);
                }
              }}
            />
          </section>
          </div>

          <div className="space-y-4 lg:col-span-2">
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
            Same login. Switch to a company from You, the building icon
            in the header, or{' '}
            <Link href="/dashboard/select-company" className="font-bold underline">
              all workspaces
            </Link>
            .
          </p>
          </div>
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
