'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, ChevronDown, Wallet, Upload } from 'lucide-react';
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
      { name: "Ghana", flag: "🇬🇭" }, { name: "Guinea", flag: "🇬🇳" }, { name: "Guinea-Bissau", flag: "🇬🇼" },
      { name: "Ivory Coast", flag: "🇨🇮" }, { name: "Kenya", flag: "🇰🇪" }, { name: "Lesotho", flag: "🇱🇸" },
      { name: "Liberia", flag: "🇱🇷" }, { name: "Libya", flag: "🇱🇾" }, { name: "Madagascar", flag: "🇲🇬" },
      { name: "Malawi", flag: "🇲🇼" }, { name: "Mali", flag: "🇲🇱" }, { name: "Mauritania", flag: "🇲🇷" },
      { name: "Mauritius", flag: "🇲🇺" }, { name: "Morocco", flag: "🇲🇦" }, { name: "Mozambique", flag: "🇲🇿" },
      { name: "Namibia", flag: "🇳🇦" }, { name: "Niger", flag: "🇳🇪" }, { name: "Nigeria", flag: "🇳🇬" },
      { name: "Rwanda", flag: "🇷🇼" }, { name: "São Tomé and Príncipe", flag: "🇸🇹" }, { name: "Senegal", flag: "🇸🇳" },
      { name: "Seychelles", flag: "🇸🇨" }, { name: "Sierra Leone", flag: "🇸🇱" }, { name: "Somalia", flag: "🇸🇴" },
      { name: "South Africa", flag: "🇿🇦" }, { name: "South Sudan", flag: "🇸🇸" }, { name: "Sudan", flag: "🇸🇩" },
      { name: "Tanzania", flag: "🇹🇿" }, { name: "Togo", flag: "🇹🇬" }, { name: "Tunisia", flag: "🇹🇳" },
      { name: "Uganda", flag: "🇺🇬" }, { name: "Zambia", flag: "🇿🇲" }, { name: "Zimbabwe", flag: "🇿🇼" }
    ],
    provinces: {
      'South Africa': ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Northern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West'],
      Nigeria: ['Lagos', 'Abuja', 'Kano', 'Rivers', 'Oyo'],
      Kenya: ['Nairobi', 'Mombasa', 'Kisumu'],
      Egypt: ['Cairo', 'Alexandria', 'Giza'],
      Ghana: ['Greater Accra', 'Ashanti'],
      Ethiopia: ['Addis Ababa', 'Oromia'],
      Uganda: ['Central', 'Western'],
      Tanzania: ['Dar es Salaam', 'Arusha'],
      Morocco: ['Casablanca', 'Rabat'],
      Algeria: ['Algiers', 'Oran'],
      Senegal: ['Dakar']
    }
  },
  'North America': {
    countries: [{ name: "Canada", flag: "🇨🇦" }, { name: "Mexico", flag: "🇲🇽" }, { name: "United States", flag: "🇺🇸" }],
    provinces: { 'United States': ['California', 'Texas', 'New York', 'Florida', 'Illinois'] }
  },
  Europe: {
    countries: [{ name: "United Kingdom", flag: "🇬🇧" }, { name: "Germany", flag: "🇩🇪" }, { name: "France", flag: "🇫🇷" }, { name: "Italy", flag: "🇮🇹" }, { name: "Spain", flag: "🇪🇸" }],
    provinces: {}
  },
  Asia: {
    countries: [{ name: "India", flag: "🇮🇳" }, { name: "China", flag: "🇨🇳" }, { name: "Japan", flag: "🇯🇵" }, { name: "South Korea", flag: "🇰🇷" }],
    provinces: {}
  },
  'South America': {
    countries: [{ name: "Brazil", flag: "🇧🇷" }, { name: "Argentina", flag: "🇦🇷" }, { name: "Chile", flag: "🇨🇱" }],
    provinces: {}
  },
  Oceania: {
    countries: [{ name: "Australia", flag: "🇦🇺" }, { name: "New Zealand", flag: "🇳🇿" }],
    provinces: {}
  },
  Antarctica: { countries: [{ name: "Antarctica", flag: "🇦🇶" }], provinces: {} }
};

const industriesList = [
  { name: 'Accommodation & Food Services', sub: ['Restaurants', 'Hotels', 'Catering', 'Cafes', 'Bars', 'Event Catering'] },
  { name: 'Agriculture & Farming', sub: ['Crop Production', 'Livestock Farming', 'Horticulture', 'Aquaculture', 'Organic Farming', 'Agri-Tech', 'Forestry', 'Beekeeping', 'Poultry', 'Dairy Farming', 'Viticulture', 'Fisheries'] },
  { name: 'Arts, Entertainment & Recreation', sub: ['Tourism', 'Hospitality', 'Film & Media', 'Museums', 'Theatres', 'Sports Facilities'] },
  { name: 'Construction & Infrastructure', sub: ['Residential', 'Commercial', 'Roads', 'Bridges', 'Renewable Projects', 'Ports', 'Airports'] },
  { name: 'Defense & Security', sub: ['Military Equipment', 'Private Security', 'Cyber Security', 'Surveillance'] },
  { name: 'Education & Academics', sub: ['Pre-School', 'Junior School', 'High School', 'Colleges', 'Universities', 'Vocational Training', 'Online Education', 'Research Institutions', 'Corporate Training'] },
  { name: 'Finance & Insurance', sub: ['Agri-Finance', 'Crop Insurance', 'Supply Chain Finance', 'Banking', 'Investment', 'Microfinance'] },
  { name: 'Food & Beverage', sub: ['Fresh Produce', 'Meat & Poultry', 'Dairy Products', 'Processed Foods', 'Beverages', 'Seafood', 'Bakery & Confectionery', 'Ready Meals', 'Spices & Herbs', 'Functional Foods'] },
  { name: 'Government & Public Administration', sub: ['Regulatory Bodies', 'Public Health', 'Trade Promotion', 'Food Safety Authorities'] },
  { name: 'Healthcare & Pharmaceuticals', sub: ['Medical Devices', 'Pharma Distribution', 'Nutraceuticals', 'Hospitals', 'Clinics'] },
  { name: 'Information Technology', sub: ['Software', 'Data Analytics', 'Traceability', 'AI & ML', 'Blockchain', 'ERP Systems'] },
  { name: 'Manufacturing', sub: ['Food Processing', 'Packaging Materials', 'Machinery', 'Chemicals', 'Textiles', 'Electronics', 'Automotive Parts', 'Pharmaceuticals'] },
  { name: 'Mining & Extraction', sub: ['Coal Mining', 'Oil & Gas', 'Metal Ore', 'Stone & Quarrying', 'Mineral Processing'] },
  { name: 'Professional Services', sub: ['Consulting', 'Legal', 'Accounting', 'Supply Chain Consulting', 'Auditing'] },
  { name: 'Real Estate', sub: ['Commercial', 'Agricultural Land', 'Warehousing', 'Industrial Parks'] },
  { name: 'Retail Trade', sub: ['Supermarkets', 'Specialty Stores', 'E-commerce', 'Convenience', 'Farmers Markets'] },
  { name: 'Sustainability & Environmental Services', sub: ['Carbon Trading', 'Waste Management', 'Water Treatment', 'Renewable Energy Consulting', 'Circular Economy'] },
  { name: 'Telecommunications', sub: ['Mobile Networks', 'Internet Services', 'Satellite Communications'] },
  { name: 'Transportation & Logistics', sub: ['Freight', 'Cold Chain', 'Shipping', 'Air Freight', 'Warehousing', 'Last-Mile Delivery'] },
  { name: 'Utilities & Energy', sub: ['Electricity', 'Renewable Energy', 'Water Supply', 'Natural Gas', 'Solar Farms'] },
  { name: 'Wholesale Trade', sub: ['Food', 'Agricultural Products', 'Industrial Supplies', 'Import/Export', 'Distributors'] },
  { name: 'Other', sub: [] }
];

const uomOptions = ['Kg', 'G', 'Tonne', 'Litre', 'Ml', 'Piece', 'Box', 'Pallet', 'Case', 'Dozen', 'Meter', 'Sqm', 'Unit', 'Pack', 'Carton', 'Drum', 'Bottle', 'Roll'];
const certifiedBodies = ['ISO 9001', 'ISO 22000', 'FSSC 22000', 'HACCP', 'BEE', 'Halal', 'Kosher', 'SEDEX', 'Fairtrade', 'FDA', 'Other'];

export default function Onboarding() {
  const { user, login, ready } = usePrivy();
  const router = useRouter();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    legal_name: '', trading_name: '', contact_name: '', email: '', registration_number: '',
    registration_document_url: '', logo_url: '',
    planet: 'Earth', continent: '', country: '', province: '', street: '', city: '', postal_code: '',
    industries: [] as string[],
    tax_number: '', tax_document_url: '',
    vat_number: '', vat_document_url: '',
    export_license: '', export_document_url: '',
    import_license: '', import_document_url: '',
    bank_name: '', account_name: '', account_number: '', iban: '', swift: '', bank_confirmation_url: '',
    products: [] as any[],
    services: [] as string[],
    certifications: [] as any[]
  });

  const [newProduct, setNewProduct] = useState({ description: '', sku: '', uom: '', sellPrice: '', leadTime: '', imageUrl: '' });
  const [newService, setNewService] = useState('');
  const [newCert, setNewCert] = useState({ name: '', body: '', awarded_date: '', expiry_date: '', never_expires: false, document_url: '' });
  const [openIndustries, setOpenIndustries] = useState<Record<string, boolean>>({});

  const toggleIndustry = (name: string) => setOpenIndustries(p => ({ ...p, [name]: !p[name] }));

  const calculateProgress = () => {
    const filled = [
      form.legal_name, form.trading_name, form.contact_name, form.email, form.registration_number,
      form.street, form.city, form.postal_code, form.continent, form.country, form.province,
      form.industries.length > 0, form.bank_name || form.iban,
      form.products.length > 0 || form.services.length > 0,
      form.certifications.length > 0
    ].filter(Boolean).length;
    return Math.round((filled / 15) * 100);
  };

  useEffect(() => { if (user && cleanId) loadExistingProfile(); }, [user, cleanId]);

  const loadExistingProfile = async () => {
    console.log("=== LOADING EXISTING PROFILE ===", cleanId);
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', cleanId).maybeSingle();
    if (error) console.error("Load profile error:", JSON.stringify(error, null, 2));
    if (data) {
      console.log("✅ Loaded profile:", data);
      setForm(prev => ({ ...prev, ...data }));
    }
  };

  const handleUpload = async (field: keyof typeof form, e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(`=== UPLOAD STARTED for ${field} ===`);
    const file = e.target.files?.[0];
    if (!file || !cleanId) return toast.error("Please select a file");
    setUploading(true);
    const fileName = `${cleanId}-${field}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });
    if (error) {
      console.error("Upload error:", JSON.stringify(error, null, 2));
      return toast.error("Upload failed");
    }
    const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setForm(p => ({ ...p, [field]: publicUrl }));
    setUploading(false);
    toast.success("✅ File uploaded");
    console.log(`=== UPLOAD SUCCESS for ${field} ===`, publicUrl);
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("=== CERT UPLOAD STARTED ===");
    const file = e.target.files?.[0];
    if (!file || !cleanId) return toast.error("Please select a file");
    setUploading(true);
    const fileName = `${cleanId}-cert-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });
    if (error) {
      console.error("Cert upload error:", JSON.stringify(error, null, 2));
      return toast.error("Upload failed");
    }
    const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setNewCert(p => ({ ...p, document_url: publicUrl }));
    setUploading(false);
    toast.success("✅ Certificate uploaded");
    console.log("=== CERT UPLOAD SUCCESS ===", publicUrl);
  };

  const addProduct = () => {
    if (newProduct.description) {
      setForm(p => ({ ...p, products: [...p.products, { ...newProduct }] }));
      setNewProduct({ description: '', sku: '', uom: '', sellPrice: '', leadTime: '', imageUrl: '' });
      toast.success("Product added");
    }
  };

  const addService = () => {
    if (newService) {
      setForm(p => ({ ...p, services: [...p.services, newService] }));
      setNewService('');
      toast.success("Service added");
    }
  };

  const addCertification = () => {
    if (newCert.name && newCert.document_url) {
      setForm(p => ({ ...p, certifications: [...p.certifications, { ...newCert }] }));
      setNewCert({ name: '', body: '', awarded_date: '', expiry_date: '', never_expires: false, document_url: '' });
      toast.success("Certification added");
    }
  };

  const saveAll = async () => {
    console.log("=== SAVEALL STARTED ===");
    console.log("cleanId:", cleanId);

    if (!cleanId) {
      console.error("No cleanId - Privy login missing");
      return toast.error("Please log in with Privy first");
    }

    setLoading(true);
    try {
      // Scalar-only profileData
      const profileData = {
        user_id: cleanId,
        legal_name: form.legal_name,
        trading_name: form.trading_name,
        contact_name: form.contact_name,
        email: form.email,
        registration_number: form.registration_number,
        registration_document_url: form.registration_document_url,
        logo_url: form.logo_url,
        planet: form.planet,
        continent: form.continent,
        country: form.country,
        province: form.province,
        street: form.street,
        city: form.city,
        postal_code: form.postal_code,
        industries: form.industries,
        tax_number: form.tax_number,
        tax_document_url: form.tax_document_url,
        vat_number: form.vat_number,
        vat_document_url: form.vat_document_url,
        export_license: form.export_license,
        export_document_url: form.export_document_url,
        import_license: form.import_license,
        import_document_url: form.import_document_url,
        bank_name: form.bank_name,
        account_name: form.account_name,
        account_number: form.account_number,
        iban: form.iban,
        swift: form.swift,
        bank_confirmation_url: form.bank_confirmation_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log("Upserting profiles...");
      const { error: profileError } = await supabase.from('profiles').upsert(profileData);
      if (profileError) console.error("Profile upsert error:", JSON.stringify(profileError, null, 2));
      else console.log("✅ Profiles upsert success");

      if (form.products.length > 0) {
        console.log("Upserting business_products...");
        const productsToInsert = form.products.map(p => ({
          profile_id: cleanId,
          description: p.description,
          sku: p.sku,
          uom: p.uom,
          sellPrice: p.sellPrice,
          leadTime: p.leadTime,
          image_url: p.imageUrl
        }));
        const { error: prodError } = await supabase.from('business_products').upsert(productsToInsert);
        if (prodError) console.error("Products upsert error:", JSON.stringify(prodError, null, 2));
        else console.log("✅ Products upsert success");
      }

      if (form.services.length > 0) {
        console.log("Upserting business_services...");
        const { error: servError } = await supabase.from('business_services').upsert(form.services.map(name => ({ profile_id: cleanId, name })));
        if (servError) console.error("Services upsert error:", JSON.stringify(servError, null, 2));
        else console.log("✅ Services upsert success");
      }

      if (form.certifications.length > 0) {
        console.log("Upserting business_certifications...");
        const { error: certError } = await supabase.from('business_certifications').upsert(form.certifications.map(c => ({ profile_id: cleanId, ...c })));
        if (certError) console.error("Certs upsert error:", JSON.stringify(certError, null, 2));
        else console.log("✅ Certs upsert success");
      }

      toast.success("🎉 All information saved to Supabase and SupplierAdvisor®!");
      console.log("=== SAVEALL COMPLETE – SUCCESS ===");
      router.push('/dashboard');
    } catch (error: any) {
      console.error("=== SAVEALL CATCH BLOCK ===", JSON.stringify(error, null, 2));
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => (step < 7 ? setStep(s => s + 1) : saveAll());

  const progress = calculateProgress();

  if (!user || !ready) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-8 w-20 h-20 bg-[#00b4d8] rounded-3xl flex items-center justify-center">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h1 className="font-black text-5xl tracking-[-2px] text-[#00b4d8]">SupplierAdvisor®</h1>
          <p className="text-2xl text-neutral-600 mt-4">Verify your business on-chain</p>
          <button onClick={login} className="mt-12 btn-primary text-xl py-6 px-16 flex items-center gap-4 mx-auto">
            <Wallet size={28} /> Log in / Register with Privy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">Verify Your Business</h1>
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 bg-neutral-200 h-3 rounded-full overflow-hidden">
          <div className="bg-[#00b4d8] h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="font-medium text-[#00b4d8]">{progress}% complete</span>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-12">
        {/* STEP 1 - Company Details */}
        {step === 1 && (
          <div>
            <h2 className="text-3xl font-bold mb-8">1. Company Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" placeholder="Legal Name" className="input w-full" value={form.legal_name} onChange={e => setForm(p => ({ ...p, legal_name: e.target.value }))} />
              <input type="text" placeholder="Trading Name" className="input w-full" value={form.trading_name} onChange={e => setForm(p => ({ ...p, trading_name: e.target.value }))} />
            </div>
            <input type="text" placeholder="Contact Name" className="input w-full mt-6" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
            <input type="email" placeholder="Email Address" className="input w-full mt-6" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <input type="text" placeholder="Company Registration Number" className="input w-full mt-6" value={form.registration_number} onChange={e => setForm(p => ({ ...p, registration_number: e.target.value }))} />
            <div className="grid grid-cols-2 gap-6 mt-8">
              <div>
                <label className="block text-sm mb-3">Registration Certificate</label>
                <input type="file" onChange={e => handleUpload('registration_document_url', e)} className="hidden" id="reg-upload" />
                <label htmlFor="reg-upload" className="btn-primary cursor-pointer w-full text-center whitespace-nowrap flex items-center justify-center gap-2"><Upload size={18} /> Choose File</label>
              </div>
              <div>
                <label className="block text-sm mb-3">Company Logo</label>
                <input type="file" onChange={e => handleUpload('logo_url', e)} className="hidden" id="logo-upload" />
                <label htmlFor="logo-upload" className="btn-primary cursor-pointer w-full text-center whitespace-nowrap flex items-center justify-center gap-2"><Upload size={18} /> Choose Logo</label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 - Location */}
        {step === 2 && (
          <div>
            <h2 className="text-3xl font-bold mb-8">2. Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <select className="input w-full" value={form.planet} onChange={e => setForm(p => ({ ...p, planet: e.target.value }))}>
                <option value="Earth">Earth</option>
                <option value="Moon">Moon</option>
                <option value="Mars">Mars</option>
              </select>
              <select className="input w-full" value={form.continent} onChange={e => setForm(p => ({ ...p, continent: e.target.value, country: '', province: '' }))}>
                <option value="">Select Continent</option>
                {Object.keys(locationData).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input w-full" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value, province: '' }))} disabled={!form.continent}>
                <option value="">Select Country</option>
                {form.continent && locationData[form.continent].countries.map(c => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
              </select>
              <select className="input w-full" value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))} disabled={!form.country}>
                <option value="">Select Province / State</option>
                {form.country && form.continent && locationData[form.continent].provinces[form.country]?.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <input type="text" placeholder="Street Address" className="input w-full" value={form.street} onChange={e => setForm(p => ({ ...p, street: e.target.value }))} />
              <input type="text" placeholder="City" className="input w-full" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              <input type="text" placeholder="Postal Code" className="input w-full" value={form.postal_code} onChange={e => setForm(p => ({ ...p, postal_code: e.target.value }))} />
            </div>
          </div>
        )}

        {/* STEP 3 - Industries */}
        {step === 3 && (
          <div>
            <h2 className="text-3xl font-bold mb-8">3. Industries & Sub-Industries</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {industriesList.map(ind => (
                <div key={ind.name} className="border rounded-3xl p-6">
                  <button onClick={() => toggleIndustry(ind.name)} className="w-full flex justify-between items-center font-medium text-left">
                    {ind.name}
                    <ChevronDown className={`transition-transform ${openIndustries[ind.name] ? 'rotate-180' : ''}`} />
                  </button>
                  {openIndustries[ind.name] && (
                    <div className="mt-4 space-y-2 pl-2">
                      {ind.sub.map(sub => (
                        <label key={sub} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.industries.includes(sub)} onChange={() => {
                            setForm(p => ({ ...p, industries: p.industries.includes(sub) ? p.industries.filter(i => i !== sub) : [...p.industries, sub] }));
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

        {/* STEP 4 - Financial & Banking */}
        {step === 4 && (
          <div>
            <h2 className="text-3xl font-bold mb-8">4. Financial & Banking</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div><label className="block text-sm mb-2">Tax Number</label><input type="text" className="input w-full" value={form.tax_number} onChange={e => setForm(p => ({ ...p, tax_number: e.target.value }))} /><input type="file" onChange={e => handleUpload('tax_document_url', e)} className="hidden" id="tax-upload" /><label htmlFor="tax-upload" className="btn-primary mt-3 w-full">Upload Tax Certificate</label></div>
              <div><label className="block text-sm mb-2">VAT Number</label><input type="text" className="input w-full" value={form.vat_number} onChange={e => setForm(p => ({ ...p, vat_number: e.target.value }))} /><input type="file" onChange={e => handleUpload('vat_document_url', e)} className="hidden" id="vat-upload" /><label htmlFor="vat-upload" className="btn-primary mt-3 w-full">Upload VAT Certificate</label></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div><label className="block text-sm mb-2">Export License</label><input type="text" className="input w-full" value={form.export_license} onChange={e => setForm(p => ({ ...p, export_license: e.target.value }))} /><input type="file" onChange={e => handleUpload('export_document_url', e)} className="hidden" id="export-upload" /><label htmlFor="export-upload" className="btn-primary mt-3 w-full">Upload Export License</label></div>
              <div><label className="block text-sm mb-2">Import License</label><input type="text" className="input w-full" value={form.import_license} onChange={e => setForm(p => ({ ...p, import_license: e.target.value }))} /><input type="file" onChange={e => handleUpload('import_document_url', e)} className="hidden" id="import-upload" /><label htmlFor="import-upload" className="btn-primary mt-3 w-full">Upload Import License</label></div>
              <div><label className="block text-sm mb-2">Bank Confirmation</label><input type="file" onChange={e => handleUpload('bank_confirmation_url', e)} className="hidden" id="bank-upload" /><label htmlFor="bank-upload" className="btn-primary mt-3 w-full">Upload Bank Confirmation</label></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
              <div><label className="block text-sm mb-2">Bank Name</label><input type="text" className="input w-full" value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} /></div>
              <div><label className="block text-sm mb-2">Account Name</label><input type="text" className="input w-full" value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} /></div>
              <div><label className="block text-sm mb-2">Account Number</label><input type="text" className="input w-full" value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} /></div>
              <div><label className="block text-sm mb-2">IBAN</label><input type="text" className="input w-full" value={form.iban} onChange={e => setForm(p => ({ ...p, iban: e.target.value }))} /></div>
              <div><label className="block text-sm mb-2">SWIFT / BIC</label><input type="text" className="input w-full" value={form.swift} onChange={e => setForm(p => ({ ...p, swift: e.target.value }))} /></div>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h3 className="font-bold text-2xl mb-6">Add Products</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Description" className="input w-full" value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} />
                <input type="text" placeholder="SKU" className="input w-full" value={newProduct.sku} onChange={e => setNewProduct(p => ({ ...p, sku: e.target.value }))} />
                <select className="input w-full" value={newProduct.uom} onChange={e => setNewProduct(p => ({ ...p, uom: e.target.value }))}>
                  <option value="">Select UoM</option>
                  {uomOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Sell Price" className="input w-full" value={newProduct.sellPrice} onChange={e => setNewProduct(p => ({ ...p, sellPrice: e.target.value }))} />
                  <input type="text" placeholder="Lead Time (days)" className="input w-full" value={newProduct.leadTime} onChange={e => setNewProduct(p => ({ ...p, leadTime: e.target.value }))} />
                </div>
                <button onClick={addProduct} className="btn-primary w-full">Add Product</button>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-2xl mb-6">Add Services</h3>
              <input type="text" placeholder="Service Name" className="input w-full" value={newService} onChange={e => setNewService(e.target.value)} />
              <button onClick={addService} className="btn-primary w-full mt-4">Add Service</button>
            </div>
          </div>
        )}

        {/* STEP 6 */}
        {step === 6 && (
          <div>
            <h2 className="text-3xl font-bold mb-8">6. Certificates & Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" placeholder="Certificate Name" className="input w-full" value={newCert.name} onChange={e => setNewCert(p => ({ ...p, name: e.target.value }))} />
              <select className="input w-full" value={newCert.body} onChange={e => setNewCert(p => ({ ...p, body: e.target.value }))}>
                <option value="">Certification Body</option>
                {certifiedBodies.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-6">
              <input type="date" className="input w-full" value={newCert.awarded_date} onChange={e => setNewCert(p => ({ ...p, awarded_date: e.target.value }))} />
              <input type="date" className="input w-full" value={newCert.expiry_date} onChange={e => setNewCert(p => ({ ...p, expiry_date: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <input type="checkbox" checked={newCert.never_expires} onChange={e => setNewCert(p => ({ ...p, never_expires: e.target.checked }))} />
              <span>Never expires / N/A</span>
            </div>
            <input type="file" onChange={handleCertUpload} className="hidden" id="cert-upload" />
            <label htmlFor="cert-upload" className="btn-primary mt-6 w-full flex items-center justify-center gap-2"><Upload size={18} /> Upload Certificate</label>
            <button onClick={addCertification} className="btn-primary w-full mt-6">Add Certificate</button>
          </div>
        )}

        {/* STEP 7 */}
        {step === 7 && (
          <div>
            <h2 className="text-3xl font-bold mb-8">7. Review & Submit</h2>
            <div className="bg-neutral-50 rounded-3xl p-8 text-sm space-y-6">
              <div><strong>Company:</strong> {form.legal_name} ({form.trading_name})</div>
              <div><strong>Location:</strong> {form.planet} • {form.continent} • {form.country} • {form.province}<br />{form.street}, {form.city} {form.postal_code}</div>
              <div><strong>Industries:</strong> {form.industries.join(', ') || 'None'}</div>
              <div><strong>Bank:</strong> {form.bank_name} • IBAN {form.iban} • SWIFT {form.swift}</div>
              <div><strong>Products:</strong> {form.products.length} • Services: {form.services.length}</div>
              <div><strong>Certificates:</strong> {form.certifications.length} uploaded</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-12">
        {step > 1 && <button onClick={() => setStep(s => s - 1)} className="flex-1 border-2 border-neutral-300 py-5 rounded-3xl font-medium flex items-center justify-center gap-3"><ArrowLeft /> Back</button>}
        <button onClick={() => setStep(s => s + 1)} className="flex-1 border-2 border-neutral-300 py-5 rounded-3xl font-medium">Skip this Section</button>
        <button onClick={handleNext} disabled={loading} className="flex-1 bg-[#00b4d8] text-white py-5 rounded-3xl font-semibold flex items-center justify-center gap-3 disabled:opacity-60">
          {loading ? 'Saving to Supabase...' : (step === 7 ? 'Submit & Go Live' : 'Continue')} <ArrowRight />
        </button>
      </div>
    </div>
  );
}