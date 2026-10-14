'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

import { Plus, RefreshCw, ArrowRight } from 'lucide-react';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { SrmEmpty, SrmSearch, SrmSkeleton, srmFocus } from '@/components/suppliers/srm/SrmDesk';

interface Supplier {
  id: number;
  public_id: string;
  trading_name: string;
  email: string;
  contact_name: string | null;
  category: string | null;
  supplier_status: string;
  invited_at: string | null;
  claimed_at: string | null;
  created_at: string;
  wallet_ready?: boolean;
}

export default function SupplierDirectory() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'invited'>('all');

  const fetchSuppliers = async () => {
    setLoading(true);
    const res = await fetch('/api/suppliers/directory');
    const json = await res.json();
    if (!res.ok) {
      console.error('Error loading suppliers:', json.error);
    } else {
      setSuppliers((json.suppliers || []) as Supplier[]);
      setFilteredSuppliers((json.suppliers || []) as Supplier[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchSuppliers();
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
    <CompanyRequired>
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="Supplier"
        titleAccent="directory"
        description="Everyone already on your ecosystem, including invited companies that have not claimed yet."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchSuppliers}
              className={`${srmFocus} btn-secondary !px-4 !py-2.5 text-sm`}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <Link href="/dashboard/suppliers/add" className={`${srmFocus} btn-primary !px-5 !py-2.5 text-sm`}>
              <Plus className="h-4 w-4" /> Add supplier
            </Link>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SrmSearch
          value={searchTerm}
          onChange={setSearchTerm}
          label="Search directory"
          placeholder="Search by name, contact, email or category"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Directory status">
          {(['all', 'active', 'invited'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`${srmFocus} rounded-full border px-3 py-2 text-sm font-semibold ${
                statusFilter === status
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950'
                  : 'border-neutral-200 bg-white text-slate-700'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
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
          <SrmSkeleton variant="table" rows={5} />
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-4">
            <SrmEmpty
              title="No suppliers found"
              description="Try another search, or add a supplier who is not in the directory yet."
              actionHref="/dashboard/suppliers/add"
              actionLabel="Add a supplier"
            />
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
                  <SupplierRow key={supplier.public_id} supplier={supplier} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </SuppliersPage>
    </CompanyRequired>
  );
}

// Row component with onchain check
function SupplierRow({ supplier }: { supplier: Supplier }) {
  // Safe date formatter
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return '—';
    }
  };

  return (
    <tr className="hover:bg-neutral-50 transition-colors group">
      <td className="px-8 py-6">
        <div className="font-semibold text-xl tracking-tight group-hover:text-[#00b4d8] transition-colors">
          {supplier.trading_name}
        </div>
        {supplier.wallet_ready ? (
          <div className="mt-1 text-xs font-semibold text-[#0077b6]">Wallet ready</div>
        ) : null}
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
        {formatDate(supplier.claimed_at || supplier.invited_at || supplier.created_at)}
      </td>

      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end gap-4">
          <Link 
            href={`/dashboard/suppliers/profiles?id=${supplier.public_id}`} 
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00b4d8] hover:underline"
          >
            View <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}