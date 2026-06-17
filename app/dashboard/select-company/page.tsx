'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

type Business = {
  id: string;
  legal_name: string;
  trading_name?: string;
  business_type?: string;
  verification_status?: string;
  verified_at?: string;
};

export default function SelectCompany() {
  const { user } = usePrivy();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadBusinesses();
  }, [user]);

  const loadBusinesses = async () => {
    setLoading(true);
    const cleanId = 'did:cmmkfe47g012f0djolmvhx6x3';

    const { data, error } = await supabase
      .from('profiles')
      .select('id, legal_name, trading_name, business_type, verification_status, verified_at')
      .eq('user_id', cleanId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load companies");
    } else {
      setBusinesses(data || []);
    }
    setLoading(false);
  };

  const handleSelect = (b: Business) => {
    // Save to localStorage so Profile & Team pages work smoothly
    localStorage.setItem('selectedCompanyId', b.id);

    // ✅ Correct new path
    router.push(`/dashboard/my-business/profile?companyId=${b.id}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Company</h1>

      {loading ? (
        <p>Loading companies...</p>
      ) : businesses.length === 0 ? (
        <p>No companies found. Create one in onboarding.</p>
      ) : (
        <div className="grid gap-4">
          {businesses.map(b => (
            <div 
              key={b.id} 
              className="p-6 border rounded-xl cursor-pointer hover:bg-gray-50 flex justify-between items-center"
              onClick={() => handleSelect(b)}
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-xl">{b.legal_name}</h2>
                  {b.verification_status === 'verified' && (
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
                      ✅ Verified
                    </span>
                  )}
                </div>
                <p className="text-neutral-600">{b.trading_name} • {b.business_type}</p>
                {b.verified_at && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Verified on {new Date(b.verified_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button className="bg-blue-600 text-white px-6 py-2 rounded">Select</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={loadBusinesses} className="mt-6 bg-green-600 text-white px-6 py-2 rounded">
        Refresh List
      </button>
    </div>
  );
}