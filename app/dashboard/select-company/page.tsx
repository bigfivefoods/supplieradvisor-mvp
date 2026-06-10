'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

// Simple interface - adjust based on your schema
interface Business {
  id: string;
  name: string;
  type?: string;
  suburb?: string;
}

export default function SelectCompany() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && user) {
      // TODO: Replace with your actual Supabase query logic from other pages
      // For now, placeholder logic
      console.log('Loading businesses for user', user.id);
      // Simulate data for testing
      setBusinesses([
        { id: '1', name: 'Test Container Spaza', type: 'ContainerSpaza', suburb: 'Umlazi' }
      ]);
      setLoading(false);
    }
  }, [ready, user]);

  const handleSelect = (business: Business) => {
    localStorage.setItem('selectedBusinessId', business.id);
    router.push(`/dashboard/profile?businessId=${business.id}`);
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center">Loading your businesses...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Company</h1>
      <div className="space-y-4">
        {businesses.map((business) => (
          <div key={business.id} className="p-6 border rounded-2xl cursor-pointer hover:bg-gray-50" onClick={() => handleSelect(business)}>
            <h2 className="font-semibold">{business.name}</h2>
            <p className="text-sm text-gray-600">{business.type} - {business.suburb}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
