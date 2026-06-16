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
    }).eq('id', Number(companyId));

    if (error) toast.error('Failed to save changes');
    else toast.success('Profile saved successfully!');
    setSaving(false);
  };

  // Call VerifyNow via our secure API route
  const callVerifyNow = async (regNumber: string) => {
    const response = await fetch('/api/verify-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: "company_verification",
        registrationNumber: regNumber,
        mode: "production"
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'VerifyNow verification failed');
    }

    // Store result in Supabase
    await supabase.from('profiles').update({
      verification_data: result,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
    }).eq('id', Number(companyId));

    return result;
  };

  // Paystack + VerifyNow
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

          if (form.registration_number) {
            toast.loading('Verifying with VerifyNow...', { id: 'verifynow' });
            await callVerifyNow(form.registration_number);
            toast.success('Verified with VerifyNow!', { id: 'verifynow' });
          } else {
            toast.success('Payment successful!');
          }

          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          console.error(err);
          toast.error('Payment succeeded but verification failed.');
        } finally {
          setVerifying(false);
        }
      },
    });

    handler.openIframe();
  };

  // Test VerifyNow Only (No Payment)
  const handleTestVerifyNow = async () => {
    if (!form.registration_number) {
      toast.error('No registration number found');
      return;
    }

    setVerifying(true);
    toast.loading('Testing VerifyNow...', { id: 'test-verifynow' });

    try {
      await callVerifyNow(form.registration_number);
      toast.success('VerifyNow test successful!', { id: 'test-verifynow' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(`VerifyNow failed: ${err.message}`, { id: 'test-verifynow' });
    } finally {
      setVerifying(false);
    }
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
          {/* All input fields - same as before */}
          <div><label className="text-sm font-medium">Legal Name</label>
            <input className="input w-full mt-1" value={form.legal_name || ''} onChange={(e) => handleInputChange('legal_name', e.target.value)} /></div>
          {/* Add other fields as needed */}
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

          <button
            onClick={handleTestVerifyNow}
            disabled={verifying}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-semibold flex items-center gap-2 disabled:opacity-70"
          >
            {verifying ? 'Processing...' : 'Test VerifyNow Only (No Payment)'}
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