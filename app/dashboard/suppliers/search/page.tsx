'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, Plus, UserPlus, MapPin, Award, Clock, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Image from 'next/image';

interface LocationData {
  [continent: string]: {
    countries: Array<{ name: string; flag: string }>;
    provinces: Record<string, string[]>;
  };
}

export default function SuppliersSearch() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const [showFilters, setShowFilters] = useState(true);
  const [showInvite, setShowInvite] = useState(true);
  const [showResults, setShowResults] = useState(true);
  const [showRequests, setShowRequests] = useState(true);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    companyName: true,
    businessType: false,
    region: false,
    industry: true,
    verificationMethod: false,
    verificationStatus: false,
    trustScore: true,
    continent: true,
    country: true,
    province: true,
  });

  const [filters, setFilters] = useState({
    businessTypes: [] as string[],
    regions: [] as string[],
    industries: [] as string[],
    subIndustries: [] as string[],
    verificationMethods: [] as string[],
    verificationStatus: [] as string[],
    trustScoreMin: 50,
    continents: [] as string[],
    countries: [] as string[],
    provinces: [] as string[],
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState(
    'Hi [Company Name],\n\n[Your Name] from [Your Business] invites you to join SupplierAdvisor — the verified B2B network for transparent, trusted supply chains. Connect instantly, share certificates, and transact with confidence.\n\nLooking forward to partnering with you!\n\nBest regards,\n[Your Name]'
  );

  const [sentInvitations, setSentInvitations] = useState([
    { id: 1, company: 'Fresh Farms Pty Ltd', sent: '2025-03-20', status: 'Pending' },
    { id: 2, company: 'Cape Dairy Co.', sent: '2025-03-18', status: 'Accepted' },
  ]);

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

  useEffect(() => {
    loadSuppliers();
    loadConnectionRequests();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const unique = data?.reduce((acc: any[], cur) => {
      if (!acc.find((c: any) => c.user_id === cur.user_id)) acc.push(cur);
      return acc;
    }, []) || [];
    setSuppliers(unique);
    setFilteredSuppliers(unique);
    setLoading(false);
  };

  const loadConnectionRequests = async () => {
    setRequestsLoading(true);
    console.log('🔄 Loading connection requests for cleanId:', cleanId);

    const { data: sent } = await supabase
      .from('business_connections')
      .select(`
        *,
        requestee:profiles!requestee_id (legal_name, trading_name)
      `)
      .eq('requester_id', cleanId)
      .order('id', { ascending: false });

    const { data: received } = await supabase
      .from('business_connections')
      .select(`
        *,
        requester:profiles!requester_id (legal_name, trading_name)
      `)
      .eq('requestee_id', cleanId)
      .order('id', { ascending: false });

    console.log('📤 Sent requests loaded:', sent?.length || 0);
    console.log('📥 Received requests loaded:', received?.length || 0);

    setSentRequests(sent || []);
    setReceivedRequests(received || []);
    setRequestsLoading(false);
  };

  const toggleFilter = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleArrayFilter = (key: string, value: string) => {
    setFilters(prev => {
      const arr = (prev as any)[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      };
    });
  };

  const sendInvitation = () => {
    if (!inviteEmail) return toast.error('Please enter an email');
    setSentInvitations(prev => [
      ...prev,
      { id: Date.now(), company: inviteEmail, sent: new Date().toISOString().split('T')[0], status: 'Pending' }
    ]);
    toast.success('Invitation sent!');
    setInviteEmail('');
  };

  const sendConnectionRequest = async (company: any) => {
    if (!cleanId) return toast.error("Please log in first");
    const { error } = await supabase.from('business_connections').insert({
      requester_id: cleanId,
      requestee_id: company.user_id,
      status: 'pending'
    });
    if (error) {
      console.error("Connection error:", JSON.stringify(error, null, 2));
      toast.error("Connection request failed – check console");
    } else {
      toast.success(`✅ Connection request sent to ${company.legal_name || company.trading_name}! Ready for PO.`);
      await loadConnectionRequests();
      setShowRequests(true);
    }
  };

  const acceptRequest = async (requestId: number) => {
    const { error } = await supabase
      .from('business_connections')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    if (error) toast.error("Failed to accept");
    else {
      toast.success("✅ Connection accepted! You now share full profile and files.");
      loadConnectionRequests();
    }
  };

  const resendRequest = async (requestId: number) => {
    const { error } = await supabase
      .from('business_connections')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) toast.error("Failed to resend");
    else {
      toast.success("✅ Request resent!");
      loadConnectionRequests();
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const result = suppliers.filter(s =>
      (s.legal_name || '').toLowerCase().includes(term.toLowerCase()) ||
      (s.trading_name || '').toLowerCase().includes(term.toLowerCase())
    );
    setFilteredSuppliers(result);
  };

  useEffect(() => {
    let result = suppliers;
    if (searchTerm) {
      result = result.filter(s =>
        (s.legal_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.trading_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filters.continents.length > 0) result = result.filter(s => filters.continents.includes(s.continent));
    if (filters.countries.length > 0) result = result.filter(s => filters.countries.includes(s.country));
    if (filters.provinces.length > 0) result = result.filter(s => filters.provinces.includes(s.province));
    if (filters.industries.length > 0) result = result.filter(s => s.industries?.some((i: string) => filters.industries.includes(i)));
    if (filters.subIndustries.length > 0) result = result.filter(s => s.industries?.some((i: string) => filters.subIndustries.includes(i)));
    if (filters.trustScoreMin > 0) result = result.filter(s => (s.trust_score || 50) >= filters.trustScoreMin);
    setFilteredSuppliers(result);
  }, [searchTerm, filters, suppliers]);

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-8">
        <span className="font-medium text-neutral-400">Dashboard</span>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-950">Suppliers</span>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-950">Search</span>
      </div>

      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8] mb-2">Search Suppliers</h1>
      <p className="text-2xl text-slate-600 mb-12">Multi-criteria metadata search • Verified partners only</p>

      {/* ROW 1: 2/3 Filters + 1/3 Invite */}
      <div className="grid grid-cols-12 gap-8 mb-12">
        <div className="col-span-12 lg:col-span-8">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex justify-between items-center text-[#00b4d8] text-3xl font-black tracking-[-1px] hover:text-[#0099b8] transition-all mb-4"
          >
            Advanced Metadata Filters
            <ChevronDown className={`transition ${showFilters ? 'rotate-180' : ''}`} size={32} />
          </button>
          {showFilters && (
            <div className="card p-8">
              {/* Company Name */}
              <div className="mb-8">
                <button onClick={() => toggleFilter('companyName')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Company Name
                  <ChevronDown className={`transition ${expanded.companyName ? 'rotate-180' : ''}`} />
                </button>
                {expanded.companyName && (
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" />
                    <input type="text" placeholder="Search companies..." className="input pl-11 w-full" value={searchTerm} onChange={e => handleSearch(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Continent */}
              <div className="mb-8">
                <button onClick={() => toggleFilter('continent')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Continent
                  <ChevronDown className={`transition ${expanded.continent ? 'rotate-180' : ''}`} />
                </button>
                {expanded.continent && (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(locationData).map(continent => (
                      <label key={continent} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={filters.continents.includes(continent)} onChange={() => toggleArrayFilter('continents', continent)} />
                        {continent}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Country */}
              <div className="mb-8">
                <button onClick={() => toggleFilter('country')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Country
                  <ChevronDown className={`transition ${expanded.country ? 'rotate-180' : ''}`} />
                </button>
                {expanded.country && (
                  <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                    {filters.continents.length > 0 ? (
                      filters.continents.flatMap(cont => locationData[cont].countries).map(c => (
                        <label key={c.name} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={filters.countries.includes(c.name)} onChange={() => toggleArrayFilter('countries', c.name)} />
                          {c.flag} {c.name}
                        </label>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm">Select continent(s) first</p>
                    )}
                  </div>
                )}
              </div>

              {/* Province/State */}
              <div className="mb-8">
                <button onClick={() => toggleFilter('province')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Province / State
                  <ChevronDown className={`transition ${expanded.province ? 'rotate-180' : ''}`} />
                </button>
                {expanded.province && (
                  <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                    {filters.countries.length > 0 ? (
                      filters.countries.flatMap(country => {
                        const contKey = Object.keys(locationData).find(c => locationData[c].countries.some(co => co.name === country));
                        return contKey && locationData[contKey].provinces[country] ? locationData[contKey].provinces[country] : [];
                      }).map(p => (
                        <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={filters.provinces.includes(p)} onChange={() => toggleArrayFilter('provinces', p)} />
                          {p}
                        </label>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm">Select country(ies) first</p>
                    )}
                  </div>
                )}
              </div>

              {/* Industry + Sub-Industry */}
              <div className="mb-8">
                <button onClick={() => toggleFilter('industry')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Industry Type
                  <ChevronDown className={`transition ${expanded.industry ? 'rotate-180' : ''}`} />
                </button>
                {expanded.industry && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {industriesList.map(ind => (
                      <div key={ind.name}>
                        <label className="flex items-center gap-2 font-medium cursor-pointer">
                          <input type="checkbox" checked={filters.industries.includes(ind.name)} onChange={() => toggleArrayFilter('industries', ind.name)} />
                          {ind.name}
                        </label>
                        {filters.industries.includes(ind.name) && ind.sub.length > 0 && (
                          <div className="pl-6 mt-2 space-y-1">
                            {ind.sub.map(sub => (
                              <label key={sub} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={filters.subIndustries.includes(sub)} onChange={() => toggleArrayFilter('subIndustries', sub)} />
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

              {/* Trust Score */}
              <div>
                <button onClick={() => toggleFilter('trustScore')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Trust Score (Min)
                  <ChevronDown className={`transition ${expanded.trustScore ? 'rotate-180' : ''}`} />
                </button>
                {expanded.trustScore && (
                  <div className="px-2">
                    <div className="flex justify-between text-sm mb-2">
                      <span>0%</span>
                      <span className="font-medium">Trust Score: <span className="text-[#00b4d8]">{filters.trustScoreMin}%</span></span>
                      <span>100%</span>
                    </div>
                    <input type="range" min="0" max="100" value={filters.trustScoreMin} onChange={e => setFilters(p => ({...p, trustScoreMin: parseInt(e.target.value)}))} className="w-full accent-[#00b4d8]" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4">
          <button 
            onClick={() => setShowInvite(!showInvite)}
            className="w-full flex justify-between items-center text-[#00b4d8] text-3xl font-black tracking-[-1px] hover:text-[#0099b8] transition-all mb-4"
          >
            Invite New Business
            <ChevronDown className={`transition ${showInvite ? 'rotate-180' : ''}`} size={32} />
          </button>
          {showInvite && (
            <div className="card p-8 h-full">
              <p className="text-slate-600 mb-6">Send a personalised invitation to join the verified SupplierAdvisor network.</p>
              <input type="email" placeholder="Business email address" className="input mb-6" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Invitation Message</label>
                <textarea rows={5} className="input w-full resize-y" value={inviteNote} onChange={e => setInviteNote(e.target.value)} />
              </div>
              <button onClick={sendInvitation} className="btn-primary w-full py-5 flex items-center justify-center gap-3">
                <Plus size={22} /> Send Invitation
              </button>
              <div className="mt-12">
                <h4 className="font-medium mb-4">Sent Invitations</h4>
                <div className="space-y-4 text-sm">
                  {sentInvitations.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center border-b pb-3 last:border-none">
                      <div>
                        <div className="font-medium">{inv.company}</div>
                        <div className="text-slate-500 text-xs">Sent {inv.sent}</div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs ${inv.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESULTS */}
      <div className="mb-12">
        <button 
          onClick={() => setShowResults(!showResults)}
          className="w-full flex justify-between items-center text-[#00b4d8] text-3xl font-black tracking-[-1px] hover:text-[#0099b8] transition-all mb-4"
        >
          Results ({filteredSuppliers.length})
          <ChevronDown className={`transition ${showResults ? 'rotate-180' : ''}`} size={32} />
        </button>
        {showResults && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredSuppliers.map((s) => (
              <div key={s.user_id} className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden hover:shadow-2xl transition-all group">
                <div className="h-56 bg-neutral-100 relative flex items-center justify-center">
                  {s.logo_url ? (
                    <Image src={s.logo_url} alt={s.legal_name} width={160} height={160} className="object-contain" />
                  ) : (
                    <div className="text-7xl font-black text-[#00b4d8]/10">
                      {(s.legal_name || 'BFF').slice(0, 2)}
                    </div>
                  )}
                  <div className="absolute top-6 right-6 bg-emerald-500 text-white text-xs px-5 py-1 rounded-full font-medium flex items-center gap-1 shadow">
                    <Award size={14} /> VERIFIED
                  </div>
                </div>
                <div className="p-8">
                  <h3 className="font-black text-3xl tracking-tight mb-1">{s.legal_name}</h3>
                  {s.trading_name && <p className="text-neutral-500 mb-4">{s.trading_name}</p>}
                  <div className="flex items-center gap-2 mt-4 text-sm text-neutral-600">
                    <MapPin size={18} className="text-neutral-400" />
                    <span>{s.country} • {s.province || '—'}</span>
                  </div>
                  {s.industries && s.industries.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-6">
                      {s.industries.slice(0, 3).map((ind: string, i: number) => (
                        <span key={i} className="bg-neutral-100 text-xs px-4 py-1.5 rounded-3xl">{ind}</span>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={() => sendConnectionRequest(s)}
                    className="mt-10 w-full bg-[#00b4d8] hover:bg-[#0099b8] text-white py-5 rounded-3xl font-semibold flex items-center justify-center gap-3 transition-all"
                  >
                    <UserPlus size={20} /> Connect & Start Raising POs
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONNECTION REQUESTS – SHOWING COMPANY NAMES */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={() => setShowRequests(!showRequests)}
            className="flex justify-between items-center text-[#00b4d8] text-3xl font-black tracking-[-1px] hover:text-[#0099b8] transition-all"
          >
            Connection Requests
            <ChevronDown className={`transition ${showRequests ? 'rotate-180' : ''}`} size={32} />
          </button>
          <button onClick={loadConnectionRequests} className="flex items-center gap-2 px-6 py-3 bg-white border border-[#00b4d8] text-[#00b4d8] rounded-3xl hover:bg-[#00b4d8] hover:text-white transition-all">
            <RefreshCw size={18} /> Refresh
          </button>
        </div>

        {showRequests && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Requests Sent */}
            <div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                Requests Sent <span className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full">{sentRequests.length}</span>
              </h3>
              {sentRequests.length === 0 ? (
                <div className="card p-12 text-center text-slate-400">
                  <p>No requests sent yet.</p>
                  <p className="text-sm mt-2">Click "Connect &amp; Start Raising POs" on a supplier card above.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sentRequests.map((req) => (
                    <div key={req.id} className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8 flex gap-6">
                      <div className="flex-1">
                        <div className="font-black text-2xl">Sent to: {req.requestee?.legal_name || req.requestee_id}</div>
                        <div className="text-neutral-500">{req.requestee?.trading_name}</div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 mt-4">
                          <Clock size={14} />
                          Sent {new Date(req.created_at || Date.now()).toLocaleDateString()} at {new Date(req.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex flex-col justify-between items-end">
                        <span className={`px-4 py-1 rounded-full text-xs ${req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {req.status.toUpperCase()}
                        </span>
                        {req.status === 'pending' && (
                          <button onClick={() => resendRequest(req.id)} className="text-[#00b4d8] flex items-center gap-2 text-sm font-medium hover:underline">
                            <RefreshCw size={16} /> Re-send
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Requests Received */}
            <div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                Requests Received <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{receivedRequests.length}</span>
              </h3>
              {receivedRequests.length === 0 ? (
                <div className="card p-12 text-center text-slate-400">
                  <p>No requests received yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {receivedRequests.map((req) => (
                    <div key={req.id} className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8 flex gap-6">
                      <div className="flex-1">
                        <div className="font-black text-2xl">From: {req.requester?.legal_name || req.requester_id}</div>
                        <div className="text-neutral-500">{req.requester?.trading_name}</div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 mt-4">
                          <Clock size={14} />
                          Received {new Date(req.created_at || Date.now()).toLocaleDateString()} at {new Date(req.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex flex-col justify-between items-end">
                        <span className={`px-4 py-1 rounded-full text-xs ${req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {req.status.toUpperCase()}
                        </span>
                        {req.status === 'pending' && (
                          <button onClick={() => acceptRequest(req.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-3xl flex items-center gap-2 text-sm font-medium">
                            <CheckCircle size={18} /> Accept
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}