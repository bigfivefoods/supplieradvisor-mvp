'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

type Business = {
  id: string;
  legal_name: string;
  trading_name?: string;
  business_type?: string;
};

export default function SelectCompany() {
  const { user } = usePrivy();
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
      .select('id, legal_name, trading_name, business_type')
      .eq('user_id', cleanId);

    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      setBusinesses(data || []);
      toast.success(`Loaded ${data?.length || 0} companies`);
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Company (All loaded from Supabase)</h1>

      <div className="grid gap-4">
        {businesses.map(b => (
          <a 
            key={b.id}
            href={`/dashboard/profile?companyId=${b.id}`}
            className="block p-6 border rounded-xl hover:bg-gray-50 no-underline"
          >
            <h2 className="font-bold text-xl">{b.legal_name}</h2>
            <p className="text-neutral-600">{b.trading_name} - {b.business_type}</p>
            <button className="mt-3 bg-blue-600 text-white px-6 py-2 rounded">Select</button>
          </a>
        ))}
      </div>

      <button onClick={loadBusinesses} className="mt-6 bg-green-600 text-white px-6 py-2">Refresh List</button>
    </div>
  );
}