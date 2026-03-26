'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, ArrowLeft, Plus, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const businessTypesList = [
  'Farmer / Producer', 'Manufacturer / Processor', 'Packer', 'Distributor',
  'Wholesaler', 'Importer', 'Exporter', 'Retailer', 'Logistics Provider'
];

export default function Onboarding() {
  const { user } = usePrivy();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    legal_name: '', trading_name: '', cipc_number: '',
    contact_name: '', email: '',
    business_types: [] as string[],
    continent: 'Africa', country: 'South Africa', province: 'KwaZulu-Natal',
    city: '', street: '', postal_code: '',
    vat_number: '', export_license: '', import_license: '',
    bank_details: { bank_name: '', account_name: '', account_number: '', branch_code: '' },
    products: [] as any[],
    certifications: [] as any[]
  });

  const [newProduct, setNewProduct] = useState({ name: '', sku: '', category: '' });
  const [newCert, setNewCert] = useState({ name: '', awarded_date: '', expiry_date: '', verification_method: 'self' as 'self' | 'api', document_url: '' });
  const [noExpiry, setNoExpiry] = useState(false);

  const toggleBusinessType = (type: string) => {
    setForm(prev => ({
      ...prev,
      business_types: prev.business_types.includes(type)
        ? prev.business_types.filter(t => t !== type)
        : [...prev.business_types, type]
    }));
  };

  const addProduct = () => {
    if (newProduct.name) {
      setForm(prev => ({ ...prev, products: [...prev.products, newProduct] }));
      setNewProduct({ name: '', sku: '', category: '' });
    }
  };

  const removeProduct = (index: number) => {
    setForm(prev => ({ ...prev, products: prev.products.filter((_, i) => i !== index) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !newCert.name) {
      toast.error("Please select a file and enter certificate name");
      return;
    }

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('certificates')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('certificates')
        .getPublicUrl(fileName);

      setNewCert(prev => ({ ...prev, document_url: publicUrl }));
      toast.success("Certificate uploaded");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCertificate = () => {
    if (!newCert.name || !newCert.document_url) {
      toast.error("Please add name and upload document");
      return;
    }
    const cert = { ...newCert, expiry_date: noExpiry ? '' : newCert.expiry_date };
    setForm(prev => ({ ...prev, certifications: [...prev.certifications, cert] }));
    setNewCert({ name: '', awarded_date: '', expiry_date: '', verification_method: 'self', document_url: '' });
    setNoExpiry(false);
    toast.success("Certificate added");
  };

  const removeCertificate = (index: number) => {
    setForm(prev => ({ ...prev, certifications: prev.certifications.filter((_, i) => i !== index) }));
  };

  const saveProfile = async () => {
    if (!user?.id) {
      toast.error("User not found. Please connect wallet first.");
      return;
    }
    setLoading(true);
    try {
      await supabase.from('profiles').upsert({ id: user.id, ...form, status: 'awaiting_verification' });
      if (form.products.length) {
        await supabase.from('business_products').delete().eq('profile_id', user.id);
        await supabase.from('business_products').insert(form.products.map(p => ({ profile_id: user.id, ...p })));
      }
      if (form.certifications.length) {
        await supabase.from('business_certifications').delete().eq('profile_id', user.id);
        await supabase.from('business_certifications').insert(form.certifications.map(c => ({ profile_id: user.id, ...c })));
      }
      toast.success("Profile saved! Awaiting verification.");
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    // Step 0: Tell us about your business
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Tell us about your business</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="block text-sm font-medium mb-2">Legal Name</label><input type="text" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} className="input w-full" placeholder="Company Legal Name" /></div>
          <div><label className="block text-sm font-medium mb-2">Trading Name</label><input type="text" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} className="input w-full" placeholder="Trading Name" /></div>
          <div><label className="block text-sm font-medium mb-2">CIPC Number</label><input type="text" value={form.cipc_number} onChange={e => setForm(p => ({...p, cipc_number: e.target.value}))} className="input w-full" placeholder="CIPC Number" /></div>
          <div><label className="block text-sm font-medium mb-2">Contact Name</label><input type="text" value={form.contact_name} onChange={e => setForm(p => ({...p, contact_name: e.target.value}))} className="input w-full" placeholder="Full Name" /></div>
          <div className="md:col-span-2"><label className="block text-sm font-medium mb-2">Email Address</label><input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} className="input w-full" placeholder="business@email.com" /></div>
        </div>
      </div>
    ),
    // Step 1: What type of business are you?
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">What type of business are you?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {businessTypesList.map(type => (
            <button key={type} onClick={() => toggleBusinessType(type)} className={`p-6 rounded-3xl border text-left transition-all ${form.business_types.includes(type) ? 'border-[#00b4d8] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              {type}
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 2: Where are you located?
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Where are you located?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="block text-sm font-medium mb-2">Continent</label><select value={form.continent} onChange={e => setForm(p => ({...p, continent: e.target.value}))} className="input w-full"><option>Africa</option><option>Europe</option><option>Asia</option><option>North America</option><option>South America</option><option>Australia</option></select></div>
          <div><label className="block text-sm font-medium mb-2">Country</label><select value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))} className="input w-full"><option>South Africa</option><option>Nigeria</option><option>Kenya</option></select></div>
          <div><label className="block text-sm font-medium mb-2">Province / State</label><input type="text" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))} className="input w-full" placeholder="KwaZulu-Natal" /></div>
          <div><label className="block text-sm font-medium mb-2">City</label><input type="text" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} className="input w-full" placeholder="Durban" /></div>
          <div className="md:col-span-2"><label className="block text-sm font-medium mb-2">Street Address</label><input type="text" value={form.street} onChange={e => setForm(p => ({...p, street: e.target.value}))} className="input w-full" placeholder="123 Main Street" /></div>
          <div><label className="block text-sm font-medium mb-2">Postal Code</label><input type="text" value={form.postal_code} onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} className="input w-full" placeholder="4001" /></div>
        </div>
      </div>
    ),
    // Step 3: Financial details (skippable)
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Financial details</h2>
        <p className="text-[#00b4d8] mb-8">You can skip this for now and complete it later. This information is used for purchase orders, invoicing, and payments.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="block text-sm font-medium mb-2">VAT Number</label><input type="text" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Export License Number</label><input type="text" value={form.export_license} onChange={e => setForm(p => ({...p, export_license: e.target.value}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Import License Number</label><input type="text" value={form.import_license} onChange={e => setForm(p => ({...p, import_license: e.target.value}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Bank Name</label><input type="text" value={form.bank_details.bank_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, bank_name: e.target.value}}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Account Name</label><input type="text" value={form.bank_details.account_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_name: e.target.value}}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Account Number</label><input type="text" value={form.bank_details.account_number} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_number: e.target.value}}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Branch Code</label><input type="text" value={form.bank_details.branch_code} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, branch_code: e.target.value}}))} className="input w-full" /></div>
        </div>
      </div>
    ),
    // Step 4: Your Products / Services (skippable)
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Your Products / Services</h2>
        <p className="text-[#00b4d8] mb-8">You can skip this for now. Completing this helps with advertising, procurement matching, and search visibility. You can add more detailed metadata later in the Inventory section.</p>
        <div className="flex gap-4 mb-6">
          <input type="text" value={newProduct.name} onChange={e => setNewProduct(p => ({...p, name: e.target.value}))} className="input flex-1" placeholder="Product / Service" />
          <input type="text" value={newProduct.sku} onChange={e => setNewProduct(p => ({...p, sku: e.target.value}))} className="input w-40" placeholder="SKU" />
          <button onClick={addProduct} className="btn-primary px-8">Add</button>
        </div>
        <div className="space-y-3">
          {form.products.map((p, i) => (
            <div key={i} className="flex justify-between bg-white p-4 rounded-3xl border">
              <div>{p.name} (SKU: {p.sku})</div>
              <button onClick={() => removeProduct(i)} className="text-red-500">Remove</button>
            </div>
          ))}
        </div>
      </div>
    ),
    // Step 5: Certifications & Documents (mandatory)
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Certifications & Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-8">
          <div className="md:col-span-2"><label className="block text-sm font-medium mb-2">Certification Name</label><input type="text" value={newCert.name} onChange={e => setNewCert(p => ({...p, name: e.target.value}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Awarded Date</label><input type="date" value={newCert.awarded_date} onChange={e => setNewCert(p => ({...p, awarded_date: e.target.value}))} className="input w-full" /></div>
          <div><label className="block text-sm font-medium mb-2">Expiry Date</label><input type="date" value={newCert.expiry_date} onChange={e => setNewCert(p => ({...p, expiry_date: e.target.value}))} className="input w-full" disabled={noExpiry} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} /><span className="text-sm">Never Expires</span></div>
          <div><label className="block text-sm font-medium mb-2">Upload Document</label><input type="file" onChange={handleFileUpload} className="text-sm" /></div>
        </div>
        <button onClick={addCertificate} className="btn-primary w-full py-4">Add Certificate</button>
        <div className="mt-10">
          <h4 className="font-medium mb-4">Current Certifications</h4>
          {form.certifications.map((c, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl border flex justify-between mb-3">
              <div>{c.name} (exp {c.expiry_date || 'N/A'})</div>
              <button onClick={() => removeCertificate(i)} className="text-red-500">Remove</button>
            </div>
          ))}
        </div>
      </div>
    ),
    // Step 6: Review & Submit
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Review & Submit</h2>
        <pre className="bg-slate-100 p-8 rounded-3xl text-sm overflow-auto max-h-96">{JSON.stringify(form, null, 2)}</pre>
      </div>
    )
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] pl-[25px] pr-12 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-6xl font-black tracking-[-3px]">Verify Your Business</h1>
          <div className="text-sm font-medium text-slate-500">Step {step + 1} of 7</div>
        </div>
        <div className="card p-12">
          {steps[step]()}
        </div>
        <div className="flex justify-between mt-10">
          {step > 0 && <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-3 px-8 py-4 border-2 rounded-3xl font-medium"><ArrowLeft /> Back</button>}
          <button onClick={() => step < 6 ? setStep(s => s + 1) : saveProfile()} className="btn-primary flex items-center gap-3 px-12 py-4">
            {step === 6 ? 'Submit & Go Live' : 'Continue'} <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}
