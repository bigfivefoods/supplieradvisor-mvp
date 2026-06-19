'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Search, Plus, Filter, ArrowRight, Users 
} from 'lucide-react';

interface Supplier {
  id: number;
  trading_name: string;
  legal_name?: string;
  category?: string;
  status: string;
  risk_level?: string;
  last_order_date?: string;
  created_at: string;
}

export default function SupplierDirectory() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => {
    const loadSuppliers = async () => {
      // TODO: Replace 'profiles' with your actual 'suppliers' table when ready
      const { data, error } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, category, status, risk_level, last_order_date, created_at')
        .order('created_at', { ascending: false });

      if (data) {
        setSuppliers(data as Supplier[]);
        setFilteredSuppliers(data as Supplier[]);
      }
      setLoading(false);
    };

    loadSuppliers();
  }, []);

  // Filter + Search Logic
  useEffect(() => {
    let result = [...suppliers];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.trading_name.toLowerCase().includes(term) ||
        (s.legal_name && s.legal_name.toLowerCase().includes(term))
      );
    }

    // Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }

    // Risk Filter
    if (riskFilter !== 'all') {
      result = result.filter(s => s.risk_level === riskFilter);
    }

    setFilteredSuppliers(result);
  }, [searchTerm, statusFilter, riskFilter, suppliers]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'inactive': return 'bg-neutral-100 text-neutral-600';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'low': return 'bg-emerald-100 text-emerald-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'high': return 'bg-red-100 text-red-700';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-neutral-500">Suppliers</p>
          <h1 className="font-black text-5xl tracking-[-2.5px]">Directory</h1>
        </div>
        <Link 
          href="/dashboard/suppliers/add" 
          className="btn-primary px-6 py-3 flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" /> Add New Supplier
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search suppliers by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:border-[#00b4d8]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>

            <select 
              value={riskFilter} 
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:border-[#00b4d8]"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-sm text-neutral-600">
          Showing <span className="font-semibold">{filteredSuppliers.length}</span> suppliers
        </p>
        <Link href="/dashboard/suppliers" className="text-sm text-[#00b4d8] hover:underline flex items-center gap-1">
          Back to Suppliers Hub <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Supplier Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Loading suppliers...</div>
        ) : filteredSuppliers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left px-8 py-4 text-sm font-semibold text-neutral-600">Supplier</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-600">Category</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-600">Risk Level</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-600">Last Order</th>
                  <th className="text-right px-8 py-4 text-sm font-semibold text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-8 py-5">
                      <div>
                        <div className="font-semibold text-lg tracking-tight">{supplier.trading_name}</div>
                        {supplier.legal_name && (
                          <div className="text-sm text-neutral-500">{supplier.legal_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-neutral-600">
                      {supplier.category || '—'}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-block px-4 py-1 text-xs font-medium rounded-full ${getStatusColor(supplier.status)}`}>
                        {supplier.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-block px-4 py-1 text-xs font-medium rounded-full ${getRiskColor(supplier.risk_level)}`}>
                        {supplier.risk_level || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-neutral-600">
                      {supplier.last_order_date 
                        ? new Date(supplier.last_order_date).toLocaleDateString() 
                        : '—'}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link 
                          href={`/dashboard/suppliers/profiles?id=${supplier.id}`}
                          className="text-sm font-medium text-[#00b4d8] hover:underline"
                        >
                          View Profile
                        </Link>
                        <Link 
                          href={`/dashboard/suppliers/edit?id=${supplier.id}`}
                          className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center">
            <Users className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
            <h3 className="font-semibold text-xl mb-2">No suppliers found</h3>
            <p className="text-neutral-600 mb-6">Try adjusting your search or filters.</p>
            <Link href="/dashboard/suppliers/add" className="btn-primary px-6 py-2 inline-block">
              Add your first supplier
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}