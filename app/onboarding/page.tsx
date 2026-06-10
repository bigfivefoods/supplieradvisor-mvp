'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, ChevronDown, Wallet, Upload, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface LocationData {
  [continent: string]: {
    countries: Array<{ name: string; flag: string }>;
    provinces: Record<string, string[]>;
  };
}

const locationData: LocationData = {
  Africa: {
    countries: [
      { name: "Algeria", flag: "🇩🇿" }, { name: "Angola", flag: "🇦🇴" }, { name: "Benin", flag: "🇧🇯" },
      { name: "Botswana", flag: "🇧🇼" }, { name: "Burkina Faso", flag: "🇧🇫" }, { name: "Burundi", flag: "🇧🇮" },
      { name: "Cameroon", flag: "🇨🇲" }, { name: "Cape Verde", flag: "🇨🇻" }, { name: "Central African Republic", flag: "🇨🇫" },
      { name: "Chad", flag: "🇹🇩" }, { name: "Comoros", flag: "🇰🇲" }, { name: "Democratic Republic of the Congo", flag: "🇨🇩" },
      { name: "Republic of the Congo", flag: "🇨🇬" }, { name: "Djibouti", flag: "🇩🇯" }, { name: "Egypt", flag: "🇪🇬" },
      { name: "Equatorial Guinea", flag: "🇬🇶" }, { name: "Eritrea", flag: "🇪🇷" }, { name: "Eswatini", flag: "🇸🇿" },
      { name: "Ethiopia", flag: "🇪🇹" }, { name: "Gabon", flag: "🇬🇦" }, { name: "Gambia", flag: "🇬🇲" },
      { name: "Ghana", flag: "🇬🇭" }, { name: "Guinea", flag: "🇬🇳" }, { name: "Ivory Coast", flag: "🇨🇮" },
      { name: "Kenya", flag: "🇰🇪" }, { name: "Lesotho", flag: "🇱🇸" }, { name: "Liberia", flag: "🇱🇷" },
      { name: "Libya", flag: "🇱🇾" }, { name: "Madagascar", flag: "🇲🇬" }, { name: "Malawi", flag: "🇲🇼" },
      { name: "Mali", flag: "🇲🇱" }, { name: "Mauritania", flag: "🇲🇷" }, { name: "Mauritius", flag: "🇲🇺" },
      { name: "Morocco", flag: "🇲🇦" }, { name: "Mozambique", flag: "🇲🇿" }, { name: "Namibia", flag: "🇳🇦" },
      { name: "Niger", flag: "🇳🇪" }, { name: "Nigeria", flag: "🇳🇬" }, { name: "Rwanda", flag: "🇷🇼" },
      { name: "Senegal", flag: "🇸🇳" }, { name: "Seychelles", flag: "🇸🇨" }, { name: "Sierra Leone", flag: "🇸🇱" },
      { name: "South Africa", flag: "🇿🇦" }, { name: "South Sudan", flag: "🇸🇸" }, { name: "Sudan", flag: "🇸🇩" },
      { name: "Tanzania", flag: "🇹🇿" }, { name: "Togo", flag: "🇹🇬" }, { name: "Tunisia", flag: "🇹🇳" },
      { name: "Uganda", flag: "🇺🇬" }, { name: "Zambia", flag: "🇿🇲" }, { name: "Zimbabwe", flag: "🇿🇼" }
    ],
    provinces: {
      'South Africa': ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Northern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West'],
      'Nigeria': ['Lagos', 'Abuja', 'Kano', 'Rivers', 'Oyo'],
      'Kenya': ['Nairobi', 'Mombasa', 'Kisumu'],
      'Egypt': ['Cairo', 'Alexandria', 'Giza'],
    }
  },
  'North America': {
    countries: [
      { name: "United States", flag: "🇺🇸" }, { name: "Canada", flag: "🇨🇦" }, { name: "Mexico", flag: "🇲🇽" }
    ],
    provinces: {
      'United States': ['California', 'Texas', 'New York', 'Florida'],
      'Canada': ['Ontario', 'Quebec', 'British Columbia'],
      'Mexico': ['Mexico City', 'Jalisco']
    }
  },
  'South America': {
    countries: [
      { name: "Brazil", flag: "🇧🇷" }, { name: "Argentina", flag: "🇦🇷" }, { name: "Colombia", flag: "🇨🇴" },
      { name: "Chile", flag: "🇨🇱" }, { name: "Peru", flag: "🇵🇪" }
    ],
    provinces: {}
  },
  Europe: {
    countries: [
      { name: "United Kingdom", flag: "🇬🇧" }, { name: "Germany", flag: "🇩🇪" }, { name: "France", flag: "🇫🇷" },
      { name: "Italy", flag: "🇮🇹" }, { name: "Spain", flag: "🇪🇸" }
    ],
    provinces: {}
  },
  Asia: {
    countries: [
      { name: "China", flag: "🇨🇳" }, { name: "India", flag: "🇮🇳" }, { name: "Japan", flag: "🇯🇵" },
      { name: "South Korea", flag: "🇰🇷" }, { name: "Indonesia", flag: "🇮🇩" }
    ],
    provinces: {}
  },
  'Australia & Oceania': {
    countries: [
      { name: "Australia", flag: "🇦🇺" }, { name: "New Zealand", flag: "🇳🇿" }
    ],
    provinces: {}
  }
};

const businessTypesList = [
  'Farmer / Producer', 'Manufacturer / Processor', 'Packer', 'Distributor',
  'Wholesaler', 'Importer', 'Exporter', 'Retailer', 'Logistics Provider',
  'Government Entity', 'NGO / Non-Profit', 'Other'
];

const industriesList = [
  { name: 'Accommodation & Food Services', sub: ['Restaurants', 'Hotels', 'Catering', 'Cafes', 'Bars', 'Event Catering'] },
  { name: 'Agriculture & Farming', sub: ['Crop Production', 'Livestock Farming', 'Horticulture', 'Aquaculture', 'Organic Farming', 'Agri-Tech', 'Forestry', 'Beekeeping', 'Poultry', 'Dairy Farming', 'Viticulture', 'Fisheries'] },
  { name: 'Education & Academics', sub: ['Pre-School', 'Junior School', 'High School', 'Colleges', 'Universities', 'Technical Training', 'Adult Education', 'Online Learning'] },
  { name: 'Food Processing', sub: ['Meat Processing', 'Dairy Processing', 'Bakery', 'Beverages', 'Snack Foods', 'Ready Meals'] },
  { name: 'Healthcare', sub: ['Hospitals', 'Clinics', 'Pharmaceuticals', 'Medical Devices', 'Diagnostics'] },
  { name: 'Manufacturing', sub: ['Automotive', 'Electronics', 'Textiles', 'Chemicals', 'Machinery'] },
  { name: 'Retail & Wholesale', sub: ['Supermarkets', 'Specialty Stores', 'E-commerce', 'Wholesale Distributors'] },
  { name: 'Logistics & Transportation', sub: ['Freight', 'Warehousing', 'Last-Mile Delivery', 'Cold Chain'] },
  { name: 'Other', sub: [] }
];

export default function Onboarding() {
  const { user } = usePrivy();
  const router = useRouter();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    legal_name: '',
    trading_name: '',
    registration_number: '',
    contact_name: '',
    email: '',
    business_type: '',
    planet: 'Earth',
    continent: '',
    country: '',
    province: '',
    street: '',
    city: '',
    postal_code: '',
    industries: [] as string[],
    bank_name: '',
    account_name: '',
    account_number: '',
    iban: '',
    swift: '',
    products: [] as any[],
    services: [] as string[],
    certifications: [] as any[]
  });

  const saveProfile = async () => {
    setLoading(true);
    const profileData = { id: cleanId, ...form, updated_at: new Date().toISOString(), loyalty_enabled: false };
    const { error: profileError } = await supabase.from('profiles').upsert(profileData);
    if (profileError) console.error("Profile upsert error:", profileError);
    else console.log("✅ Profiles upsert success");

    toast.success('Profile saved successfully!');
    router.push('/dashboard/select-company');
    setLoading(false);
  };

  const steps = [
    // Step 1: Company Details
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">1. Company Details</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Legal Name</label>
            <input type="text" className="input w-full" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Trading Name</label>
            <input type="text" className="input w-full" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} />
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium mb-2">Registration Number (CIPC)</label>
          <input type="text" className="input w-full" value={form.registration_number} onChange={e => setForm(p => ({...p, registration_number: e.target.value}))} />
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium mb-2">Business Type</label>
          <select className="input w-full" value={form.business_type} onChange={e => setForm(p => ({...p, business_type: e.target.value}))}>
            <option value="">Select Business Type</option>
            {businessTypesList.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>
    ),
    // Step 2: Location
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">2. Location</h2>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Planet</label>
            <select className="input w-full" value={form.planet} onChange={e => setForm(p => ({...p, planet: e.target.value}))}>
              <option value="Earth">Earth</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Continent</label>
            <select className="input w-full" value={form.continent} onChange={e => setForm(p => ({...p, continent: e.target.value}))}>
              <option value="">Select Continent</option>
              <option value="Africa">Africa</option>
              <option value="North America">North America</option>
              <option value="South America">South America</option>
              <option value="Europe">Europe</option>
              <option value="Asia">Asia</option>
              <option value="Australia & Oceania">Australia & Oceania</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Country</label>
            <select className="input w-full" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))}>
              <option value="">Select Country</option>
              {locationData[form.continent]?.countries.map(c => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Province / State</label>
            <select className="input w-full" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))}>
              <option value="">Select Province</option>
              {locationData[form.continent]?.provinces[form.country]?.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 mt-8">
          <div>
            <label className="block text-sm font-medium mb-2">Street Address</label>
            <input type="text" className="input w-full" value={form.street} onChange={e => setForm(p => ({...p, street: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">City</label>
            <input type="text" className="input w-full" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Postal Code</label>
            <input type="text" className="input w-full" value={form.postal_code} onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} />
          </div>
        </div>
      </div>
    ),
    // Step 3: Industries & Sub-Industries
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">3. Industries & Sub-Industries</h2>
        <div className="grid grid-cols-3 gap-6">
          {industriesList.map((industry, i) => (
            <div key={i} className="border p-4 rounded-3xl">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.industries.includes(industry.name)} onChange={() => {
                  if (form.industries.includes(industry.name)) {
                    setForm(p => ({ ...p, industries: p.industries.filter(ind => ind !== industry.name) }));
                  } else {
                    setForm(p => ({ ...p, industries: [...p.industries, industry.name] }));
                  }
                }} />
                {industry.name}
              </label>
            </div>
          ))}
        </div>
      </div>
    ),
    // Step 4: Financial & Banking
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">4. Financial & Banking</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Bank Name</label>
            <input type="text" className="input w-full" value={form.bank_name} onChange={e => setForm(p => ({...p, bank_name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Account Name</label>
            <input type="text" className="input w-full" value={form.account_name} onChange={e => setForm(p => ({...p, account_name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Account Number</label>
            <input type="text" className="input w-full" value={form.account_number} onChange={e => setForm(p => ({...p, account_number: e.target.value}))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-8">
          <div>
            <label className="block text-sm font-medium mb-2">IBAN</label>
            <input type="text" className="input w-full" value={form.iban} onChange={e => setForm(p => ({...p, iban: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">SWIFT</label>
            <input type="text" className="input w-full" value={form.swift} onChange={e => setForm(p => ({...p, swift: e.target.value}))} />
          </div>
        </div>
      </div>
    ),
    // Step 5: Products & Services
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">5. Products & Services</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold mb-4">Products</h3>
            <button className="btn-primary w-full py-4">Add Product</button>
          </div>
          <div>
            <h3 className="font-bold mb-4">Services</h3>
            <button className="btn-primary w-full py-4">Add Service</button>
          </div>
        </div>
      </div>
    ),
    // Step 6: Certificates & Documents
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">6. Certificates & Documents</h2>
        <button className="btn-primary w-full py-4">Upload Certificate</button>
      </div>
    ),
    // Step 7: Review & Submit
    () => (
      <div>
        <h2 className="text-3xl font-bold mb-8">7. Review & Submit</h2>
        <pre className="bg-slate-100 p-8 rounded-3xl text-sm overflow-auto max-h-96">{JSON.stringify(form, null, 2)}</pre>
        <p className="text-emerald-600 mt-8">R299 per company/month after 30-day free trial • Unlimited users included</p>
      </div>
    )
  ];

  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-6xl font-black tracking-[-3px]">Verify Your Business</h1>
          <div className="text-sm font-medium text-slate-500">Step {step + 1} of 7</div>
        </div>
        <div className="card p-12">{steps[step]()}</div>
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