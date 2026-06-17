'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { usePrivy } from '@privy-io/react-auth';
import { ChevronDown, ChevronUp } from 'lucide-react';

function ProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const urlCompanyId = searchParams.get('companyId');
  const [companyId, setCompanyId] = useState<string | null>(urlCompanyId || localStorage.getItem('selectedCompanyId'));

  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [expanded, setExpanded] = useState({
    basics: true,
    location: true,
    industry: true,
    financial: true,
    certifications: true,
    verification: true,
  });

  const toggleSection = (section: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const [continents, setContinents] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);
  const [businessTypes, setBusinessTypes] = useState<any[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);

  const beeLevels = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Non-compliant'];

  const commonCertificates = [
    'ISO 9001', 'ISO 22000', 'ISO 14001', 'ISO 45001', 'HACCP', 'BRC', 'SQF',
    'Halal', 'Kosher', 'Organic', 'Fairtrade', 'FSSC 22000'
  ];

  // Save companyId
  useEffect(() => {
    if (urlCompanyId) {
      localStorage.setItem('selectedCompanyId', urlCompanyId);
      setCompanyId(urlCompanyId);
    }
  }, [urlCompanyId]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!companyId) { setLoading(false); return; }
      setLoading(true);

      const { data: row } = await supabase.from('profiles').select('*').eq('id', Number(companyId)).single();
      if (row) setForm(row);

      const [contRes, countryRes, indRes, btRes] = await Promise.all([
        supabase.from('continents').select('id, name').order('name'),
        supabase.from('countries').select('id, name, flag').order('name'),
        supabase.from('industries').select('id, name, parent_id').eq('is_active', true).order('name'),
        supabase.from('business_types').select('id, name').order('name')
      ]);

      if (contRes.data) setContinents(contRes.data);
      if (countryRes.data) setCountries(countryRes.data);
      if (indRes.data) setIndustries(indRes.data);
      if (btRes.data) setBusinessTypes(btRes.data);

      if (row?.country) {
        const { data: countryData } = await supabase.from('countries').select('id').eq('name', row.country).single();
        if (countryData) setSelectedCountryId(countryData.id);
      }
      setLoading(false);
    };
    loadData();
  }, [companyId]);

  useEffect(() => {
    const loadProvinces = async () => {
      if (!selectedCountryId) { setProvinces([]); return; }
      const { data } = await supabase.from('provinces').select('id, name').eq('country_id', selectedCountryId).order('name');
      setProvinces(data || []);
    };
    loadProvinces();
  }, [selectedCountryId]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const countryName = e.target.value;
    const selected = countries.find(c => c.name === countryName);
    setForm((prev: any) => ({ ...prev, country: countryName, province: '' }));
    setSelectedCountryId(selected ? selected.id : null);
  };

  // === UNIVERSAL FILE UPLOAD TO SUPABASE STORAGE ===
  const uploadFileToStorage = async (file: File, folder: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from('company-documents')
      .upload(filePath, file);

    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from('company-documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Handle document uploads (Banking, VAT, Export, Import, BEE)
  const handleDocumentUpload = async (field: string, file: File) => {
    if (!companyId) return;

    const url = await uploadFileToStorage(file, `companies/${companyId}/documents`);
    if (!url) return;

    // Update form with the URL
    setForm((prev: any) => ({
      ...prev,
      [field]: url,
    }));

    toast.success(`${file.name} uploaded successfully`);
  };

  // Handle ISO certificate checkbox + file
  const handleISOCertificateChange = async (certName: string, file?: File) => {
    const currentCerts = form.iso_certifications || [];
    const existing = currentCerts.find((c: any) => c.name === certName);

    let updatedCerts;

    if (file) {
      const url = await uploadFileToStorage(file, `companies/${companyId}/certificates`);
      if (!url) return;

      if (existing) {
        updatedCerts = currentCerts.map((c: any) =>
          c.name === certName ? { ...c, selected: true, file_url: url } : c
        );
      } else {
        updatedCerts = [...currentCerts, { name: certName, selected: true, file_url: url }];
      }
      toast.success(`${certName} certificate uploaded`);
    } else {
      if (existing) {
        updatedCerts = currentCerts.map((c: any) =>
          c.name === certName ? { ...c, selected: !c.selected } : c
        );
      } else {
        updatedCerts = [...currentCerts, { name: certName, selected: true, file_url: null }];
      }
    }

    setForm((prev: any) => ({ ...prev, iso_certifications: updatedCerts }));
  };

  // Save Profile
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
      industries: form.industries || [],
      short_description: form.short_description,
      tax_number: form.tax_number,
      vat_number: form.vat_number,
      bank_name: form.bank_name,
      account_name: form.account_name,
      account_number: form.account_number,
      iban: form.iban,
      swift: form.swift,
      director_id_number: form.director_id_number,
      export_license_number: form.export_license_number,
      import_license_number: form.import_license_number,
      bee_level: form.bee_level,
      bee_certificate_url: form.bee_certificate_url,
      bank_confirmation_url: form.bank_confirmation_url,
      vat_certificate_url: form.vat_certificate_url,
      export_license_url: form.export_license_url,
      import_license_url: form.import_license_url,
      iso_certifications: form.iso_certifications || [],
    }).eq('id', Number(companyId));

    if (error) {
      toast.error('Failed to save changes');
      console.error(error);
    } else {
      toast.success('Profile saved successfully!');
    }
    setSaving(false);
  };

  // VerifyNow + Paystack (kept from your original)
  const callVerifyNow = async (idNumber: string) => {
    const response = await fetch('/api/verify-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: "consumer_trace", idNumber, mode: "production" }),
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
        const handler = PaystackPop.setup({
          key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
          email: form.email,
          amount: 6900,
          currency: 'ZAR',
          ref: `verify_${companyId}_${Date.now()}`,
          metadata: { company_id: companyId, company_name: form.legal_name },
          onClose: () => { setVerifying(false); toast.error('Payment cancelled') },
          callback: async () => {
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
          },
        });
        handler.openIframe();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        setVerifying(false);
        toast.error('Paystack failed to load. Please refresh.');
      }
    }, 100);
  };

  if (!companyId) {
    return (
      <div className="p-12 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">Please select a company.</p>
        <button onClick={() => router.push('/dashboard/select-company')} className="btn-primary px-8 py-3">
          Select Company
        </button>
      </div>
    );
  }

  if (loading) return <div className="p-12">Loading company data...</div>;

  const verificationStatus = form.verification_status || 'unverified';
  const badgeColor = verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                     verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight">{form.legal_name}</h1>
          <p className="text-xl text-neutral-600 mt-1">Profile & Legal Information</p>
        </div>
        <div className={`px-5 py-2 rounded-3xl text-sm font-semibold ${badgeColor}`}>
          {verificationStatus === 'verified' && '✅ Verified'}
          {verificationStatus === 'pending' && '⏳ Pending Verification'}
          {verificationStatus === 'unverified' && '⚪ Unverified'}
        </div>
      </div>

      <div className="space-y-6">

        {/* 1. Company Basics */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <button onClick={() => toggleSection('basics')} className="w-full flex justify-between items-center px-8 py-5 text-left hover:bg-neutral-50">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-2xl bg-[#00b4d8] text-white flex items-center justify-center font-bold text-sm">1</div>
              <h2 className="text-2xl font-bold">Company Basics</h2>
            </div>
            {expanded.basics ? <ChevronUp className="text-neutral-500" /> : <ChevronDown className="text-neutral-500" />}
          </button>
          {expanded.basics && (
            <div className="px-8 pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-sm font-medium">Legal Name</label>
                <input className="input w-full mt-1" value={form.legal_name || ''} onChange={e => handleInputChange('legal_name', e.target.value)} /></div>
              <div><label className="text-sm font-medium">Trading Name</label>
                <input className="input w-full mt-1" value={form.trading_name || ''} onChange={e => handleInputChange('trading_name', e.target.value)} /></div>
              <div><label className="text-sm font-medium">Business Type</label>
                <select className="input w-full mt-1" value={form.business_type || ''} onChange={e => handleInputChange('business_type', e.target.value)}>
                  <option value="">Select Business Type</option>
                  {businessTypes.map(bt => <option key={bt.id} value={bt.name}>{bt.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Contact Name</label>
                <input className="input w-full mt-1" value={form.contact_name || ''} onChange={e => handleInputChange('contact_name', e.target.value)} /></div>
              <div><label className="text-sm font-medium">Contact Number</label>
                <input className="input w-full mt-1" value={form.contact_number || ''} onChange={e => handleInputChange('contact_number', e.target.value)} /></div>
              <div><label className="text-sm font-medium">Email Address</label>
                <input className="input w-full mt-1" value={form.email || ''} onChange={e => handleInputChange('email', e.target.value)} /></div>
              <div><label className="text-sm font-medium">Registration Number</label>
                <input className="input w-full mt-1" value={form.registration_number || ''} onChange={e => handleInputChange('registration_number', e.target.value)} /></div>
            </div>
          )}
        </div>

        {/* 2. Location */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <button onClick={() => toggleSection('location')} className="w-full flex justify-between items-center px-8 py-5 text-left hover:bg-neutral-50">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-2xl bg-[#00b4d8] text-white flex items-center justify-center font-bold text-sm">2</div>
              <h2 className="text-2xl font-bold">Location</h2>
            </div>
            {expanded.location ? <ChevronUp className="text-neutral-500" /> : <ChevronDown className="text-neutral-500" />}
          </button>
          {expanded.location && (
            <div className="px-8 pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-sm font-medium">Continent</label>
                <select className="input w-full mt-1" value={form.continent || ''} onChange={e => handleInputChange('continent', e.target.value)}>
                  <option value="">Select Continent</option>{continents.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Country</label>
                <select className="input w-full mt-1" value={form.country || ''} onChange={handleCountryChange}>
                  <option value="">Select Country</option>{countries.map(c => <option key={c.id} value={c.name}>{c.flag} {c.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Province / State</label>
                <select className="input w-full mt-1" value={form.province || ''} onChange={e => handleInputChange('province', e.target.value)} disabled={!selectedCountryId}>
                  <option value="">Select Province</option>{provinces.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">City</label><input className="input w-full mt-1" value={form.city || ''} onChange={e => handleInputChange('city', e.target.value)} /></div>
              <div><label className="text-sm font-medium">Street Address</label><input className="input w-full mt-1" value={form.street || ''} onChange={e => handleInputChange('street', e.target.value)} /></div>
              <div><label className="text-sm font-medium">Postal Code</label><input className="input w-full mt-1" value={form.postal_code || ''} onChange={e => handleInputChange('postal_code', e.target.value)} /></div>
            </div>
          )}
        </div>

        {/* 3. Industry */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <button onClick={() => toggleSection('industry')} className="w-full flex justify-between items-center px-8 py-5 text-left hover:bg-neutral-50">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-2xl bg-[#00b4d8] text-white flex items-center justify-center font-bold text-sm">3</div>
              <h2 className="text-2xl font-bold">Industry</h2>
            </div>
            {expanded.industry ? <ChevronUp className="text-neutral-500" /> : <ChevronDown className="text-neutral-500" />}
          </button>
          {expanded.industry && (
            <div className="px-8 pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {industries.filter((ind: any) => !ind.parent_id).map((parent: any) => {
                const subIndustries = industries.filter((sub: any) => sub.parent_id === parent.id);
                return (
                  <div key={parent.id} className="border rounded-3xl p-6">
                    <div className="font-semibold text-lg mb-4">{parent.name}</div>
                    <div className="space-y-3">
                      {subIndustries.length > 0 ? subIndustries.map((sub: any) => (
                        <label key={sub.id} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={(form.industries || []).includes(sub.name)}
                            onChange={() => {
                              const current = form.industries || [];
                              const updated = current.includes(sub.name) ? current.filter((i: string) => i !== sub.name) : [...current, sub.name];
                              setForm((prev: any) => ({ ...prev, industries: updated }));
                            }} />
                          <span className="text-sm">{sub.name}</span>
                        </label>
                      )) : <p className="text-sm text-neutral-500 italic">No sub-industries yet</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Financial & Banking */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <button onClick={() => toggleSection('financial')} className="w-full flex justify-between items-center px-8 py-5 text-left hover:bg-neutral-50">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-2xl bg-[#00b4d8] text-white flex items-center justify-center font-bold text-sm">4</div>
              <h2 className="text-2xl font-bold">Financial & Banking</h2>
            </div>
            {expanded.financial ? <ChevronUp className="text-neutral-500" /> : <ChevronDown className="text-neutral-500" />}
          </button>
          {expanded.financial && (
            <div className="px-8 pb-8 pt-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="text-sm font-medium">Registration Number</label>
                  <input className="input w-full mt-1" value={form.registration_number || ''} onChange={e => handleInputChange('registration_number', e.target.value)} /></div>
                <div><label className="text-sm font-medium">VAT Number</label>
                  <input className="input w-full mt-1" value={form.vat_number || ''} onChange={e => handleInputChange('vat_number', e.target.value)} /></div>
                <div><label className="text-sm font-medium">Bank Name</label>
                  <input className="input w-full mt-1" value={form.bank_name || ''} onChange={e => handleInputChange('bank_name', e.target.value)} /></div>
                <div><label className="text-sm font-medium">Account Name</label>
                  <input className="input w-full mt-1" value={form.account_name || ''} onChange={e => handleInputChange('account_name', e.target.value)} /></div>
                <div><label className="text-sm font-medium">Account Number</label>
                  <input className="input w-full mt-1" value={form.account_number || ''} onChange={e => handleInputChange('account_number', e.target.value)} /></div>
                <div><label className="text-sm font-medium">IBAN</label>
                  <input className="input w-full mt-1" value={form.iban || ''} onChange={e => handleInputChange('iban', e.target.value)} /></div>
                <div><label className="text-sm font-medium">SWIFT / BIC</label>
                  <input className="input w-full mt-1" value={form.swift || ''} onChange={e => handleInputChange('swift', e.target.value)} /></div>
              </div>

              {/* File Uploads - Fully Functional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium">Banking Confirmation</label>
                  <input type="file" className="input w-full mt-1" onChange={e => e.target.files?.[0] && handleDocumentUpload('bank_confirmation_url', e.target.files[0])} />
                  {form.bank_confirmation_url && <p className="text-xs text-emerald-600 mt-1">✓ Uploaded</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">VAT Certificate</label>
                  <input type="file" className="input w-full mt-1" onChange={e => e.target.files?.[0] && handleDocumentUpload('vat_certificate_url', e.target.files[0])} />
                  {form.vat_certificate_url && <p className="text-xs text-emerald-600 mt-1">✓ Uploaded</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Export License Number</label>
                  <input className="input w-full mt-1" value={form.export_license || ''} onChange={e => handleInputChange('export_license', e.target.value)} />
                  <input type="file" className="input w-full mt-2" onChange={e => e.target.files?.[0] && handleDocumentUpload('export_license_url', e.target.files[0])} />
                  {form.export_license_url && <p className="text-xs text-emerald-600 mt-1">✓ Uploaded</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Import License Number</label>
                  <input className="input w-full mt-1" value={form.import_license || ''} onChange={e => handleInputChange('import_license', e.target.value)} />
                  <input type="file" className="input w-full mt-2" onChange={e => e.target.files?.[0] && handleDocumentUpload('import_license_url', e.target.files[0])} />
                  {form.import_license_url && <p className="text-xs text-emerald-600 mt-1">✓ Uploaded</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. Certifications */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <button onClick={() => toggleSection('certifications')} className="w-full flex justify-between items-center px-8 py-5 text-left hover:bg-neutral-50">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-2xl bg-[#00b4d8] text-white flex items-center justify-center font-bold text-sm">5</div>
              <h2 className="text-2xl font-bold">Certifications & Compliance</h2>
            </div>
            {expanded.certifications ? <ChevronUp className="text-neutral-500" /> : <ChevronDown className="text-neutral-500" />}
          </button>
          {expanded.certifications && (
            <div className="px-8 pb-8 pt-2 space-y-10">

              {/* BEE */}
              <div>
                <h3 className="font-semibold text-lg mb-4">B-BBEE Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">BEE Level</label>
                    <select className="input w-full mt-1" value={form.bee_level || ''} onChange={e => handleInputChange('bee_level', e.target.value)}>
                      <option value="">Select Level</option>
                      {beeLevels.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">BEE Certificate</label>
                    <input type="file" className="input w-full mt-1" onChange={e => e.target.files?.[0] && handleDocumentUpload('bee_certificate_url', e.target.files[0])} />
                    {form.bee_certificate_url && <p className="text-xs text-emerald-600 mt-1">✓ Uploaded</p>}
                  </div>
                </div>
              </div>

              {/* ISO & Common Certifications */}
              <div>
                <h3 className="font-semibold text-lg mb-4">ISO & Common Certifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {commonCertificates.map(cert => {
                    const certData = (form.iso_certifications || []).find((c: any) => c.name === cert);
                    const isSelected = certData?.selected || false;

                    return (
                      <div key={cert} className="flex items-center justify-between border rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={isSelected} onChange={() => handleISOCertificateChange(cert)} />
                          <span className="font-medium">{cert}</span>
                        </div>
                        <input type="file" className="text-sm" onChange={e => e.target.files?.[0] && handleISOCertificateChange(cert, e.target.files[0])} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Verification */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <button onClick={() => toggleSection('verification')} className="w-full flex justify-between items-center px-8 py-5 text-left hover:bg-neutral-50">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-2xl bg-[#00b4d8] text-white flex items-center justify-center font-bold text-sm">6</div>
              <h2 className="text-2xl font-bold">Verification</h2>
            </div>
            {expanded.verification ? <ChevronUp className="text-neutral-500" /> : <ChevronDown className="text-neutral-500" />}
          </button>
          {expanded.verification && (
            <div className="px-8 pb-8 pt-2">
              <label className="text-sm font-medium">Director ID Number (for VerifyNow)</label>
              <input className="input w-full mt-1" value={form.director_id_number || ''} onChange={e => handleInputChange('director_id_number', e.target.value)} placeholder="e.g. 8001015009087" />
            </div>
          )}
        </div>

      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
        <button onClick={saveProfile} disabled={saving} className="btn-primary px-10 py-4">
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
        <button onClick={handleGetVerified} disabled={verifying} className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl font-semibold">
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