'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Star, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SuppliersSearch() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    verifiedOnly: true,
    expiringSoon: false,
  });

  useEffect(() => {
    const loadSuppliers = async () => {
      let query = supabase.from('profiles').select('*').eq('verified_at', 'is not null');

      if (filters.verifiedOnly) {
        query = query.not('verified_at', 'is', null);
      }

      const { data } = await query;
      setSuppliers(data || []);
    };
    loadSuppliers();
  }, [filters]);

  const filtered = suppliers.filter(s =>
    s.legal_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sendRequest = async (id: number, name: string) => {
    const { error } = await supabase.from('business_connections').insert({
      requester_id: 1, // TODO: replace with real current user ID
      requestee_id: id,
      status: 'pending'
    });
    if (!error) toast.success(`Request sent to ${name}`);
  };

  return (
    <div className="space-y-12">
      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Search Suppliers</h1>
      <p className="text-2xl text-slate-600">Deep search powered by verified metadata, certificates & ratings</p>

      {/* Search + Filters */}
      <div className="card p-8 flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-6 top-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, industry, region..."
              className="input pl-16"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-3 px-6 py-4 border rounded-3xl cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={e => setFilters(p => ({ ...p, verifiedOnly: e.target.checked }))}
            />
            Verified Only
          </label>
          <label className="flex items-center gap-3 px-6 py-4 border rounded-3xl cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={filters.expiringSoon}
              onChange={e => setFilters(p => ({ ...p, expiringSoon: e.target.checked }))}
            />
            Expiring Soon
          </label>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map(supplier => (
          <div key={supplier.id} className="card p-8 hover:shadow-xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-2xl font-bold">{supplier.legal_name}</div>
                <div className="text-slate-500">{supplier.trading_name}</div>
              </div>
              <div className="flex items-center gap-1 text-emerald-600">
                <ShieldCheck size={22} />
                <span className="font-medium">Verified</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-amber-500 text-sm mb-8">
              <Star className="fill-current" /> 4.8 • 17 reviews
            </div>

            <div className="flex justify-between">
              <Link href={`/dashboard/suppliers/${supplier.id}`} className="text-[#00b4d8] font-medium">
                View Full Profile →
              </Link>
              <button
                onClick={() => sendRequest(supplier.id, supplier.legal_name)}
                className="btn-primary px-8 py-3 text-sm"
              >
                Connect
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}