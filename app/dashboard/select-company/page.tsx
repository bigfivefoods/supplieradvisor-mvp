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
  suburb?: string;
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

    const { data } = await supabase
      .from('profiles')
      .select('id, legal_name, trading_name, business_type, suburb')
      .eq('user_id', cleanId);

    setBusinesses(data || []);
    setLoading(false);
  };

  const handleSelect = (b: Business) => {
    router.push(`/dashboard/profile?companyId=${b.id}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Company (All loaded from Supabase)</h1>

      <div className="grid gap-4">
        {businesses.map(b => (
          <div key={b.id} className="p-6 border rounded-xl cursor-pointer hover:bg-gray-50" onClick={() => handleSelect(b)}>
            <h2 className="font-bold">{b.legal_name}</h2>
            <p>{b.trading_name} - {b.business_type}</p>
            <button className="mt-3 bg-blue-600 text-white px-6 py-2 rounded">Select</button>
          </div>
        ))}
      </div>

      <button onClick={loadBusinesses} className="mt-6 bg-green-600 text-white px-6 py-2">Refresh List</button>
    </div>
  );
}