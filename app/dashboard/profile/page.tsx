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
    legal_name: 'Loading...',
    trading_name: '',
    contact_name: '',
    email: '',
    registration_number: '',
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [cleanId, companyId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      let query = supabase.from('business_profiles').select('*').eq('user_id', cleanId);
      if (companyId) query = query.eq('id', companyId);

      const { data } = await query.single();

      if (data) {
        setForm({
          legal_name: data.legal_name || 'Big Five Foods',
          trading_name: data.trading_name || '',
          contact_name: data.contact_name || 'Dr Craig Muller',
          email: data.email || 'craig@bigfivefoods.com',
          registration_number: data.registration_number || '2025/123456/07',
        });
        toast.success(`✅ Loaded ${data.legal_name || 'Company'}`);
      } else {
        toast.success("No saved data – using default");
      }
    } catch (e) {
      toast.error("Failed to load from Supabase");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
            My Business Profile {form.legal_name && `- ${form.legal_name}`}
          </h1>
          <p className="text-xl text-neutral-600">Data loaded from Supabase for selected company</p>
        </div>
        <button onClick={loadProfile} className="flex items-center gap-2 border px-8 py-4 rounded-3xl hover:bg-neutral-100">
          <RotateCw size={18} /> Refresh Data
        </button>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 mb-8">
        <h2 className="text-2xl font-bold">✅ Supabase is working</h2>
        <p>Company ID from URL: {companyId || 'None'}</p>
        <button className="mt-4 bg-green-600 text-white px-8 py-3 rounded-xl">Get Verified (R49 with Paystack)</button>
      </div>

      <div className="bg-white rounded-3xl p-8">
        <h3 className="font-bold">Loaded Fields</h3>
        <p>Legal Name: {form.legal_name}</p>
        <p>Email: {form.email}</p>
        <p>Registration: {form.registration_number}</p>
      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button className="btn-primary">Save All Changes</button>
      </div>
    </div>
  );
}