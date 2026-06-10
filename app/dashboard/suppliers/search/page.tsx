'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, Plus, UserPlus, MapPin, Award, Clock, RefreshCw, CheckCircle, BadgeCheck } from 'lucide-react';
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('Hi [Company Name],\n\n[Your Name] from [Your Business] invites you to join SupplierAdvisor — the verified B2B network for transparent, trusted supply chains. Connect instantly, share certificates, and transact with confidence.\n\nLooking forward to partnering with you!\n\nBest regards,\n[Your Name]');

  // Filters state
  const [selectedContinent, setSelectedContinent] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [trustScoreMin, setTrustScoreMin] = useState(50);

  const locationData: LocationData = {
    Africa: {
      countries: [
        { name: "South Africa", flag: "🇿🇦" }, { name: "Nigeria", flag: "🇳🇬" }, { name: "Kenya", flag: "🇰🇪" },
        { name: "Egypt", flag: "🇪🇬" }, { name: "Ghana", flag: "🇬🇭" }, { name: "Ethiopia", flag: "🇪🇹" },
        { name: "Uganda", flag: "🇺🇬" }, { name: "Tanzania", flag: "🇹🇿" }, { name: "Morocco", flag: "🇲🇦" },
        { name: "Algeria", flag: "🇩🇿" }, { name: "Senegal", flag: "🇸🇳" }
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
    }
  };

  const industriesList = [
    'Agriculture & Farming', 'Food & Beverage', 'Manufacturing', 'Logistics & Transportation',
    'Retail & Wholesale', 'Sustainability', 'Finance & Insurance', 'Education & Academics'
  ];

  const loadSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, legal_name, trading_name, country, province, industries, verification_status, official_name, cipc_verified_at')
      .neq('user_id', cleanId);
    setSuppliers(data || []);
    setFilteredSuppliers(data || []);
    setLoading(false);
  };

  const loadConnectionRequests = async () => {
    setRequestsLoading(true);
    const { data: sent } = await supabase.from('business_connections').select('*').eq('requester_id', cleanId);
    const { data: received } = await supabase.from('business_connections').select('*').eq('target_id', cleanId);
    setSentRequests(sent || []);
    setReceivedRequests(received || []);
    setRequestsLoading(false);
  };

  const sendConnectionRequest = async (targetId: string, companyName: string) => {
    const { error } = await supabase.from('business_connections').insert({
      requester_id: cleanId,
      target_id: targetId,
      status: 'pending'
    });
    if (error) {
      console.error("Connection error:", error);
      toast.error("Connection request failed");
    } else {
      toast.success(`✅ Connection request sent to ${companyName}! Ready for PO.`);
      loadConnectionRequests();
    }
  };

  const acceptRequest = async (id: string) => {
    const { error } = await supabase.from('business_connections').update({ status: 'accepted' }).eq('id', id);
    if (error) toast.error("Failed to accept");
    else {
      toast.success("✅ Connection accepted");
      loadConnectionRequests();
    }
  };

  const sendInvitation = async () => {
    if (!inviteEmail) return toast.error('Please enter an email');
    try {
      await supabase.functions.invoke('send-team-invitation', {
        body: {
          to_email: inviteEmail,
          to_name: 'New Supplier',
          company_name: 'Your Company',
          role: 'Supplier',
          inviter_name: 'You'
        }
      });
      toast.success('Invitation sent!');
      setInviteEmail('');
    } catch (err) {
      console.error(err);
      toast.error('Invitation failed to send');
    }
  };

  const filteredSuppliersList = suppliers.filter(s => {
    const matchesSearch = 
      (s.legal_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.trading_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  useEffect(() => {
    loadSuppliers();
    loadConnectionRequests();
  }, []);

  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Find Verified Suppliers</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Advanced Filters */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-6 border border-neutral-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#00b4d8]">Advanced Filters</h3>
              <button onClick={() => setShowFilters(!showFilters)} className="text-[#00b4d8]">
                <ChevronDown className={`transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {showFilters && (
              <div className="space-y-8">
                {/* Continent */}
                <div>
                  <label className="block text-sm font-medium mb-3">Continent</label>
                  <select className="input w-full" value={selectedContinent} onChange={(e) => setSelectedContinent(e.target.value)}>
                    <option value="">All Continents</option>
                    {Object.keys(locationData).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium mb-3">Country</label>
                  <select className="input w-full" value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} disabled={!selectedContinent}>
                    <option value="">All Countries</option>
                    {selectedContinent && locationData[selectedContinent].countries.map(c => (
                      <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Province / State */}
                <div>
                  <label className="block text-sm font-medium mb-3">Province / State</label>
                  <select className="input w-full" value={selectedProvince} onChange={(e) => setSelectedProvince(e.target.value)} disabled={!selectedCountry}>
                    <option value="">All Provinces</option>
                    {selectedCountry && selectedContinent && locationData[selectedContinent].provinces[selectedCountry]?.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-sm font-medium mb-3">Industry</label>
                  <div className="max-h-60 overflow-auto space-y-2">
                    {industriesList.map(ind => (
                      <label key={ind} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedIndustries.includes(ind)} 
                          onChange={() => {
                            setSelectedIndustries(prev => 
                              prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
                            );
                          }} 
                        />
                        {ind}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Trust Score */}
                <div>
                  <label className="block text-sm font-medium mb-3">Minimum Trust Score</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={trustScoreMin} 
                    onChange={(e) => setTrustScoreMin(Number(e.target.value))} 
                    className="w-full"
                  />
                  <div className="text-center text-sm text-neutral-500 mt-1">{trustScoreMin}%</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invite New Business */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-6 border border-neutral-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#00b4d8]">Invite New Business</h3>
              <button onClick={() => setShowInvite(!showInvite)} className="text-[#00b4d8]">
                <ChevronDown className={`transition ${showInvite ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {showInvite && (
              <div>
                <input type="email" placeholder="Email address" className="input w-full" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                <textarea className="input w-full h-32 mt-4" value={inviteNote} onChange={e => setInviteNote(e.target.value)} />
                <button onClick={sendInvitation} className="btn-primary w-full mt-4">Send Invitation</button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-6 border border-neutral-100">
            <h3 className="text-xl font-bold mb-6">Results ({filteredSuppliersList.length})</h3>
            <div className="space-y-6">
              {filteredSuppliersList.map(s => (
                <div key={s.id} className="card p-6 hover:shadow-xl transition-all">
                  <div className="flex items-start justify-between mb-1">
                    <div className="text-2xl font-bold">{s.legal_name}</div>
                    {s.verification_status === 'verified' && (
                      <div className="flex items-center gap-1 text-emerald-700 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex-shrink-0 ml-2">
                        <BadgeCheck size={14} /> CIPC Verified
                      </div>
                    )}
                  </div>
                  <div className="text-slate-500 mb-2">{s.trading_name}</div>
                  {s.verification_status === 'verified' && s.official_name && (
                    <div className="text-emerald-700 text-xs mb-2">Registered as: <span className="font-semibold">{s.official_name}</span></div>
                  )}
                  <div className="flex items-center gap-2 text-amber-500 mb-8">
                    ⭐ 4.8 • 17 reviews
                  </div>
                  <button onClick={() => sendConnectionRequest(s.id, s.legal_name)} className="btn-primary w-full py-4 flex items-center justify-center gap-2">
                    <UserPlus size={20} /> Send Connection Request
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Connection Requests */}
      <div className="mt-12 bg-white rounded-3xl p-6 border border-neutral-100">
        <h3 className="text-xl font-bold mb-6">Connection Requests</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sent */}
          <div>
            <h4 className="font-medium mb-4">Sent</h4>
            <div className="space-y-4">
              {sentRequests.map(req => (
                <div key={req.id} className="flex justify-between items-center bg-neutral-50 p-5 rounded-3xl">
                  <div>
                    <div className="font-medium">To: {req.target_id}</div>
                    <div className="text-xs text-neutral-400">Sent {new Date(req.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-xs ${req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {req.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Received */}
          <div>
            <h4 className="font-medium mb-4">Received</h4>
            <div className="space-y-4">
              {receivedRequests.map(req => (
                <div key={req.id} className="flex justify-between items-center bg-neutral-50 p-5 rounded-3xl">
                  <div>
                    <div className="font-medium">From: {req.requester_id}</div>
                    <div className="text-xs text-neutral-400">Received {new Date(req.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-xs ${req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {req.status.toUpperCase()}
                  </span>
                  {req.status === 'pending' && (
                    <button onClick={() => acceptRequest(req.id)} className="bg-emerald-500 text-white px-6 py-3 rounded-3xl flex items-center gap-2 text-sm font-medium">
                      <CheckCircle size={18} /> Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}