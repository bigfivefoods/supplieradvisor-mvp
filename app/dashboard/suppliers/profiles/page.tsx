'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Edit2, MessageCircle, FileText, Calendar, 
  Users, Plus, ExternalLink, Clock, CheckCircle, AlertCircle, 
  ArrowUpDown 
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SupplierProfile {
  id: number;
  public_id: string;
  trading_name: string;
  legal_name: string | null;
  email: string;
  contact_name: string | null;
  contact_phone: string | null;
  category: string | null;
  website: string | null;
  supplier_status: string;
  invited_at: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string | null;
  invited_by: string | null;
}

type SortOption = 'name' | 'category' | 'onboarded' | 'status';

function SupplierProfileContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');

  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  // Fetch all active suppliers
  const fetchActiveSuppliers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('relationship_type', 'supplier')
      .eq('supplier_status', 'active')
      .order('trading_name', { ascending: true });

    if (!error && data) setSuppliers(data as SupplierProfile[]);
    setLoading(false);
  };

  // Fetch single supplier detail
  const fetchSupplier = async (publicId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('public_id', publicId)
      .single();

    if (!error && data) setSupplier(data as SupplierProfile);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedId) {
      fetchSupplier(selectedId);
    } else {
      fetchActiveSuppliers();
    }
  }, [selectedId]);

  // Client-side sorting + filtering
  const getSortedAndFilteredSuppliers = () => {
    let result = [...suppliers];

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.trading_name.toLowerCase().includes(term) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(term)) ||
        (s.category && s.category.toLowerCase().includes(term))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.trading_name.localeCompare(b.trading_name);
      }
      if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      if (sortBy === 'onboarded') {
        const dateA = a.claimed_at || a.created_at;
        const dateB = b.claimed_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
      if (sortBy === 'status') {
        return a.supplier_status.localeCompare(b.supplier_status);
      }
      return 0;
    });

    return result;
  };

  const filteredSuppliers = getSortedAndFilteredSuppliers();

  // ==================== LIST VIEW (Cards) ====================
  if (!selectedId) {
    return (
      <div className="px-8 py-12 max-w-screen-2xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-sm text-neutral-500 mb-1">SUPPLIERS</p>
            <h1 className="font-black text-6xl tracking-[-3.5px]">Active Suppliers</h1>
          </div>
          <Link href="/dashboard/suppliers/add" className="btn-primary px-8 py-3 flex items-center gap-2 w-fit">
            <Plus className="w-4 h-4" /> Add Supplier
          </Link>
        </div>

        {/* Search + Sort Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-6 py-4 bg-white border border-neutral-200 rounded-3xl text-lg focus:outline-none focus:border-[#00b4d8]"
          />
          
          <div className="flex items-center gap-2 px-5 bg-white border border-neutral-200 rounded-3xl">
            <ArrowUpDown className="w-4 h-4 text-neutral-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent py-4 pr-8 text-sm font-medium focus:outline-none"
            >
              <option value="name">Sort by Name</option>
              <option value="category">Sort by Category</option>
              <option value="onboarded">Sort by Onboarded Date</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">Loading suppliers...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-20">No suppliers found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSuppliers.map((s) => (
              <Link 
                key={s.public_id} 
                href={`/dashboard/suppliers/profiles?id=${s.public_id}`}
                className="group bg-white border border-neutral-200 rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-2xl tracking-tight group-hover:text-[#00b4d8] transition-colors pr-4">
                      {s.trading_name}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${s.supplier_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.supplier_status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="text-neutral-600">{s.contact_name || 'No contact name'}</div>
                    <div className="text-neutral-500">{s.email}</div>
                    {s.category && <div className="text-neutral-600">Category: {s.category}</div>}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t text-xs text-neutral-500 flex justify-between">
                  <span>Onboarded</span>
                  <span>{s.claimed_at ? new Date(s.claimed_at).toLocaleDateString('en-GB') : 'Pending'}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== DETAIL VIEW ====================
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!supplier) return <div className="min-h-screen flex items-center justify-center">Supplier not found</div>;

  const isActive = supplier.supplier_status === 'active';

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-screen-2xl mx-auto px-8 py-12">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-5">
            <Link href="/dashboard/suppliers/profiles" className="p-3 hover:bg-white rounded-2xl border">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-6xl font-black tracking-[-3.5px]">{supplier.trading_name}</h1>
                <span className={`px-5 py-1.5 rounded-full text-sm font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isActive ? 'Active' : 'Invited'}
                </span>
              </div>
              {supplier.legal_name && <p className="text-2xl text-neutral-500 tracking-tight mt-1">{supplier.legal_name}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="flex items-center gap-2 px-6 py-3 border border-neutral-300 rounded-2xl hover:bg-white">
              <MessageCircle className="w-4 h-4" /> Message
            </button>
            <Link href={`/dashboard/suppliers/po?supplier=${supplier.public_id}`} className="flex items-center gap-2 px-6 py-3 bg-[#00b4d8] text-white rounded-2xl hover:bg-[#0099b8]">
              <Plus className="w-4 h-4" /> Raise PO
            </Link>
            <button className="flex items-center gap-2 px-6 py-3 border border-neutral-300 rounded-2xl hover:bg-white">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          </div>
        </div>

        {/* Comprehensive Detail Sections */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Info */}
          <div className="xl:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl border p-6">
                <div className="text-sm text-neutral-500 mb-1">Category</div>
                <div className="text-2xl font-semibold tracking-tight">{supplier.category || '—'}</div>
              </div>
              <div className="bg-white rounded-3xl border p-6">
                <div className="text-sm text-neutral-500 mb-1">Website</div>
                {supplier.website ? (
                  <a href={supplier.website} target="_blank" className="text-[#00b4d8] flex items-center gap-2 hover:underline">
                    Visit Website <ExternalLink className="w-4 h-4" />
                  </a>
                ) : '—'}
              </div>
              <div className="bg-white rounded-3xl border p-6">
                <div className="text-sm text-neutral-500 mb-1">Relationship Started</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {supplier.claimed_at ? new Date(supplier.claimed_at).toLocaleDateString('en-GB') : 'Pending'}
                </div>
              </div>
            </div>

            {/* Full Contact Info */}
            <div className="bg-white rounded-3xl border p-8">
              <h3 className="font-bold text-2xl tracking-tight mb-6">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-lg">
                <div><span className="text-neutral-500 text-sm block">Primary Contact</span>{supplier.contact_name || '—'}</div>
                <div><span className="text-neutral-500 text-sm block">Email</span><a href={`mailto:${supplier.email}`} className="text-[#00b4d8] hover:underline">{supplier.email}</a></div>
                <div><span className="text-neutral-500 text-sm block">Phone</span>{supplier.contact_phone || '—'}</div>
                <div><span className="text-neutral-500 text-sm block">Invited By</span>{supplier.invited_by || '—'}</div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border p-8">
              <h4 className="font-bold text-xl tracking-tight mb-6">Actions</h4>
              <div className="space-y-3">
                <button className="w-full py-4 border rounded-2xl hover:bg-neutral-50 flex items-center justify-center gap-2 text-lg">Send Message</button>
                <Link href={`/dashboard/suppliers/po?supplier=${supplier.public_id}`} className="w-full py-4 bg-[#00b4d8] text-white rounded-2xl flex items-center justify-center gap-2 text-lg">Create Purchase Order</Link>
                <button className="w-full py-4 border rounded-2xl hover:bg-neutral-50 flex items-center justify-center gap-2 text-lg">View Documents</button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border p-8 text-sm">
              <div className="text-neutral-500 mb-4 font-medium">SYSTEM METADATA</div>
              <div className="space-y-3 text-neutral-600">
                <div className="flex justify-between"><span>Public ID</span> <span className="font-mono text-xs">{supplier.public_id}</span></div>
                <div className="flex justify-between"><span>Internal ID</span> <span>{supplier.id}</span></div>
                <div className="flex justify-between"><span>Status</span> <span className="capitalize">{supplier.supplier_status}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SupplierProfileContent />
    </Suspense>
  );
}