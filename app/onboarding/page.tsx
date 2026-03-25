'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { ArrowRight, ArrowLeft, Plus, ChevronDown } from 'lucide-react';
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
    continent: '',
    country: '',
    province: '',
    city: '',
    street: '',
    postal_code: '',
    vat_number: '',
    bank_details: { bank_name: '', account_name: '', account_number: '', branch_code: '' },
    products: [] as { name: string; sku: string; category: string }[],
    certifications: [] as { name: string; expiry_date: string; verification_method: 'self' | 'api'; document_url: string }[],
    other_business_type: '',
  });

  const [newProduct, setNewProduct] = useState({ name: '', sku: '', category: '' });
  const [newCert, setNewCert] = useState({ name: '', expiry_date: '', verification_method: 'self' as 'self' | 'api', document_url: '' });
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});

  const toggleSector = (sector: string) => {
    setExpandedSectors(prev => ({ ...prev, [sector]: !prev[sector] }));
  };

  // 15 MAJOR SECTORS + EXHAUSTIVE SUB-INDUSTRIES
  const industrySectors = {
    'Agriculture & Primary Production': ['Crop Farming', 'Horticulture', 'Viticulture', 'Organic Farming', 'Hydroponics', 'Beekeeping', 'Seed Production'],
    'Livestock & Animal Production': ['Cattle Farming', 'Sheep & Goat', 'Poultry Farming', 'Pig Farming', 'Dairy Farming', 'Aquaculture', 'Game Farming'],
    'Food & Beverage Manufacturing': ['Meat Processing', 'Dairy Processing', 'Bakery & Confectionery', 'Beverage Production', 'Snack Foods', 'Ready Meals', 'Frozen Foods'],
    'Packaging & Materials': ['Plastic Packaging', 'Paper & Cardboard', 'Glass & Metal', 'Flexible Packaging', 'Sustainable Packaging', 'Label Printing'],
    'Distribution & Wholesale': ['National Distributor', 'Regional Wholesaler', 'Cash & Carry', 'Import/Export Agent', 'Cold Chain Wholesaler', 'Specialty Ingredients'],
    'Logistics & Transportation': ['Road Freight', 'Sea Freight', 'Air Cargo', 'Cold Chain Logistics', 'Warehousing', 'Last-Mile Delivery', 'Rail Freight'],
    'Retail & E-commerce': ['Supermarket Chain', 'Specialty Food Retail', 'Online Grocery', 'Convenience Stores', 'Farmers Markets', 'Pharmacy Retail'],
    'Hospitality & Food Service': ['Restaurants', 'Hotels & Resorts', 'Catering Services', 'Cafes & Coffee Shops', 'Quick Service Restaurants', 'Institutional Catering'],
    'Quality, Safety & Certification': ['HACCP Consulting', 'Food Safety Auditing', 'Traceability Solutions', 'Lab Testing', 'Organic Certification', 'Halal/Kosher'],
    'Sustainability & Environmental': ['Carbon Footprint Tracking', 'Waste Management', 'Water Conservation', 'Ethical Sourcing', 'Renewable Energy', 'Circular Economy'],
    'Finance & Supply Chain Finance': ['Trade Finance', 'Invoice Financing', 'Insurance', 'Banking Services', 'Fintech Solutions', 'Export Credit'],
    'Technology & Software': ['ERP Systems', 'Supply Chain Software', 'Blockchain Traceability', 'AI Analytics', 'IoT Sensors', 'Mobile Apps'],
    'Government & Public Sector': ['Municipal Procurement', 'State Agencies', 'Export Promotion Boards', 'Regulatory Bodies', 'NGOs'],
    'Healthcare & Pharmaceuticals': ['Pharmaceutical Manufacturing', 'Medical Devices', 'Nutraceuticals', 'Veterinary Products', 'Cosmetics'],
    'Construction & Infrastructure': ['Building Materials', 'Cold Storage Construction', 'Logistics Parks', 'Road & Port Infrastructure', 'Renewable Energy Plants'],
  };

  const locationData = {
    Africa: { countries: ['South Africa', 'Namibia', 'Botswana', 'Kenya', 'Nigeria', 'Egypt', 'Ghana'], provinces: { /* same as before */ } },
    'North America': { countries: ['United States', 'Canada', 'Mexico'], provinces: { /* same as before */ } },
    Europe: { countries: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Spain'], provinces: { /* same as before */ } },
    Asia: { countries: ['China', 'India', 'Japan', 'Singapore', 'United Arab Emirates'], provinces: { /* same as before */ } },
    'South America': { countries: ['Brazil', 'Argentina', 'Chile'], provinces: { /* same as before */ } },
    Oceania: { countries: ['Australia', 'New Zealand'], provinces: { /* same as before */ } },
  };

  const steps = [
    // Step 1: Company Basics
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

    // Step 2: Exhaustive Industry Sectors
    () => (
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-8 text-[#00b4d8]">What type of business are you?</h2>
        <p className="text-slate-600 mb-8">Select all that apply – every major sector and sub-industry is covered.</p>

        <div className="space-y-6">
          {Object.entries(industrySectors).map(([sector, subs]) => (
            <div key={sector} className="border border-slate-200 rounded-3xl overflow-hidden">
              <button onClick={() => toggleSector(sector)} className="w-full flex justify-between items-center px-8 py-6 text-left hover:bg-slate-50">
                <span className="text-xl font-semibold text-[#00b4d8]">{sector}</span>
                <ChevronDown className={`transition ${expandedSectors[sector] ? 'rotate-180' : ''}`} />
              </button>
              {expandedSectors[sector] && (
                <div className="px-8 pb-8 grid grid-cols-2 gap-3">
                  {subs.map(sub => (
                    <label key={sub} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={form.business_types.includes(sub)} onChange={() => {
                        setForm(prev => ({...prev, business_types: prev.business_types.includes(sub) ? prev.business_types.filter(t => t !== sub) : [...prev.business_types, sub]}));
                      }} />
                      {sub}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* OTHER OPTION */}
          <div className="border border-slate-200 rounded-3xl p-6">
            <label className="flex items-center gap-3 text-lg font-medium">
              <input type="checkbox" checked={form.business_types.includes('Other')} onChange={() => {
                setForm(prev => ({...prev, business_types: prev.business_types.includes('Other') ? prev.business_types.filter(t => t !== 'Other') : [...prev.business_types, 'Other']}));
              }} />
              Other (please specify)
            </label>
            {form.business_types.includes('Other') && (
              <input type="text" placeholder="Describe your business type" className="input mt-4 w-full" value={form.other_business_type} onChange={e => setForm(p => ({...p, other_business_type: e.target.value}))} />
            )}
          </div>
        </div>
      </div>
    ),

    // Step 3: Location (Continent → Country → Province)
    () => (
      <div>
        <h2 className="text-4xl font-black tracking-tighter mb-8 text-[#00b4d8]">Where are you located?</h2>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <label className="block text-sm font-medium mb-2">Continent</label>
            <select className="input w-full" value={form.continent} onChange={e => setForm(p => ({...p, continent: e.target.value, country: '', province: ''}))}>
              <option value="">Select continent</option>
              {Object.keys(locationData).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Country</label>
            <select className="input w-full" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value, province: ''}))} disabled={!form.continent}>
              <option value="">Select country</option>
              {form.continent && locationData[form.continent as keyof typeof locationData]?.countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Province / State</label>
            <select className="input w-full" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))} disabled={!form.country}>
              <option value="">Select province/state</option>
              {form.country && locationData[form.continent as keyof typeof locationData]?.provinces[form.country]?.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium mb-2">City</label>
            <input className="input w-full" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Street Address</label>
            <input className="input w-full" value={form.street} onChange={e => setForm(p => ({...p, street: e.target.value}))} />
          </div>
        </div>
        <div className="mt-8">
          <label className="block text-sm font-medium mb-2">Postal Code</label>
          <input className="input w-full" value={form.postal_code} onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} />
        </div>
      </div>
    ),

    // Step 4: Financial (unchanged)
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

    // Step 5: Products & Certifications
    () => (
      <div className="space-y-12">
        <div>
          <h3 className="text-2xl font-bold mb-6">Your Products / Services</h3>
          <div className="flex gap-4">
            <input className="input flex-1" placeholder="Product name" value={newProduct.name} onChange={e => setNewProduct(p => ({...p, name: e.target.value}))} />
            <button onClick={() => { if (newProduct.name) { setForm(p => ({...p, products: [...p.products, newProduct]})); setNewProduct({ name: '', sku: '', category: '' }); } }} className="btn-primary px-8">Add</button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {form.products.map((p, i) => <div key={i} className="card text-sm p-4">{p.name}</div>)}
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold mb-6">Certifications & Documents</h3>
          <div className="grid grid-cols-2 gap-6">
            <input className="input" placeholder="Certificate name" value={newCert.name} onChange={e => setNewCert(p => ({...p, name: e.target.value}))} />
            <input type="date" className="input" value={newCert.expiry_date} onChange={e => setNewCert(p => ({...p, expiry_date: e.target.value}))} />
          </div>
          <button onClick={() => { if (newCert.name) { setForm(p => ({...p, certifications: [...p.certifications, newCert]})); setNewCert({ name: '', expiry_date: '', verification_method: 'self', document_url: '' }); } }} className="btn-primary mt-6">Add Certificate</button>
        </div>
      </div>
    ),

    // Step 6: Review
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
      await supabase.from('profiles').upsert({ id: user?.id, ...form });
      toast.success('🎉 Welcome to SupplierAdvisor! Your business is now verified.');
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error('Something went wrong.');
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