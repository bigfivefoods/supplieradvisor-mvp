'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Business = {
  id: string;
  legal_name: string;
  trading_name?: string;
  business_type?: string;
  suburb?: string;
  containerId?: string;
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
    const cleanId = user?.id.replace('privy:', '');

    const { data, error } = await supabase
      .from('business_profiles')
      .select('id, legal_name, trading_name, business_type, suburb')
      .eq('user_id', cleanId);

    if (error) {
      console.error(error);
      toast.error("Failed to load companies");
    } else {
      setBusinesses(data || []);
    }
    setLoading(false);
  };

  const handleSelect = (b: Business) => {
    router.push(`/dashboard/profile?companyId=${b.id}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Company (All loaded from Supabase)</h1>

      {loading && <p>Loading companies...</p>}

      <div className="grid gap-4">
        {businesses.map(b => (
          <div key={b.id} className="p-6 border rounded-xl cursor-pointer hover:bg-gray-50" onClick={() => handleSelect(b)}>
            <h2 className="font-bold">{b.legal_name}</h2>
            <p>{b.trading_name} - {b.business_type} - {b.suburb}</p>
            <button className="mt-3 bg-blue-600 text-white px-6 py-2 rounded">Select</button>
          </div>
        ))}
      </div>

      {businesses.length === 0 && !loading && (
        <p>No companies found. Create one in onboarding.</p>
      )}

      <button onClick={loadBusinesses} className="mt-6 bg-green-600 text-white px-6 py-2">Refresh List</button>
    </div>
  );
}