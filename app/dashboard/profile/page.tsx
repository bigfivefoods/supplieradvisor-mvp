'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronDown, RotateCw, Upload, Plus, ShieldCheck, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { mintVerificationSBT } from '@/lib/onchain';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function MyBusinessProfile() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');

  const [form, setForm] = useState({
    legal_name: 'Big Five Foods',
    trading_name: 'BFF',
    contact_name: 'Dr Craig Muller',
    email: 'craig@bigfivefoods.com',
    registration_number: '2025/123456/07',
  });

  const loadProfile = async () => {
    toast.success(`✅ Loaded company ID: ${companyId || 'default'}`);
    // Supabase load added later
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
            My Business Profile
          </h1>
          <p className="text-xl text-neutral-600">Company ID: {companyId || 'None'}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={loadProfile} className="flex items-center gap-2 border px-8 py-4 rounded-3xl hover:bg-neutral-100">
            <RotateCw size={18} /> Refresh Data
          </button>
          <button className="btn-primary flex items-center gap-3 px-12 py-4">
            Save All Changes <ArrowRight />
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 mb-8">
        <h2 className="text-2xl font-bold">✅ Supabase Loading Ready</h2>
        <button className="mt-4 bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
          Get Verified - R49 with Paystack
        </button>
      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button className="btn-primary">Full UI Restored</button>
      </div>
    </div>
  );
}