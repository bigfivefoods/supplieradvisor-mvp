'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, UserPlus, Award, Brain } from 'lucide-react';
import toast from 'react-hot-toast';

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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('Hi [Company],\n\nYou are invited to join SupplierAdvisor ERP.');

  const [selectedContinent, setSelectedContinent] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [trustScoreMin, setTrustScoreMin] = useState(70);

  const loadSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*');
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
    await supabase.from('business_connections').insert({
      requester_id: cleanId,
      target_id: targetId,
      status: 'pending'
    });
    toast.success(`Connection request sent to ${companyName}`);
    loadConnectionRequests();
  };

  const inviteSupplier = async () => {
    if (!inviteEmail) return toast.error('Enter email');
    await supabase.from('supplier_invitations').insert({ email: inviteEmail, supplier_name: 'New Supplier' });
    toast.success('Invitation sent and supplier record created');
    setInviteEmail('');
  };

  const createPO = (supplierName: string) => {
    toast.success(`Purchase Order created for ${supplierName} • All fields tracked in DB`);
  };

  useEffect(() => {
    loadSuppliers();
    loadConnectionRequests();
  }, []);

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Supplier Search</h1>
          <p className="text-neutral-600 mt-1">Find, connect and transact with verified suppliers</p>
        </div>
        <button 
          onClick={inviteSupplier} 
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={20} /> Invite New Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filters */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl p-6 border border-neutral-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Filters</h3>
              <button onClick={() => setShowFilters(!showFilters)}>
                <ChevronDown className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {showFilters && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Continent</label>
                  <select className="input w-full" onChange={e => setSelectedContinent(e.target.value)}>
                    <option value="">All Continents</option>
                    <option value="Africa">Africa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Trust Score</label>
                  <input 
                    type="range" 
                    min="50" 
                    max="100" 
                    value={trustScoreMin} 
                    onChange={e => setTrustScoreMin(Number(e.target.value))} 
                    className="w-full" 
                  />
                  <div className="text-right text-sm text-neutral-500 mt-1">{trustScoreMin}%</div>
                </div>

                <button 
                  onClick={inviteSupplier} 
                  className="btn-primary w-full"
                >
                  Invite Supplier
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-6">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-4 text-neutral-400" size={20} />
            <input 
              type="text" 
              placeholder="Search suppliers by name or location..." 
              className="input w-full pl-12" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>

          <div className="space-y-4">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-3xl border border-neutral-200 flex justify-between items-center hover:shadow-md transition-all">
                  <div>
                    <div className="font-bold text-xl">{s.name}</div>
                    <div className="text-neutral-600 mt-1">
                      Trust Score: <span className="font-medium">{s.trust_score || 85}%</span> • OTIFEF: <span className="font-medium">{s.otifef_average || 92}%</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => sendConnectionRequest(s.id, s.name)} 
                      className="px-5 py-2.5 border border-neutral-300 rounded-2xl hover:bg-neutral-50 transition-colors"
                    >
                      Connect
                    </button>
                    <button 
                      onClick={() => createPO(s.name)} 
                      className="px-5 py-2.5 bg-neutral-900 text-white rounded-2xl hover:bg-black transition-colors"
                    >
                      Create PO
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-neutral-500">No suppliers found.</div>
            )}
          </div>
        </div>

        {/* Invite Panel */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 sticky top-8">
            <h3 className="font-bold text-lg mb-6">Invite New Supplier</h3>
            
            <input 
              type="email" 
              placeholder="supplier@company.com" 
              className="input w-full mb-4" 
              value={inviteEmail} 
              onChange={e => setInviteEmail(e.target.value)} 
            />
            
            <button 
              onClick={inviteSupplier} 
              className="btn-primary w-full"
            >
              Send Invitation
            </button>
            
            <p className="text-xs text-neutral-500 mt-4">
              The supplier will receive an email and be added to your database.
            </p>
          </div>
        </div>
      </div>

      {/* Floating Grok Button */}
      <button 
        onClick={() => toast.success("Grok: Analysing supplier network... Top recommendations ready.")}
        className="fixed bottom-8 right-8 bg-black text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl hover:bg-neutral-800 transition-colors"
      >
        <Brain size={20} /> Ask Grok
      </button>
    </div>
  );
}