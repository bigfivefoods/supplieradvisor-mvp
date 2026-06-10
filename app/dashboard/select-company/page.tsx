'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Breadcrumb from '@/components/ui/Breadcrumb';
import toast from 'react-hot-toast';

type Company = {
  profile_id: string;
  legal_name: string;
  trading_name: string;
  logo_url: string | null;
  verified_at: string | null;
  sbt_token_id: string | null;
};

export default function SelectCompany() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !cleanId) return;

    const fetchCompanies = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('business_users')
        .select(`
          profile_id,
          profiles!inner (
            legal_name,
            trading_name,
            logo_url,
            verified_at,
            sbt_token_id
          )
        `)
        .eq('user_id', cleanId);

      if (error) {
        console.error('Error fetching companies:', error);
        setLoading(false);
        return;
      }

      // Properly map and deduplicate
      const mapped: Company[] = (data || []).map((item: any) => ({
        profile_id: item.profile_id,
        legal_name: item.profiles.legal_name,
        trading_name: item.profiles.trading_name,
        logo_url: item.profiles.logo_url,
        verified_at: item.profiles.verified_at,
        sbt_token_id: item.profiles.sbt_token_id,
      }));

      // Remove duplicates (in case of multiple roles per company)
      const unique = Array.from(
        new Map(mapped.map(item => [item.profile_id, item])).values()
      );

      setCompanies(unique);
      setLoading(false);

      // Auto-redirect if only one company
      if (unique.length === 1) {
        localStorage.setItem('selected_company_id', unique[0].profile_id);
        router.push('/dashboard/profile');
      }
    };

    fetchCompanies();
  }, [cleanId, ready, router]);

  const selectCompany = (profileId: string) => {
    localStorage.setItem('selected_company_id', profileId);
    toast.success('Company selected');
    router.push('/dashboard/profile');
  };

  if (loading) {
    return (
      <div className="pl-0 pr-12 py-12 min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-xl font-medium">Loading your companies...</div>
      </div>
    );
  }

  return (
    <div className="pl-0 pr-12 py-12 min-h-screen bg-[#f8fafc]">
      <Breadcrumb />
      <div className="max-w-2xl mx-auto">
        <h1 className="font-black text-5xl tracking-tight text-[#00b4d8] mb-2">Select Company</h1>
        <p className="text-xl text-neutral-600 mb-12">Choose which company you want to log into</p>

        {companies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {companies.map((company) => (
              <div
                key={company.profile_id}
                onClick={() => selectCompany(company.profile_id)}
                className="card p-8 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div>
                  {company.logo_url && (
                    <Image 
                      src={company.logo_url} 
                      alt={company.legal_name} 
                      width={64} 
                      height={64} 
                      className="rounded-2xl mb-6" 
                    />
                  )}
                  <div className="text-2xl font-bold mb-1">{company.legal_name}</div>
                  <div className="text-slate-500 mb-6">{company.trading_name}</div>
                </div>

                {company.verified_at && (
                  <div className="inline-flex items-center gap-2 text-emerald-600 font-medium text-sm">
                    <ShieldCheck size={18} />
                    Verified on Polygon
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-6">No companies linked to your account yet.</p>
            <button 
              onClick={() => router.push('/onboarding')} 
              className="btn-primary"
            >
              Create Your First Company
            </button>
          </div>
        )}
      </div>
    </div>
  );
}