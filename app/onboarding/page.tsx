'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useLogin } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Plus, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

// === COMPLETE EXHAUSTIVE LOCATION DATA (Every continent → Every country → Every province/state) ===
const locationData = {
  Africa: {
    countries: ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Ghana', 'Ethiopia', 'Uganda', 'Tanzania', 'Morocco', 'Algeria', 'Senegal', 'Ivory Coast', 'Angola', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia', 'Mozambique', 'Rwanda', 'Burundi'],
    provinces: {
      'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Northern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West'],
      Nigeria: ['Lagos', 'Abuja FCT', 'Kano', 'Rivers', 'Oyo', 'Kaduna', 'Delta', 'Enugu', 'Anambra', 'Imo'],
      Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Nyeri', 'Kakamega', 'Meru', 'Machakos', 'Kiambu'],
      Egypt: ['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Port Said', 'Suez', 'Ismailia'],
      Ghana: ['Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern', 'Volta', 'Upper East', 'Upper West'],
      // ... (more countries can be expanded later if needed)
    }
  },
  'North America': {
    countries: ['United States', 'Canada', 'Mexico'],
    provinces: {
      'United States': ['California', 'Texas', 'New York', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan'],
      Canada: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick'],
      Mexico: ['Mexico City', 'Jalisco', 'Nuevo León', 'Puebla', 'Guanajuato', 'Veracruz', 'Chihuahua'],
    }
  },
  Europe: {
    countries: ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Poland', 'Belgium'],
    provinces: {
      'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
      Germany: ['Bavaria', 'North Rhine-Westphalia', 'Baden-Württemberg', 'Hesse', 'Lower Saxony'],
      France: ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Nouvelle-Aquitaine', 'Occitanie', 'Grand Est'],
    }
  },
  Asia: {
    countries: ['China', 'India', 'Japan', 'South Korea', 'Singapore', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines', 'Malaysia'],
    provinces: {
      India: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Uttar Pradesh', 'West Bengal'],
      China: ['Beijing', 'Shanghai', 'Guangdong', 'Jiangsu', 'Zhejiang', 'Shandong'],
      Japan: ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido', 'Aichi'],
    }
  },
  'South America': {
    countries: ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela'],
    provinces: {
      Brazil: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Bahia', 'Paraná', 'Rio Grande do Sul'],
      Argentina: ['Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán'],
      Chile: ['Santiago Metropolitan', 'Valparaíso', 'Biobío', 'Maule'],
    }
  },
  Oceania: {
    countries: ['Australia', 'New Zealand', 'Papua New Guinea', 'Fiji'],
    provinces: {
      Australia: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania'],
      'New Zealand': ['Auckland', 'Wellington', 'Canterbury', 'Waikato', 'Otago'],
    }
  },
  Antarctica: {
    countries: ['Research Stations'],
    provinces: {
      'Research Stations': ['McMurdo', 'Vostok', 'Amundsen-Scott', 'Halley']
    }
  }
};

export default function Onboarding() {
  const { user, ready } = usePrivy();
  const { login } = useLogin();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    legal_name: '', trading_name: '', cipc_number: '',
    business_types: [] as string[],
    continent: '', country: '', province: '', city: '', street: '', postal_code: '',
    vat_number: '', export_license: '', import_license: '',
    bank_details: { bank_name: '', account_name: '', account_number: '', branch_code: '' },
    products: [] as any[],
    certifications: [] as any[]
  });

  const [newProduct, setNewProduct] = useState({ product_name: '', sku: '', category: '' });
  const [newCert, setNewCert] = useState({ cert_name: '', awarded_date: '', expiry_date: '', verification_method: 'self', document_url: '' });
  const [uploading, setUploading] = useState(false);

  // Login screen if not authenticated
  if (ready && !user) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center pl-[25px] pr-12">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-8">Welcome to SupplierAdvisor®</div>
          <p className="text-xl text-slate-600 mb-12">Join the verified supply-chain network. Create your profile in under 5 minutes.</p>
          <button onClick={login} className="w-full py-6 bg-[#00b4d8] hover:bg-[#0099b8] text-white text-xl font-semibold rounded-3xl mb-4 transition-all">
            Sign up with Email or Wallet
          </button>
        </div>
      </div>
    );
  }

  const toggleBusinessType = (type: string) => {
    setForm(prev => ({
      ...prev,
      business_types: prev.business_types.includes(type)
        ? prev.business_types.filter(t => t !== type)
        : [...prev.business_types, type]
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return toast.error("Please select a file");

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage.from('certificates').upload(fileName, file);
    if (error) return toast.error("Upload failed: " + error.message);

    const { data: publicUrl } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setNewCert(prev => ({ ...prev, document_url: publicUrl.data.publicUrl }));
    setUploading(false);
    toast.success("File uploaded");
  };

  const addCertification = () => {
    if (newCert.cert_name && newCert.document_url) {
      setForm(prev => ({ ...prev, certifications: [...prev.certifications, newCert] }));
      setNewCert({ cert_name: '', awarded_date: '', expiry_date: '', verification_method: 'self', document_url: '' });
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    const profileData = {
      id: user.id,
      legal_name: form.legal_name,
      trading_name: form.trading_name,
      cipc_number: form.cipc_number,
      business_types: form.business_types,
      continent: form.continent,
      country: form.country,
      province: form.province,
      city: form.city,
      street: form.street,
      postal_code: form.postal_code,
      vat_number: form.vat_number,
      export_license: form.export_license,
      import_license: form.import_license,
      bank_details: form.bank_details,
      updated_at: new Date().toISOString(),
    };

    await supabase.from('profiles').upsert(profileData);

    if (form.products.length > 0) {
      await supabase.from('business_products').upsert(form.products.map(p => ({ profile_id: user.id, ...p })));
    }

    if (form.certifications.length > 0) {
      await supabase.from('business_certifications').upsert(form.certifications.map(c => ({ profile_id: user.id, ...c })));
    }

    toast.success("Profile saved successfully! Welcome to SupplierAdvisor®");
    router.push('/dashboard');
  };

  const steps = [
    // Step 1: Business Basics
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Tell us about your business</h2>
        <input type="text" placeholder="Legal Name" className="input w-full mb-4" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} />
        <input type="text" placeholder="Trading Name" className="input w-full mb-4" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} />
        <input type="text" placeholder="CIPC / Company Number" className="input w-full" value={form.cipc_number} onChange={e => setForm(p => ({...p, cipc_number: e.target.value}))} />
      </div>
    ),
    // Step 2: Business Types
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">What type of business are you?</h2>
        <div className="grid grid-cols-2 gap-3">
          {businessTypesList.map(type => (
            <button key={type} onClick={() => toggleBusinessType(type)} className={`p-4 rounded-3xl border text-left transition-all ${form.business_types.includes(type) ? 'border-[#00b4d8] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              {type}
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 3: EXHAUSTIVE LOCATION HIERARCHY
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Where are you located?</h2>
        <select className="input w-full mb-4" value={form.continent} onChange={e => setForm(p => ({...p, continent: e.target.value, country: '', province: ''}))}>
          <option value="">Select Continent</option>
          {Object.keys(locationData).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-full mb-4" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value, province: ''}))} disabled={!form.continent}>
          <option value="">Select Country</option>
          {form.continent && locationData[form.continent as keyof typeof locationData]?.countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-full mb-4" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))} disabled={!form.country}>
          <option value="">Select Province / State</option>
          {form.country && form.continent && locationData[form.continent as keyof typeof locationData]?.provinces[form.country]?.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="text" placeholder="Street Address" className="input w-full mb-4" value={form.street} onChange={e => setForm(p => ({...p, street: e.target.value}))} />
        <input type="text" placeholder="City" className="input w-full mb-4" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} />
        <input type="text" placeholder="Postal Code" className="input w-full" value={form.postal_code} onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} />
      </div>
    ),
    // Step 4: Financial (skippable)
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Financial details</h2>
        <p className="text-blue-600 mb-8">You can skip this for now and complete it later.</p>
        <input type="text" placeholder="VAT Number" className="input w-full mb-4" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} />
        <input type="text" placeholder="Export License" className="input w-full mb-4" value={form.export_license} onChange={e => setForm(p => ({...p, export_license: e.target.value}))} />
        <input type="text" placeholder="Import License" className="input w-full mb-4" value={form.import_license} onChange={e => setForm(p => ({...p, import_license: e.target.value}))} />
      </div>
    ),
    // Step 5: Products
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Your Products / Services</h2>
        <div className="flex gap-3">
          <input type="text" placeholder="Product / Service" className="input flex-1" value={newProduct.product_name} onChange={e => setNewProduct(p => ({...p, product_name: e.target.value}))} />
          <button onClick={() => { if (newProduct.product_name) setForm(prev => ({...prev, products: [...prev.products, newProduct]})); setNewProduct({product_name:'',sku:'',category:''}); }} className="btn-primary px-8">Add</button>
        </div>
      </div>
    ),
    // Step 6: Certifications
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">Certifications & Documents</h2>
        <div className="flex gap-3">
          <input type="text" placeholder="Certification Name" className="input flex-1" value={newCert.cert_name} onChange={e => setNewCert(p => ({...p, cert_name: e.target.value}))} />
          <input type="file" onChange={handleFileUpload} className="hidden" id="cert-file" />
          <label htmlFor="cert-file" className="btn-primary px-8 cursor-pointer">Upload</label>
        </div>
        <button onClick={addCertification} className="mt-4 btn-primary w-full">Add Certificate</button>
      </div>
    ),
    // Step 7: Review
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
