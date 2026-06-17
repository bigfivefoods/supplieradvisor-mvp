'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, UserPlus, MapPin, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

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
  const [inviteEmail, setInviteEmail] = useState('');

  const [selectedContinent, setSelectedContinent] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [trustScoreMin, setTrustScoreMin] = useState(70);

  // ==================== LOAD SUPPLIERS ====================
  const loadSuppliers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('relationship_type', 'supplier')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading suppliers:', error);
      toast.error('Failed to load suppliers');
    } else {
      setSuppliers(data || []);
      setFilteredSuppliers(data || []);
    }
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

  // ==================== CONNECTION REQUEST ====================
  const sendConnectionRequest = async (targetId: string, companyName: string) => {
    await supabase.from('business_connections').insert({
      requester_id: cleanId,
      target_id: targetId,
      status: 'pending'
    });
    toast.success(`Connection request sent to ${companyName}`);
    loadConnectionRequests();
  };

  // ==================== INVITE SUPPLIER (via Resend API) ====================
  const inviteSupplier = async () => {
    if (!inviteEmail) return toast.error('Please enter an email address');

    try {
      const response = await fetch('/api/invite-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          invitedBy: 'Admin',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      toast.success('Invitation sent successfully!');
      setInviteEmail('');
      loadSuppliers(); // Refresh supplier list
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong while sending the invitation');
    }
  };

  const createPO = (supplierName: string) => {
    toast.success(`Purchase Order created for ${supplierName}`);
    // TODO: Navigate to PO creation with prefilled supplier
  };

  // ==================== CLIENT-SIDE SEARCH ====================
  useEffect(() => {
    if (!searchTerm) {
      setFilteredSuppliers(suppliers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = suppliers.filter(s =>
      (s.legal_name?.toLowerCase().includes(term)) ||
      (s.trading_name?.toLowerCase().includes(term)) ||
      (s.city?.toLowerCase().includes(term)) ||
      (s.country?.toLowerCase().includes(term))
    );
    setFilteredSuppliers(filtered);
  }, [searchTerm, suppliers]);

  useEffect(() => {
    loadSuppliers();
    loadConnectionRequests();
  }, []);

  return (
    <div className="pl-0 pr-12 py-12 bg-neutral-50">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-[-3px] mb-12">Supplier Search</h1>

      <div className="grid grid-cols-12 gap-8">
        {/* Filters Sidebar */}
        <div className="col-span-3">
          <div className="bg-white rounded-3xl p-6 border">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Filters</h3>
              <button onClick={() => setShowFilters(!showFilters)}>
                <ChevronDown className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showFilters && (
              <div className="mt-6 space-y-6">
                <div>
                  <label className="text-sm font-medium">Continent</label>
                  <select 
                    className="input w-full mt-1" 
                    value={selectedContinent} 
                    onChange={e => setSelectedContinent(e.target.value)}
                  >
                    <option value="">All Continents</option>
                    <option value="Africa">Africa</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Minimum Trust Score: {trustScoreMin}</label>
                  <input 
                    type="range" 
                    min="50" 
                    max="100" 
                    value={trustScoreMin} 
                    onChange={e => setTrustScoreMin(Number(e.target.value))} 
                    className="w-full mt-2" 
                  />
                </div>

                <button 
                  onClick={inviteSupplier} 
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <UserPlus size={18} /> Invite Supplier
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="col-span-6">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search suppliers by name, city or country..." 
              className="input w-full pl-12" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
            <Search className="absolute left-4 top-4 text-neutral-400" size={20} />
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="text-center py-12 text-neutral-500">Loading suppliers...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">No suppliers found.</div>
            ) : (
              filteredSuppliers.map((s) => (
                <div key={s.id} className="bg-white p-6 rounded-3xl border flex justify-between items-center hover:shadow-md transition-all">
                  <div>
                    <div className="font-bold text-lg">{s.legal_name || s.trading_name}</div>
                    <div className="text-sm text-neutral-600 flex items-center gap-2 mt-1">
                      <MapPin size={14} />
                      {s.city ? `${s.city}, ` : ''}{s.country || 'Location not set'}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      BEE: {s.bee_level || 'Not specified'} • Status: {s.supplier_status || 'pending'}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => sendConnectionRequest(s.id, s.legal_name || s.trading_name)} 
                      className="border px-5 py-2 rounded-2xl hover:bg-neutral-50 text-sm font-medium"
                    >
                      Connect
                    </button>
                    <button 
                      onClick={() => createPO(s.legal_name || s.trading_name)} 
                      className="bg-neutral-900 hover:bg-black text-white px-5 py-2 rounded-2xl text-sm font-medium"
                    >
                      Create PO
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invite Panel */}
        <div className="col-span-3">
          <div className="bg-white rounded-3xl p-6 border sticky top-8">
            <h3 className="font-bold text-lg mb-4">Invite New Supplier</h3>
            <p className="text-sm text-neutral-600 mb-4">
              Send an invitation. A pending supplier record will be created and an email will be sent.
            </p>
            
            <input 
              type="email" 
              className="input w-full" 
              placeholder="supplier@company.com" 
              value={inviteEmail} 
              onChange={e => setInviteEmail(e.target.value)} 
            />
            
            <button 
              onClick={inviteSupplier} 
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <UserPlus size={18} /> Send Invitation
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action */}
      <button className="fixed bottom-8 right-8 bg-neutral-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg hover:bg-black">
        <Award size={20} /> Grok AI Analysis
      </button>
    </div>
  );
}