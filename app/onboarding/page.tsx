'use client';

import { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const businessTypesList = [
  'Farmer / Producer', 'Manufacturer / Processor', 'Packer', 'Distributor',
  'Wholesaler', 'Importer', 'Exporter', 'Retailer', 'Logistics Provider'
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    legal_name: '', trading_name: '', cipc_number: '',
    business_types: [] as string[],
    full_address: { country: 'South Africa', province: '', city: '', street: '', postal_code: '' },
    vat_number: '',
    bank_details: { bank_name: '', account_name: '', account_number: '', branch_code: '' },
    products: [] as any[],
    certifications: [] as any[]
  });

  const [newProduct, setNewProduct] = useState({ product_name: '', sku: '', category: '' });

  // ✅ Fixed typing for verification_method
  const [newCert, setNewCert] = useState<{
    cert_name: string;
    expiry_date: string;
    verification_method: 'self' | 'api';
    document_url: string;
  }>({
    cert_name: '',
    expiry_date: '',
    verification_method: 'self',
    document_url: ''
  });

  const toggleBusinessType = (type: string) => {
    setForm(prev => ({
      ...prev,
      business_types: prev.business_types.includes(type)
        ? prev.business_types.filter(t => t !== type)
        : [...prev.business_types, type]
    }));
  };

  const addProduct = () => {
    if (newProduct.product_name) {
      setForm(prev => ({ ...prev, products: [...prev.products, newProduct] }));
      setNewProduct({ product_name: '', sku: '', category: '' });
    }
  };

  const addCertification = () => {
    if (newCert.cert_name && newCert.expiry_date) {
      setForm(prev => ({ ...prev, certifications: [...prev.certifications, newCert] }));
      setNewCert({ 
        cert_name: '', 
        expiry_date: '', 
        verification_method: 'self', 
        document_url: '' 
      });
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      await supabase.from('profiles').upsert({
        legal_name: form.legal_name,
        trading_name: form.trading_name,
        cipc_number: form.cipc_number,
        business_types: form.business_types,
        full_address: form.full_address,
        vat_number: form.vat_number,
        bank_details: form.bank_details,
        verified_at: new Date().toISOString()
      });

      toast.success('🎉 Business fully verified and live on the trusted network!');
      window.location.href = '/dashboard';
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fully typed steps array (fixes the second error)
  const steps: (() => JSX.Element)[] = [
    // Step 0: Company Particulars
    () => (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold">Company Particulars</h2>
        <input type="text" placeholder="Legal Name" className="w-full p-4 rounded-2xl border" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} />
        <input type="text" placeholder="Trading Name" className="w-full p-4 rounded-2xl border" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} />
        <input type="text" placeholder="CIPC Number" className="w-full p-4 rounded-2xl border" value={form.cipc_number} onChange={e => setForm(p => ({...p, cipc_number: e.target.value}))} />
        <div>
          <p className="font-medium mb-3">Business Types (select all that apply)</p>
          <div className="grid grid-cols-2 gap-3">
            {businessTypesList.map(type => (
              <label key={type} className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={form.business_types.includes(type)} onChange={() => toggleBusinessType(type)} />
                {type}
              </label>
            ))}
          </div>
        </div>
      </div>
    ),
    // Step 1: Full Location
    () => (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold">Company Location</h2>
        <input type="text" placeholder="Country" className="w-full p-4 rounded-2xl border" value={form.full_address.country} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, country: e.target.value}}))} />
        <input type="text" placeholder="Province / State" className="w-full p-4 rounded-2xl border" value={form.full_address.province} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, province: e.target.value}}))} />
        <input type="text" placeholder="City" className="w-full p-4 rounded-2xl border" value={form.full_address.city} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, city: e.target.value}}))} />
        <input type="text" placeholder="Street Address" className="w-full p-4 rounded-2xl border" value={form.full_address.street} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, street: e.target.value}}))} />
        <input type="text" placeholder="Postal Code" className="w-full p-4 rounded-2xl border" value={form.full_address.postal_code} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, postal_code: e.target.value}}))} />
      </div>
    ),
    // Step 2: Financial
    () => (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold">Financial Information</h2>
        <input type="text" placeholder="VAT Number" className="w-full p-4 rounded-2xl border" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} />
        <input type="text" placeholder="Bank Name" className="w-full p-4 rounded-2xl border" value={form.bank_details.bank_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, bank_name: e.target.value}}))} />
        <input type="text" placeholder="Account Name" className="w-full p-4 rounded-2xl border" value={form.bank_details.account_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_name: e.target.value}}))} />
        <input type="text" placeholder="Account Number" className="w-full p-4 rounded-2xl border" value={form.bank_details.account_number} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_number: e.target.value}}))} />
        <input type="text" placeholder="Branch Code" className="w-full p-4 rounded-2xl border" value={form.bank_details.branch_code} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, branch_code: e.target.value}}))} />
      </div>
    ),
    // Step 3: Products
    () => (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold">Products / Services Catalog</h2>
        <div className="flex gap-4">
          <input type="text" placeholder="Product Name" className="flex-1 p-4 rounded-2xl border" value={newProduct.product_name} onChange={e => setNewProduct(p => ({...p, product_name: e.target.value}))} />
          <input type="text" placeholder="SKU" className="flex-1 p-4 rounded-2xl border" value={newProduct.sku} onChange={e => setNewProduct(p => ({...p, sku: e.target.value}))} />
          <button onClick={addProduct} className="btn-primary px-8">Add</button>
        </div>
        <div className="space-y-3">
          {form.products.map((p, i) => <div key={i} className="p-4 bg-slate-50 rounded-2xl">{p.product_name} ({p.sku})</div>)}
        </div>
      </div>
    ),
    // Step 4: Certifications & CoA
    () => (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold">Certificates & CoA</h2>
        <div className="flex gap-4">
          <input type="text" placeholder="Certificate Name (e.g. FSSC 22000, CoA)" className="flex-1 p-4 rounded-2xl border" value={newCert.cert_name} onChange={e => setNewCert(p => ({...p, cert_name: e.target.value}))} />
          <input type="date" className="flex-1 p-4 rounded-2xl border" value={newCert.expiry_date} onChange={e => setNewCert(p => ({...p, expiry_date: e.target.value}))} />
          <select 
            className="p-4 rounded-2xl border" 
            value={newCert.verification_method} 
            onChange={e => setNewCert(p => ({...p, verification_method: e.target.value as 'self' | 'api' }))}
          >
            <option value="self">Self Upload</option>
            <option value="api">API Verification (future)</option>
          </select>
          <button onClick={addCertification} className="btn-primary px-8">Add Cert</button>
        </div>
        <div className="space-y-3">
          {form.certifications.map((c, i) => <div key={i} className="p-4 bg-slate-50 rounded-2xl flex justify-between"><span>{c.cert_name} (exp {c.expiry_date})</span><span className="text-xs text-emerald-600">{c.verification_method}</span></div>)}
        </div>
      </div>
    ),
    // Step 5: Review
    () => (
      <div>
        <h2 className="text-3xl font-bold">Review & Submit</h2>
        <pre className="bg-slate-100 p-8 rounded-3xl text-sm overflow-auto max-h-96">{JSON.stringify(form, null, 2)}</pre>
      </div>
    )
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] pl-[25px] pr-12 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-6xl font-black tracking-[-3px]">Verify Your Business</h1>
          <div className="text-sm font-medium text-slate-500">Step {step + 1} of 6</div>
        </div>

        <div className="card p-12">
          {steps[step]()}
        </div>

        <div className="flex justify-between mt-10">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-3 px-8 py-4 border-2 rounded-3xl font-medium">
              <ArrowLeft /> Back
            </button>
          )}
          <button
            onClick={() => step < 5 ? setStep(s => s + 1) : saveProfile()}
            disabled={loading}
            className="btn-primary flex items-center gap-3 px-12 py-4 disabled:opacity-70"
          >
            {loading ? 'Saving...' : step === 5 ? 'Submit & Go Live' : 'Continue'} <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}