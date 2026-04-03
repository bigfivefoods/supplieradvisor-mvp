'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, ChevronDown, RotateCw, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Image from 'next/image';

export default function MyBusinessProfile() {
  const { user } = usePrivy();
  const rawId = user?.id || '';
  const cleanId = rawId.startsWith('privy:') ? rawId.slice(6) : rawId;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    basics: true,
    location: true,
    industries: true,
    financial: true,
    products: true,
    services: true,
    certifications: true
  });

  const [form, setForm] = useState({
    legal_name: '', trading_name: '', contact_name: '', email: '', registration_number: '',
    registration_document_url: '', logo_url: '',
    planet: 'Earth', continent: '', country: '', province: '', street: '', city: '', postal_code: '',
    industries: [] as string[],
    tax_number: '', tax_document_url: '',
    vat_number: '', vat_document_url: '',
    export_license: '', export_document_url: '',
    import_license: '', import_document_url: '',
    bank_name: '', account_name: '', account_number: '', bank_confirmation_url: '',
    products: [] as any[],
    services: [] as string[],
    certifications: [] as any[]
  });

  const toggleSection = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', cleanId).single();
    if (profile) setForm(prev => ({ ...prev, ...profile }));

    const { data: products } = await supabase.from('business_products').select('*').eq('profile_id', cleanId);
    if (products) setForm(prev => ({ ...prev, products }));

    const { data: servicesData } = await supabase.from('business_services').select('name').eq('profile_id', cleanId);
    if (servicesData) setForm(prev => ({ ...prev, services: servicesData.map((s: any) => s.name) }));

    const { data: certs } = await supabase.from('business_certifications').select('*').eq('profile_id', cleanId);
    if (certs) setForm(prev => ({ ...prev, certifications: certs }));

    setLoading(false);
  };

  const handleUpload = async (field: keyof typeof form, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return toast.error("Please select a file");
    setUploading(true);
    const fileName = `${cleanId}-${field}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('certificates').upload(fileName, file);
    if (error) return toast.error("Upload failed");
    const { data: url } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setForm(prev => ({ ...prev, [field]: url.publicUrl }));
    setUploading(false);
    toast.success("File uploaded successfully");
  };

  const saveProfile = async () => {
    setLoading(true);
    const profileData = { id: cleanId, ...form, updated_at: new Date().toISOString() };
    await supabase.from('profiles').upsert(profileData);

    if (form.products.length) await supabase.from('business_products').upsert(form.products.map(p => ({ profile_id: cleanId, ...p })));
    if (form.services.length) await supabase.from('business_services').upsert(form.services.map(name => ({ profile_id: cleanId, name })));
    if (form.certifications.length) await supabase.from('business_certifications').upsert(form.certifications.map(c => ({ profile_id: cleanId, ...c })));

    toast.success("✅ All changes saved to SupplierAdvisor®");
    setLoading(false);
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">My Business Profile</h1>
          <p className="text-xl text-neutral-600">Complete & verified supplier record • All data from onboarding</p>
        </div>
      </div>

      <div className="space-y-8">

        {/* 1. Company Details */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('basics')}>
            <h2 className="text-2xl font-bold">1. Company Details</h2>
            <ChevronDown className={`transition ${expanded.basics ? 'rotate-180' : ''}`} />
          </div>
          {expanded.basics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm mb-2">Legal Name</label>
                <input type="text" className="input w-full" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} />
              </div>
              <div>
                <label className="block text-sm mb-2">Trading Name</label>
                <input type="text" className="input w-full" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} />
              </div>
              <div>
                <label className="block text-sm mb-2">Contact Name</label>
                <input type="text" className="input w-full" value={form.contact_name} onChange={e => setForm(p => ({...p, contact_name: e.target.value}))} />
              </div>
              <div>
                <label className="block text-sm mb-2">Email Address</label>
                <input type="email" className="input w-full" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-2">Company Registration Number</label>
                <input type="text" className="input w-full" value={form.registration_number} onChange={e => setForm(p => ({...p, registration_number: e.target.value}))} />
              </div>
              <div className="flex items-center gap-8">
                {form.logo_url && <Image src={form.logo_url} alt="Logo" width={120} height={120} className="rounded-2xl border" />}
                <div>
                  <label className="block text-sm mb-3">Upload Company Logo</label>
                  <input type="file" onChange={e => handleUpload('logo_url', e)} className="hidden" id="logo-upload" />
                  <label htmlFor="logo-upload" className="btn-primary cursor-pointer">Choose Logo</label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Location */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('location')}>
            <h2 className="text-2xl font-bold">2. Location</h2>
            <ChevronDown className={`transition ${expanded.location ? 'rotate-180' : ''}`} />
          </div>
          {expanded.location && (
            <div>
              <p className="text-sm text-neutral-500 mb-4">Earth • {form.continent} • {form.country} • {form.province}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div><label className="block text-sm mb-2">Planet</label><input className="input w-full" value={form.planet} onChange={e => setForm(p => ({...p, planet: e.target.value}))} /></div>
                <div><label className="block text-sm mb-2">Continent</label><input className="input w-full" value={form.continent} onChange={e => setForm(p => ({...p, continent: e.target.value}))} /></div>
                <div><label className="block text-sm mb-2">Country</label><input className="input w-full" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))} /></div>
                <div><label className="block text-sm mb-2">Province / State</label><input className="input w-full" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))} /></div>
              </div>
              <input type="text" placeholder="Street Address" className="input w-full mt-6" value={form.street} onChange={e => setForm(p => ({...p, street: e.target.value}))} />
              <div className="grid grid-cols-2 gap-6 mt-6">
                <input type="text" placeholder="City" className="input w-full" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} />
                <input type="text" placeholder="Postal Code" className="input w-full" value={form.postal_code} onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} />
              </div>
            </div>
          )}
        </div>

        {/* 3. Industries */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('industries')}>
            <h2 className="text-2xl font-bold">3. Industries</h2>
            <ChevronDown className={`transition ${expanded.industries ? 'rotate-180' : ''}`} />
          </div>
          {expanded.industries && (
            <div className="flex flex-wrap gap-3">
              {form.industries.map((ind, i) => (
                <div key={i} className="bg-[#00b4d8]/10 text-[#00b4d8] px-5 py-2 rounded-3xl text-sm font-medium">{ind}</div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Financial & Banking */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('financial')}>
            <h2 className="text-2xl font-bold">4. Financial & Banking</h2>
            <ChevronDown className={`transition ${expanded.financial ? 'rotate-180' : ''}`} />
          </div>
          {expanded.financial && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div><label className="block text-sm mb-2">Tax Number</label><input className="input w-full" value={form.tax_number} onChange={e => setForm(p => ({...p, tax_number: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">VAT Number</label><input className="input w-full" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Export License Number</label><input className="input w-full" value={form.export_license} onChange={e => setForm(p => ({...p, export_license: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Import License Number</label><input className="input w-full" value={form.import_license} onChange={e => setForm(p => ({...p, import_license: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Bank Name</label><input className="input w-full" value={form.bank_name} onChange={e => setForm(p => ({...p, bank_name: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Account Name</label><input className="input w-full" value={form.account_name} onChange={e => setForm(p => ({...p, account_name: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Account Number</label><input className="input w-full" value={form.account_number} onChange={e => setForm(p => ({...p, account_number: e.target.value}))} /></div>
              <div className="md:col-span-2 flex flex-wrap gap-4 mt-6">
                <input type="file" onChange={e => handleUpload('bank_confirmation_url', e)} className="hidden" id="bank-conf" />
                <label htmlFor="bank-conf" className="btn-primary cursor-pointer px-6 py-3">Bank Confirmation</label>
                <input type="file" onChange={e => handleUpload('tax_document_url', e)} className="hidden" id="tax" />
                <label htmlFor="tax" className="btn-primary cursor-pointer px-6 py-3">TAX Certificate</label>
                <input type="file" onChange={e => handleUpload('vat_document_url', e)} className="hidden" id="vat" />
                <label htmlFor="vat" className="btn-primary cursor-pointer px-6 py-3">VAT Certificate</label>
                <input type="file" onChange={e => handleUpload('export_document_url', e)} className="hidden" id="export" />
                <label htmlFor="export" className="btn-primary cursor-pointer px-6 py-3">Export License</label>
                <input type="file" onChange={e => handleUpload('import_document_url', e)} className="hidden" id="import" />
                <label htmlFor="import" className="btn-primary cursor-pointer px-6 py-3">Import License</label>
              </div>
            </div>
          )}
        </div>

        {/* 5. Products & Services */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('products')}>
            <h2 className="text-2xl font-bold">5. Products & Services</h2>
            <ChevronDown className={`transition ${expanded.products ? 'rotate-180' : ''}`} />
          </div>
          {expanded.products && (
            <div className="space-y-8">
              {/* Products list */}
              <div>
                <h3 className="font-semibold mb-4">Products</h3>
                <div className="space-y-3">
                  {form.products.map((p, i) => (
                    <div key={i} className="flex justify-between bg-neutral-50 p-4 rounded-3xl">
                      <div>{p.description} • {p.sku} • {p.uom}</div>
                      <div className="text-emerald-600">R {p.sellPrice}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Services list */}
              <div>
                <h3 className="font-semibold mb-4">Services</h3>
                <div className="flex flex-wrap gap-3">
                  {form.services.map((s, i) => (
                    <div key={i} className="bg-neutral-50 px-5 py-2 rounded-3xl text-sm">{s}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Certifications */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('certifications')}>
            <h2 className="text-2xl font-bold">6. Certificates & Documents</h2>
            <ChevronDown className={`transition ${expanded.certifications ? 'rotate-180' : ''}`} />
          </div>
          {expanded.certifications && (
            <div className="space-y-4">
              {form.certifications.map((c, i) => (
                <div key={i} className="flex justify-between items-center bg-neutral-50 p-4 rounded-3xl">
                  <div>{c.name} ({c.body})</div>
                  <div className="text-emerald-600 text-sm">{c.document_url ? '✓ Document' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button onClick={loadProfile} className="border px-8 py-4 rounded-3xl hover:bg-slate-100 flex items-center gap-2"><RotateCw size={18} /> Refresh</button>
        <button onClick={saveProfile} disabled={loading} className="btn-primary flex items-center gap-3 px-12 py-4">
          {loading ? 'Saving...' : 'Save All Changes'} <ArrowRight />
        </button>
      </div>
    </div>
  );
}