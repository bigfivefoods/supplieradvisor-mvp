'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, Upload, Plus, Users2, RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function Onboarding() {
  const { user } = usePrivy();
  const router = useRouter();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [step, setStep] = useState(0);
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
    team_members: [] as any[],
    created_at: '',
    on_chain_hash: '', sbt_token_id: null as string | null, verified_at: null as string | null
  });

  const [newProduct, setNewProduct] = useState({ description: '', sku: '', uom: '', sellPrice: '', leadTime: '', image_url: '' });
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

  // Dynamic data from Supabase
  const [continents, setContinents] = useState<any[]>([]);
  const [allCountries, setAllCountries] = useState<any[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<any[]>([]);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [industriesList, setIndustriesList] = useState<any[]>([]);
  const [businessTypesList, setBusinessTypesList] = useState<any[]>([]);

  const [selectedContinentId, setSelectedContinentId] = useState<number | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);

  // Load dynamic data from Supabase
  useEffect(() => {
    const loadLookups = async () => {
      const [contRes, countryRes, indRes, btRes] = await Promise.all([
        supabase.from('continents').select('id, name').order('name'),
        supabase.from('countries').select('id, name, flag, continent_id').order('name'),
        supabase.from('industries').select('id, name, parent_id').eq('is_active', true).order('name'),
        supabase.from('business_types').select('id, name').order('name')
      ]);

      if (contRes.data) setContinents(contRes.data);
      if (countryRes.data) {
        setAllCountries(countryRes.data);
        setFilteredCountries(countryRes.data);
      }
      if (indRes.data) setIndustriesList(indRes.data);
      if (btRes.data) setBusinessTypesList(btRes.data);
    };

    loadLookups();
  }, []);

  // Filter countries when continent changes
  useEffect(() => {
    if (!selectedContinentId) {
      setFilteredCountries(allCountries);
    } else {
      setFilteredCountries(allCountries.filter(c => c.continent_id === selectedContinentId));
    }
    setForm(p => ({ ...p, country: '', province: '' }));
    setSelectedCountryId(null);
    setProvinces([]);
  }, [selectedContinentId, allCountries]);

  // Load provinces when country changes
  useEffect(() => {
    const loadProvinces = async () => {
      if (!selectedCountryId) {
        setProvinces([]);
        return;
      }
      const { data } = await supabase
        .from('provinces')
        .select('id, name')
        .eq('country_id', selectedCountryId)
        .order('name');
      setProvinces(data || []);
    };
    loadProvinces();
  }, [selectedCountryId]);

  const toggleIndustry = (name: string) => setOpenIndustries(prev => ({ ...prev, [name]: !prev[name] }));
  const toggleSection = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
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
      setNewProduct({ description: '', sku: '', uom: '', sellPrice: '', leadTime: '', image_url: '' });
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

    const { error: insertError } = await supabase.from('business_users').insert(memberData);
    if (insertError) {
      toast.error('Failed to save user');
      return;
    }

    setForm(p => ({
      ...p,
      team_members: [...(p.team_members || []), memberData]
    }));

    setNewTeamMember({ name: '', email: '', contact_number: '', role: '' });
    toast.success(`✅ Team member added`);
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
        created_at: form.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase.from('profiles').upsert(profileData);
      if (profileError) throw profileError;

      // Critical: Create link in business_users
      const { error: linkError } = await supabase
        .from('business_users')
        .upsert({
          user_id: cleanId,
          profile_id: cleanId,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString()
        }, { onConflict: 'user_id,profile_id' });

      if (linkError) console.error('business_users link error:', linkError);

      if (form.products.length > 0) {
        await supabase.from('business_products').upsert(form.products.map(p => ({ profile_id: cleanId, ...p })));
      }
      if (form.services.length > 0) {
        await supabase.from('business_services').upsert(form.services.map(name => ({ profile_id: cleanId, name })));
      }
      if (form.certifications.length > 0) {
        await supabase.from('business_certifications').upsert(form.certifications.map(c => ({ profile_id: cleanId, ...c })));
      }

      toast.success("🎉 Onboarding complete – Profile saved!");
      router.push('/dashboard/select-company');
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
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">Verify Your Business</h1>
          <p className="text-xl text-neutral-600">Complete your company profile</p>
        </div>
      </div>

      <div className="space-y-8">

        {/* 1. Company Details + Team Members */}
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
                    {businessTypesList.map((type: any) => <option key={type.id} value={type.name}>{type.name}</option>)}
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

              {/* Team Members */}
              <div className="mt-12 pt-8 border-t">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold flex items-center gap-3"><Users2 size={24} /> Team Members</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-neutral-50 p-8 rounded-3xl">
                  <input type="text" className="input w-full" placeholder="Full Name" value={newTeamMember.name} onChange={e => setNewTeamMember({...newTeamMember, name: e.target.value})} />
                  <input type="email" className="input w-full" placeholder="Email" value={newTeamMember.email} onChange={e => setNewTeamMember({...newTeamMember, email: e.target.value})} />
                  <input type="tel" className="input w-full" placeholder="Contact Number" value={newTeamMember.contact_number} onChange={e => setNewTeamMember({...newTeamMember, contact_number: e.target.value})} />
                  <select className="input w-full" value={newTeamMember.role} onChange={e => setNewTeamMember({...newTeamMember, role: e.target.value})}>
                    <option value="">Select Role</option>
                    <option value="CEO">CEO</option>
                    <option value="Director">Director</option>
                    <option value="Manager">Manager</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <button onClick={addTeamMember} className="mt-6 btn-primary flex items-center gap-3">
                  <Plus size={20} /> Add Team Member
                </button>
              </div>
            </>
          )}
        </div>

        {/* 2. LOCATION - Dynamic Cascading */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('location')}>
            <h2 className="text-2xl font-bold">2. Location</h2>
            <ChevronDown className={`transition ${expanded.location ? 'rotate-180' : ''}`} />
          </div>
          {expanded.location && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <select className="input w-full" value={form.continent} onChange={(e) => {
                  const continentName = e.target.value;
                  const selected = continents.find(c => c.name === continentName);
                  setForm(p => ({...p, continent: continentName, country: '', province: ''}));
                  setSelectedContinentId(selected ? selected.id : null);
                }}>
                  <option value="">Select Continent</option>
                  {continents.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>

                <select className="input w-full" value={form.country} onChange={(e) => {
                  const countryName = e.target.value;
                  const selected = filteredCountries.find(c => c.name === countryName);
                  setForm(p => ({...p, country: countryName, province: ''}));
                  setSelectedCountryId(selected ? selected.id : null);
                }} disabled={!form.continent}>
                  <option value="">Select Country</option>
                  {filteredCountries.map(c => <option key={c.id} value={c.name}>{c.flag} {c.name}</option>)}
                </select>

                <select className="input w-full" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))} disabled={!form.country}>
                  <option value="">Select Province / State</option>
                  {provinces.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <input type="text" className="input w-full" placeholder="Street Address" value={form.street || ''} onChange={e => setForm(p => ({...p, street: e.target.value}))} />
                <input type="text" className="input w-full" placeholder="City" value={form.city || ''} onChange={e => setForm(p => ({...p, city: e.target.value}))} />
                <input type="text" className="input w-full" placeholder="Postal Code" value={form.postal_code || ''} onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} />
              </div>
            </>
          )}
        </div>

        {/* 3. Industries */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('industries')}>
            <h2 className="text-2xl font-bold">3. Industries</h2>
            <ChevronDown className={`transition ${expanded.industries ? 'rotate-180' : ''}`} />
          </div>
          {expanded.industries && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {industriesList.filter((i: any) => !i.parent_id).map((ind: any) => (
                <div key={ind.id} className="border rounded-3xl p-6">
                  <div className="font-medium">{ind.name}</div>
                  <div className="mt-3 space-y-2">
                    {industriesList.filter((sub: any) => sub.parent_id === ind.id).map((sub: any) => (
                      <label key={sub.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.industries.includes(sub.name)} onChange={() => {
                          setForm(p => ({
                            ...p,
                            industries: p.industries.includes(sub.name)
                              ? p.industries.filter(i => i !== sub.name)
                              : [...p.industries, sub.name]
                          }));
                        }} />
                        {sub.name}
                      </label>
                    ))}
                  </div>
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
              <input type="text" className="input w-full" placeholder="Tax Number" value={form.tax_number} onChange={e => setForm(p => ({...p, tax_number: e.target.value}))} />
              <input type="text" className="input w-full" placeholder="VAT Number" value={form.vat_number} onChange={e => setForm(p => ({...p, vat_number: e.target.value}))} />
              <input type="text" className="input w-full" placeholder="Bank Name" value={form.bank_name} onChange={e => setForm(p => ({...p, bank_name: e.target.value}))} />
              <input type="text" className="input w-full" placeholder="Account Name" value={form.account_name} onChange={e => setForm(p => ({...p, account_name: e.target.value}))} />
              <input type="text" className="input w-full" placeholder="Account Number" value={form.account_number} onChange={e => setForm(p => ({...p, account_number: e.target.value}))} />
              <input type="text" className="input w-full" placeholder="IBAN" value={form.iban} onChange={e => setForm(p => ({...p, iban: e.target.value}))} />
              <input type="text" className="input w-full" placeholder="SWIFT" value={form.swift} onChange={e => setForm(p => ({...p, swift: e.target.value}))} />
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
                <h3 className="font-semibold mb-4">Products</h3>
                <input type="text" placeholder="Description" className="input w-full mb-3" value={newProduct.description} onChange={e => setNewProduct(p => ({...p, description: e.target.value}))} />
                <button onClick={addProduct} className="btn-primary w-full">Add Product</button>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Services</h3>
                <input type="text" placeholder="Service Name" className="input w-full mb-3" value={newService} onChange={e => setNewService(e.target.value)} />
                <button onClick={addService} className="btn-primary w-full">Add Service</button>
              </div>
            </div>
          )}
        </div>

        {/* 6. Certificates */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="flex justify-between items-center mb-6 cursor-pointer" onClick={() => toggleSection('certifications')}>
            <h2 className="text-2xl font-bold">6. Certificates & Documents</h2>
            <ChevronDown className={`transition ${expanded.certifications ? 'rotate-180' : ''}`} />
          </div>
          {expanded.certifications && (
            <div>
              <input type="text" placeholder="Certificate Name" className="input w-full mb-4" value={newCert.name} onChange={e => setNewCert(p => ({...p, name: e.target.value}))} />
              <button onClick={addCertification} className="btn-primary w-full">Add Certificate</button>
            </div>
          )}
        </div>

      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-3 px-12 py-4">
          {saving ? 'Saving...' : 'Submit & Go Live'} <ArrowRight />
        </button>
      </div>
    </div>
  );
}