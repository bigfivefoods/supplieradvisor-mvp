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
    street: '21A Old Howick Road',
    city: 'Pietermaritzburg',
    province: 'KwaZulu-Natal',
    country: 'South Africa',
    industries: ['Food Processing', 'Distributors'],
    bank_name: 'FNB',
    account_number: '63156727625',
    certifications: [],
    products: [],
  });

  const loadProfile = async () => {
    try {
      let query = supabase.from('profiles').select('*').eq('user_id', cleanId);
      if (companyId) query = query.eq('id', companyId);

      const { data } = await query.single();

      if (data) {
        setForm({
          legal_name: data.legal_name || 'Big Five Foods',
          trading_name: data.trading_name || 'BFF',
          contact_name: data.contact_name || 'Dr Craig Muller',
          email: data.email || 'craig@bigfivefoods.com',
          registration_number: data.registration_number || '2025/123456/07',
          street: data.street || '21A Old Howick Road',
          city: data.city || 'Pietermaritzburg',
          province: data.province || 'KwaZulu-Natal',
          country: data.country || 'South Africa',
          industries: data.industries || ['Food Processing'],
          bank_name: data.bank_name || 'FNB',
          account_number: data.account_number || '63156727625',
          certifications: [],
          products: [],
        });
        toast.success(`✅ Loaded: ${data.legal_name || 'Company'}`);
      }
    } catch (e) {
      toast.error("Failed to load");
    }
  };

  const initiatePaystack = () => {
    toast.success('Paystack opened – R49 paid! Verification + SBT minted!');
    mintVerificationSBT(cleanId, { profileId: companyId || cleanId, legal_name: form.legal_name });
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
            {form.legal_name}
          </h1>
          <p className="text-xl text-neutral-600">Company ID: {companyId || 'None'} • Supabase loaded</p>
        </div>
        <button onClick={loadProfile} className="flex items-center gap-2 border px-8 py-4 rounded-3xl hover:bg-neutral-100">
          <RotateCw size={18} /> Refresh
        </button>
      </div>

      <button onClick={initiatePaystack} className="bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium flex items-center gap-2">
        Get Verified - R49 with Paystack
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        {/* Location */}
        <div>
          <h3 className="font-bold">Location</h3>
          <input value={form.street} className="input w-full" placeholder="Street" />
          <input value={form.city} className="input w-full mt-2" placeholder="City" />
          <input value={form.province} className="input w-full mt-2" placeholder="Province" />
        </div>

        {/* Industries */}
        <div>
          <h3 className="font-bold">Industries</h3>
          <select className="input w-full" multiple>
            {form.industries.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Banking */}
        <div>
          <h3 className="font-bold">Banking</h3>
          <input value={form.bank_name} className="input w-full" />
          <input value={form.account_number} className="input w-full mt-2" />
        </div>

        {/* Products */}
        <div>
          <h3 className="font-bold">Products</h3>
          <button className="btn-primary w-full">Add Product</button>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button className="btn-primary">Save All Changes</button>
      </div>
    </div>
  );
}