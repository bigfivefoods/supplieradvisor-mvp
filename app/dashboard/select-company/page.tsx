'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SelectCompany() {
  const { user } = usePrivy();
  const router = useRouter();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('🔍 SelectCompany mounted - cleanId:', cleanId);

  useEffect(() => {
    const loadProfiles = async () => {
      console.log('🚀 loadProfiles started for cleanId:', cleanId);
      if (!cleanId) {
        console.log('❌ No cleanId found');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, legal_name, trading_name, logo_url, business_type')
        .eq('user_id', cleanId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading profiles:', error);
        toast.error('Failed to load your companies');
      } else {
        console.log('✅ Profiles loaded:', data?.length || 0, 'profiles', data);
        setProfiles(data || []);
      }
      setLoading(false);
    };

    loadProfiles();
  }, [cleanId]);

  const selectProfile = (profileId: string) => {
    console.log('👉 User clicked profile:', profileId);
    router.push(`/dashboard?profile_id=${profileId}`);
  };

  if (loading) {
    return (
      <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
        <Breadcrumb />
        <p className="text-xl text-slate-600">Loading your companies...</p>
      </div>
    );
  }

  if (profiles.length === 0) {
    console.log('⚠️ No profiles found for this user');
    return (
      <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
        <Breadcrumb />
        <p className="text-xl text-slate-600">No companies found. Please complete onboarding first.</p>
        <button 
          onClick={() => router.push('/onboarding')}
          className="mt-8 btn-primary"
        >
          Go to Onboarding
        </button>
      </div>
    );
  }

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-4">Select Company</h1>
      <p className="text-2xl text-slate-600 mb-12">You have multiple businesses. Choose which one to log into.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            onClick={() => selectProfile(profile.id)}
            className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8 hover:shadow-2xl hover:border-[#00b4d8] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-6">
              {profile.logo_url ? (
                <Image
                  src={profile.logo_url}
                  alt={profile.legal_name}
                  width={80}
                  height={80}
                  className="rounded-2xl object-contain border"
                />
              ) : (
                <div className="w-20 h-20 bg-[#00b4d8]/10 rounded-2xl flex items-center justify-center text-4xl font-black text-[#00b4d8]">
                  {(profile.legal_name || 'BFF').slice(0, 2)}
                </div>
              )}

              <div className="flex-1">
                <h3 className="font-black text-3xl tracking-tight group-hover:text-[#00b4d8]">
                  {profile.legal_name}
                </h3>
                {profile.trading_name && (
                  <p className="text-neutral-500 mt-1">{profile.trading_name}</p>
                )}
                {profile.business_type && (
                  <p className="text-xs bg-neutral-100 text-neutral-600 px-4 py-1 rounded-3xl inline-block mt-3">
                    {profile.business_type}
                  </p>
                )}
              </div>
            </div>

            <button className="mt-10 w-full py-5 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl font-semibold flex items-center justify-center gap-3 transition-all">
              Log in to this company <ArrowRight size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}