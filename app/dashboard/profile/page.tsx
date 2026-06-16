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

  // Lookup data from Supabase
  const [industries, setIndustries] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [businessTypes, setBusinessTypes] = useState<any[]>([]);

  // Selected country ID (for loading provinces)
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);

  // Load company data + lookup tables
  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return;

      const { data: row } = await supabase.from('profiles').select('*').eq('id', Number(companyId)).single();
      if (row) {
        setForm(row);

        // If country already exists, find its ID
        if (row.country) {
          const { data: countryData } = await supabase
            .from('countries')
            .select('id')
            .eq('name', row.country)
            .single();

          if (countryData) setSelectedCountryId(countryData.id);
        }
      }

      // Load lookup tables
      const [indRes, countryRes, btRes] = await Promise.all([
        supabase.from('industries').select('id, name, parent_id').eq('is_active', true).order('name'),
        supabase.from('countries').select('id, name, flag').order('name'),
        supabase.from('business_types').select('id, name').order('name')
      ]);

      if (indRes.data) setIndustries(indRes.data);
      if (countryRes.data) setCountries(countryRes.data);
      if (btRes.data) setBusinessTypes(btRes.data);

      setLoading(false);
    };

    loadData();
  }, [companyId]);

  // Load provinces when selectedCountryId changes
  useEffect(() => {
    const loadProvinces = async () => {
      if (!selectedCountryId) {
        setProvinces([]);
        return;
      }

      const { data } = await supabase
        .from('provinces')
        .select('id, name')
        .eq('country_id', selectedCountryId)
        .order('name');

      setProvinces(data || []);
    };

    loadProvinces();
  }, [selectedCountryId]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  // Handle country change (store both name and ID)
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const countryName = e.target.value;
    const selectedCountry = countries.find(c => c.name === countryName);

    setForm((prev: any) => ({ ...prev, country: countryName, province: '' }));
    setSelectedCountryId(selectedCountry ? selectedCountry.id : null);
  };

  const saveProfile = async () => {
    if (!companyId) return;
    setSaving(true);

    const { error } = await supabase.from('profiles').update({
      legal_name: form.legal_name,
      trading_name: form.trading_name,
      contact_name: form.contact_name,
      email: form.email,
      registration_number: form.registration_number,
      contact_number: form.contact_number,
      business_type: form.business_type,

      continent: form.continent,
      country: form.country,
      province: form.province,
      city: form.city,
      street: form.street,
      postal_code: form.postal_code,

      industry: form.industry,
      short_description: form.short_description,

      tax_number: form.tax_number,
      vat_number: form.vat_number,
      bank_name: form.bank_name,
      account_name: form.account_name,
      account_number: form.account_number,
      iban: form.iban,
      swift: form.swift,

      director_id_number: form.director_id_number,
    }).eq('id', Number(companyId));

    if (error) toast.error('Failed to save changes');
    else toast.success('Profile saved successfully!');
    setSaving(false);
  };

  // ==================== PAYSTACK + VERIFYNOW ====================
  const callVerifyNow = async (idNumber: string) => {
    const response = await fetch('/api/verify-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: "consumer_trace",
        idNumber: idNumber,
        mode: "production"
      }),
    });

    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || 'VerifyNow failed');

    await supabase.from('profiles').update({
      verification_data: result,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
    }).eq('id', Number(companyId));

    return result;
  };

  const handleGetVerified = () => {
    if (!companyId || !form.email) {
      toast.error('Missing company ID or email');
      return;
    }

    setVerifying(true);

    let attempts = 0;
    const maxAttempts = 50;

    const interval = setInterval(() => {
      const PaystackPop = (window as any).PaystackPop;
      attempts++;

      if (PaystackPop) {
        clearInterval(interval);

        function onCloseCallback() {
          setVerifying(false);
          toast.error('Payment cancelled');
        }

        function paymentCallback(response: any) {
          (async () => {
            try {
              await supabase.from('profiles').update({
                verification_status: 'verified',
                verified_at: new Date().toISOString(),
              }).eq('id', Number(companyId));

              const idToVerify = form.director_id_number || form.registration_number;
              if (idToVerify) {
                toast.loading('Verifying with VerifyNow...', { id: 'verifynow' });
                await callVerifyNow(idToVerify);
                toast.success('Payment & Verification successful!', { id: 'verifynow' });
              } else {
                toast.success('Payment successful!');
              }
              setTimeout(() => window.location.reload(), 1500);
            } catch (err: any) {
              toast.error(`Verification failed: ${err.message}`);
            } finally {
              setVerifying(false);
            }
          })();
        }

        try {
          const handler = PaystackPop.setup({
            key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
            email: form.email,
            amount: 6900,
            currency: 'ZAR',
            ref: `verify_${companyId}_${Date.now()}`,
            metadata: { company_id: companyId, company_name: form.legal_name },
            onClose: onCloseCallback,
            callback: paymentCallback,
          });
          handler.openIframe();
        } catch (err: any) {
          toast.error(`Paystack Error: ${err.message}`);
          setVerifying(false);
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        setVerifying(false);
        toast.error('Paystack failed to load. Please refresh the page.');
      }
    }, 100);
  };

  if (loading) return <div className="p-12">Loading company data...</div>;

  const verificationStatus = form.verification_status || 'unverified';
  const badgeColor =
    verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
    verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-600';

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">{form.legal_name}</h1>
          <p className="text-xl text-neutral-600 mt-1">Company Profile</p>
        </div>
        <div className={`px-5 py-2 rounded-3xl text-sm font-semibold ${badgeColor}`}>
          {verificationStatus === 'verified' && '✅ Verified'}
          {verificationStatus === 'pending' && '⏳ Pending Verification'}
          {verificationStatus === 'unverified' && '⚪ Unverified'}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 space-y-10">

        {/* 1. Company Basics */}
        <div>
          <h2 className="text-2xl font-bold mb-6">1. Company Basics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Legal Name</label>
              <input className="input w-full mt-1" value={form.legal_name || ''} onChange={e => handleInputChange('legal_name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Trading Name</label>
              <input className="input w-full mt-1" value={form.trading_name || ''} onChange={e => handleInputChange('trading_name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Business Type</label>
              <select className="input w-full mt-1" value={form.business_type || ''} onChange={e => handleInputChange('business_type', e.target.value)}>
                <option value="">Select Business Type</option>
                {businessTypes.map(bt => (
                  <option key={bt.id} value={bt.name}>{bt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Contact Name</label>
              <input className="input w-full mt-1" value={form.contact_name || ''} onChange={e => handleInputChange('contact_name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Contact Number</label>
              <input className="input w-full mt-1" value={form.contact_number || ''} onChange={e => handleInputChange('contact_number', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <input className="input w-full mt-1" value={form.email || ''} onChange={e => handleInputChange('email', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Registration Number</label>
              <input className="input w-full mt-1" value={form.registration_number || ''} onChange={e => handleInputChange('registration_number', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 2. Location */}
        <div>
          <h2 className="text-2xl font-bold mb-6">2. Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Country</label>
              <select className="input w-full mt-1" value={form.country || ''} onChange={handleCountryChange}>
                <option value="">Select Country</option>
                {countries.map(c => (
                  <option key={c.id} value={c.name}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Province / State</label>
              <select className="input w-full mt-1" value={form.province || ''} onChange={e => handleInputChange('province', e.target.value)} disabled={!selectedCountryId}>
                <option value="">Select Province</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <input className="input w-full mt-1" value={form.city || ''} onChange={e => handleInputChange('city', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Street Address</label>
              <input className="input w-full mt-1" value={form.street || ''} onChange={e => handleInputChange('street', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Postal Code</label>
              <input className="input w-full mt-1" value={form.postal_code || ''} onChange={e => handleInputChange('postal_code', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 3. Industry & Description */}
        <div>
          <h2 className="text-2xl font-bold mb-6">3. Industry & Description</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Industry</label>
              <select className="input w-full mt-1" value={form.industry || ''} onChange={e => handleInputChange('industry', e.target.value)}>
                <option value="">Select Industry</option>
                {industries.filter(i => !i.parent_id).map(ind => (
                  <option key={ind.id} value={ind.name}>{ind.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Short Description (max 120 characters)</label>
              <textarea className="input w-full mt-1 min-h-[90px]" value={form.short_description || ''} onChange={e => handleInputChange('short_description', e.target.value)} maxLength={120} />
              <div className="text-xs text-neutral-500 text-right mt-1">
                {form.short_description?.length || 0}/120
              </div>
            </div>
          </div>
        </div>

        {/* 4. Financial & Banking */}
        <div>
          <h2 className="text-2xl font-bold mb-6">4. Financial & Banking</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Tax Number</label>
              <input className="input w-full mt-1" value={form.tax_number || ''} onChange={e => handleInputChange('tax_number', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">VAT Number</label>
              <input className="input w-full mt-1" value={form.vat_number || ''} onChange={e => handleInputChange('vat_number', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Bank Name</label>
              <input className="input w-full mt-1" value={form.bank_name || ''} onChange={e => handleInputChange('bank_name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Account Name</label>
              <input className="input w-full mt-1" value={form.account_name || ''} onChange={e => handleInputChange('account_name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Account Number</label>
              <input className="input w-full mt-1" value={form.account_number || ''} onChange={e => handleInputChange('account_number', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">IBAN</label>
              <input className="input w-full mt-1" value={form.iban || ''} onChange={e => handleInputChange('iban', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">SWIFT / BIC</label>
              <input className="input w-full mt-1" value={form.swift || ''} onChange={e => handleInputChange('swift', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 5. Verification */}
        <div>
          <h2 className="text-2xl font-bold mb-6">5. Verification</h2>
          <div>
            <label className="text-sm font-medium">Director ID Number (for VerifyNow)</label>
            <input className="input w-full mt-1" value={form.director_id_number || ''} onChange={e => handleInputChange('director_id_number', e.target.value)} placeholder="e.g. 8001015009087" />
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
        <button onClick={saveProfile} disabled={saving} className="btn-primary px-10 py-4">
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>

        <button
          onClick={handleGetVerified}
          disabled={verifying}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl font-semibold flex items-center gap-2 disabled:opacity-70"
        >
          {verifying ? 'Processing...' : 'Get Verified - R69 with Paystack + VerifyNow'}
        </button>
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