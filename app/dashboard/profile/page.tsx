'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { ArrowRight, ChevronDown, RefreshCw, RotateCw } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import toast from 'react-hot-toast';

type LocationData = {
  [continent: string]: {
    countries: string[];
    provinces: Record<string, string[]>;
  };
};

export default function MyBusinessProfile() {
  const { user } = usePrivy();

  // NORMALIZE PRIVY ID (this fixes the disappearing data bug)
  const rawId = user?.id || '';
  const cleanId = rawId.startsWith('privy:') ? rawId.slice(6) : rawId;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("Ready – click Save or Refresh");

  const [form, setForm] = useState({
    legal_name: '', trading_name: '', cipc_number: '',
    contact_name: '', email: '',
    business_types: [] as string[],
    continent: '', country: '', province: '', city: '', street: '', postal_code: '',
    vat_number: '', export_license: '', import_license: '',
    bank_details: { bank_name: '', account_name: '', account_number: '', branch_code: '' },
    products: [] as { name: string; sku: string; category: string }[],
    certifications: [] as { name: string; awarded_date: string; expiry_date: string; verification_method: 'self' | 'api'; document_url: string }[],
    other_business_type: '',
  });

  const [newProduct, setNewProduct] = useState({ name: '', sku: '', category: '' });
  const [newCert, setNewCert] = useState({ name: '', awarded_date: '', expiry_date: '', verification_method: 'self' as 'self' | 'api', document_url: '' });
  const [noExpiry, setNoExpiry] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    basics: true,
    location: true,
    industries: true,
    financial: true,
    products: true,
    certifications: true,
  });

  const toggleSection = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadData = async () => {
    if (!cleanId) {
      setStatus("❌ No user ID found");
      return;
    }
    setStatus("🔄 Loading from Supabase...");
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Loading for cleanId:`, cleanId);

    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', cleanId).single();
      const { data: products } = await supabase.from('business_products').select('*').eq('profile_id', cleanId);
      const { data: certs } = await supabase.from('business_certifications').select('*').eq('profile_id', cleanId);

      setForm({
        legal_name: profile?.legal_name || '',
        trading_name: profile?.trading_name || '',
        cipc_number: profile?.cipc_number || '',
        contact_name: profile?.contact_name || '',
        email: profile?.email || '',
        business_types: profile?.business_types || [],
        continent: profile?.continent || '',
        country: profile?.country || '',
        province: profile?.province || '',
        city: profile?.city || '',
        street: profile?.street || '',
        postal_code: profile?.postal_code || '',
        vat_number: profile?.vat_number || '',
        export_license: profile?.export_license || '',
        import_license: profile?.import_license || '',
        bank_details: profile?.bank_details || { bank_name: '', account_name: '', account_number: '', branch_code: '' },
        products: products || [],
        certifications: certs || [],
        other_business_type: profile?.other_business_type || '',
      });

      setStatus(`✅ Loaded – ${products?.length || 0} products • ${certs?.length || 0} certifications`);
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Data loaded successfully`);
    } catch (err: any) {
      console.error("💥 Load error:", err);
      setStatus("❌ Load failed – check console");
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const saveProfile = async () => {
    if (!cleanId) return toast.error("User not found");
    setLoading(true);
    setStatus("💾 Saving...");
    try {
      await supabase.from('profiles').upsert({ id: cleanId, ...form });
      await supabase.from('business_products').delete().eq('profile_id', cleanId);
      if (form.products.length > 0) await supabase.from('business_products').insert(form.products.map(p => ({ profile_id: cleanId, ...p })));
      await supabase.from('business_certifications').delete().eq('profile_id', cleanId);
      if (form.certifications.length > 0) await supabase.from('business_certifications').insert(form.certifications.map(c => ({ profile_id: cleanId, ...c })));

      toast.success('✅ Profile saved successfully!');
      await loadData();
    } catch (err: any) {
      console.error("💥 Save error:", err);
      toast.error('Save failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const hardReload = () => window.location.reload();

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

  const locationData: LocationData = {
    Africa: {
      countries: ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Ghana', 'Ethiopia', 'Uganda', 'Tanzania', 'Morocco', 'Algeria', 'Senegal', 'Ivory Coast', 'Angola', 'Zambia', 'Zimbabwe'],
      provinces: {
        'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Northern Cape', 'Limpopo', 'Mpumalanga', 'North West'],
        'Nigeria': ['Lagos', 'Abuja', 'Kano', 'Rivers', 'Oyo', 'Kaduna'],
        'Kenya': ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
        'Egypt': ['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan'],
        'Ghana': ['Accra', 'Kumasi', 'Tamale', 'Cape Coast'],
        'Ethiopia': ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray'],
        'Uganda': ['Kampala', 'Wakiso', 'Jinja'],
        'Tanzania': ['Dar es Salaam', 'Arusha', 'Mwanza'],
        'Morocco': ['Casablanca', 'Rabat', 'Marrakech'],
        'Algeria': ['Algiers', 'Oran', 'Constantine'],
        'Senegal': ['Dakar', 'Thiès'],
        'Ivory Coast': ['Abidjan', 'Bouaké'],
        'Angola': ['Luanda', 'Huambo'],
        'Zambia': ['Lusaka', 'Kitwe'],
        'Zimbabwe': ['Harare', 'Bulawayo']
      }
    },
    'North America': {
      countries: ['United States', 'Canada', 'Mexico'],
      provinces: {
        'United States': ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'],
        'Canada': ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan'],
        'Mexico': ['Mexico City', 'Jalisco', 'Nuevo León', 'Yucatán', 'Baja California', 'Chihuahua']
      }
    },
    Europe: {
      countries: ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Poland', 'Portugal', 'Greece', 'Austria', 'Switzerland'],
      provinces: {
        'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
        'Germany': ['Bavaria', 'Berlin', 'Hamburg', 'North Rhine-Westphalia', 'Baden-Württemberg'],
        'France': ['Île-de-France', 'Provence-Alpes-Côte d\'Azur', 'Auvergne-Rhône-Alpes', 'Occitanie'],
        'Italy': ['Lombardy', 'Lazio', 'Campania', 'Veneto'],
        'Spain': ['Catalonia', 'Andalusia', 'Madrid', 'Valencia'],
        'Netherlands': ['North Holland', 'South Holland', 'Utrecht'],
        'Belgium': ['Flanders', 'Wallonia', 'Brussels'],
        'Sweden': ['Stockholm', 'Gothenburg', 'Malmö'],
        'Norway': ['Oslo', 'Bergen', 'Trondheim'],
        'Denmark': ['Capital Region', 'Central Denmark'],
        'Poland': ['Masovia', 'Silesia', 'Lesser Poland'],
        'Portugal': ['Lisbon', 'Porto'],
        'Greece': ['Attica', 'Central Macedonia'],
        'Austria': ['Vienna', 'Tyrol', 'Salzburg'],
        'Switzerland': ['Zurich', 'Geneva', 'Bern']
      }
    },
    Asia: {
      countries: ['China', 'India', 'Japan', 'South Korea', 'Singapore', 'United Arab Emirates', 'Saudi Arabia', 'Turkey', 'Indonesia', 'Thailand', 'Malaysia', 'Vietnam', 'Philippines'],
      provinces: {
        'China': ['Shanghai', 'Beijing', 'Guangdong', 'Zhejiang', 'Jiangsu'],
        'India': ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat'],
        'Japan': ['Tokyo', 'Osaka', 'Kanagawa', 'Aichi'],
        'South Korea': ['Seoul', 'Busan', 'Incheon'],
        'Singapore': ['Singapore'],
        'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
        'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca'],
        'Turkey': ['Istanbul', 'Ankara', 'Izmir'],
        'Indonesia': ['Jakarta', 'East Java', 'West Java'],
        'Thailand': ['Bangkok', 'Chiang Mai'],
        'Malaysia': ['Kuala Lumpur', 'Penang'],
        'Vietnam': ['Ho Chi Minh City', 'Hanoi'],
        'Philippines': ['Metro Manila', 'Cebu']
      }
    },
    'South America': {
      countries: ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia'],
      provinces: {
        'Brazil': ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Bahia'],
        'Argentina': ['Buenos Aires', 'Córdoba', 'Santa Fe'],
        'Chile': ['Santiago', 'Valparaíso', 'Biobío'],
        'Colombia': ['Bogotá', 'Medellín', 'Cali'],
        'Peru': ['Lima', 'Arequipa'],
        'Venezuela': ['Caracas', 'Maracaibo'],
        'Ecuador': ['Quito', 'Guayaquil'],
        'Bolivia': ['La Paz', 'Santa Cruz']
      }
    },
    Oceania: {
      countries: ['Australia', 'New Zealand', 'Fiji'],
      provinces: {
        'Australia': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia'],
        'New Zealand': ['Auckland', 'Wellington', 'Canterbury'],
        'Fiji': ['Central', 'Western']
      }
    }
  };

  return (
    <div className="pl-[25px] min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">My Business Profile</h1>

        <div className="mb-8 p-6 bg-white border border-slate-200 rounded-3xl flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Active Privy ID used by Supabase</div>
            <div className="font-mono text-[#00b4d8] break-all">{cleanId}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-medium">Status: <span className="font-bold text-[#00b4d8]">{status}</span></div>
          </div>
        </div>

        <div className="space-y-6">

          {/* Company Basics */}
          <div className="card">
            <button onClick={() => toggleSection('basics')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Company Basics</h2>
              <ChevronDown className={`transition ${expanded.basics ? 'rotate-180' : ''}`} />
            </button>
            {expanded.basics && (
              <div className="p-8 grid grid-cols-2 gap-8">
                <div><label className="block text-sm font-medium mb-2">Legal Name</label><input className="input w-full" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Trading Name</label><input className="input w-full" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Contact Name</label><input className="input w-full" value={form.contact_name} onChange={e => setForm(p => ({...p, contact_name: e.target.value}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Email Address</label><input type="email" className="input w-full" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
                <div><label className="block text-sm font-medium mb-2">CIPC Number</label><input className="input w-full" value={form.cipc_number} onChange={e => setForm(p => ({...p, cipc_number: e.target.value}))} /></div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="card">
            <button onClick={() => toggleSection('location')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Location</h2>
              <ChevronDown className={`transition ${expanded.location ? 'rotate-180' : ''}`} />
            </button>
            {expanded.location && (
              <div className="p-8">
                <div className="grid grid-cols-3 gap-8">
                  <div><label className="block text-sm font-medium mb-2">Continent</label><select className="input w-full" value={form.continent} onChange={e => setForm(p => ({...p, continent: e.target.value}))}><option value="">Select continent</option>{Object.keys(locationData).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="block text-sm font-medium mb-2">Country</label><select className="input w-full" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))}><option value="">Select country</option>{form.continent && locationData[form.continent as keyof LocationData]?.countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="block text-sm font-medium mb-2">Province / State</label><select className="input w-full" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))}><option value="">Select province/state</option>{form.country && form.continent && locationData[form.continent as keyof LocationData]?.provinces[form.country]?.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                </div>
                <div className="mt-10 grid grid-cols-2 gap-8">
                  <div><label className="block text-sm font-medium mb-2">City</label><input className="input w-full" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} /></div>
                  <div><label className="block text-sm font-medium mb-2">Street Address</label><input className="input w-full" value={form.street} onChange={e => setForm(p => ({...p, street: e.target.value}))} /></div>
                </div>
                <div className="mt-8"><label className="block text-sm font-medium mb-2">Postal Code</label><input className="input w-1/2" value={form.postal_code} onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} /></div>
              </div>
            )}
          </div>

          {/* Industries */}
          <div className="card">
            <button onClick={() => toggleSection('industries')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Industries</h2>
              <ChevronDown className={`transition ${expanded.industries ? 'rotate-180' : ''}`} />
            </button>
            {expanded.industries && (
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(industrySectors).map(([sector, subs]) => (
                    <div key={sector} className="border border-slate-200 rounded-3xl overflow-hidden">
                      <button onClick={() => toggleSection(sector)} className="w-full flex justify-between items-center px-6 py-5 text-left hover:bg-slate-50">
                        <span className="text-lg font-semibold text-[#00b4d8]">{sector}</span>
                        <ChevronDown className={`transition ${expanded[sector] ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded[sector] && (
                        <div className="px-6 pb-6 grid grid-cols-1 gap-2 text-sm">
                          {subs.map(sub => (
                            <label key={sub} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer">
                              <input type="checkbox" checked={form.business_types.includes(sub)} onChange={() => {
                                setForm(prev => ({
                                  ...prev,
                                  business_types: prev.business_types.includes(sub)
                                    ? prev.business_types.filter(t => t !== sub)
                                    : [...prev.business_types, sub]
                                }));
                              }} />
                              {sub}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Financial Details */}
          <div className="card">
            <button onClick={() => toggleSection('financial')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Financial Details</h2>
              <ChevronDown className={`transition ${expanded.financial ? 'rotate-180' : ''}`} />
            </button>
            {expanded.financial && (
              <div className="p-8 grid grid-cols-2 gap-8">
                <div><label className="block text-sm font-medium mb-2">VAT Number</label><input className="input w-full" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Export License Number</label><input className="input w-full" value={form.export_license} onChange={e => setForm(p => ({...p, export_license: e.target.value}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Import License Number</label><input className="input w-full" value={form.import_license} onChange={e => setForm(p => ({...p, import_license: e.target.value}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Bank Name</label><input className="input w-full" value={form.bank_details.bank_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, bank_name: e.target.value}}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Account Name</label><input className="input w-full" value={form.bank_details.account_name} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_name: e.target.value}}))} /></div>
                <div><label className="block text-sm font-medium mb-2">Account Number</label><input className="input w-full" value={form.bank_details.account_number} onChange={e => setForm(p => ({...p, bank_details: {...p.bank_details, account_number: e.target.value}}))} /></div>
              </div>
            )}
          </div>

          {/* Products / Services */}
          <div className="card">
            <button onClick={() => toggleSection('products')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Products / Services</h2>
              <ChevronDown className={`transition ${expanded.products ? 'rotate-180' : ''}`} />
            </button>
            {expanded.products && (
              <div className="p-8">
                <div className="flex gap-4">
                  <input className="input flex-1" placeholder="Product / Service" value={newProduct.name} onChange={e => setNewProduct(p => ({...p, name: e.target.value}))} />
                  <button onClick={() => { if (newProduct.name) { setForm(p => ({...p, products: [...p.products, newProduct]})); setNewProduct({ name: '', sku: '', category: '' }); } }} className="btn-primary px-8">Add</button>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  {form.products.map((p, i) => <div key={i} className="card text-sm p-4">{p.name}</div>)}
                </div>
              </div>
            )}
          </div>

          {/* Certifications & Documents */}
          <div className="card">
            <button onClick={() => toggleSection('certifications')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Certifications & Documents</h2>
              <ChevronDown className={`transition ${expanded.certifications ? 'rotate-180' : ''}`} />
            </button>
            {expanded.certifications && (
              <div className="p-8">
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]"><label className="block text-sm font-medium mb-2">Certification Body / Name</label><select className="input w-full" value={newCert.name} onChange={e => setNewCert(p => ({...p, name: e.target.value}))}><option value="">Select certification</option><option value="ISO 9001">ISO 9001</option><option value="ISO 22000">ISO 22000</option><option value="BEE">BEE</option><option value="Halal">Halal</option><option value="Kosher">Kosher</option><option value="Sedex">Sedex</option><option value="Fairtrade">Fairtrade</option><option value="FDA">FDA</option><option value="HACCP">HACCP</option><option value="Other">Other</option></select></div>
                  <div className="flex-1 min-w-[180px]"><label className="block text-sm font-medium mb-2">Awarded Date</label><input type="date" className="input w-full" value={newCert.awarded_date} onChange={e => setNewCert(p => ({...p, awarded_date: e.target.value}))} /></div>
                  <div className="flex-1 min-w-[180px]"><label className="block text-sm font-medium mb-2">Expiry Date</label><input type="date" className="input w-full" value={newCert.expiry_date} onChange={e => setNewCert(p => ({...p, expiry_date: e.target.value}))} disabled={noExpiry} /></div>
                  <div className="flex-1 min-w-[200px]"><label className="block text-sm font-medium mb-2">Verification Method</label><select className="input w-full" value={newCert.verification_method} onChange={e => setNewCert(p => ({...p, verification_method: e.target.value as 'self' | 'api'}))}><option value="self">Self Upload</option><option value="api">API Verified</option></select></div>
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-sm font-medium mb-2">Upload Certificate File</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="input w-full" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${cleanId}-cert-${Date.now()}.${fileExt}`;
                        const { error } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });
                        if (error) throw error;
                        const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(fileName);
                        setNewCert(p => ({ ...p, document_url: publicUrl }));
                        toast.success('✅ File uploaded successfully!');
                      } catch (err: any) {
                        toast.error(`Upload failed: ${err.message}`);
                      } finally {
                        setUploading(false);
                      }
                    }} />
                  </div>
                  <button onClick={() => {
                    if (!newCert.name) return toast.error("Please select a certification name");
                    if (!newCert.document_url) return toast.error("Please upload a file first");
                    setForm(p => ({ ...p, certifications: [...p.certifications, newCert] }));
                    setNewCert({ name: '', awarded_date: '', expiry_date: '', verification_method: 'self', document_url: '' });
                    toast.success('Certificate added!');
                  }} disabled={uploading || !newCert.name || !newCert.document_url} className="btn-primary px-8 py-3 flex-shrink-0">{uploading ? 'Uploading…' : 'Add Certificate'}</button>
                  <label className="flex items-center gap-2 whitespace-nowrap"><input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} />Never Expires / N/A</label>
                </div>
                <div className="mt-8">
                  <h4 className="font-medium mb-3">Current Certifications</h4>
                  <div className="space-y-3">
                    {form.certifications.map((c, i) => (
                      <div key={i} className="card p-4 text-sm flex justify-between items-center">
                        <div>{c.name} (exp {c.expiry_date || 'N/A'})</div>
                        <span className="text-emerald-600">{c.verification_method}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-12">
          <button onClick={loadData} className="border px-8 py-4 rounded-3xl hover:bg-slate-100">Refresh Data</button>
          <button onClick={hardReload} className="border px-8 py-4 rounded-3xl hover:bg-slate-100 flex items-center gap-2"><RotateCw size={18} /> Hard Reload</button>
          <button onClick={saveProfile} disabled={loading} className="btn-primary flex items-center gap-3 px-12 py-4">
            {loading ? 'Saving...' : 'Save All Changes'} <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}