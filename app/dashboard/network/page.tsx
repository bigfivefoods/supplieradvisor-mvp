// app/dashboard/network/page.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { fetchUserCompanies } from './actions';

interface Company {
  id: number;
  role: string;
  status: string;
  joined_at: string;
  profiles: {
    id: number;
    trading_name: string;
    legal_name: string | null;
    registration_number: string | null;
    vat_number: string | null;
    tax_number: string | null;
    city: string | null;
    country: string | null;
    verification_status: string | null;
    logo_url: string | null;
  } | null;
}

export default function NetworkPage() {
  const { user, ready } = usePrivy();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!ready || !user?.id) return;

    startTransition(async () => {
      setLoading(true);
      setError(null);

      const result = await fetchUserCompanies(user.id);

      if (result.error) {
        setError(result.error);
      } else {
        setCompanies(result.companies || []);
      }
      setLoading(false);
    });
  }, [user?.id, ready]);

  if (!ready || loading || isPending) {
    return (
      <div className="p-8">
        <div className="animate-pulse text-gray-500">Loading your network...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Network</h1>
        <div className="text-sm text-gray-500">
          {companies.length} active {companies.length === 1 ? 'company' : 'companies'}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      {companies.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 p-8 rounded-2xl">
          <p className="font-medium mb-2">No active companies found.</p>
          <p className="text-sm text-gray-600">Privy ID: {user?.id}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => {
            const p = company.profiles;
            return (
              <div key={company.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">{p?.trading_name}</h3>
                    {p?.legal_name && <p className="text-sm text-gray-500 mt-0.5">{p.legal_name}</p>}
                  </div>
                  {p?.logo_url && (
                    <img src={p.logo_url} alt="" className="w-14 h-14 rounded-xl object-contain border p-1" />
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">Registration</span>
                    <span className="font-medium text-right">{p?.registration_number || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">VAT Number</span>
                    <span className="font-medium text-right">{p?.vat_number || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">Location</span>
                    <span className="font-medium text-right">
                      {[p?.city, p?.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Verification</span>
                    <span className="font-medium capitalize">{p?.verification_status || '—'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t text-xs flex justify-between text-gray-500">
                  <div>
                    Role: <span className="font-medium text-gray-700">{company.role}</span>
                  </div>
                  <div>
                    {company.joined_at ? new Date(company.joined_at).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}