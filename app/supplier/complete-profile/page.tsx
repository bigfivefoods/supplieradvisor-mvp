'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { CheckCircle } from 'lucide-react';

function CompleteProfileContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    contact_name: '',
    contact_number: '',
    country: '',
    city: '',
    short_description: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        ...form,
        supplier_status: 'active',
        invite_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('invite_token', token);

    if (error) {
      toast.error('Failed to complete profile');
      console.error(error);
    } else {
      setSuccess(true);
      toast.success('Profile activated successfully!');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-9 h-9 text-emerald-600" />
        </div>
        <h1 className="font-black text-3xl">Profile Activated</h1>
        <p className="text-neutral-600 mt-3">Thank you. You can now receive purchase orders.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <h1 className="font-black text-3xl tracking-tight mb-2">Complete Your Profile</h1>
      <p className="text-neutral-600 mb-8">Just a few quick details to activate your account.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-sm font-medium">Contact Person</label>
          <input className="input w-full mt-1" value={form.contact_name} onChange={e => handleChange('contact_name', e.target.value)} required />
        </div>

        <div>
          <label className="text-sm font-medium">Contact Number</label>
          <input className="input w-full mt-1" value={form.contact_number} onChange={e => handleChange('contact_number', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Country</label>
            <input className="input w-full mt-1" value={form.country} onChange={e => handleChange('country', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">City</label>
            <input className="input w-full mt-1" value={form.city} onChange={e => handleChange('city', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">What do you supply? (Optional)</label>
          <textarea className="input w-full h-20 mt-1" value={form.short_description} onChange={e => handleChange('short_description', e.target.value)} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-lg mt-4">
          {loading ? 'Activating...' : 'Activate My Account'}
        </button>
      </form>
    </div>
  );
}

export default function SupplierCompleteProfile() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20">Loading...</div>}>
      <CompleteProfileContent />
    </Suspense>
  );
}