'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Building2, ArrowRight } from 'lucide-react';

interface Company {
  id: string;
  trading_name: string;
  legal_name?: string | null;
  supplier_status: string;
  role: string;
}

export default function SelectCompanyPage() {
  const { user: privyUser, ready } = usePrivy();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Supabase client (modern pattern)
  const supabase = createClient();

  useEffect(() => {
    const loadCompanies = async () => {
      if (!ready || !privyUser?.id) {
        setLoading(false);
        return;
      }

      try {
        // Get companies where user has 'owner' role
        const { data: businessUsers, error: buError } = await supabase
          .from('business_users')
          .select('role, profile_id')
          .eq('user_id', privyUser.id)
          .eq('role', 'owner')
          .eq('status', 'active');

        if (buError) {
          console.error('Error loading business_users:', buError);
          setLoading(false);
          return;
        }

        if (!businessUsers || businessUsers.length === 0) {
          setCompanies([]);
          setLoading(false);
          return;
        }

        const profileIds = businessUsers.map((bu: any) => bu.profile_id);

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name, supplier_status')
          .in('id', profileIds);

        if (profilesError) {
          console.error('Error loading profiles:', profilesError);
        }

        const companiesList: Company[] = (profiles || []).map((profile: any) => {
          const bu = businessUsers.find((b: any) => b.profile_id === profile.id);
          return {
            id: profile.id,
            trading_name: profile.trading_name,
            legal_name: profile.legal_name,
            supplier_status: profile.supplier_status,
            role: bu?.role || 'owner',
          };
        });

        setCompanies(companiesList);
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [privyUser, ready, supabase]);

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
      <div className="max-w-5xl mx-auto">
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
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <div
                key={company.id}
                onClick={() => handleSelectCompany(company.id)}
                className="group bg-white border border-neutral-200 rounded-3xl p-8 cursor-pointer hover:border-[#00b4d8] hover:shadow-xl transition-all active:scale-[0.985]"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-[#00b4d8]/10 rounded-2xl flex items-center justify-center group-hover:bg-[#00b4d8]/15 transition-colors">
                    <Building2 className="w-7 h-7 text-[#00b4d8]" />
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    {company.role}
                  </span>
                </div>

                <h3 className="text-2xl font-bold tracking-[-1px] mb-1 group-hover:text-[#00b4d8] transition-colors">
                  {company.trading_name}
                </h3>
                {company.legal_name && company.legal_name !== company.trading_name && (
                  <p className="text-neutral-500 text-sm mb-4">{company.legal_name}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-6 border-t border-neutral-100">
                  <span className="text-sm text-neutral-500">Manage Dashboard</span>
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