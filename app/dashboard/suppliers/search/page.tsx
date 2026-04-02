'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, Plus, UserPlus } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import toast from 'react-hot-toast';

export default function SuppliersSearch() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    companyName: true,
    businessType: false,
    region: false,
    industry: false,
    verificationMethod: false,
    verificationStatus: false,
    trustScore: false,
  });

  const [filters, setFilters] = useState({
    businessTypes: [] as string[],
    regions: [] as string[],
    industries: [] as string[],
    verificationMethods: [] as string[],
    verificationStatus: [] as string[],
    trustScoreMin: 50,
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState(
    'Hi [Company Name],\n\n[Your Name] from [Your Business] invites you to join SupplierAdvisor — the verified B2B network for transparent, trusted supply chains. Connect instantly, share certificates, and transact with confidence.\n\nLooking forward to partnering with you!\n\nBest regards,\n[Your Name]'
  );

  const [sentInvitations, setSentInvitations] = useState([
    { id: 1, company: 'Fresh Farms Pty Ltd', sent: '2025-03-20', status: 'Pending' },
    { id: 2, company: 'Cape Dairy Co.', sent: '2025-03-18', status: 'Accepted' },
  ]);

  const businessTypeOptions = ['Farmer / Producer', 'Manufacturer', 'Distributor', 'Wholesaler', 'Importer', 'Exporter'];
  const regionOptions = ['KwaZulu-Natal', 'Western Cape', 'Gauteng', 'Eastern Cape', 'Free State'];
  const industryOptions = ['Fresh Produce', 'Meat & Poultry', 'Dairy', 'Grains', 'Processed Foods'];
  const verificationMethodOptions = ['Self Upload', 'API Verified', 'Manual Review'];
  const verificationStatusOptions = ['Fully Verified', 'Pending'];

  useEffect(() => {
    const loadSuppliers = async () => {
      const { data } = await supabase.from('profiles').select('*');
      setSuppliers(data || []);
    };
    loadSuppliers();
  }, []);

  const toggleFilter = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleArrayFilter = (key: string, value: string) => {
    setFilters(prev => {
      const arr = prev[key as keyof typeof prev] as string[];
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

  const sendConnectionRequest = async (supplierId: number, supplierName: string) => {
    const { error } = await supabase.from('business_connections').insert({
      requester_id: 1,
      requestee_id: supplierId,
      status: 'pending'
    });
    if (!error) toast.success(`Connection request sent to ${supplierName}`);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.trading_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Search Suppliers</h1>
      <p className="text-2xl text-slate-600 mb-12">Multi-criteria metadata search</p>

      <div className="grid grid-cols-12 gap-8">
        {/* LEFT 2/3 – Advanced Metadata Filters */}
        <div className="col-span-12 lg:col-span-8">
          <div className="card p-8">
            <div className="flex items-center gap-4 mb-8">
              <Search size={28} />
              <h3 className="text-3xl font-bold">Advanced Metadata Filters</h3>
            </div>

            {/* Company Name – FULL WIDTH */}
            <div className="mb-8">
              <button onClick={() => toggleFilter('companyName')} className="w-full flex justify-between text-lg font-medium mb-4">
                Company Name
                <ChevronDown className={`transition ${expanded.companyName ? 'rotate-180' : ''}`} />
              </button>
              {expanded.companyName && (
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 text-slate-400" />
                  <input type="text" placeholder="Search companies..." className="input pl-11 w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              )}
            </div>

            {/* Other filters – 2 per row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <button onClick={() => toggleFilter('businessType')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Business Type
                  <ChevronDown className={`transition ${expanded.businessType ? 'rotate-180' : ''}`} />
                </button>
                {expanded.businessType && (
                  <div className="space-y-3">
                    {businessTypeOptions.map(type => (
                      <label key={type} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('businessTypes', type)} />
                        {type}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => toggleFilter('region')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Region
                  <ChevronDown className={`transition ${expanded.region ? 'rotate-180' : ''}`} />
                </button>
                {expanded.region && (
                  <div className="space-y-3">
                    {regionOptions.map(r => (
                      <label key={r} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('regions', r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => toggleFilter('industry')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Industry
                  <ChevronDown className={`transition ${expanded.industry ? 'rotate-180' : ''}`} />
                </button>
                {expanded.industry && (
                  <div className="space-y-3">
                    {industryOptions.map(i => (
                      <label key={i} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('industries', i)} />
                        {i}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => toggleFilter('verificationMethod')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Verification Method
                  <ChevronDown className={`transition ${expanded.verificationMethod ? 'rotate-180' : ''}`} />
                </button>
                {expanded.verificationMethod && (
                  <div className="space-y-3">
                    {verificationMethodOptions.map(m => (
                      <label key={m} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('verificationMethods', m)} />
                        {m}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => toggleFilter('verificationStatus')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Verification Status
                  <ChevronDown className={`transition ${expanded.verificationStatus ? 'rotate-180' : ''}`} />
                </button>
                {expanded.verificationStatus && (
                  <div className="space-y-3">
                    {verificationStatusOptions.map(s => (
                      <label key={s} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('verificationStatus', s)} />
                        {s}
                      </label>
                    ))}
                  </div>
                )}
              </div>

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
          </div>
        </div>

        {/* RIGHT COLUMN – TWO SEPARATE CARDS */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="card p-8">
            <h3 className="text-3xl font-bold mb-6">Invite New Business</h3>
            <p className="text-slate-600 mb-6">Send a personalised invitation to join the verified SupplierAdvisor network.</p>

            <input 
              type="email" 
              placeholder="Business email address" 
              className="input mb-6"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Invitation Message</label>
              <textarea rows={5} className="input w-full resize-y" value={inviteNote} onChange={e => setInviteNote(e.target.value)} />
            </div>

            <button onClick={sendInvitation} className="btn-primary w-full py-5 flex items-center justify-center gap-3">
              <Plus size={22} /> Send Invitation
            </button>
          </div>

          <div className="card p-8">
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
      </div>

      {/* RESULTS */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-6">Results ({filteredSuppliers.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(s => (
            <div key={s.id} className="card p-8 hover:shadow-xl transition-all">
              <div className="text-2xl font-bold mb-1">{s.legal_name}</div>
              <div className="text-slate-500 mb-6">{s.trading_name}</div>
              
              <div className="flex items-center gap-2 text-amber-500 mb-8">
                ⭐ 4.8 • 17 reviews
              </div>

              <button 
                onClick={() => sendConnectionRequest(s.id, s.legal_name)}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2"
              >
                <UserPlus size={20} /> Send Connection Request
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}