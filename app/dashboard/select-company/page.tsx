'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ArrowRight,
  Plus,
  LogOut,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Users,
  LayoutDashboard,
  MapPin,
  Smartphone,
} from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import { fetchLoginRole } from '@/lib/auth/login-role';
import { defaultHomePathForRole } from '@/lib/business/permissions';
import { toast } from 'sonner';
import {
  HubHero,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
} from '@/components/chrome/CommandHubChrome';

interface Company {
  id: string;
  trading_name: string;
  legal_name?: string | null;
  supplier_status: string | null;
  verification_status?: string | null;
  role: string;
  business_type?: string | null;
  org_type?: string | null;
  entity_kind?: string | null;
  entity_badge?: string | null;
  home_path?: string | null;
}

interface DeletedCompany {
  id: string;
  trading_name: string;
  deleted_at: string;
  restore_until?: string | null;
}

export default function SelectCompanyPage() {
  const { user: privyUser, ready, logout, authenticated, login } = usePrivy();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deletedCompanies, setDeletedCompanies] = useState<DeletedCompany[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [personal, setPersonal] = useState<{
    name?: string | null;
    memberships: number;
    gym: number;
    clinic: number;
    hire: number;
  } | null>(null);

  const loadCompanies = useCallback(async () => {
    if (!ready) return;

    if (!authenticated || !privyUser?.id) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const userId = getCanonicalUserId(privyUser.id);
    const email = extractEmailFromPrivyUser(privyUser);
    // Collect every linked email so platform ownership can match reliably
    const linkedEmails = new Set<string>();
    if (email) linkedEmails.add(email);
    try {
      const linked = (privyUser as { linkedAccounts?: Array<{ type?: string; address?: string | null; email?: string | null }> })
        ?.linkedAccounts || [];
      for (const a of linked) {
        if (a.address && String(a.address).includes('@')) {
          linkedEmails.add(String(a.address).toLowerCase());
        }
        if (a.email && String(a.email).includes('@')) {
          linkedEmails.add(String(a.email).toLowerCase());
        }
      }
      const g = (privyUser as { google?: { email?: string } })?.google?.email;
      if (g) linkedEmails.add(String(g).toLowerCase());
    } catch {
      /* soft */
    }
    setSessionEmail(email);

    if (!userId) {
      setCompanies([]);
      setLoading(false);
      setError('Could not read your secure session. Please sign in again.');
      return;
    }

    try {
      const mePromise = fetch(
        `/api/b2c/me${email ? `?email=${encodeURIComponent(email)}` : ''}`,
        { cache: 'no-store' }
      )
        .then((r) => r.json())
        .then((data) => {
          if (!data?.success) return;
          setPersonal({
            name: data.profile?.full_name || null,
            memberships: Number(data.stats?.memberships || 0),
            gym: Number(data.stats?.gym || 0),
            clinic: Number(data.stats?.clinic || 0),
            hire: Number(data.stats?.hire || 0),
          });
        })
        .catch(() => {
          /* personal wallet is optional on this screen */
        });

      const res = await fetch('/api/me/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId: userId,
          email,
          emails: [...linkedEmails],
          includeDeleted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('companies API error:', data);
        setError(data.error || 'Could not load your companies.');
        setCompanies([]);
        setDeletedCompanies([]);
        await mePromise;
        return;
      }

      // Pin SupplierAdvisor platform company first (API also sorts; belt-and-braces)
      const list: Company[] = Array.isArray(data.companies)
        ? [...data.companies]
        : [];
      list.sort((a, b) => {
        const aPlat =
          a.entity_kind === 'platform' ||
          String(a.org_type || '').toLowerCase() === 'platform' ||
          String(a.business_type || '').toLowerCase() === 'platform' ||
          /^supplier\s*advisor$/i.test(String(a.trading_name || '').trim());
        const bPlat =
          b.entity_kind === 'platform' ||
          String(b.org_type || '').toLowerCase() === 'platform' ||
          String(b.business_type || '').toLowerCase() === 'platform' ||
          /^supplier\s*advisor$/i.test(String(b.trading_name || '').trim());
        if (aPlat && !bPlat) return -1;
        if (!aPlat && bPlat) return 1;
        return 0;
      });
      setCompanies(list);
      setDeletedCompanies(data.deletedCompanies || []);
      await mePromise;
    } catch (err) {
      console.error('Error loading companies:', err);
      setError('Network error while loading companies. Check your connection and try again.');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [ready, authenticated, privyUser]);

  useEffect(() => {
    if (!ready) {
      setLoading(true);
      return;
    }
    void loadCompanies();
  }, [ready, authenticated, privyUser?.id, loadCompanies]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace('/login?next=' + encodeURIComponent('/dashboard/select-company'));
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ready || !authenticated || !privyUser) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLoginRole({
          privyUserId: getCanonicalUserId(privyUser.id),
          email: extractEmailFromPrivyUser(privyUser),
        });
        if (cancelled) return;
        if (data.isContractor && !data.isBusinessUser) {
          router.replace('/contractor');
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, privyUser, router]);

  const handleSelectCompany = (
    companyId: string,
    tradingName?: string,
    role?: string,
    homePath?: string | null
  ) => {
    try {
      localStorage.setItem('selectedCompanyId', companyId);
      if (tradingName) localStorage.setItem('selectedCompanyName', tradingName);
      window.dispatchEvent(new Event('sa:company-changed'));
    } catch {
      /* private mode */
    }
    // Entity home (school/DBE/SP) wins; team role only for sales_contractor etc.
    const path =
      role === 'sales_contractor'
        ? defaultHomePathForRole(role)
        : homePath || defaultHomePathForRole(role);
    try {
      localStorage.setItem('saWorkspace', 'business');
    } catch {
      /* private mode */
    }
    router.push(path);
  };

  const handleOpenPersonal = () => {
    try {
      localStorage.setItem('saWorkspace', 'personal');
      // Do not touch selectedCompanyId — operator context stays put.
    } catch {
      /* private mode */
    }
    router.push('/me');
  };

  /** Derive continent from country on every owned company (discover search quality) */
  const backfillAllLocations = async () => {
    if (!privyUser?.id || !companies.length) return;
    const privyUserId = getCanonicalUserId(privyUser.id);
    setBackfillBusy(true);
    let updated = 0;
    let skipped = 0;
    try {
      for (const c of companies) {
        try {
          const res = await fetch('/api/business/location-backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: Number(c.id),
              privyUserId,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.updated) updated += 1;
          else skipped += 1;
        } catch {
          skipped += 1;
        }
      }
      toast.success(
        `Location fix: ${updated} updated${skipped ? ` · ${skipped} unchanged` : ''}`
      );
    } finally {
      setBackfillBusy(false);
    }
  };

  const verifiedCount = useMemo(
    () => companies.filter((c) => c.verification_status === 'verified').length,
    [companies]
  );
  const roleCount = useMemo(() => {
    const s = new Set(companies.map((c) => c.role).filter(Boolean));
    return s.size;
  }, [companies]);

  if (!ready || (authenticated && loading)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#00b4d8]" />
          <p className="font-medium text-neutral-600">Loading your workspaces…</p>
          <p className="mt-2 text-sm text-neutral-400">Restoring secure session</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f8fafc] px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-cyan-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00b4d8]/10">
            <LayoutDashboard className="h-6 w-6 text-[#00b4d8]" />
          </div>
          <h1 className="mb-2 text-2xl font-black tracking-tight text-slate-900">
            Sign in <span className="text-[#00b4d8]">required</span>
          </h1>
          <p className="mb-6 text-sm text-neutral-600">
            Log in to open company workspaces linked to your profile.
          </p>
          <button type="button" onClick={() => login()} className="btn-primary w-full !py-3.5">
            Continue securely
          </button>
          <Link
            href="/login?next=/dashboard/select-company"
            className="mt-4 block text-sm font-semibold text-[#00b4d8] hover:underline"
          >
            Open login page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900 antialiased">
      {/* Top chrome */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:h-[4.25rem] sm:px-6 lg:px-10">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={120}
              height={52}
              className="h-9 w-auto object-contain sm:h-10"
              priority
            />
            <span className="truncate text-base font-black tracking-tight text-slate-900 sm:text-lg">
              SupplierAdvisor<span className="text-[#00b4d8]">®</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadCompanies().then(() => toast.success('Workspaces refreshed'));
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-[#00b4d8] hover:text-[#0077b6] sm:text-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 sm:text-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        {/* Command header */}
        <div className="mb-6 sm:mb-8">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 sm:text-xs">
            Workspace selector
          </p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl md:text-5xl md:tracking-[-1.5px]">
                Select a <span className="text-[#00b4d8]">workspace</span>
              </h1>
              <p className="mt-2 text-sm text-neutral-600 sm:text-base">
                Same login, two lives: your personal SA Member wallet (gym, dentist, hire)
                stays separate from every company you operate.
              </p>
              {sessionEmail && (
                <p className="mt-2 text-sm text-neutral-500">
                  Signed in as <span className="font-semibold text-slate-700">{sessionEmail}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {companies.length > 0 ? (
                <button
                  type="button"
                  disabled={backfillBusy}
                  onClick={() => void backfillAllLocations()}
                  className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                  title="Set continent from country on every company you own (improves Discover search)"
                >
                  {backfillBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  Fix locations
                </button>
              ) : null}
              <Link
                href="/join"
                className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Register business
              </Link>
            </div>
          </div>
        </div>

        <HubHero
          pill="Dual-life · personal wallet + companies"
          title="One login. Personal life and companies."
          description="Open SA Member for gym, dentist and hire brands. Open a company to run B2B or B2G — those books never mix into your personal profile."
          stats={[
            {
              label: 'Companies',
              value: loading ? '—' : companies.length,
              valueClass: 'text-[#00b4d8]',
            },
            {
              label: 'Personal brands',
              value: personal ? personal.memberships : '—',
              valueClass: 'text-sky-600',
            },
            {
              label: 'Roles',
              value: loading ? '—' : roleCount,
              valueClass: 'text-amber-600',
            },
          ]}
        />

        <HubTelemetryGrid className="mb-8">
          <TelemetryCard
            label="Workspaces"
            value={companies.length}
            sub="Linked memberships"
            accent="cyan"
            icon={Building2}
          />
          <TelemetryCard
            label="Verified"
            value={verifiedCount}
            sub="Trust-ready profiles"
            accent="emerald"
            icon={ShieldCheck}
          />
          <TelemetryCard
            label="Your roles"
            value={roleCount}
            sub="Across companies"
            accent="violet"
            icon={Users}
          />
          <TelemetryCard
            label="Next step"
            value="Open"
            sub="Command dashboard"
            accent="sky"
            icon={LayoutDashboard}
          />
        </HubTelemetryGrid>

        <div className="mb-6">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
            Personal
          </p>
          <button
            type="button"
            onClick={handleOpenPersonal}
            className="group flex w-full items-stretch gap-4 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 text-left shadow-sm transition-all hover:border-[#00b4d8]/60 hover:shadow-md active:scale-[0.99] dark:border-sky-900/50 dark:from-sky-950/40 dark:to-neutral-950 sm:p-6"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00b4d8] to-[#0077b6] text-white shadow">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
                SA Member
              </p>
              <h3 className="mt-0.5 text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
                {personal?.name
                  ? `${personal.name.split(' ')[0]}'s personal wallet`
                  : 'Your personal wallet'}
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                GymAdvisor, DentalAdvisor, HireAdvisor and clinic brands you use as a
                customer — not mixed with any company you operate.
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {personal
                  ? `${personal.memberships} brand${personal.memberships === 1 ? '' : 's'}${
                      personal.gym || personal.clinic || personal.hire
                        ? ` · ${[
                            personal.gym ? `${personal.gym} gym` : null,
                            personal.clinic ? `${personal.clinic} clinic` : null,
                            personal.hire ? `${personal.hire} hire` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}`
                        : ''
                    }`
                  : 'Open to link or review your brands'}
              </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1 self-center text-xs font-bold text-[#00b4d8] sm:inline-flex">
              Open app <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-2">{error}</p>
            <button type="button" onClick={() => void loadCompanies()} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}

        {companies.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-cyan-200 bg-gradient-to-br from-white to-sky-50/60 px-6 py-14 text-center shadow-sm sm:px-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00b4d8]/10">
              <Building2 className="h-7 w-7 text-[#00b4d8]" />
            </div>
            <h3 className="mb-2 text-xl font-black text-slate-900 sm:text-2xl">No companies found</h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-neutral-600">
              No active memberships for this login
              {sessionEmail ? (
                <>
                  {' '}
                  (<span className="font-medium">{sessionEmail}</span>)
                </>
              ) : null}
              . Use the same email as on your other devices, or register a business.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setTimeout(() => login(), 400);
                }}
                className="btn-secondary !py-3 !px-6"
              >
                Different account
              </button>
              <Link
                href="/join"
                className="btn-primary !py-3 !px-6 inline-flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Register organisation
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
              Companies you operate
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {companies.map((company) => {
                const isSales = String(company.role || '')
                  .toLowerCase()
                  .replace(/[\s-]+/g, '_')
                  .includes('sales_contractor');
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() =>
                      handleSelectCompany(
                        company.id,
                        company.trading_name,
                        company.role,
                        company.home_path
                      )
                    }
                    className="group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-[#00b4d8]/50 hover:shadow-md active:scale-[0.99] touch-manipulation dark:border-neutral-800 dark:bg-neutral-950 sm:p-6"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-[#0077b6] shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-[#00b4d8]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {company.entity_badge ? (
                          <span className="rounded-full border border-[#00b4d8]/30 bg-[#00b4d8]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0077b6] dark:text-[#00b4d8]">
                            {company.entity_badge}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                          {String(company.role || 'member').replace(/_/g, ' ')}
                        </span>
                        {company.verification_status === 'verified' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="mb-1 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-[#0077b6] dark:text-white dark:group-hover:text-[#00b4d8] sm:text-xl">
                      {company.trading_name || 'Untitled organisation'}
                    </h3>
                    {company.legal_name && company.legal_name !== company.trading_name && (
                      <p className="mb-3 truncate text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
                        {company.legal_name}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-neutral-800">
                      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        {isSales
                          ? 'Open sales portal'
                          : company.entity_kind === 'nsnp_isp'
                            ? 'Open SP deliveries'
                            : company.entity_kind === 'school' ||
                                company.entity_kind === 'government_education'
                              ? 'Open schools programme'
                              : 'Open command center'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00b4d8]">
                        Enter{' '}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/join"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#00b4d8] hover:underline"
              >
                <Plus className="h-4 w-4" /> Add another organisation
              </Link>
            </div>
          </>
        )}

        {deletedCompanies.length > 0 && (
          <div className="mt-10 rounded-3xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
            <h3 className="text-sm font-black text-amber-950 mb-1">
              Recently deleted (restore within 14 days)
            </h3>
            <p className="text-xs text-amber-900/80 mb-4">
              Companies you soft-deleted can be restored if the window has not
              expired. Only the owner who deleted can restore.
            </p>
            <ul className="space-y-2">
              {deletedCompanies.map((d) => {
                const expired =
                  d.restore_until &&
                  new Date(d.restore_until).getTime() < Date.now();
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-100 bg-white px-4 py-3"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {d.trading_name}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Deleted {new Date(d.deleted_at).toLocaleString()}
                        {d.restore_until
                          ? ` · restore by ${new Date(d.restore_until).toLocaleDateString()}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(expired) || restoreBusy === d.id}
                      onClick={async () => {
                        setRestoreBusy(d.id);
                        try {
                          const res = await fetch('/api/business/company', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'restore',
                              companyId: Number(d.id),
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            throw new Error(
                              (data as { error?: string }).error ||
                                'Restore failed'
                            );
                          }
                          toast.success(
                            `Restored ${data.tradingName || d.trading_name}`
                          );
                          await loadCompanies();
                        } catch (e: unknown) {
                          toast.error(
                            e instanceof Error ? e.message : 'Restore failed'
                          );
                        } finally {
                          setRestoreBusy(null);
                        }
                      }}
                      className="rounded-full bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900 disabled:opacity-40"
                    >
                      {restoreBusy === d.id
                        ? 'Restoring…'
                        : expired
                          ? 'Expired'
                          : 'Restore'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <HubPrinciples
          items={[
            {
              title: 'Personal stays personal',
              body: 'Your SA Member wallet is you — dentist, gym, hire customer. It is never keyed off the company you last operated.',
            },
            {
              title: 'Company-scoped always',
              body: 'Every operator module, API, and document is membership-checked against the company you select here.',
            },
            {
              title: 'Independent brands',
              body: 'Each business you link is one wallet account. A gym and a dentist at different companies stay separate — they only share this login.',
            },
          ]}
        />
      </main>
    </div>
  );
}
