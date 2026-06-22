'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Edit2, MessageCircle, Plus, ExternalLink, 
  ArrowUpDown, X, ChevronDown, ChevronUp, Filter 
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SupplierProfile {
  id: number;
  public_id: string;
  trading_name: string;
  legal_name: string | null;
  email: string;
  contact_name: string | null;
  contact_phone: string | null;
  category: string | null;
  website: string | null;
  supplier_status: string;
  invited_at: string | null;
  claimed_at: string | null;
  created_at: string;
  invited_by: string | null;
  location: string | null;
  industry: string | null;
  sub_industry: string | null;
  continent: string | null;
  country: string | null;
  province: string | null;
  certifications: string[] | null;
}

type SortOption = 'name' | 'industry' | 'onboarded' | 'status';

function SupplierProfileContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');

  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showFilters, setShowFilters] = useState(true);

  // Checkbox Filter States
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedSubIndustries, setSelectedSubIndustries] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);

  // Expandable sections
  const [expandedSections, setExpandedSections] = useState({
    industry: true,
    subIndustry: true,
    location: true,
    certifications: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Fetch suppliers
  const fetchActiveSuppliers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('relationship_type', 'supplier')
      .order('trading_name', { ascending: true });

    if (!error && data) setSuppliers(data as SupplierProfile[]);
    setLoading(false);
  };

  const fetchSupplier = async (publicId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('public_id', publicId)
      .single();

    if (!error && data) setSupplier(data as SupplierProfile);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedId) {
      fetchSupplier(selectedId);
    } else {
      fetchActiveSuppliers();
    }
  }, [selectedId]);

  // ===================== DYNAMIC FILTER OPTIONS =====================
  const uniqueIndustries = Array.from(new Set(suppliers.map(s => s.industry).filter(Boolean))) as string[];
  const uniqueSubIndustries = Array.from(new Set(suppliers.map(s => s.sub_industry).filter(Boolean))) as string[];
  const uniqueCountries = Array.from(new Set(suppliers.map(s => s.country).filter(Boolean))) as string[];
  const uniqueProvinces = Array.from(new Set(suppliers.map(s => s.province).filter(Boolean))) as string[];
  const uniqueCertifications = Array.from(new Set(suppliers.flatMap(s => s.certifications || []))) as string[];

  // ===================== FILTERING LOGIC =====================
  const getFilteredSuppliers = () => {
    let result = [...suppliers];

    // Text search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(s =>
        s.trading_name?.toLowerCase().includes(term) ||
        s.legal_name?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.industry?.toLowerCase().includes(term) ||
        s.sub_industry?.toLowerCase().includes(term) ||
        s.country?.toLowerCase().includes(term) ||
        s.province?.toLowerCase().includes(term)
      );
    }

    // Industry
    if (selectedIndustries.length > 0) {
      result = result.filter(s => s.industry && selectedIndustries.includes(s.industry));
    }

    // Sub-Industry
    if (selectedSubIndustries.length > 0) {
      result = result.filter(s => s.sub_industry && selectedSubIndustries.includes(s.sub_industry));
    }

    // Country
    if (selectedCountries.length > 0) {
      result = result.filter(s => s.country && selectedCountries.includes(s.country));
    }

    // Province
    if (selectedProvinces.length > 0) {
      result = result.filter(s => s.province && selectedProvinces.includes(s.province));
    }

    // Certifications (must have ALL selected certs)
    if (selectedCertifications.length > 0) {
      result = result.filter(s =>
        s.certifications && selectedCertifications.every(cert => s.certifications!.includes(cert))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') return a.trading_name.localeCompare(b.trading_name);
      if (sortBy === 'industry') return (a.industry || '').localeCompare(b.industry || '');
      if (sortBy === 'onboarded') {
        const dateA = a.claimed_at || a.created_at;
        const dateB = b.claimed_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
      if (sortBy === 'status') return a.supplier_status.localeCompare(b.supplier_status);
      return 0;
    });

    return result;
  };

  const filteredSuppliers = getFilteredSuppliers();

  // Toggle functions
  const toggleIndustry = (industry: string) => {
    setSelectedIndustries(prev => prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]);
  };

  const toggleSubIndustry = (sub: string) => {
    setSelectedSubIndustries(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);
  };

  const toggleCountry = (country: string) => {
    setSelectedCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  };

  const toggleProvince = (province: string) => {
    setSelectedProvinces(prev => prev.includes(province) ? prev.filter(p => p !== province) : [...prev, province]);
  };

  const toggleCertification = (cert: string) => {
    setSelectedCertifications(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedIndustries([]);
    setSelectedSubIndustries([]);
    setSelectedCountries([]);
    setSelectedProvinces([]);
    setSelectedCertifications([]);
  };

  const activeFilterCount =
    selectedIndustries.length +
    selectedSubIndustries.length +
    selectedCountries.length +
    selectedProvinces.length +
    selectedCertifications.length;

  // ==================== LIST VIEW ====================
  if (!selectedId) {
    return (
      <div className="px-8 py-12 max-w-screen-2xl mx-auto">
        <div className="flex justify-between items-end mb-10">
          <div>
            <p className="text-sm text-neutral-500 mb-1">SUPPLIERS</p>
            <h1 className="font-black text-6xl tracking-[-3.5px]">Supplier Profiles</h1>
          </div>
          <Link href="/dashboard/suppliers/add" className="btn-primary px-8 py-3 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add New Supplier
          </Link>
        </div>

        {/* Search Bar + Filter Toggle */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by company name, industry, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-12 py-4 bg-white border border-neutral-200 rounded-3xl text-lg focus:outline-none focus:border-[#00b4d8]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-5 top-4 text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-6 py-4 border border-neutral-200 rounded-3xl hover:bg-white transition-colors"
          >
            <Filter className="w-4 h-4" /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-[#00b4d8] text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 px-5 bg-white border border-neutral-200 rounded-3xl">
            <ArrowUpDown className="w-4 h-4 text-neutral-500" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="bg-transparent py-4 pr-8 text-sm font-medium focus:outline-none">
              <option value="name">Sort by Name</option>
              <option value="industry">Sort by Industry</option>
              <option value="onboarded">Sort by Recently Onboarded</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        </div>

        {/* EXPANDABLE CHECKBOX FILTERS */}
        {showFilters && (
          <div className="mb-8 bg-white border border-neutral-200 rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-xl tracking-tight flex items-center gap-2">
                <Filter className="w-5 h-5" /> Filter Suppliers
              </h3>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="text-sm text-[#00b4d8] hover:underline">
                  Clear all filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              
              {/* Industry */}
              <div>
                <button onClick={() => toggleSection('industry')} className="flex w-full justify-between items-center mb-3 text-left font-semibold">
                  Industry {expandedSections.industry ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.industry && (
                  <div className="space-y-2 pl-1 max-h-52 overflow-auto">
                    {uniqueIndustries.length > 0 ? uniqueIndustries.map(ind => (
                      <label key={ind} className="flex items-center gap-3 cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedIndustries.includes(ind)} onChange={() => toggleIndustry(ind)} className="w-4 h-4 accent-[#00b4d8]" />
                        {ind}
                      </label>
                    )) : <p className="text-sm text-neutral-400">No industry data yet</p>}
                  </div>
                )}
              </div>

              {/* Sub-Industry */}
              <div>
                <button onClick={() => toggleSection('subIndustry')} className="flex w-full justify-between items-center mb-3 text-left font-semibold">
                  Sub-Industry {expandedSections.subIndustry ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.subIndustry && (
                  <div className="space-y-2 pl-1 max-h-52 overflow-auto">
                    {uniqueSubIndustries.length > 0 ? uniqueSubIndustries.map(sub => (
                      <label key={sub} className="flex items-center gap-3 cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedSubIndustries.includes(sub)} onChange={() => toggleSubIndustry(sub)} className="w-4 h-4 accent-[#00b4d8]" />
                        {sub}
                      </label>
                    )) : <p className="text-sm text-neutral-400">No sub-industry data yet</p>}
                  </div>
                )}
              </div>

              {/* Location */}
              <div>
                <button onClick={() => toggleSection('location')} className="flex w-full justify-between items-center mb-3 text-left font-semibold">
                  Location {expandedSections.location ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.location && (
                  <div className="space-y-4 pl-1">
                    {/* Country */}
                    <div>
                      <div className="text-xs font-medium text-neutral-500 mb-1.5">Country</div>
                      <div className="space-y-1.5 max-h-40 overflow-auto">
                        {uniqueCountries.length > 0 ? uniqueCountries.map(country => (
                          <label key={country} className="flex items-center gap-3 cursor-pointer text-sm">
                            <input type="checkbox" checked={selectedCountries.includes(country)} onChange={() => toggleCountry(country)} className="w-4 h-4 accent-[#00b4d8]" />
                            {country}
                          </label>
                        )) : <p className="text-xs text-neutral-400">No country data yet</p>}
                      </div>
                    </div>

                    {/* Province */}
                    <div>
                      <div className="text-xs font-medium text-neutral-500 mb-1.5">Province / State</div>
                      <div className="space-y-1.5 max-h-40 overflow-auto">
                        {uniqueProvinces.length > 0 ? uniqueProvinces.map(prov => (
                          <label key={prov} className="flex items-center gap-3 cursor-pointer text-sm">
                            <input type="checkbox" checked={selectedProvinces.includes(prov)} onChange={() => toggleProvince(prov)} className="w-4 h-4 accent-[#00b4d8]" />
                            {prov}
                          </label>
                        )) : <p className="text-xs text-neutral-400">No province data yet</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Certifications */}
              <div>
                <button onClick={() => toggleSection('certifications')} className="flex w-full justify-between items-center mb-3 text-left font-semibold">
                  Certifications {expandedSections.certifications ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.certifications && (
                  <div className="flex flex-wrap gap-2">
                    {uniqueCertifications.length > 0 ? uniqueCertifications.map(cert => (
                      <label key={cert} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-2xl cursor-pointer text-sm transition-colors">
                        <input type="checkbox" checked={selectedCertifications.includes(cert)} onChange={() => toggleCertification(cert)} className="w-4 h-4 accent-[#00b4d8]" />
                        {cert}
                      </label>
                    )) : <p className="text-sm text-neutral-400">No certification data yet</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="mb-4 text-sm text-neutral-500 px-1">
          Showing <span className="font-semibold text-neutral-900">{filteredSuppliers.length}</span> suppliers
        </div>

        {loading ? (
          <div className="py-20 text-center">Loading suppliers...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-20">No suppliers match your current filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSuppliers.map((s) => (
              <Link 
                key={s.public_id} 
                href={`/dashboard/suppliers/profiles?id=${s.public_id}`} 
                className="group bg-white border border-neutral-200 rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-xl transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-2xl tracking-tight group-hover:text-[#00b4d8] pr-4">{s.trading_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.supplier_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.supplier_status}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  {s.contact_name && <div>{s.contact_name}</div>}
                  <div className="text-neutral-500">{s.email}</div>
                  {(s.industry || s.country || s.province) && (
                    <div className="pt-2 text-xs text-neutral-600">
                      {[s.industry, s.country, s.province].filter(Boolean).join(' • ')}
                    </div>
                  )}
                  {s.certifications && s.certifications.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {s.certifications.slice(0, 3).map((cert, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-100 rounded-full">{cert}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== DETAIL VIEW ====================
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!supplier) return <div className="min-h-screen flex items-center justify-center">Supplier not found</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-screen-2xl mx-auto px-8 py-12">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-5">
            <Link href="/dashboard/suppliers/profiles" className="p-3 hover:bg-white rounded-2xl border"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-6xl font-black tracking-[-3.5px]">{supplier.trading_name}</h1>
                <span className={`px-5 py-1.5 rounded-full text-sm font-semibold ${supplier.supplier_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {supplier.supplier_status}
                </span>
              </div>
              {supplier.legal_name && <p className="text-2xl text-neutral-500 tracking-tight mt-1">{supplier.legal_name}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="flex items-center gap-2 px-6 py-3 border border-neutral-300 rounded-2xl hover:bg-white"><MessageCircle className="w-4 h-4" /> Message</button>
            <Link href={`/dashboard/suppliers/po?supplier=${supplier.public_id}`} className="flex items-center gap-2 px-6 py-3 bg-[#00b4d8] text-white rounded-2xl hover:bg-[#0099b8]"><Plus className="w-4 h-4" /> Raise PO</Link>
            <button className="flex items-center gap-2 px-6 py-3 border border-neutral-300 rounded-2xl hover:bg-white"><Edit2 className="w-4 h-4" /> Edit</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            {/* Metadata Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl border p-6">
                <div className="text-sm text-neutral-500 mb-1">Industry</div>
                <div className="text-2xl font-semibold tracking-tight">{supplier.industry || '—'}</div>
              </div>
              <div className="bg-white rounded-3xl border p-6">
                <div className="text-sm text-neutral-500 mb-1">Sub-Industry</div>
                <div className="text-2xl font-semibold tracking-tight">{supplier.sub_industry || '—'}</div>
              </div>
              <div className="bg-white rounded-3xl border p-6">
                <div className="text-sm text-neutral-500 mb-1">Location</div>
                <div className="text-2xl font-semibold tracking-tight">{supplier.location || supplier.country || '—'}</div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-3xl border p-8">
              <h3 className="font-bold text-2xl tracking-tight mb-6">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-lg">
                <div><span className="text-neutral-500 text-sm block">Primary Contact</span>{supplier.contact_name || '—'}</div>
                <div><span className="text-neutral-500 text-sm block">Email</span><a href={`mailto:${supplier.email}`} className="text-[#00b4d8] hover:underline">{supplier.email}</a></div>
                <div><span className="text-neutral-500 text-sm block">Phone</span>{supplier.contact_phone || '—'}</div>
                <div><span className="text-neutral-500 text-sm block">Location</span>{supplier.location || supplier.country || '—'}</div>
              </div>
            </div>

            {/* Certifications */}
            {supplier.certifications && supplier.certifications.length > 0 && (
              <div className="bg-white rounded-3xl border p-8">
                <h3 className="font-bold text-2xl tracking-tight mb-4">Certifications</h3>
                <div className="flex flex-wrap gap-2">
                  {supplier.certifications.map((cert, index) => (
                    <span key={index} className="px-4 py-2 bg-neutral-100 rounded-2xl text-sm">{cert}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border p-8">
              <h4 className="font-bold text-xl tracking-tight mb-6">Quick Actions</h4>
              <div className="space-y-3">
                <button className="w-full py-4 border rounded-2xl hover:bg-neutral-50 flex justify-center gap-2 text-lg">Send Message</button>
                <Link href={`/dashboard/suppliers/po?supplier=${supplier.public_id}`} className="w-full py-4 bg-[#00b4d8] text-white rounded-2xl flex justify-center gap-2 text-lg">Create Purchase Order</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SupplierProfileContent />
    </Suspense>
  );
}