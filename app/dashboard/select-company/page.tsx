'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Building2, ArrowRight, Plus, LogOut } from 'lucide-react';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';

interface Company {
  id: string;
  trading_name: string;
  legal_name?: string | null;
  supplier_status: string | null;
  verification_status?: string | null;
  role: string;
}

export default function SelectCompanyPage() {
  const { user: privyUser, ready, logout, authenticated } = usePrivy();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadCompanies = async () => {
      if (!ready) return;

      if (!authenticated || !privyUser?.id) {
        setLoading(false);
        return;
      }

      try {
        setError(null);

        const userId = getCanonicalUserId(privyUser.id);
        if (!userId) {
          setCompanies([]);
          setLoading(false);
          return;
        }

        // Match canonical Privy id + legacy stripped formats
        const variants = userIdMatchVariants(userId);
        const { data: businessUsers, error: buError } = await supabase
          .from('business_users')
          .select('role, profile_id, status, user_id')
          .in('user_id', variants)
          .eq('status', 'active');

        if (buError) {
          console.error('Error loading business_users:', buError);
          setError('Could not load your company memberships.');
          setLoading(false);
          return;
        }

        if (!businessUsers || businessUsers.length === 0) {
          setCompanies([]);
          setLoading(false);
          return;
        }

        const profileIds = businessUsers.map((bu: { profile_id: string | number }) => bu.profile_id);

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name, supplier_status, verification_status')
          .in('id', profileIds);

        if (profilesError) {
          console.error('Error loading profiles:', profilesError);
          setError('Could not load company profiles.');
        }

        const companiesList: Company[] = (profiles || []).map((profile: {
          id: string | number;
          trading_name: string;
          legal_name?: string | null;
          supplier_status: string | null;
          verification_status?: string | null;
        }) => {
          const bu = businessUsers.find(
            (b: { profile_id: string | number; role: string }) =>
              String(b.profile_id) === String(profile.id)
          );
          return {
            id: String(profile.id),
            trading_name: profile.trading_name,
            legal_name: profile.legal_name,
            supplier_status: profile.supplier_status,
            verification_status: profile.verification_status,
            role: bu?.role || 'member',
          };
        });

        setCompanies(companiesList);
      } catch (err) {
        console.error('Error loading companies:', err);
        setError('Something went wrong while loading companies.');
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [privyUser, ready, authenticated, supabase]);

  const handleSelectCompany = (companyId: string) => {
    localStorage.setItem('selectedCompanyId', companyId);
    router.push('/dashboard');
  };

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Loading your companies…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-3">Sign in required</h1>
          <p className="text-neutral-600 mb-8">Log in to choose a company workspace.</p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2">
            Go to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-12">
          <div className="text-center sm:text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-[-2.5px] text-[#00b4d8] mb-3">
              Select a Company
            </h1>
            <p className="text-lg md:text-xl text-neutral-600">
              Choose which company profile you would like to manage
            </p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-white transition-colors self-center sm:self-start"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {companies.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-neutral-200">
            <Building2 className="w-16 h-16 mx-auto text-neutral-300 mb-6" />
            <h3 className="text-2xl font-semibold mb-2 text-slate-900">No companies found</h3>
            <p className="text-neutral-600 mb-8 max-w-md mx-auto">
              You do not have any companies linked to your account yet. Register a business to get started.
            </p>
            <Link href="/onboarding?type=business" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Register a Business
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleSelectCompany(company.id)}
                  className="group text-left bg-white border border-neutral-200 rounded-3xl p-8 cursor-pointer hover:border-[#00b4d8] hover:shadow-xl transition-all active:scale-[0.985]"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-[#00b4d8]/10 rounded-2xl flex items-center justify-center group-hover:bg-[#00b4d8]/15 transition-colors">
                      <Building2 className="w-7 h-7 text-[#00b4d8]" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium capitalize">
                        {company.role}
                      </span>
                      {company.verification_status === 'verified' && (
                        <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-[#00b4d8] font-medium">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold tracking-[-1px] mb-1 text-slate-900 group-hover:text-[#00b4d8] transition-colors">
                    {company.trading_name || 'Untitled company'}
                  </h3>
                  {company.legal_name && company.legal_name !== company.trading_name && (
                    <p className="text-neutral-500 text-sm mb-4">{company.legal_name}</p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-neutral-100">
                    <span className="text-sm text-neutral-500">Open dashboard</span>
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
