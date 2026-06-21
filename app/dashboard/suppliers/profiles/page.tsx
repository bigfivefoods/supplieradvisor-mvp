'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Edit2, MessageCircle, FileText, 
  Calendar, Clock, CheckCircle, AlertCircle, Users, ArrowRight   // ← Added ArrowRight
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

function SupplierProfilesContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');

  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all active suppliers
  const fetchActiveSuppliers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('relationship_type', 'supplier')
      .eq('supplier_status', 'active')
      .order('trading_name', { ascending: true });

    if (error) {
      setError('Failed to load suppliers');
      console.error(error);
    } else {
      setSuppliers(data as SupplierProfile[]);
    }
    setLoading(false);
  };

  // Fetch single supplier when ID is provided
  const fetchSingleSupplier = async (publicId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('public_id', publicId)
      .single();

    if (error || !data) {
      setError('Supplier not found');
    } else {
      setSelectedSupplier(data as SupplierProfile);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedId) {
      fetchSingleSupplier(selectedId);
    } else {
      fetchActiveSuppliers();
    }
  }, [selectedId]);

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(s =>
    s.trading_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contact_name && s.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ==================== DETAIL VIEW ====================
  if (selectedId) {
    if (loading) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00b4d8]"></div>
        </div>
      );
    }

    if (error || !selectedSupplier) {
      return (
        <div className="min-h-screen bg-[#f8fafc] p-8">
          <div className="max-w-4xl mx-auto text-center py-20">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-6" />
            <h1 className="text-4xl font-black tracking-[-2px] mb-4">Supplier Profile</h1>
            <p className="text-xl text-neutral-600 mb-8">{error}</p>
            <Link href="/dashboard/suppliers/profiles" className="btn-primary px-8 py-3 inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Active Suppliers
            </Link>
          </div>
        </div>
      );
    }

    return <SupplierDetailView supplier={selectedSupplier} />;
  }

  // ==================== LIST VIEW ====================
  return (
    <div className="px-8 py-12 max-w-screen-2xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <p className="text-sm text-neutral-500 mb-1">Suppliers</p>
          <h1 className="font-black text-6xl tracking-[-3px]">Active Suppliers</h1>
          <p className="text-xl text-neutral-600 mt-2">All onboarded and active suppliers</p>
        </div>
        <Link href="/dashboard/suppliers/add" className="btn-primary px-8 py-3 flex items-center gap-2 w-fit">
          Add New Supplier
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search active suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-6 py-4 bg-white border border-neutral-200 rounded-3xl text-lg focus:outline-none focus:border-[#00b4d8]"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00b4d8] mx-auto mb-4"></div>
          <p className="text-neutral-500">Loading suppliers...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="py-20 text-center">
          <Users className="w-14 h-14 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-2xl font-semibold tracking-tight mb-2">No active suppliers found</h3>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-8 py-5 text-sm font-semibold text-neutral-600">Supplier</th>
                <th className="text-left px-6 py-5 text-sm font-semibold text-neutral-600">Contact</th>
                <th className="text-left px-6 py-5 text-sm font-semibold text-neutral-600">Category</th>
                <th className="text-left px-6 py-5 text-sm font-semibold text-neutral-600">Onboarded</th>
                <th className="text-right px-8 py-5 text-sm font-semibold text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.public_id} className="hover:bg-neutral-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="font-semibold text-xl tracking-tight group-hover:text-[#00b4d8] transition-colors">
                      {supplier.trading_name}
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="font-medium">{supplier.contact_name || '—'}</div>
                    <div className="text-sm text-neutral-500">{supplier.email}</div>
                  </td>
                  <td className="px-6 py-6 text-neutral-600">{supplier.category || '—'}</td>
                  <td className="px-6 py-6 text-sm text-neutral-500">
                    {supplier.claimed_at 
                      ? new Date(supplier.claimed_at).toLocaleDateString('en-GB')
                      : new Date(supplier.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <Link 
                      href={`/dashboard/suppliers/profiles?id=${supplier.public_id}`} 
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00b4d8] hover:underline"
                    >
                      View Profile <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Detail view component
function SupplierDetailView({ supplier }: { supplier: SupplierProfile }) {
  const isActive = supplier.supplier_status === 'active';

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/suppliers/profiles" className="p-3 hover:bg-white rounded-2xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-6xl font-black tracking-[-3.5px]">{supplier.trading_name}</h1>
                <span className={`px-5 py-1.5 rounded-full text-sm font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isActive ? 'Active' : 'Invited'}
                </span>
              </div>
              {supplier.legal_name && supplier.legal_name !== supplier.trading_name && (
                <p className="text-2xl text-neutral-500 tracking-tight mt-1">{supplier.legal_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-6 py-3 border border-neutral-300 rounded-2xl hover:bg-white transition-colors">
              <MessageCircle className="w-4 h-4" /> Message
            </button>
            <button className="flex items-center gap-2 px-6 py-3 bg-[#00b4d8] text-white rounded-2xl hover:bg-[#0099b8] transition-colors">
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <h3 className="font-bold text-2xl tracking-tight mb-6">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div>
                  <div className="text-sm text-neutral-500 mb-1.5">Primary Contact</div>
                  <div className="text-2xl font-semibold tracking-tight">{supplier.contact_name || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-neutral-500 mb-1.5">Email Address</div>
                  <a href={`mailto:${supplier.email}`} className="text-xl text-[#00b4d8] hover:underline break-all">{supplier.email}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierProfilesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SupplierProfilesContent />
    </Suspense>
  );
}