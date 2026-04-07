'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, ChevronDown, RotateCw, Upload, Plus, Users2 } from 'lucide-react';
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
  'North America': { countries: [{ name: "Canada", flag: "🇨🇦" }, { name: "Mexico", flag: "🇲🇽" }, { name: "United States", flag: "🇺🇸" }], provinces: { 'United States': ['California', 'Texas', 'New York', 'Florida', 'Illinois'] } },
  Europe: { countries: [{ name: "United Kingdom", flag: "🇬🇧" }, { name: "Germany", flag: "🇩🇪" }, { name: "France", flag: "🇫🇷" }, { name: "Italy", flag: "🇮🇹" }, { name: "Spain", flag: "🇪🇸" }], provinces: {} },
  Asia: { countries: [{ name: "India", flag: "🇮🇳" }, { name: "China", flag: "🇨🇳" }, { name: "Japan", flag: "🇯🇵" }, { name: "South Korea", flag: "🇰🇷" }], provinces: {} },
  'South America': { countries: [{ name: "Brazil", flag: "🇧🇷" }, { name: "Argentina", flag: "🇦🇷" }, { name: "Chile", flag: "🇨🇱" }], provinces: {} },
  Oceania: { countries: [{ name: "Australia", flag: "🇦🇺" }, { name: "New Zealand", flag: "🇳🇿" }], provinces: {} },
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

const businessTypesList = [
  'Private Company (Pty Ltd)', 'Public Company (Ltd)', 'Non-Profit Company (NPC)',
  'Sole Proprietorship', 'Partnership', 'Close Corporation (CC)', 'Cooperative',
  'Trust', 'Government Entity / State-Owned Enterprise', 'Section 21 Company',
  'Association', 'School', 'University', 'College', 'Pre-School', 'NGO', 'Religious Organisation',
  'Franchise', 'Joint Venture', 'Limited Liability Partnership (LLP)', 'Holding Company',
  'Subsidiary Company', 'Startup / SME', 'Co-operative Society', 'Other'
];

const roleOptions = [
  'CEO / Managing Director',
  'Procurement Leader',
  'Supply Chain Leader',
  'Finance Leader',
  'Quality Leader',
  'Sales Leader',
  'Operations Leader',
  'Logistics Leader',
  'Warehouse Leader',
  'HR Leader',
  'IT Leader',
  'Compliance Leader',
  'Sustainability Leader',
  'Administrator',
  'Other'
];

export default function MyBusinessProfile() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    legal_name: '', trading_name: '', contact_name: '', email: '', registration_number: '', contact_number: '',
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
    certifications: [] as any[],
    business_type: '',
    team_members: [] as any[]
  });

  const [newProduct, setNewProduct] = useState({ description: '', sku: '', uom: '', sellPrice: '', leadTime: '', imageUrl: '' });
  const [newService, setNewService] = useState('');
  const [newCert, setNewCert] = useState({ name: '', body: '', awarded_date: '', expiry_date: '', never_expires: false, document_url: '' });
  const [newTeamMember, setNewTeamMember] = useState({ name: '', email: '', contact_number: '', role: '' });

  const [openIndustries, setOpenIndustries] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    basics: true,
    location: true,
    industries: true,
    financial: true,
    products: true,
    certifications: true
  });

  const toggleIndustry = (name: string) => setOpenIndustries(prev => ({ ...prev, [name]: !prev[name] }));
  const toggleSection = (section: string) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  useEffect(() => {
    if (user && cleanId) loadProfile();
  }, [user, cleanId]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', cleanId).maybeSingle();
    if (profile) setForm(prev => ({ ...prev, ...profile }));

    const { data: products } = await supabase.from('business_products').select('*').eq('profile_id', cleanId);
    const { data: servicesData } = await supabase.from('business_services').select('name').eq('profile_id', cleanId);
    const { data: certifications } = await supabase.from('business_certifications').select('*').eq('profile_id', cleanId);
    const { data: teamData } = await supabase.from('business_users').select('*').eq('profile_id', cleanId);

    setForm(prev => ({
      ...prev,
      products: products || [],
      services: servicesData?.map((s: any) => s.name) || [],
      certifications: certifications || [],
      team_members: teamData || []
    }));
    setLoading(false);
  };

  const handleUpload = async (field: keyof typeof form, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cleanId) return toast.error("Please select a file");
    setUploading(true);
    const fileName = `${cleanId}-${field}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });
    if (error) return toast.error("Upload failed");
    const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setForm(p => ({ ...p, [field]: publicUrl }));
    setUploading(false);
    toast.success("✅ File uploaded");
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cleanId) return toast.error("Please select a file");
    setUploading(true);
    const fileName = `${cleanId}-cert-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });
    if (error) return toast.error("Upload failed");
    const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setNewCert(p => ({ ...p, document_url: publicUrl }));
    setUploading(false);
    toast.success("✅ Certificate uploaded");
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

  const addTeamMember = async () => {
    if (!newTeamMember.name || !newTeamMember.email) {
      toast.error('Name and Email are required');
      return;
    }

    const memberData = {
      profile_id: cleanId,
      name: newTeamMember.name,
      email: newTeamMember.email,
      contact_number: newTeamMember.contact_number || '',
      role: newTeamMember.role || 'Other',
      status: 'invited',
      invited_at: new Date().toISOString()
    };

    // Save to database
    const { error: insertError } = await supabase.from('business_users').insert(memberData);
    if (insertError) {
      toast.error('Failed to save user');
      return;
    }

    // Send real email invitation
    const { error: emailError } = await supabase.functions.invoke('send-team-invitation', {
      body: {
        to_email: newTeamMember.email,
        to_name: newTeamMember.name,
        company_name: form.trading_name || form.legal_name || 'Your Company',
        role: newTeamMember.role || 'Team Member',
        inviter_name: form.contact_name || 'The team'
      }
    });

    if (emailError) {
      console.error(emailError);
      toast.error('User saved but email failed to send');
    } else {
      toast.success(`✅ Real invitation email sent to ${newTeamMember.email}`);
    }

    // Refresh UI
    setForm(p => ({
      ...p,
      team_members: [...(p.team_members || []), memberData]
    }));

    setNewTeamMember({ name: '', email: '', contact_number: '', role: '' });
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const profileData = {
        user_id: cleanId,
        legal_name: form.legal_name,
        trading_name: form.trading_name,
        contact_name: form.contact_name,
        email: form.email,
        contact_number: form.contact_number,
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
        business_type: form.business_type,
        updated_at: new Date().toISOString()
      };

      await supabase.from('profiles').upsert(profileData);

      if (form.products.length > 0) {
        await supabase.from('business_products').upsert(form.products.map(p => ({ profile_id: cleanId, ...p })));
      }
      if (form.services.length > 0) {
        await supabase.from('business_services').upsert(form.services.map(name => ({ profile_id: cleanId, name })));
      }
      if (form.certifications.length > 0) {
        await supabase.from('business_certifications').upsert(form.certifications.map(c => ({ profile_id: cleanId, ...c })));
      }

      toast.success("🎉 Profile saved successfully to Supabase!");
      loadProfile();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">My Business Profile</h1>
          <p className="text-xl text-neutral-600">Exact mirror of onboarding – edit every field</p>
        </div>
        <div className="flex gap-4">
          <button onClick={loadProfile} className="flex items-center gap-2 border px-8 py-4 rounded-3xl hover:bg-neutral-100">
            <RotateCw size={18} /> Refresh
          </button>
          <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-3 px-12 py-4">
            {saving ? 'Saving...' : 'Save All Changes'} <ArrowRight />
          </button>
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
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium mb-2">Legal Name</label>
                  <input type="text" className="input w-full" value={form.legal_name} onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Trading Name</label>
                  <input type="text" className="input w-full" value={form.trading_name} onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Business Type</label>
                  <select className="input w-full" value={form.business_type || ''} onChange={e => setForm(p => ({ ...p, business_type: e.target.value }))}>
                    <option value="">Select Business Type</option>
                    {businessTypesList.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Contact Name</label>
                  <input type="text" className="input w-full" value={form.contact_name} onChange={e => setForm(p => ({...p, contact_name: e.target.value}))} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Contact Number</label>
                  <input type="tel" className="input w-full" value={form.contact_number || ''} onChange={e => setForm(p => ({...p, contact_number: e.target.value}))} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <input type="email" className="input w-full" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Company Registration Number</label>
                  <input type="text" className="input w-full" value={form.registration_number} onChange={e => setForm(p => ({...p, registration_number: e.target.value}))} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Company Logo</label>
                  {form.logo_url && <img src={form.logo_url} alt="Logo" className="w-14 h-14 object-cover rounded-2xl border mb-3" />}
                  <input type="file" onChange={e => handleUpload('logo_url', e)} className="hidden" id="logo-upload" />
                  <label htmlFor="logo-upload" className="btn-primary cursor-pointer">Choose Logo</label>
                </div>
              </div>

              {/* TEAM MEMBERS SECTION - REAL EMAIL ENABLED */}
              <div className="mt-12 pt-8 border-t">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold flex items-center gap-3">
                    <Users2 size={24} /> Team Members / Users
                  </h3>
                  {form.team_members?.length > 0 && (
                    <span className="text-sm bg-blue-100 text-blue-700 px-4 py-1 rounded-3xl">
                      {form.team_members.length} user{form.team_members.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-3 mb-8">
                  {form.team_members?.map((member: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-neutral-50 p-5 rounded-3xl">
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-neutral-500">{member.email} • {member.role}</div>
                      </div>
                      <div className="text-xs px-4 py-1 bg-emerald-100 text-emerald-700 rounded-3xl">
                        {member.status || 'invited'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-neutral-50 p-8 rounded-3xl">
                  <div>
                    <label className="block text-sm mb-2">Full Name</label>
                    <input type="text" className="input w-full" value={newTeamMember.name} onChange={e => setNewTeamMember({...newTeamMember, name: e.target.value})} placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Email Address</label>
                    <input type="email" className="input w-full" value={newTeamMember.email} onChange={e => setNewTeamMember({...newTeamMember, email: e.target.value})} placeholder="john@company.com" />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Contact Number</label>
                    <input type="tel" className="input w-full" value={newTeamMember.contact_number} onChange={e => setNewTeamMember({...newTeamMember, contact_number: e.target.value})} placeholder="+27 82 581 4215" />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Role</label>
                    <select className="input w-full" value={newTeamMember.role} onChange={e => setNewTeamMember({...newTeamMember, role: e.target.value})}>
                      <option value="">Select Role</option>
                      {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <button onClick={addTeamMember} className="mt-6 btn-primary flex items-center gap-3">
                  <Plus size={20} /> Send Real Invitation Email
                </button>
              </div>
            </>
          )}
        </div>

        {/* 2. Location */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('location')}>
            <h2 className="text-2xl font-bold">2. Location</h2>
            <ChevronDown className={`transition ${expanded.location ? 'rotate-180' : ''}`} />
          </div>
          {expanded.location && (
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
                {form.continent && locationData[form.continent].countries.map(c => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
              </select>
              <select className="input w-full" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))} disabled={!form.country}>
                <option value="">Select Province / State</option>
                {form.country && form.continent && locationData[form.continent].provinces[form.country]?.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
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
          )}
        </div>

        {/* 4. Financial & Banking */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('financial')}>
            <h2 className="text-2xl font-bold">4. Financial & Banking</h2>
            <ChevronDown className={`transition ${expanded.financial ? 'rotate-180' : ''}`} />
          </div>
          {expanded.financial && (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <label className="block text-sm mb-2">Tax Number</label>
                  <input type="text" className="input w-full" value={form.tax_number} onChange={e => setForm(p => ({...p, tax_number: e.target.value}))} />
                  <input type="file" onChange={e => handleUpload('tax_document_url', e)} className="hidden" id="tax-upload" />
                  <label htmlFor="tax-upload" className="btn-primary mt-3 w-full">Upload Tax Certificate</label>
                </div>
                <div>
                  <label className="block text-sm mb-2">VAT Number</label>
                  <input type="text" className="input w-full" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} />
                  <input type="file" onChange={e => handleUpload('vat_document_url', e)} className="hidden" id="vat-upload" />
                  <label htmlFor="vat-upload" className="btn-primary mt-3 w-full">Upload VAT Certificate</label>
                </div>
                <div>
                  <label className="block text-sm mb-2">Export License</label>
                  <input type="text" className="input w-full" value={form.export_license} onChange={e => setForm(p => ({...p, export_license: e.target.value}))} />
                  <input type="file" onChange={e => handleUpload('export_document_url', e)} className="hidden" id="export-upload" />
                  <label htmlFor="export-upload" className="btn-primary mt-3 w-full">Upload Export License</label>
                </div>
                <div>
                  <label className="block text-sm mb-2">Import License</label>
                  <input type="text" className="input w-full" value={form.import_license} onChange={e => setForm(p => ({...p, import_license: e.target.value}))} />
                  <input type="file" onChange={e => handleUpload('import_document_url', e)} className="hidden" id="import-upload" />
                  <label htmlFor="import-upload" className="btn-primary mt-3 w-full">Upload Import License</label>
                </div>
                <div>
                  <label className="block text-sm mb-2">Bank Confirmation</label>
                  <input type="file" onChange={e => handleUpload('bank_confirmation_url', e)} className="hidden" id="bank-upload" />
                  <label htmlFor="bank-upload" className="btn-primary mt-3 w-full">Upload Bank Confirmation</label>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-6">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm mb-2">Bank Name</label>
                    <input type="text" className="input w-full" value={form.bank_name} onChange={e => setForm(p => ({...p, bank_name: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Account Name</label>
                    <input type="text" className="input w-full" value={form.account_name} onChange={e => setForm(p => ({...p, account_name: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Account Number</label>
                    <input type="text" className="input w-full" value={form.account_number} onChange={e => setForm(p => ({...p, account_number: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">IBAN</label>
                    <input type="text" className="input w-full" value={form.iban} onChange={e => setForm(p => ({...p, iban: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">SWIFT / BIC</label>
                    <input type="text" className="input w-full" value={form.swift} onChange={e => setForm(p => ({...p, swift: e.target.value}))} />
                  </div>
                </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h3 className="font-semibold mb-6">Products</h3>
                <div className="space-y-4">
                  <input type="text" placeholder="Description" className="input w-full" value={newProduct.description} onChange={e => setNewProduct(p => ({...p, description: e.target.value}))} />
                  <input type="text" placeholder="SKU" className="input w-full" value={newProduct.sku} onChange={e => setNewProduct(p => ({...p, sku: e.target.value}))} />
                  <select className="input w-full" value={newProduct.uom} onChange={e => setNewProduct(p => ({...p, uom: e.target.value}))}>
                    <option value="">Select UoM</option>
                    {uomOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Sell Price" className="input w-full" value={newProduct.sellPrice} onChange={e => setNewProduct(p => ({...p, sellPrice: e.target.value}))} />
                    <input type="text" placeholder="Lead Time (days)" className="input w-full" value={newProduct.leadTime} onChange={e => setNewProduct(p => ({...p, leadTime: e.target.value}))} />
                  </div>
                  <button onClick={addProduct} className="btn-primary w-full">Add Product</button>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-6">Services</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input type="text" placeholder="Certificate Name" className="input w-full" value={newCert.name} onChange={e => setNewCert(p => ({...p, name: e.target.value}))} />
                <select className="input w-full" value={newCert.body} onChange={e => setNewCert(p => ({...p, body: e.target.value}))}>
                  <option value="">Certification Body</option>
                  {certifiedBodies.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-6">
                <input type="date" className="input w-full" value={newCert.awarded_date} onChange={e => setNewCert(p => ({...p, awarded_date: e.target.value}))} />
                <input type="date" className="input w-full" value={newCert.expiry_date} onChange={e => setNewCert(p => ({...p, expiry_date: e.target.value}))} />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <input type="checkbox" checked={newCert.never_expires} onChange={e => setNewCert(p => ({...p, never_expires: e.target.checked}))} />
                <span>Never expires / N/A</span>
              </div>
              <input type="file" onChange={handleCertUpload} className="hidden" id="cert-upload" />
              <label htmlFor="cert-upload" className="btn-primary mt-6 w-full flex items-center justify-center gap-2"><Upload size={18} /> Upload Certificate</label>
              <button onClick={addCertification} className="btn-primary w-full mt-6">Add Certificate</button>
            </div>
          )}
        </div>

      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button onClick={loadProfile} className="border px-8 py-4 rounded-3xl hover:bg-slate-100 flex items-center gap-2"><RotateCw size={18} /> Refresh Data</button>
        <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-3 px-12 py-4">
          {saving ? 'Saving...' : 'Save All Changes'} <ArrowRight />
        </button>
      </div>
    </div>
  );
}