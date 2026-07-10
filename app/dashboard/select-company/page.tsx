'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, Plus, LogOut, RefreshCw, Loader2 } from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import { defaultHomePathForRole } from '@/lib/business/permissions';
import { toast } from 'sonner';

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

  // Wait for Privy to fully restore the session (important on mobile Safari)
  useEffect(() => {
    if (!ready) {
      setLoading(true);
      return;
    }
    // Small delay helps mobile browsers finish session hydration after redirect
    const t = setTimeout(() => {
      void loadCompanies();
    }, authenticated ? 150 : 0);
    return () => clearTimeout(t);
  }, [ready, authenticated, privyUser?.id, loadCompanies]);

  // Unauthenticated: send to login with return URL (do not show empty companies)
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace('/login?next=' + encodeURIComponent('/dashboard/select-company'));
    }
  }, [ready, authenticated, router]);

  // Pure contractors never pick a company — operator portal only
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
      // Notify open tabs / CompanyGate listeners
      window.dispatchEvent(new Event('sa:company-changed'));
    } catch {
      // private mode / blocked storage — still navigate
    }
    // Sales contractors land in Customers, not the full dashboard hub
    router.push(defaultHomePathForRole(role));
  };

  const handleSignIn = () => {
    login();
  };

  // Loading / session restore
  if (!ready || (authenticated && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600 font-medium">Loading your companies…</p>
          <p className="text-sm text-neutral-400 mt-2">Restoring your secure session</p>
        </div>
      </div>
    );
  }

  // Not signed in (brief state while redirecting, with clear CTA)
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-md w-full bg-white border border-neutral-200 rounded-3xl p-8 shadow-sm">
          <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-3">Sign in required</h1>
          <p className="text-neutral-600 mb-8">
            Log in with your email, Google, or Apple to see the companies linked to your profile.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            className="btn-primary w-full py-4 text-lg mb-3"
          >
            Continue securely
          </button>
          <Link
            href="/login?next=/dashboard/select-company"
            className="block text-sm text-[#00b4d8] font-medium hover:underline"
          >
            Open login page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 sm:py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 sm:mb-12">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-2px] text-[#00b4d8] mb-2 sm:mb-3">
              Select a Company
            </h1>
            <p className="text-base sm:text-xl text-neutral-600">
              Choose which company profile you would like to manage
            </p>
            {sessionEmail && (
              <p className="text-sm text-neutral-500 mt-2">
                Signed in as <span className="font-medium text-slate-700">{sessionEmail}</span>
              </p>
            )}
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadCompanies().then(() => toast.success('Companies refreshed'));
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm">
            <p className="mb-3">{error}</p>
            <button
              type="button"
              onClick={() => void loadCompanies()}
              className="font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {companies.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-3xl border border-neutral-200 px-6">
            <Building2 className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-neutral-300 mb-6" />
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 text-slate-900">No companies found</h3>
            <p className="text-neutral-600 mb-4 max-w-md mx-auto text-sm sm:text-base">
              We couldn&apos;t find active company memberships for this login
              {sessionEmail ? (
                <>
                  {' '}
                  (<span className="font-medium">{sessionEmail}</span>)
                </>
              ) : null}
              . Use the same email as on your other devices, or register a business.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setTimeout(() => login(), 400);
                }}
                className="btn-secondary py-3 px-6"
              >
                Sign in with a different account
              </button>
              <Link href="/onboarding?type=business" className="btn-primary py-3 px-6 inline-flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Register a Business
              </Link>
            </div>
            <button
              type="button"
              onClick={() => void loadCompanies()}
              className="mt-6 text-sm text-[#00b4d8] font-medium inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh list
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() =>
                    handleSelectCompany(company.id, company.trading_name, company.role)
                  }
                  className="group text-left bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 cursor-pointer hover:border-[#00b4d8] hover:shadow-xl transition-all active:scale-[0.985] touch-manipulation"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-[#00b4d8]/10 rounded-2xl flex items-center justify-center group-hover:bg-[#00b4d8]/15 transition-colors">
                      <Building2 className="w-7 h-7 text-[#00b4d8]" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium capitalize">
                        {String(company.role || '').replace(/_/g, ' ')}
                      </span>
                      {company.verification_status === 'verified' && (
                        <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-[#00b4d8] font-medium">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold tracking-[-1px] mb-1 text-slate-900 group-hover:text-[#00b4d8] transition-colors">
                    {company.trading_name || 'Untitled company'}
                  </h3>
                  {company.legal_name && company.legal_name !== company.trading_name && (
                    <p className="text-neutral-500 text-sm mb-4">{company.legal_name}</p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-neutral-100">
                    <span className="text-sm text-neutral-500">
                      {String(company.role || '')
                        .toLowerCase()
                        .includes('sales_contractor') ||
                      String(company.role || '')
                        .toLowerCase()
                        .includes('sales contractor')
                        ? 'Open Customers'
                        : 'Open dashboard'}
                    </span>
                    <ArrowRight className="w-5 h-5 text-[#00b4d8] group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/onboarding?type=business"
                className="inline-flex items-center gap-2 text-[#00b4d8] font-medium hover:underline"
              >
                <Plus className="w-4 h-4" /> Add another company
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
