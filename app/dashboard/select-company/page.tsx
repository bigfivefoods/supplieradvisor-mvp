'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { getAssociatedBusinesses } from '@/lib/business-associations';

interface Business {
  id: string;
  name: string;
  type?: string;
  suburb?: string;
  logoUrl?: string | null;
}

export default function SelectCompany() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      setBusinesses([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadBusinesses = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const { businesses: associatedBusinesses } = await getAssociatedBusinesses(user);

        if (cancelled) return;

        setBusinesses(
          associatedBusinesses.map(business => ({
            id: business.id,
            name: business.trading_name || business.legal_name || 'Untitled Company',
            type: business.business_type || undefined,
            suburb: [business.city, business.province].filter(Boolean).join(', ') || undefined,
            logoUrl: business.logo_url || null
          }))
        );
      } catch (error) {
        console.error('Error fetching companies:', error);

        if (!cancelled) {
          setErrorMessage('We could not load your companies right now.');
          setBusinesses([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadBusinesses();

    return () => {
      cancelled = true;
    };
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
      {errorMessage ? <p className="mb-4 text-sm text-red-600">{errorMessage}</p> : null}
      {businesses.length === 0 ? (
        <p className="text-gray-600">No companies are linked to your account yet. Complete onboarding to add one.</p>
      ) : (
        <div className="space-y-4">
          {businesses.map((business) => (
            <div key={business.id} className="p-6 border rounded-2xl cursor-pointer hover:bg-gray-50" onClick={() => handleSelect(business)}>
              <h2 className="font-semibold">{business.name}</h2>
              <p className="text-sm text-gray-600">{[business.type, business.suburb].filter(Boolean).join(' • ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
