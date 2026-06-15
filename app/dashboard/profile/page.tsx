'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function MyBusinessProfile() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');

  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      let query = supabase.from('profiles').select('*').eq('user_id', cleanId);
      if (companyId) query = query.eq('id', companyId);

      const { data } = await query.single();

      if (data) {
        setForm(data);
        toast.success(`✅ Loaded all fields from Supabase`);
      }
    } catch (e) {
      toast.error("Failed to load");
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = { ...form, user_id: cleanId, updated_at: new Date().toISOString() } as any;
      if (companyId) payload.id = companyId;

      const { error } = await supabase.from('profiles').upsert(payload);

      if (error) throw error;
      toast.success("✅ Saved to Supabase – all fields updated");
      loadProfile();
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [companyId]);

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
          {form.legal_name || 'My Business Profile'}
        </h1>
        <div className="flex gap-4">
          <button onClick={loadProfile} className="flex items-center gap-2 border px-8 py-4 rounded-3xl hover:bg-neutral-100">
            <RotateCw size={18} /> Refresh
          </button>
          <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-3 px-12 py-4">
            {saving ? 'Saving...' : 'Save All Changes to Supabase'} <ArrowRight />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 grid grid-cols-2 gap-6">
        {Object.keys(form).map(key => (
          <div key={key}>
            <label className="block text-sm font-medium">{key}</label>
            <input 
              value={form[key] || ''} 
              onChange={e => setForm(p => ({...p, [key]: e.target.value}))}
              className="input w-full"
            />
          </div>
        ))}
      </div>

      <button className="mt-8 bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
        Get Verified - R69 with Paystack
      </button>
    </div>
  );
}