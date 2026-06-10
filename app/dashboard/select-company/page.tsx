// Updated Select Company page with proper user-business filtering
'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SelectCompany() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && user) {
      loadUserBusinesses();
    }
  }, [ready, user]);

  const loadUserBusinesses = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('business_users')
      .select(`*, business: businesses(*)`)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (error) console.error(error);
    setBusinesses(data || []);
    setLoading(false);

    // If only one business, auto-select and redirect
    if (data && data.length === 1) {
      handleSelectBusiness(data[0].business);
    }
  };

  const handleSelectBusiness = async (business) => {
    // Store selected business ID in localStorage or Supabase user metadata
    localStorage.setItem('selectedBusinessId', business.id);
    // Optionally update user session
    router.push(`/dashboard/profile?businessId=${business.id}`);
  };

  if (loading) return <div>Loading your businesses...</div>;

  if (businesses.length === 0) {
    return <div>No businesses found. Please register one.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Company</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {businesses.map((item) => (
          <div key={item.business.id} className="border p-6 rounded-xl cursor-pointer hover:shadow-md" onClick={() => handleSelectBusiness(item.business)}>
            <h2 className="text-xl font-semibold">{item.business.name}</h2>
            <p className="text-gray-600">{item.business.type} • {item.business.suburb || 'No location'}</p>
            <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg">Select</button>
          </div>
        ))}
      </div>
    </div>
  );
}
