'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { Building2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Business {
  id: string;
  legal_name: string | null;
  trading_name: string | null;
  logo_url: string | null;
  business_type: string | null;
  city: string | null;
  province: string | null;
}

interface BusinessMembership {
  profile_id: string | null;
}

function getCleanUserId(userId: string) {
  return userId.startsWith('privy:') ? userId.slice('privy:'.length) : userId;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unable to load your businesses right now.';
}

function getProfileIds(memberships: BusinessMembership[]) {
  return Array.from(new Set(memberships.map((membership) => membership.profile_id).filter(Boolean))) as string[];
}

function isSafeLogoUrl(logoUrl: string | null) {
  if (!logoUrl) {
    return false;
  }

  if (logoUrl.startsWith('/')) {
    return true;
  }

  try {
    const parsedUrl = new URL(logoUrl);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function Page() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.push('/');
      return;
    }

    const loadBusinesses = async () => {
      setLoading(true);
      setError('');

      try {
        const cleanId = getCleanUserId(user.id);
        let nextBusinesses: Business[] = [];

        const { data: memberships, error: membershipsError } = await supabase
          .from('business_users')
          .select('profile_id')
          .eq('user_id', cleanId);

        if (membershipsError) {
          throw membershipsError;
        }

        const profileIds = getProfileIds(memberships || []);

        if (profileIds.length > 0) {
          const { data: linkedProfiles, error: linkedProfilesError } = await supabase
            .from('profiles')
            .select('id, legal_name, trading_name, logo_url, business_type, city, province')
            .in('id', profileIds);

          if (linkedProfilesError) {
            throw linkedProfilesError;
          } else {
            nextBusinesses = linkedProfiles || [];
          }
        }

        if (nextBusinesses.length === 0) {
          const { data: ownedProfiles, error: ownedProfilesError } = await supabase
            .from('profiles')
            .select('id, legal_name, trading_name, logo_url, business_type, city, province')
            .eq('user_id', cleanId);

          if (ownedProfilesError) {
            throw ownedProfilesError;
          }

          nextBusinesses = ownedProfiles || [];
        }

        setBusinesses(nextBusinesses);
      } catch (loadError: unknown) {
        console.error('Select company load error:', loadError);
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    loadBusinesses();
  }, [ready, router, user]);

  const handleSelect = (business: Business) => {
    localStorage.setItem('selectedBusinessId', business.id);
    router.push(`/dashboard/profile?businessId=${business.id}`);
  };

  if (loading) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 md:px-12 py-12">
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-8 text-lg text-neutral-600">
          Loading your businesses...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 md:px-12 py-12">
      <div className="mb-8">
        <h1 className="font-black text-4xl md:text-5xl tracking-[-2px] text-[#00b4d8]">Select Your Company</h1>
        <p className="text-lg md:text-xl text-neutral-600 mt-3">
          Choose the business you want to manage in SupplierAdvisor.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-3xl p-6 mb-6">
          {error}
        </div>
      ) : null}

      {businesses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-8">
          <h2 className="text-2xl font-bold mb-3">No businesses found</h2>
          <p className="text-neutral-600 mb-6">
            We could not find a business linked to your account yet.
          </p>
          <button
            onClick={() => router.push('/onboarding')}
            className="inline-flex items-center justify-center rounded-3xl bg-[#00b4d8] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#0099b8]"
          >
            Complete onboarding
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {businesses.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => handleSelect(business)}
              className="bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-xl transition-all p-6 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {isSafeLogoUrl(business.logo_url) ? (
                    <img
                      src={business.logo_url || undefined}
                      alt={`Logo for ${business.trading_name || business.legal_name || business.id}`}
                      className="w-16 h-16 rounded-2xl object-cover border border-neutral-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-[#00b4d8]/10 text-[#00b4d8] flex items-center justify-center">
                      <Building2 className="w-8 h-8" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold truncate">
                      {business.trading_name || business.legal_name || 'Unnamed business'}
                    </h2>
                    {business.trading_name && business.legal_name && business.trading_name !== business.legal_name ? (
                      <p className="text-neutral-500 truncate">{business.legal_name}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {business.business_type ? (
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">
                          {business.business_type}
                        </span>
                      ) : null}
                      {business.city || business.province ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm">
                          {[business.city, business.province].filter(Boolean).join(', ')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-6 h-6 text-neutral-400 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
