'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Building2, Plus, ArrowRight } from 'lucide-react';

interface Company {
  id: string;
  trading_name: string;
  legal_name: string | null;
  supplier_status: string;
  role: string;
  source: 'linked' | 'email_match';
}

export default function SelectCompanyPage() {
  const { user: privyUser, ready } = usePrivy();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      if (!ready) return;

      try {
        const userIds: string[] = [];
        let userEmail: string | null = null;

        // 1. Get Privy user ID + email
        if (privyUser?.id) {
          const cleanPrivyId = privyUser.id.replace('privy:', '');
          userIds.push(cleanPrivyId);
          userEmail = privyUser.email ? String(privyUser.email) : null;
        }

        // 2. Get Supabase Auth user ID + email
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser?.id) {
          userIds.push(supabaseUser.id);
          if (!userEmail) userEmail = supabaseUser.email || null;
        }

        let allCompanies: Company[] = [];

        // 3. Fetch via business_users (proper links)
        if (userIds.length > 0) {
          const { data: businessUsers } = await supabase
            .from('business_users')
            .select(`
              role,
              profiles (
                id,
                trading_name,
                legal_name,
                supplier_status
              )
            `)
            .in('user_id', userIds)
            .eq('status', 'active');

          if (businessUsers) {
            const linked = businessUsers
              .filter((bu: any) => bu.profiles)
              .map((bu: any) => ({
                id: bu.profiles.id,
                trading_name: bu.profiles.trading_name,
                legal_name: bu.profiles.legal_name,
                supplier_status: bu.profiles.supplier_status,
                role: bu.role,
                source: 'linked' as const,
              }));
            allCompanies = [...linked];
          }
        }

        // 4. Fallback: Case-insensitive email match
        if (userEmail) {
          const { data: emailMatches } = await supabase
            .from('profiles')
            .select('id, trading_name, legal_name, supplier_status')
            .ilike('email', userEmail);   // ← Case-insensitive match

          if (emailMatches) {
            const emailCompanies = emailMatches.map((profile: any) => ({
              id: profile.id,
              trading_name: profile.trading_name,
              legal_name: profile.legal_name,
              supplier_status: profile.supplier_status,
              role: 'owner',
              source: 'email_match' as const,
            }));

            emailCompanies.forEach((ec) => {
              if (!allCompanies.some((c) => c.id === ec.id)) {
                allCompanies.push(ec);
              }
            });
          }
        }

        setCompanies(allCompanies);
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [privyUser, ready]);

  const handleSelectCompany = (companyId: string) => {
    localStorage.setItem('selectedCompanyId', companyId);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Loading your companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black tracking-[-3px] mb-3">Select a Company</h1>
          <p className="text-xl text-neutral-600">Choose which company profile you'd like to manage</p>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-neutral-200">
            <Building2 className="w-16 h-16 mx-auto text-neutral-300 mb-6" />
            <h3 className="text-2xl font-semibold mb-2">No companies found</h3>
            <p className="text-neutral-600 mb-8 max-w-md mx-auto">
              You don't have any companies linked to your account yet.
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#00b4d8] text-white rounded-2xl font-semibold hover:bg-[#0099b8] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Company
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <div
                key={company.id}
                onClick={() => handleSelectCompany(company.id)}
                className="bg-white border border-neutral-200 rounded-3xl p-8 cursor-pointer hover:border-[#00b4d8] hover:shadow-lg transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-[#00b4d8]/10 rounded-2xl flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-[#00b4d8]" />
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    {company.role}
                  </span>
                </div>

                <h3 className="text-2xl font-bold tracking-tight mb-1 group-hover:text-[#00b4d8] transition-colors">
                  {company.trading_name}
                </h3>
                {company.legal_name && company.legal_name !== company.trading_name && (
                  <p className="text-neutral-500 text-sm mb-4">{company.legal_name}</p>
                )}

                <div className="flex items-center justify-between mt-8 pt-6 border-t">
                  <span className="text-sm text-neutral-500">
                    {company.source === 'email_match' ? 'Email match' : 'View Dashboard'}
                  </span>
                  <ArrowRight className="w-5 h-5 text-[#00b4d8] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}