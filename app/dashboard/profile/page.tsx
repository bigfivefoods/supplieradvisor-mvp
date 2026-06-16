'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

function ProfileContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');

  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return;
      const { data: row } = await supabase.from('profiles').select('*').eq('id', Number(companyId)).single();
      if (row) setForm(row);
      setLoading(false);
    };
    loadData();
  }, [companyId]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      legal_name: form.legal_name,
      trading_name: form.trading_name,
      email: form.email,
      registration_number: form.registration_number,
      street: form.street,
      city: form.city,
      province: form.province,
      bank_name: form.bank_name,
      account_number: form.account_number,
      business_type: form.business_type,
      director_id_number: form.director_id_number,
    }).eq('id', Number(companyId));

    if (error) toast.error('Failed to save changes');
    else toast.success('Profile saved successfully!');
    setSaving(false);
  };

  // Call VerifyNow via our secure API route (PRODUCTION MODE)
  const callVerifyNow = async (idNumber: string) => {
    const response = await fetch('/api/verify-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: "consumer_trace",
        idNumber: idNumber,
        mode: "production"           // ← Real verification (uses credits)
      }),
    });

    const result = await response.json();
    console.log("VerifyNow Response:", result);

    if (!response.ok || result.error) {
      throw new Error(result.error || 'VerifyNow verification failed');
    }

    await supabase.from('profiles').update({
      verification_data: result,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
    }).eq('id', Number(companyId));

    return result;
  };

  // Pay R69 + Real VerifyNow
  const handleGetVerified = () => {
    if (!companyId || !form.email) {
      toast.error('Missing company ID or email');
      return;
    }

    setVerifying(true);

    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      toast.error('Paystack is still loading. Please refresh and try again.');
      setVerifying(false);
      return;
    }

    const handler = PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email: form.email,
      amount: 6900,
      currency: 'ZAR',
      ref: `verify_${companyId}_${Date.now()}`,
      metadata: {
        company_id: companyId,
        company_name: form.legal_name,
      },
      onClose: () => {
        setVerifying(false);
        toast.error('Payment cancelled');
      },
      callback: async function (response: any) {
        console.log('Paystack success:', response);

        try {
          await supabase.from('profiles').update({
            verification_status: 'verified',
            verified_at: new Date().toISOString(),
          }).eq('id', Number(companyId));

          const idToVerify = form.director_id_number || form.registration_number;
          if (idToVerify) {
            toast.loading('Verifying company with VerifyNow...', { id: 'verifynow' });
            await callVerifyNow(idToVerify);
            toast.success('Payment & Verification successful!', { id: 'verifynow' });
          } else {
            toast.success('Payment successful!');
          }

          setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
          console.error(err);
          toast.error(`Verification failed: ${err.message}`);
        } finally {
          setVerifying(false);
        }
      },
    });

    handler.openIframe();
  };

  if (loading) return <div className="p-12">Loading company data...</div>;

  const verificationStatus = form.verification_status || 'unverified';
  const badgeColor =
    verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
    verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-600';

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">{form.legal_name}</h1>
          <p className="text-xl text-neutral-600 mt-1">Selected Company ID: {companyId}</p>
        </div>

        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold ${badgeColor}`}>
          {verificationStatus === 'verified' && '✅ Verified'}
          {verificationStatus === 'pending' && '⏳ Pending Verification'}
          {verificationStatus === 'unverified' && '⚪ Unverified'}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium">Legal Name</label>
            <input className="input w-full mt-1" value={form.legal_name || ''} onChange={(e) => handleInputChange('legal_name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Trading Name</label>
            <input className="input w-full mt-1" value={form.trading_name || ''} onChange={(e) => handleInputChange('trading_name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input className="input w-full mt-1" value={form.email || ''} onChange={(e) => handleInputChange('email', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Registration Number</label>
            <input className="input w-full mt-1" value={form.registration_number || ''} onChange={(e) => handleInputChange('registration_number', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Director ID Number (for VerifyNow)</label>
            <input className="input w-full mt-1" value={form.director_id_number || ''} onChange={(e) => handleInputChange('director_id_number', e.target.value)} placeholder="e.g. 8001015009087" />
          </div>
          <div>
            <label className="text-sm font-medium">Street</label>
            <input className="input w-full mt-1" value={form.street || ''} onChange={(e) => handleInputChange('street', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">City</label>
            <input className="input w-full mt-1" value={form.city || ''} onChange={(e) => handleInputChange('city', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Province</label>
            <input className="input w-full mt-1" value={form.province || ''} onChange={(e) => handleInputChange('province', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Business Type</label>
            <input className="input w-full mt-1" value={form.business_type || ''} onChange={(e) => handleInputChange('business_type', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Bank Name</label>
            <input className="input w-full mt-1" value={form.bank_name || ''} onChange={(e) => handleInputChange('bank_name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Account Number</label>
            <input className="input w-full mt-1" value={form.account_number || ''} onChange={(e) => handleInputChange('account_number', e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
          <button onClick={saveProfile} disabled={saving} className="btn-primary px-8 py-3">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={handleGetVerified}
            disabled={verifying}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-semibold flex items-center gap-2 disabled:opacity-70"
          >
            {verifying ? 'Processing...' : 'Get Verified - R69 with Paystack + VerifyNow'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyBusinessProfile() {
  return (
    <Suspense fallback={<div className="p-12">Loading profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}