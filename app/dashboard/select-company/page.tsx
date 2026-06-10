'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Building2 } from 'lucide-react';

interface Business {
  id: string;
  user_id: string;
  legal_name: string;
  trading_name?: string;
  business_type?: string;
  country?: string;
  province?: string;
  city?: string;
  verification_status?: string;
  updated_at?: string;
  created_at?: string;
}

export default function SelectCompany() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const cleanId = (user?.id || '').replace('privy:', '');

  useEffect(() => {
    if (ready && cleanId) {
      loadBusinesses();
    }
  }, [ready, cleanId]);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      // Load all profiles for this user, ordered by most recent first
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, legal_name, trading_name, business_type, country, province, city, verification_status, updated_at, created_at')
        .eq('user_id', cleanId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Deduplicate: keep only the most recent profile per user_id (should normally be one per user)
      const seen = new Set<string>();
      const unique: Business[] = [];
      for (const b of (data || [])) {
        if (!seen.has(b.user_id)) {
          seen.add(b.user_id);
          unique.push(b);
        }
      }
      setBusinesses(unique);
    } catch (err) {
      console.error('Error loading businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (business: Business) => {
    localStorage.setItem('selectedBusinessId', business.id);
    router.push(`/dashboard/profile?businessId=${business.id}`);
  };

  if (!ready || loading) {
    return <div className="p-8 flex items-center justify-center text-neutral-500">Loading your businesses...</div>;
  }

  if (businesses.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Select Your Company</h1>
        <div className="text-center py-20 text-neutral-400">
          <Building2 size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg">No company profile found.</p>
          <button onClick={() => router.push('/onboarding')} className="mt-6 btn-primary px-8 py-3">
            Create Your Business Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Select Your Company</h1>
      <p className="text-neutral-500 mb-8">Choose a business profile to continue.</p>
      <div className="space-y-4">
        {businesses.map((business) => (
          <div
            key={business.id}
            className="p-6 border border-neutral-200 rounded-2xl cursor-pointer hover:border-[#00b4d8] hover:bg-blue-50 transition-all flex items-center justify-between"
            onClick={() => handleSelect(business)}
          >
            <div>
              <h2 className="font-semibold text-lg">{business.legal_name || '(Unnamed)'}</h2>
              {business.trading_name && (
                <p className="text-sm text-neutral-500">Trading as: {business.trading_name}</p>
              )}
              <p className="text-sm text-neutral-400 mt-1">
                {[business.business_type, business.city, business.province, business.country]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {business.verification_status === 'verified' && (
              <div className="flex items-center gap-1 text-emerald-600 font-medium text-sm bg-emerald-50 px-3 py-1 rounded-full">
                <ShieldCheck size={16} /> Verified
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
