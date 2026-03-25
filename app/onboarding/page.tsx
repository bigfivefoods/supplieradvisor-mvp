'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { ArrowRight, ArrowLeft, Plus, Upload } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import toast from 'react-hot-toast';

export default function Onboarding() {
  const { user } = usePrivy();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    legal_name: '',
    trading_name: '',
    cipc_number: '',
    business_types: [] as string[],
    full_address: { country: 'South Africa', province: '', city: '', street: '', postal_code: '' },
    vat_number: '',
    bank_details: { bank_name: '', account_name: '', account_number: '', branch_code: '' },
    products: [] as { name: string; sku: string; category: string }[],
    certifications: [] as { name: string; expiry_date: string; verification_method: 'self' | 'api'; document_url: string }[],
  });

  const [newProduct, setNewProduct] = useState({ name: '', sku: '', category: '' });
  const [newCert, setNewCert] = useState({ name: '', expiry_date: '', verification_method: 'self' as 'self' | 'api', document_url: '' });

  const businessTypesList = [
    'Farmer / Producer', 'Manufacturer / Processor', 'Packer', 'Distributor',
    'Wholesaler', 'Importer', 'Exporter', 'Retailer', 'Logistics Provider'
  ];

  const steps = [
    () => (
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-8 text-[#00b4d8]">Tell us about your business</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium mb-2">Legal Name</label>
            <input className="input w-full" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Trading Name</label>
            <input className="input w-full" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} />
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium mb-2">CIPC / Company Registration Number</label>
          <input className="input w-full" value={form.cipc_number} onChange={e => setForm(p => ({...p, cipc_number: e.target.value}))} />
        </div>
      </div>
    ),
    () => (
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-8 text-[#00b4d8]">What type of business are you?</h2>
        <div className="grid grid-cols-2 gap-3">
          {businessTypesList.map(type => (
            <label key={type} className="flex items-center gap-3 border p-4 rounded-3xl cursor-pointer hover:bg-slate-50">
              <input 
                type="checkbox" 
                checked={form.business_types.includes(type)}
                onChange={() => {
                  setForm(prev => ({
                    ...prev,
                    business_types: prev.business_types.includes(type)
                      ? prev.business_types.filter(t => t !== type)
                      : [...prev.business_types, type]
                  }));
                }}
              />
              {type}
            </label>
          ))}
        </div>
      </div>
    ),
    () => (
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-8 text-[#00b4d8]">Where are you located?</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium mb-2">Street Address</label>
            <input className="input w-full" value={form.full_address.street} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, street: e.target.value}}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">City</label>
            <input className="input w-full" value={form.full_address.city} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, city: e.target.value}}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Province</label>
            <input className="input w-full" value={form.full_address.province} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, province: e.target.value}}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Postal Code</label>
            <input className="input w-full" value={form.full_address.postal_code} onChange={e => setForm(p => ({...p, full_address: {...p.full_address, postal_code: e.target.value}}))} />
          </div>
        </div>
      </div>
    ),
    () => (
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-8 text-[#00b4d8]">Financial details</h2>
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium mb-2">VAT Number</label>
            <input className="input w-full" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Bank Name</label>
            <input className="input w-full" value={form.bank_details.bank_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, bank_name: e.target.value}}))} />
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium mb-2">Account Name</label>
              <input className="input w-full" value={form.bank_details.account_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_name: e.target.value}}))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Account Number</label>
              <input className="input w-full" value={form.bank_details.account_number} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_number: e.target.value}}))} />
            </div>
          </div>
        </div>
      </div>
    ),
    () => (
      <div className="space-y-12">
        <div>
          <h3 className="text-2xl font-bold mb-6">Your Products / Services</h3>
          <div className="flex gap-4">
            <input className="input flex-1" placeholder="Product name" value={newProduct.name} onChange={e => setNewProduct(p => ({...p, name: e.target.value}))} />
            <button onClick={() => {
              if (newProduct.name) {
                setForm(p => ({...p, products: [...p.products, newProduct]}));
                setNewProduct({ name: '', sku: '', category: '' });
              }
            }} className="btn-primary px-8">Add</button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {form.products.map((p, i) => (
              <div key={i} className="card text-sm p-4">{p.name}</div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold mb-6">Certifications & Documents</h3>
          <div className="grid grid-cols-2 gap-6">
            <input className="input" placeholder="Certificate name" value={newCert.name} onChange={e => setNewCert(p => ({...p, name: e.target.value}))} />
            <input type="date" className="input" value={newCert.expiry_date} onChange={e => setNewCert(p => ({...p, expiry_date: e.target.value}))} />
          </div>
          <button onClick={() => {
            if (newCert.name) {
              setForm(p => ({...p, certifications: [...p.certifications, newCert]}));
              setNewCert({ name: '', expiry_date: '', verification_method: 'self', document_url: '' });
            }
          }} className="btn-primary mt-6">Add Certificate</button>
        </div>
      </div>
    ),
    () => (
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-8 text-[#00b4d8]">Review & Join the Network</h2>
        <pre className="bg-slate-100 p-8 rounded-3xl text-sm overflow-auto max-h-96">{JSON.stringify(form, null, 2)}</pre>
      </div>
    )
  ];

  const saveProfile = async () => {
    setLoading(true);
    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user?.id,
        legal_name: form.legal_name,
        trading_name: form.trading_name,
        cipc_number: form.cipc_number,
        business_types: form.business_types,
        full_address: form.full_address,
        vat_number: form.vat_number,
        bank_details: form.bank_details,
      });

      if (profileError) throw profileError;

      if (form.certifications.length > 0) {
        await supabase.from('business_certifications').insert(
          form.certifications.map(c => ({ profile_id: user?.id, ...c }))
        );
      }

      toast.success('🎉 Welcome to SupplierAdvisor! Your business is now verified.');
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-[25px] min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />

        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Verify Your Business</h1>
            <p className="text-2xl text-slate-600">Join the most trusted supply-chain network in Africa</p>
          </div>
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
            className="btn-primary flex items-center gap-3 px-12 py-4"
          >
            {step === 5 ? (loading ? 'Saving...' : 'Submit & Go Live') : 'Continue'} <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}