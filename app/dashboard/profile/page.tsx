'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { mintVerificationSBT } from '@/lib/onchain';
import toast from 'react-hot-toast';

function ProfileContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');

  const [form, setForm] = useState<any>({});
  const [originalData, setOriginalData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Load company data
  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return;

      const { data: row } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', Number(companyId))
        .single();

      if (row) {
        setForm(row);
        setOriginalData(row);
      }
      setLoading(false);
    };

    loadData();
  }, [companyId]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  // Save changes to Supabase
  const saveProfile = async () => {
    if (!companyId) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
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
      })
      .eq('id', Number(companyId));

    if (error) {
      toast.error('Failed to save changes');
    } else {
      toast.success('Profile saved successfully!');
      setOriginalData(form);
    }
    setSaving(false);
  };

  // Paystack + Verification flow
  const handleGetVerified = () => {
    if (!companyId || !form.email) {
      toast.error('Missing company ID or email');
      return;
    }

    setVerifying(true);

    // @ts-ignore - Paystack is loaded globally
    const handler = window.PaystackPop?.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_your_key_here',
      email: form.email,
      amount: 4900, // R49 in cents
      currency: 'ZAR',
      ref: `verify_${companyId}_${Date.now()}`,
      metadata: {
        company_id: companyId,
        company_name: form.legal_name,
      },
      onClose: () => {
        setVerifying(false);
      },
      callback: async function (response: any) {
        // Payment successful
        toast.success('Payment successful! Verifying company...');

        // Update Supabase
        await supabase
          .from('profiles')
          .update({
            verification_status: 'verified',
            verified_at: new Date().toISOString(),
          })
          .eq('id', Number(companyId));

        // Mint on-chain SBT (if function exists)
        try {
          await mintVerificationSBT(companyId, form.legal_name);
        } catch (e) {
          console.log('On-chain mint skipped or failed (non-critical)');
        }

        toast.success('🎉 Company verified successfully!');
        setVerifying(false);

        // Refresh data
        window.location.reload();
      },
    });

    handler.openIframe();
  };

  if (loading) return <div className="p-12">Loading company data...</div>;

  const verificationStatus = form.verification_status || 'unverified';
  const badgeColor =
    verificationStatus === 'verified'
      ? 'bg-emerald-100 text-emerald-700'
      : verificationStatus === 'pending'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-600';

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
            {form.legal_name}
          </h1>
          <p className="text-xl text-neutral-600 mt-1">
            Selected Company ID: {companyId}
          </p>
        </div>

        {/* Verification Badge */}
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold ${badgeColor}`}>
          {verificationStatus === 'verified' && '✅ Verified'}
          {verificationStatus === 'pending' && '⏳ Pending Verification'}
          {verificationStatus === 'unverified' && '⚪ Unverified'}
        </div>
      </div>

      {/* Editable Form */}
      <div className="bg-white rounded-3xl p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium">Legal Name</label>
            <input
              className="input w-full mt-1"
              value={form.legal_name || ''}
              onChange={(e) => handleInputChange('legal_name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Trading Name</label>
            <input
              className="input w-full mt-1"
              value={form.trading_name || ''}
              onChange={(e) => handleInputChange('trading_name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="input w-full mt-1"
              value={form.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Registration Number</label>
            <input
              className="input w-full mt-1"
              value={form.registration_number || ''}
              onChange={(e) => handleInputChange('registration_number', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Street</label>
            <input
              className="input w-full mt-1"
              value={form.street || ''}
              onChange={(e) => handleInputChange('street', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">City</label>
            <input
              className="input w-full mt-1"
              value={form.city || ''}
              onChange={(e) => handleInputChange('city', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Province</label>
            <input
              className="input w-full mt-1"
              value={form.province || ''}
              onChange={(e) => handleInputChange('province', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Business Type</label>
            <input
              className="input w-full mt-1"
              value={form.business_type || ''}
              onChange={(e) => handleInputChange('business_type', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Bank Name</label>
            <input
              className="input w-full mt-1"
              value={form.bank_name || ''}
              onChange={(e) => handleInputChange('bank_name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Account Number</label>
            <input
              className="input w-full mt-1"
              value={form.account_number || ''}
              onChange={(e) => handleInputChange('account_number', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary px-8 py-3"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={handleGetVerified}
            disabled={verifying}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-semibold flex items-center gap-2 disabled:opacity-70"
          >
            {verifying ? 'Processing...' : 'Get Verified - R49 with Paystack'}
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