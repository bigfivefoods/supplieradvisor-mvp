'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Check, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConnectPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [approvedConnections, setApprovedConnections] = useState<any[]>([]);

  // Load all verified businesses
  useEffect(() => {
    const loadBusinesses = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .not('verified_at', 'is', null);
      setBusinesses(data || []);
    };
    loadBusinesses();
  }, []);

  // Load my connections
  useEffect(() => {
    const loadConnections = async () => {
      const { data: pending } = await supabase
        .from('business_connections')
        .select('*, requestee:profiles!requestee_id(*)')
        .eq('status', 'pending');

      const { data: approved } = await supabase
        .from('business_connections')
        .select('*, requestee:profiles!requestee_id(*)')
        .eq('status', 'approved');

      setPendingRequests(pending || []);
      setApprovedConnections(approved || []);
    };
    loadConnections();
  }, []);

  const sendConnectionRequest = async (targetProfileId: number, targetName: string) => {
    const { error } = await supabase.from('business_connections').insert({
      requester_id: 1, // TODO: Replace with real current user profile ID later
      requestee_id: targetProfileId,
      message: `Would love to connect and start transacting with ${targetName}`,
      status: 'pending'
    });

    if (!error) {
      toast.success(`Connection request sent to ${targetName}`);
    } else {
      toast.error('Failed to send request');
    }
  };

  const filteredBusinesses = businesses.filter(b =>
    b.legal_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12">
      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Connect with Businesses</h1>
      <p className="text-2xl text-slate-600">Only approved connections can raise POs, send invoices, or ship goods</p>

      {/* Search Bar */}
      <div className="card p-8">
        <input
          type="text"
          placeholder="Search by company name..."
          className="input"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Search Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredBusinesses.map(b => (
          <div key={b.id} className="card p-8 flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold">{b.legal_name}</div>
              <div className="text-slate-500">{b.trading_name || '—'}</div>
            </div>
            <button 
              onClick={() => sendConnectionRequest(b.id, b.legal_name)}
              className="btn-primary px-8 py-4 flex items-center gap-2"
            >
              <Plus size={20} /> Send Request
            </button>
          </div>
        ))}
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="card p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Users /> Pending Requests</h2>
          {pendingRequests.map(req => (
            <div key={req.id} className="flex justify-between py-4 border-b last:border-0">
              <div>{req.requestee?.legal_name}</div>
              <div className="text-amber-600 font-medium">Awaiting approval</div>
            </div>
          ))}
        </div>
      )}

      {/* Approved Connections */}
      {approvedConnections.length > 0 && (
        <div className="card p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Check className="text-emerald-600" /> Approved Connections</h2>
          {approvedConnections.map(conn => (
            <div key={conn.id} className="flex justify-between py-4 border-b last:border-0 text-emerald-700">
              <div>{conn.requestee?.legal_name}</div>
              <div>✓ Can now transact (POs, Invoices, Shipments)</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}