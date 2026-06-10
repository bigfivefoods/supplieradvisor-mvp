'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface BusinessProfile {
  id: number;
  user_id: string;
  legal_name: string;
  trading_name: string | null;
  logo_url: string | null;
}

export default function SelectCompanyPage() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !cleanId) return;

    const loadBusinesses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, legal_name, trading_name, logo_url')
        .eq('user_id', cleanId);
      if (error) {
        toast.error('Failed to load your companies');
      } else {
        setBusinesses(data || []);
      }
      setLoading(false);
    };

    loadBusinesses();
  }, [ready, cleanId]);

  const handleSelect = (business: BusinessProfile) => {
    // Store selected profile id in localStorage for downstream use
    localStorage.setItem('selected_profile_id', String(business.id));
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-2xl text-slate-500">Loading your companies…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-16 space-y-10">
      <div>
        <h1 className="text-5xl font-black tracking-tighter text-[#00b4d8]">Select a Company</h1>
        <p className="text-xl text-slate-500 mt-3">You have multiple business profiles. Choose one to continue.</p>
      </div>

      <div className="space-y-4">
        {businesses.map((business) => (
          <button
            key={business.id}
            onClick={() => handleSelect(business)}
            className="w-full flex items-center gap-6 bg-white rounded-3xl shadow-sm border border-neutral-100 p-6 hover:border-[#00b4d8] hover:shadow-md transition-all text-left"
          >
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.legal_name}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#e0f7fa] flex items-center justify-center flex-shrink-0">
                <Building2 size={28} className="text-[#00b4d8]" />
              </div>
            )}
            <div>
              <div className="text-xl font-bold">{business.legal_name}</div>
              {business.trading_name && (
                <div className="text-slate-500 mt-1">{business.trading_name}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
