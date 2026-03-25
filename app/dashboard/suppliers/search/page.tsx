'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Star, ShieldCheck, Plus } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';   // ← Correct @/ alias
import toast from 'react-hot-toast';

export default function SuppliersSearch() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadSuppliers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .not('verified_at', 'is', null);
      setSuppliers(data || []);
    };
    loadSuppliers();
  }, []);

  const filtered = suppliers.filter(s => 
    s.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.trading_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sendConnectionRequest = async (id: number, name: string) => {
    const { error } = await supabase.from('business_connections').insert({
      requester_id: 1, // TODO: replace with real user ID later
      requestee_id: id,
      status: 'pending'
    });
    if (!error) toast.success(`Request sent to ${name}`);
  };

  return (
    <div className="pl-[25px]">
      <Breadcrumb />

      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Search Suppliers</h1>
      <p className="text-2xl text-slate-600 mb-12">Verified suppliers • Deep search • Instant connect</p>

      <div className="card p-8 mb-12">
        <div className="relative mb-6">
          <Search className="absolute left-6 top-5 text-slate-400" size={24} />
          <input
            type="text"
            placeholder="Search by name, industry or region..."
            className="input pl-16 text-lg"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map(s => (
          <div key={s.id} className="card p-8 hover:shadow-xl transition-all">
            <div className="flex justify-between">
              <div>
                <div className="text-2xl font-bold">{s.legal_name}</div>
                <div className="text-slate-500">{s.trading_name}</div>
              </div>
              <div className="flex items-center gap-1 text-emerald-600">
                <ShieldCheck size={24} />
                <span>Verified</span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-amber-500">
              <Star className="fill-current" /> 4.8 • 17 reviews
            </div>

            <div className="mt-8 flex justify-between">
              <button 
                onClick={() => sendConnectionRequest(s.id, s.legal_name)}
                className="btn-primary px-8 py-4 flex items-center gap-2"
              >
                <Plus size={20} /> Connect
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}