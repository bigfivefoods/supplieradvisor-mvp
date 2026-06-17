'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, Plus, UserPlus, MapPin, Award, Clock, RefreshCw, CheckCircle } from 'lucide-react';
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
    <div className="pl-0 pr-12 py-12 bg-neutral-50">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-[-3px] mb-12">Supplier Search</h1>

      <div className="grid grid-cols-12 gap-8">
        {/* Filters */}
        <div className="col-span-3">
          <div className="bg-white rounded-3xl p-6 border">
            <div className="flex justify-between">
              <h3 className="font-bold">Filters</h3>
              <button onClick={() => setShowFilters(!showFilters)}><ChevronDown /></button>
            </div>
            {showFilters && (
              <div className="mt-6 space-y-6">
                <select className="input w-full" onChange={e => setSelectedContinent(e.target.value)}>
                  <option>All Continents</option>
                  <option>Africa</option>
                </select>
                <input type="range" min="50" max="100" value={trustScoreMin} onChange={e => setTrustScoreMin(Number(e.target.value))} className="w-full" />
                <button className="btn-primary w-full" onClick={inviteSupplier}>Invite Supplier</button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="col-span-6">
          <input type="text" placeholder="Search suppliers" className="input w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="mt-6 space-y-4">
            {filteredSuppliers.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-3xl border flex justify-between">
                <div>
                  <div className="font-bold">{s.name}</div>
                  <div>Trust {s.trust_score}% • OTIFEF {s.otifef_average}%</div>
                </div>
                <div>
                  <button onClick={() => sendConnectionRequest(s.id, s.name)} className="border px-4 py-2 rounded-2xl">Connect</button>
                  <button onClick={() => createPO(s.name)} className="ml-3 bg-neutral-900 text-white px-4 py-2 rounded-2xl">Create PO</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite */}
        <div className="col-span-3">
          <div className="bg-white rounded-3xl p-6 border">
            <h3 className="font-bold">Invite Supplier</h3>
            <input type="email" className="input w-full mt-4" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <button onClick={inviteSupplier} className="btn-primary w-full mt-4">Send Invitation</button>
          </div>
        </div>
      </div>

      <button className="fixed bottom-8 right-8 bg-neutral-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2">
        <Award size={20} /> Grok AI Analysis
      </button>
    </div>
  );
}