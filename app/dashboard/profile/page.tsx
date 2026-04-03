'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, ChevronDown, RotateCw, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Image from 'next/image';

interface LocationData {
  [continent: string]: {
    countries: Array<{name: string; flag: string}>;
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
    countries: [
      { name: "Canada", flag: "🇨🇦" }, { name: "Mexico", flag: "🇲🇽" }, { name: "United States", flag: "🇺🇸" }
    ],
    provinces: {
      'United States': ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'],
      Canada: ['Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Nova Scotia','Ontario','Prince Edward Island','Quebec','Saskatchewan'],
      Mexico: ['Mexico City','Jalisco','Nuevo León','Yucatán','Baja California','Chihuahua']
    }
  },
  Europe: {
    countries: [
      { name: "Albania", flag: "🇦🇱" }, { name: "Andorra", flag: "🇦🇩" }, { name: "Austria", flag: "🇦🇹" },
      { name: "Belarus", flag: "🇧🇾" }, { name: "Belgium", flag: "🇧🇪" }, { name: "Bosnia and Herzegovina", flag: "🇧🇦" },
      { name: "Bulgaria", flag: "🇧🇬" }, { name: "Croatia", flag: "🇭🇷" }, { name: "Czechia", flag: "🇨🇿" },
      { name: "Denmark", flag: "🇩🇰" }, { name: "Estonia", flag: "🇪🇪" }, { name: "Finland", flag: "🇫🇮" },
      { name: "France", flag: "🇫🇷" }, { name: "Germany", flag: "🇩🇪" }, { name: "Greece", flag: "🇬🇷" },
      { name: "Hungary", flag: "🇭🇺" }, { name: "Iceland", flag: "🇮🇸" }, { name: "Ireland", flag: "🇮🇪" },
      { name: "Italy", flag: "🇮🇹" }, { name: "Kosovo", flag: "🇽🇰" }, { name: "Latvia", flag: "🇱🇻" },
      { name: "Liechtenstein", flag: "🇱🇮" }, { name: "Lithuania", flag: "🇱🇹" }, { name: "Luxembourg", flag: "🇱🇺" },
      { name: "Malta", flag: "🇲🇹" }, { name: "Moldova", flag: "🇲🇩" }, { name: "Monaco", flag: "🇲🇨" },
      { name: "Montenegro", flag: "🇲🇪" }, { name: "Netherlands", flag: "🇳🇱" }, { name: "North Macedonia", flag: "🇲🇰" },
      { name: "Norway", flag: "🇳🇴" }, { name: "Poland", flag: "🇵🇱" }, { name: "Portugal", flag: "🇵🇹" },
      { name: "Romania", flag: "🇷🇴" }, { name: "Russia", flag: "🇷🇺" }, { name: "San Marino", flag: "🇸🇲" },
      { name: "Serbia", flag: "🇷🇸" }, { name: "Slovakia", flag: "🇸🇰" }, { name: "Slovenia", flag: "🇸🇮" },
      { name: "Spain", flag: "🇪🇸" }, { name: "Sweden", flag: "🇸🇪" }, { name: "Switzerland", flag: "🇨🇭" },
      { name: "Ukraine", flag: "🇺🇦" }, { name: "United Kingdom", flag: "🇬🇧" }, { name: "Vatican City", flag: "🇻🇦" }
    ],
    provinces: {
      'United Kingdom': ['England','Scotland','Wales','Northern Ireland'],
      Germany: ['Bavaria','Berlin','North Rhine-Westphalia'],
      France: ['Île-de-France','Provence-Alpes-Côte d\'Azur'],
      Spain: ['Madrid','Catalonia','Andalusia'],
      Italy: ['Lombardy','Lazio','Campania']
    }
  },
  Asia: {
    countries: [
      { name: "Afghanistan", flag: "🇦🇫" }, { name: "Armenia", flag: "🇦🇲" }, { name: "Azerbaijan", flag: "🇦🇿" },
      { name: "Bahrain", flag: "🇧🇭" }, { name: "Bangladesh", flag: "🇧🇩" }, { name: "Bhutan", flag: "🇧🇹" },
      { name: "Brunei", flag: "🇧🇳" }, { name: "Cambodia", flag: "🇰🇭" }, { name: "China", flag: "🇨🇳" },
      { name: "Cyprus", flag: "🇨🇾" }, { name: "Georgia", flag: "🇬🇪" }, { name: "India", flag: "🇮🇳" },
      { name: "Indonesia", flag: "🇮🇩" }, { name: "Iran", flag: "🇮🇷" }, { name: "Iraq", flag: "🇮🇶" },
      { name: "Israel", flag: "🇮🇱" }, { name: "Japan", flag: "🇯🇵" }, { name: "Jordan", flag: "🇯🇴" },
      { name: "Kazakhstan", flag: "🇰🇿" }, { name: "North Korea", flag: "🇰🇵" }, { name: "South Korea", flag: "🇰🇷" },
      { name: "Kuwait", flag: "🇰🇼" }, { name: "Kyrgyzstan", flag: "🇰🇬" }, { name: "Laos", flag: "🇱🇦" },
      { name: "Lebanon", flag: "🇱🇧" }, { name: "Malaysia", flag: "🇲🇾" }, { name: "Maldives", flag: "🇲🇻" },
      { name: "Mongolia", flag: "🇲🇳" }, { name: "Myanmar", flag: "🇲🇲" }, { name: "Nepal", flag: "🇳🇵" },
      { name: "Oman", flag: "🇴🇲" }, { name: "Pakistan", flag: "🇵🇰" }, { name: "Palestine", flag: "🇵🇸" },
      { name: "Philippines", flag: "🇵🇭" }, { name: "Qatar", flag: "🇶🇦" }, { name: "Saudi Arabia", flag: "🇸🇦" },
      { name: "Singapore", flag: "🇸🇬" }, { name: "Sri Lanka", flag: "🇱🇰" }, { name: "Syria", flag: "🇸🇾" },
      { name: "Taiwan", flag: "🇹🇼" }, { name: "Tajikistan", flag: "🇹🇯" }, { name: "Thailand", flag: "🇹🇭" },
      { name: "Timor-Leste", flag: "🇹🇱" }, { name: "Turkey", flag: "🇹🇷" }, { name: "Turkmenistan", flag: "🇹🇲" },
      { name: "United Arab Emirates", flag: "🇦🇪" }, { name: "Uzbekistan", flag: "🇺🇿" }, { name: "Vietnam", flag: "🇻🇳" },
      { name: "Yemen", flag: "🇾🇪" }
    ],
    provinces: {
      India: ['Maharashtra','Delhi','Karnataka','Tamil Nadu','Uttar Pradesh'],
      China: ['Beijing','Shanghai','Guangdong','Jiangsu'],
      Japan: ['Tokyo','Osaka','Kanagawa'],
      'South Korea': ['Seoul','Busan','Incheon']
    }
  },
  'South America': {
    countries: [
      { name: "Argentina", flag: "🇦🇷" }, { name: "Bolivia", flag: "🇧🇴" }, { name: "Brazil", flag: "🇧🇷" },
      { name: "Chile", flag: "🇨🇱" }, { name: "Colombia", flag: "🇨🇴" }, { name: "Ecuador", flag: "🇪🇨" },
      { name: "Guyana", flag: "🇬🇾" }, { name: "Paraguay", flag: "🇵🇾" }, { name: "Peru", flag: "🇵🇪" },
      { name: "Suriname", flag: "🇸🇷" }, { name: "Uruguay", flag: "🇺🇾" }, { name: "Venezuela", flag: "🇻🇪" }
    ],
    provinces: {
      Brazil: ['São Paulo','Rio de Janeiro','Minas Gerais','Bahia'],
      Argentina: ['Buenos Aires','Córdoba','Santa Fe'],
      Chile: ['Santiago','Valparaíso','Biobío']
    }
  },
  Oceania: {
    countries: [
      { name: "Australia", flag: "🇦🇺" }, { name: "Fiji", flag: "🇫🇯" }, { name: "Kiribati", flag: "🇰🇮" },
      { name: "Marshall Islands", flag: "🇲🇭" }, { name: "Micronesia", flag: "🇫🇲" }, { name: "Nauru", flag: "🇳🇷" },
      { name: "New Zealand", flag: "🇳🇿" }, { name: "Palau", flag: "🇵🇼" }, { name: "Papua New Guinea", flag: "🇵🇬" },
      { name: "Samoa", flag: "🇼🇸" }, { name: "Solomon Islands", flag: "🇸🇧" }, { name: "Tonga", flag: "🇹🇴" },
      { name: "Tuvalu", flag: "🇹🇻" }, { name: "Vanuatu", flag: "🇻🇺" }
    ],
    provinces: {
      Australia: ['New South Wales','Victoria','Queensland','Western Australia','South Australia'],
      'New Zealand': ['Auckland','Wellington','Canterbury']
    }
  },
  Antarctica: {
    countries: [{ name: "Antarctica", flag: "🇦🇶" }],
    provinces: {}
  }
};

const industriesList = [
  { name: 'Accommodation & Food Services', sub: ['Restaurants', 'Hotels', 'Catering'] },
  { name: 'Agriculture & Farming', sub: ['Crop Production', 'Livestock Farming', 'Horticulture', 'Aquaculture', 'Organic Farming', 'Agri-Tech', 'Forestry', 'Beekeeping', 'Poultry', 'Dairy Farming'] },
  { name: 'Arts, Entertainment & Recreation', sub: ['Tourism', 'Hospitality', 'Film & Media'] },
  { name: 'Construction & Infrastructure', sub: ['Residential', 'Commercial', 'Roads', 'Bridges', 'Renewable Projects'] },
  { name: 'Defense & Security', sub: ['Military Equipment', 'Private Security'] },
  { name: 'Education & Academics', sub: ['Pre-School', 'Junior School', 'High School', 'Colleges', 'Universities', 'Vocational Training', 'Online Education', 'Research Institutions'] },
  { name: 'Finance & Insurance', sub: ['Agri-Finance', 'Crop Insurance', 'Supply Chain Finance'] },
  { name: 'Food & Beverage', sub: ['Fresh Produce', 'Meat & Poultry', 'Dairy Products', 'Processed Foods', 'Beverages', 'Seafood', 'Bakery & Confectionery', 'Ready Meals', 'Spices & Herbs'] },
  { name: 'Government & Public Administration', sub: ['Regulatory Bodies', 'Public Health', 'Trade Promotion'] },
  { name: 'Healthcare & Pharmaceuticals', sub: ['Medical Devices', 'Pharma Distribution', 'Nutraceuticals'] },
  { name: 'Information Technology', sub: ['Software', 'Data Analytics', 'Traceability', 'AI & ML'] },
  { name: 'Manufacturing', sub: ['Food Processing', 'Packaging Materials', 'Machinery', 'Chemicals', 'Textiles', 'Electronics', 'Automotive Parts', 'Pharmaceuticals'] },
  { name: 'Mining & Extraction', sub: ['Coal Mining', 'Oil & Gas', 'Metal Ore', 'Stone & Quarrying', 'Mineral Processing'] },
  { name: 'Professional Services', sub: ['Consulting', 'Legal', 'Accounting', 'Supply Chain Consulting'] },
  { name: 'Real Estate', sub: ['Commercial', 'Agricultural Land', 'Warehousing'] },
  { name: 'Retail Trade', sub: ['Supermarkets', 'Specialty Stores', 'E-commerce', 'Convenience'] },
  { name: 'Sustainability & Environmental Services', sub: ['Carbon Trading', 'Waste Management', 'Water Treatment', 'Renewable Energy Consulting'] },
  { name: 'Telecommunications', sub: ['Mobile Networks', 'Internet Services'] },
  { name: 'Transportation & Logistics', sub: ['Freight', 'Cold Chain', 'Shipping', 'Air Freight', 'Warehousing'] },
  { name: 'Utilities & Energy', sub: ['Electricity', 'Renewable Energy', 'Water Supply', 'Natural Gas'] },
  { name: 'Wholesale Trade', sub: ['Food', 'Agricultural Products', 'Industrial Supplies', 'Import/Export'] },
  { name: 'Other', sub: [] }
];

const uomOptions = ['Kg', 'G', 'Tonne', 'Litre', 'Ml', 'Piece', 'Box', 'Pallet', 'Case', 'Dozen', 'Meter', 'Sqm', 'Unit', 'Pack', 'Carton', 'Drum', 'Bottle', 'Roll'];

const certifiedBodies = ['ISO 9001', 'ISO 22000', 'FSSC 22000', 'HACCP', 'BEE', 'Halal', 'Kosher', 'SEDEX', 'Fairtrade', 'FDA', 'Other'];

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

  const [newProduct, setNewProduct] = useState({ description: '', sku: '', uom: '', sellPrice: '', leadTime: '', imageUrl: '' });
  const [newService, setNewService] = useState('');
  const [newCert, setNewCert] = useState({ name: '', body: '', awarded_date: '', expiry_date: '', never_expires: false, document_url: '' });
  const [openIndustries, setOpenIndustries] = useState<Record<string, boolean>>({});

  const toggleIndustry = (name: string) => setOpenIndustries(prev => ({ ...prev, [name]: !prev[name] }));
  const toggleSection = (section: string) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

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

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return toast.error("Please select a file");
    setUploading(true);
    const fileName = `${cleanId}-cert-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('certificates').upload(fileName, file);
    if (error) return toast.error("Upload failed");
    const { data: url } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setNewCert(prev => ({ ...prev, document_url: url.publicUrl }));
    setUploading(false);
    toast.success("✅ Certificate uploaded successfully");
  };

  const addProduct = () => {
    if (newProduct.description) {
      setForm(prev => ({ ...prev, products: [...prev.products, newProduct] }));
      setNewProduct({ description: '', sku: '', uom: '', sellPrice: '', leadTime: '', imageUrl: '' });
      toast.success("Product added");
    }
  };

  const addService = () => {
    if (newService) {
      setForm(prev => ({ ...prev, services: [...prev.services, newService] }));
      setNewService('');
    }
  };

  const addCertification = () => {
    if (newCert.name && newCert.document_url) {
      setForm(prev => ({ ...prev, certifications: [...prev.certifications, newCert] }));
      setNewCert({ name: '', body: '', awarded_date: '', expiry_date: '', never_expires: false, document_url: '' });
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const profileData = { id: cleanId, ...form, updated_at: new Date().toISOString() };
      await supabase.from('profiles').upsert(profileData);

      if (form.products.length) await supabase.from('business_products').upsert(form.products.map(p => ({ profile_id: cleanId, ...p })));
      if (form.services.length) await supabase.from('business_services').upsert(form.services.map(name => ({ profile_id: cleanId, name })));
      if (form.certifications.length) await supabase.from('business_certifications').upsert(form.certifications.map(c => ({ profile_id: cleanId, ...c })));

      toast.success("✅ All changes saved to Supabase!");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Save failed: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">My Business Profile</h1>
          <p className="text-xl text-neutral-600">Exact mirror of onboarding — edit every field</p>
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
              <div><label className="block text-sm mb-2">Legal Name</label><input className="input w-full" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Trading Name</label><input className="input w-full" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Contact Name</label><input className="input w-full" value={form.contact_name} onChange={e => setForm(p => ({...p, contact_name: e.target.value}))} /></div>
              <div><label className="block text-sm mb-2">Email Address</label><input type="email" className="input w-full" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
              <div className="md:col-span-2"><label className="block text-sm mb-2">Company Registration Number</label><input className="input w-full" value={form.registration_number} onChange={e => setForm(p => ({...p, registration_number: e.target.value}))} /></div>
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

        {/* 2. Location — EXACT SAME AS ONBOARDING (cascading dropdowns) */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('location')}>
            <h2 className="text-2xl font-bold">2. Location</h2>
            <ChevronDown className={`transition ${expanded.location ? 'rotate-180' : ''}`} />
          </div>
          {expanded.location && (
            <div>
              <div className="grid grid-cols-4 gap-6">
                <select className="input w-full" value={form.planet} onChange={e => setForm(p => ({...p, planet: e.target.value}))}>
                  <option value="Earth">Earth</option>
                  <option value="Moon">Moon</option>
                  <option value="Mars">Mars</option>
                </select>
                <select className="input w-full" value={form.continent} onChange={e => setForm(p => ({...p, continent: e.target.value, country: '', province: ''}))}>
                  <option value="">Select Continent</option>
                  {Object.keys(locationData).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input w-full" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value, province: ''}))} disabled={!form.continent}>
                  <option value="">Select Country</option>
                  {form.continent && locationData[form.continent]?.countries.map(c => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
                </select>
                <select className="input w-full" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))} disabled={!form.country}>
                  <option value="">Select Province / State</option>
                  {form.country && form.continent && locationData[form.continent]?.provinces[form.country]?.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
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
            <h2 className="text-2xl font-bold">3. Industries & Sub-Industries</h2>
            <ChevronDown className={`transition ${expanded.industries ? 'rotate-180' : ''}`} />
          </div>
          {expanded.industries && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {industriesList.map((ind) => (
                <div key={ind.name} className="border border-neutral-200 rounded-3xl overflow-hidden">
                  <button onClick={() => toggleIndustry(ind.name)} className="w-full flex justify-between px-8 py-5 text-left hover:bg-neutral-50">
                    <span className="font-semibold text-lg">{ind.name}</span>
                    <ChevronDown className={`transition ${openIndustries[ind.name] ? 'rotate-180' : ''}`} />
                  </button>
                  {openIndustries[ind.name] && (
                    <div className="px-8 pb-6 grid grid-cols-1 gap-3 text-sm">
                      {ind.sub.map((sub) => (
                        <label key={sub} className="flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-2xl cursor-pointer">
                          <input type="checkbox" checked={form.industries.includes(sub)} onChange={() => {
                            const newInd = form.industries.includes(sub) ? form.industries.filter(x => x !== sub) : [...form.industries, sub];
                            setForm(p => ({...p, industries: newInd}));
                          }} />
                          {sub}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div>
                <h3 className="font-semibold mb-6">Add Product</h3>
                <div className="space-y-5">
                  <input type="text" placeholder="Description" className="input w-full" value={newProduct.description} onChange={e => setNewProduct(p => ({...p, description: e.target.value}))} />
                  <input type="text" placeholder="SKU Number" className="input w-full" value={newProduct.sku} onChange={e => setNewProduct(p => ({...p, sku: e.target.value}))} />
                  <select className="input w-full" value={newProduct.uom} onChange={e => setNewProduct(p => ({...p, uom: e.target.value}))}>
                    <option value="">Unit of Measure</option>
                    {uomOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" placeholder="Sell Price" className="input w-full" value={newProduct.sellPrice} onChange={e => setNewProduct(p => ({...p, sellPrice: e.target.value}))} />
                  <input type="text" placeholder="Lead Time (days)" className="input w-full" value={newProduct.leadTime} onChange={e => setNewProduct(p => ({...p, leadTime: e.target.value}))} />
                  <button onClick={addProduct} className="btn-primary w-full py-4">Add Product</button>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-6">Add Service</h3>
                <input type="text" placeholder="Service Name" className="input w-full" value={newService} onChange={e => setNewService(e.target.value)} />
                <button onClick={addService} className="btn-primary w-full mt-4">Add Service</button>
              </div>
            </div>
          )}
        </div>

        {/* 6. Certificates & Documents */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('certifications')}>
            <h2 className="text-2xl font-bold">6. Certificates & Documents</h2>
            <ChevronDown className={`transition ${expanded.certifications ? 'rotate-180' : ''}`} />
          </div>
          {expanded.certifications && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2"><label className="block text-sm mb-2">Certificate Name</label><input className="input w-full" value={newCert.name} onChange={e => setNewCert(p => ({...p, name: e.target.value}))} /></div>
                <div className="md:col-span-2"><label className="block text-sm mb-2">Certified Body</label>
                  <select className="input w-full" value={newCert.body} onChange={e => setNewCert(p => ({...p, body: e.target.value}))}>
                    {certifiedBodies.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm mb-2">Award Date</label><input type="date" className="input w-full" value={newCert.awarded_date} onChange={e => setNewCert(p => ({...p, awarded_date: e.target.value}))} /></div>
                <div><label className="block text-sm mb-2">Expiry Date</label><input type="date" className="input w-full" value={newCert.expiry_date} onChange={e => setNewCert(p => ({...p, expiry_date: e.target.value}))} disabled={newCert.never_expires} /></div>
                <div className="flex items-center gap-3"><input type="checkbox" checked={newCert.never_expires} onChange={e => setNewCert(p => ({...p, never_expires: e.target.checked}))} /><span className="text-sm">Never Expires</span></div>
                <div><input type="file" onChange={handleCertUpload} className="hidden" id="cert-file" /><label htmlFor="cert-file" className="btn-primary cursor-pointer text-center">Upload</label></div>
              </div>
              <button onClick={addCertification} className="mt-8 btn-primary w-full">Add Certificate</button>
            </div>
          )}
        </div>

      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button onClick={loadProfile} className="border px-8 py-4 rounded-3xl hover:bg-slate-100 flex items-center gap-2"><RotateCw size={18} /> Refresh Data</button>
        <button onClick={saveProfile} disabled={loading} className="btn-primary flex items-center gap-3 px-12 py-4">
          {loading ? 'Saving to Supabase...' : 'Save All Changes'} <ArrowRight />
        </button>
      </div>

      {/* SEED BUTTON */}
      <div className="mt-12 flex justify-center">
        <button 
          onClick={async () => {
            if (!confirm("Add 6 test companies to Supabase?")) return;
            const testCompanies = [
              { legal_name: "FreshFarm Co", trading_name: "FreshFarm", country: "South Africa", province: "KwaZulu-Natal" },
              { legal_name: "OceanCatch Ltd", trading_name: "OceanCatch", country: "South Africa", province: "Western Cape" },
              { legal_name: "GreenHarvest Pty", trading_name: "GreenHarvest", country: "South Africa", province: "Gauteng" },
              { legal_name: "AgriTech SA", trading_name: "AgriTech", country: "South Africa", province: "Eastern Cape" },
              { legal_name: "BioGrow Farms", trading_name: "BioGrow", country: "South Africa", province: "Free State" },
              { legal_name: "SupplyChain Pro", trading_name: "SupplyChain", country: "South Africa", province: "Limpopo" }
            ];
            for (const comp of testCompanies) {
              await supabase.from('profiles').insert({ ...comp, id: `test-${Date.now()}` });
            }
            toast.success("6 test companies added to Supabase!");
            loadProfile();
          }}
          className="bg-emerald-600 text-white px-8 py-4 rounded-3xl font-semibold flex items-center gap-3"
        >
          <Upload size={20} /> Seed 6 Test Companies (for testing)
        </button>
      </div>
    </div>
  );
}