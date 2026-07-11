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
} from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
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
}

export default function SelectCompanyPage() {
  const { user: privyUser, ready, logout, authenticated, login } = usePrivy();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

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
    setSessionEmail(email);

    if (!userId) {
      setCompanies([]);
      setLoading(false);
      setError('Could not read your secure session. Please sign in again.');
      return;
    }

    try {
      const res = await fetch('/api/me/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privyUserId: userId, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('companies API error:', data);
        setError(data.error || 'Could not load your companies.');
        setCompanies([]);
        return;
      }

      setCompanies(data.companies || []);
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
    const t = setTimeout(() => {
      void loadCompanies();
    }, authenticated ? 150 : 0);
    return () => clearTimeout(t);
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
        const res = await fetch('/api/contractor/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyUserId: getCanonicalUserId(privyUser.id),
            email: extractEmailFromPrivyUser(privyUser),
          }),
        });
        const data = await res.json();
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

  const handleSelectCompany = (companyId: string, tradingName?: string, role?: string) => {
    try {
      localStorage.setItem('selectedCompanyId', companyId);
      if (tradingName) localStorage.setItem('selectedCompanyName', tradingName);
      window.dispatchEvent(new Event('sa:company-changed'));
    } catch {
      /* private mode */
    }
    router.push(defaultHomePathForRole(role));
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
              width={40}
              height={40}
              className="h-9 w-9 rounded-2xl object-contain sm:h-10 sm:w-10"
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
                Select a <span className="text-[#00b4d8]">company</span>
              </h1>
              <p className="mt-2 text-sm text-neutral-600 sm:text-base">
                Choose which company workspace to command — every module is company-scoped and
                membership-checked.
              </p>
              {sessionEmail && (
                <p className="mt-2 text-sm text-neutral-500">
                  Signed in as <span className="font-semibold text-slate-700">{sessionEmail}</span>
                </p>
              )}
            </div>
            <Link
              href="/onboarding?type=business"
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex shrink-0 items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Register business
            </Link>
          </div>
        </div>

        <HubHero
          pill="Live workspaces · multi-company safe"
          title="One login. Many companies."
          description="Pick a workspace to open the command center — network, trade, inventory, manufacturing, distribution, and books for that company only."
          stats={[
            {
              label: 'Companies',
              value: loading ? '—' : companies.length,
              valueClass: 'text-[#00b4d8]',
            },
            {
              label: 'Verified',
              value: loading ? '—' : verifiedCount,
              valueClass: 'text-emerald-600',
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
                href="/onboarding?type=business"
                className="btn-primary !py-3 !px-6 inline-flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Register a business
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
              Your companies
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {companies.map((company, i) => {
                const isSales = String(company.role || '')
                  .toLowerCase()
                  .replace(/[\s-]+/g, '_')
                  .includes('sales_contractor');
                const accents = [
                  'from-cyan-50 to-white border-cyan-100',
                  'from-violet-50 to-white border-violet-100',
                  'from-emerald-50 to-white border-emerald-100',
                  'from-sky-50 to-white border-sky-100',
                  'from-amber-50 to-white border-amber-100',
                ];
                const accent = accents[i % accents.length];
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() =>
                      handleSelectCompany(company.id, company.trading_name, company.role)
                    }
                    className={`group rounded-3xl border bg-gradient-to-br ${accent} p-5 text-left shadow-sm transition-all hover:border-[#00b4d8]/50 hover:shadow-md active:scale-[0.99] touch-manipulation sm:p-6`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white bg-white shadow-sm text-[#0077b6]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          {String(company.role || 'member').replace(/_/g, ' ')}
                        </span>
                        {company.verification_status === 'verified' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="mb-1 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-[#0077b6] sm:text-xl">
                      {company.trading_name || 'Untitled company'}
                    </h3>
                    {company.legal_name && company.legal_name !== company.trading_name && (
                      <p className="mb-3 truncate text-xs text-neutral-500 sm:text-sm">
                        {company.legal_name}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-white/80 pt-4">
                      <span className="text-xs font-semibold text-neutral-500">
                        {isSales ? 'Open sales portal' : 'Open command center'}
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
                href="/onboarding?type=business"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#00b4d8] hover:underline"
              >
                <Plus className="h-4 w-4" /> Add another company
              </Link>
            </div>
          </>
        )}

        <HubPrinciples
          items={[
            {
              title: 'Company-scoped always',
              body: 'Every module, API, and document is membership-checked against the company you select here.',
            },
            {
              title: 'Switch without confusion',
              body: 'Multi-company operators pick a workspace once — the sticky process rail and dashboard follow that context.',
            },
            {
              title: 'Roles with least privilege',
              body: 'Owners, admins, operators, and sales contractors land in the right home for their permissions.',
            },
          ]}
        />
      </main>
    </div>
  );
}
