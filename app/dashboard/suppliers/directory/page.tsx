'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useReadContract } from 'wagmi';
import { SupplierRegistryABI } from '@/lib/contracts/SupplierRegistryABI';
import { Search, Plus, Users, RefreshCw, ArrowRight } from 'lucide-react';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SUPPLIER_REGISTRY_ADDRESS as `0x${string}`;

interface Supplier {
  id: string;
  trading_name: string;
  email: string;
  contact_name: string | null;
  category: string | null;
  supplier_status: string;
  invited_at: string | null;
  claimed_at: string | null;
  created_at: string;
  wallet_address?: string;
}

export default function SupplierDirectory() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'invited'>('all');

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, trading_name, email, contact_name, category, supplier_status, invited_at, claimed_at, created_at, wallet_address')
      .eq('relationship_type', 'supplier')
      .order('trading_name', { ascending: true });

    if (error) {
      console.error('Error loading suppliers:', error);
    } else {
      setSuppliers(data as Supplier[]);
      setFilteredSuppliers(data as Supplier[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Search + Filter
  useEffect(() => {
    let result = [...suppliers];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.trading_name.toLowerCase().includes(term) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(term)) ||
        s.email.toLowerCase().includes(term) ||
        (s.category && s.category.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(s => s.supplier_status === statusFilter);
    }

    setFilteredSuppliers(result);
  }, [searchTerm, statusFilter, suppliers]);

  return (
    <div className="px-8 py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <p className="text-sm text-neutral-500 mb-1">Supply Chain</p>
          <h1 className="font-black text-6xl tracking-[-3px]">Supplier Directory</h1>
          <p className="text-xl text-neutral-600 mt-2">All suppliers in your ecosystem</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchSuppliers}
            className="flex items-center gap-2 px-6 py-3 border border-neutral-300 rounded-2xl hover:bg-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link 
            href="/dashboard/suppliers/add" 
            className="btn-primary px-8 py-3 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-4 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, contact, email or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-neutral-200 rounded-3xl text-lg focus:outline-none focus:border-[#00b4d8] transition-colors"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'active', 'invited'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-8 py-4 rounded-3xl font-medium transition-all border text-sm ${
                statusFilter === status 
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]' 
                  : 'bg-white border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {status === 'all' ? 'All Suppliers' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 px-1 text-sm text-neutral-500">
        Showing <span className="font-semibold text-neutral-900">{filteredSuppliers.length}</span> of {suppliers.length} suppliers
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00b4d8] mx-auto mb-4"></div>
            <p className="text-neutral-500">Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-14 h-14 mx-auto text-neutral-300 mb-4" />
            <h3 className="text-2xl font-semibold tracking-tight mb-2">No suppliers found</h3>
            <p className="text-neutral-600 mb-8">Try adjusting your search or filters.</p>
            <Link href="/dashboard/suppliers/add" className="btn-primary px-8 py-3 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add your first supplier
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b">
                <tr>
                  <th className="text-left px-8 py-5 text-sm font-semibold text-neutral-600">Supplier</th>
                  <th className="text-left px-6 py-5 text-sm font-semibold text-neutral-600">Contact</th>
                  <th className="text-left px-6 py-5 text-sm font-semibold text-neutral-600">Category</th>
                  <th className="text-left px-6 py-5 text-sm font-semibold text-neutral-600">Status</th>
                  <th className="text-left px-6 py-5 text-sm font-semibold text-neutral-600">Onboarded</th>
                  <th className="text-right px-8 py-5 text-sm font-semibold text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSuppliers.map((supplier) => (
                  <SupplierRow key={supplier.id} supplier={supplier} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Row component with onchain check
function SupplierRow({ supplier }: { supplier: Supplier }) {
  const { data: isVerified, isLoading: checkingOnchain } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SupplierRegistryABI,
    functionName: 'isVerified',
    args: supplier.wallet_address ? [supplier.wallet_address as `0x${string}`] : undefined,
    query: { enabled: !!supplier.wallet_address },
  });

  return (
    <tr className="hover:bg-neutral-50 transition-colors group">
      <td className="px-8 py-6">
        <div className="font-semibold text-xl tracking-tight group-hover:text-[#00b4d8] transition-colors">
          {supplier.trading_name}
        </div>
      </td>

      <td className="px-6 py-6">
        <div className="font-medium">{supplier.contact_name || '—'}</div>
        <div className="text-sm text-neutral-500">{supplier.email}</div>
      </td>

      <td className="px-6 py-6 text-neutral-600">
        {supplier.category || '—'}
      </td>

      <td className="px-6 py-6">
        <span className={`inline-block px-5 py-1.5 rounded-full text-sm font-medium ${
          supplier.supplier_status === 'active' 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-amber-100 text-amber-700'
        }`}>
          {supplier.supplier_status === 'active' ? 'Active' : 'Invited'}
        </span>
      </td>

      <td className="px-6 py-6 text-sm text-neutral-500">
        {supplier.claimed_at 
          ? new Date(supplier.claimed_at).toLocaleDateString('en-GB')
          : new Date(supplier.invited_at || supplier.created_at).toLocaleDateString('en-GB')
        }
      </td>

      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end gap-4">
          <Link 
            href={`/dashboard/suppliers/profiles?id=${supplier.id}`} 
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00b4d8] hover:underline"
          >
            View <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}