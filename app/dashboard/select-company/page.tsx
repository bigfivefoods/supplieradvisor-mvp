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

        // 1. Get Privy user ID (if logged in via Privy)
        if (privyUser?.id) {
          const cleanPrivyId = privyUser.id.replace('privy:', '');
          userIds.push(cleanPrivyId);
        }

        // 2. Get Supabase Auth user ID (if logged in via Supabase - e.g. after claiming)
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser?.id) {
          userIds.push(supabaseUser.id);
        }

        if (userIds.length === 0) {
          setLoading(false);
          return;
        }

        // 3. Fetch all companies linked to any of these user IDs
        const { data: businessUsers, error } = await supabase
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

        if (error) {
          console.error('Error fetching companies:', error);
          setLoading(false);
          return;
        }

        // 4. Format the results
        const formattedCompanies: Company[] = (businessUsers || [])
          .filter((bu: any) => bu.profiles)
          .map((bu: any) => ({
            id: bu.profiles.id,
            trading_name: bu.profiles.trading_name,
            legal_name: bu.profiles.legal_name,
            supplier_status: bu.profiles.supplier_status,
            role: bu.role,
          }));

        setCompanies(formattedCompanies);
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [privyUser, ready]);

  const handleSelectCompany = (companyId: string) => {
    // You can store the selected company in localStorage or context if needed
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