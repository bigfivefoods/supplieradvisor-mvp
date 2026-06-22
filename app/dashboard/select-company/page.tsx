'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    const loadCompanies = async () => {
      if (!ready || !privyUser?.id) {
        setLoading(false);
        return;
      }

      const privyId = privyUser.id; // This is the full "did:privy:xxx"
      console.log('Using Privy ID:', privyId);

      try {
        // Step 1: Get linked companies via business_users
        const { data: businessUsers, error: buError } = await supabase
          .from('business_users')
          .select('role, profile_id')
          .eq('user_id', privyId)
          .eq('status', 'active');

        if (buError) console.error('business_users error:', buError);

        let linkedCompanies: Company[] = [];

        if (businessUsers && businessUsers.length > 0) {
          const profileIds = businessUsers.map((bu: any) => bu.profile_id);

          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, trading_name, legal_name, supplier_status')
            .in('id', profileIds);

          if (profilesError) console.error('profiles error:', profilesError);

          if (profiles) {
            linkedCompanies = profiles.map((profile: any) => {
              const bu = businessUsers.find((b: any) => b.profile_id === profile.id);
              return {
                id: profile.id,
                trading_name: profile.trading_name,
                legal_name: profile.legal_name,
                supplier_status: profile.supplier_status,
                role: bu?.role || 'owner',
              };
            });
          }
        }

        console.log('Final companies:', linkedCompanies);
        setCompanies(linkedCompanies);
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [privyUser, ready]);

  const handleSelect = (companyId: string) => {
    localStorage.setItem('selectedCompanyId', companyId);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Loading your companies...</p>
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
            <p className="text-neutral-600 mb-8">You don't have any companies linked to your account yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <div
                key={company.id}
                onClick={() => handleSelect(company.id)}
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

                <div className="flex items-center justify-between mt-8 pt-6 border-t">
                  <span className="text-sm text-neutral-500">View Dashboard</span>
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