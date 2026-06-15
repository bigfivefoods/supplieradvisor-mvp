'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface ProfileData {
  legal_name?: string;
  trading_name?: string;
  contact_name?: string;
  email?: string;
  registration_number?: string;
  street?: string;
  city?: string;
  province?: string;
  country?: string;
  bank_name?: string;
  account_number?: string;
  [key: string]: any;
}

export default function MyBusinessProfile() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');

  const [form, setForm] = useState<ProfileData>({
    legal_name: 'Big Five Foods',
    trading_name: 'BFF',
    contact_name: 'Dr Craig Muller',
    email: 'craig@bigfivefoods.com',
    registration_number: '2025/123456/07',
    street: '21A Old Howick Road',
    city: 'Pietermaritzburg',
    province: 'KwaZulu-Natal',
    country: 'South Africa',
    bank_name: 'FNB',
    account_number: '63156727625',
  });

  const loadProfile = async () => {
    try {
      let query = supabase.from('profiles').select('*').eq('user_id', cleanId);
      if (companyId) query = query.eq('id', companyId);

      const { data } = await query.single();

      if (data) {
        setForm(data);
        toast.success(`✅ Loaded all fields for ${data.legal_name || 'Company'}`);
      } else {
        toast.success("No data – using defaults");
      }
    } catch (e) {
      toast.error("Failed to load");
    }
  };

  useEffect(() => {
    loadProfile();
  }, [companyId]);

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
            {form.legal_name || 'My Business Profile'}
          </h1>
          <p className="text-xl text-neutral-600">Company ID: {companyId || 'None'} • ALL onboarding fields loaded</p>
        </div>
        <button onClick={loadProfile} className="flex items-center gap-2 border px-8 py-4 rounded-3xl hover:bg-neutral-100">
          <RotateCw size={18} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-3xl p-8 space-y-8">
        <pre className="bg-neutral-100 p-4 rounded text-sm overflow-auto">{JSON.stringify(form, null, 2)}</pre>

        <div className="grid grid-cols-2 gap-4">
          <input value={form.legal_name || ''} className="input w-full" placeholder="Legal Name" />
          <input value={form.trading_name || ''} className="input w-full" placeholder="Trading Name" />
          <input value={form.email || ''} className="input w-full" placeholder="Email" />
          <input value={form.registration_number || ''} className="input w-full" placeholder="Registration" />
          <input value={form.street || ''} className="input w-full" placeholder="Street" />
          <input value={form.city || ''} className="input w-full" placeholder="City" />
          <input value={form.province || ''} className="input w-full" placeholder="Province" />
          <input value={form.country || ''} className="input w-full" placeholder="Country" />
          <input value={form.bank_name || ''} className="input w-full" placeholder="Bank" />
          <input value={form.account_number || ''} className="input w-full" placeholder="Account Number" />
        </div>

        <button className="bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
          Get Verified - R49 with Paystack
        </button>
      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button className="btn-primary">Save All Changes to Supabase</button>
      </div>
    </div>
  );
}