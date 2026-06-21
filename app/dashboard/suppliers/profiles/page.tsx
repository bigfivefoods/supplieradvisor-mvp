'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Edit2, MessageCircle, FileText, 
  Calendar, Clock, CheckCircle, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SupplierProfile {
  id: string;
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

function SupplierProfileContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      if (!id) {
        setError('No supplier selected. Please choose a supplier from the directory.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setError('Supplier not found');
      } else {
        setSupplier(data as SupplierProfile);
      }
      setLoading(false);
    };

    fetchSupplier();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00b4d8]"></div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8">
        <div className="max-w-4xl mx-auto text-center py-20">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-6" />
          <h1 className="text-4xl font-black tracking-[-2px] mb-4">Supplier Profile</h1>
          <p className="text-xl text-neutral-600 mb-8">{error}</p>
          <Link href="/dashboard/suppliers/directory" className="btn-primary px-8 py-3 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Go to Supplier Directory
          </Link>
        </div>
      </div>
    );
  }

  const statusColor = supplier.supplier_status === 'active' 
    ? 'bg-emerald-100 text-emerald-700' 
    : 'bg-amber-100 text-amber-700';

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-6xl mx-auto px-8 py-12">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard/suppliers/directory" 
              className="p-3 hover:bg-white rounded-2xl transition-colors border border-transparent hover:border-neutral-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-6xl font-black tracking-[-3.5px]">{supplier.trading_name}</h1>
                <span className={`px-5 py-1.5 rounded-full text-sm font-semibold ${statusColor}`}>
                  {supplier.supplier_status === 'active' ? 'Active' : 'Invited'}
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
          
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl border border-neutral-200 p-6">
                <div className="text-sm text-neutral-500 mb-2">Onboarding Status</div>
                <div className="flex items-center gap-2">
                  {supplier.supplier_status === 'active' ? (
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Clock className="w-6 h-6 text-amber-600" />
                  )}
                  <span className="text-2xl font-semibold tracking-tight">
                    {supplier.supplier_status === 'active' ? 'Complete' : 'Pending'}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-neutral-200 p-6">
                <div className="text-sm text-neutral-500 mb-2">Category</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {supplier.category || 'Not specified'}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-neutral-200 p-6">
                <div className="text-sm text-neutral-500 mb-2">Website</div>
                {supplier.website ? (
                  <a href={supplier.website} target="_blank" className="text-[#00b4d8] hover:underline text-xl font-medium break-all">
                    {supplier.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <span className="text-neutral-400">Not provided</span>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <h3 className="font-bold text-2xl tracking-tight mb-6">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div>
                  <div className="text-sm text-neutral-500 mb-1.5">Primary Contact</div>
                  <div className="text-2xl font-semibold tracking-tight">
                    {supplier.contact_name || 'Not provided'}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-neutral-500 mb-1.5">Email Address</div>
                  <a href={`mailto:${supplier.email}`} className="text-xl text-[#00b4d8] hover:underline break-all">
                    {supplier.email}
                  </a>
                </div>

                <div>
                  <div className="text-sm text-neutral-500 mb-1.5">Phone Number</div>
                  <div className="text-xl font-medium">
                    {supplier.contact_phone || 'Not provided'}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-neutral-500 mb-1.5">Invited By</div>
                  <div className="text-xl font-medium">
                    {supplier.invited_by || 'Big Five Foods'}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <h3 className="font-bold text-2xl tracking-tight mb-6 flex items-center gap-3">
                <Calendar className="w-6 h-6" /> Timeline
              </h3>

              <div className="space-y-6">
                {supplier.invited_at && (
                  <div className="flex gap-4">
                    <div className="w-3 h-3 mt-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Invitation Sent</div>
                      <div className="text-sm text-neutral-500">
                        {new Date(supplier.invited_at).toLocaleDateString('en-GB', { 
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {supplier.claimed_at && (
                  <div className="flex gap-4">
                    <div className="w-3 h-3 mt-2 rounded-full bg-emerald-600 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Profile Claimed & Activated</div>
                      <div className="text-sm text-neutral-500">
                        {new Date(supplier.claimed_at).toLocaleDateString('en-GB', { 
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="w-3 h-3 mt-2 rounded-full bg-neutral-400 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Record Created</div>
                    <div className="text-sm text-neutral-500">
                      {new Date(supplier.created_at).toLocaleDateString('en-GB', { 
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <h4 className="font-bold text-xl tracking-tight mb-6">Quick Actions</h4>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-3 py-4 border border-neutral-300 rounded-2xl hover:bg-neutral-50 transition-colors text-lg font-medium">
                  <FileText className="w-5 h-5" /> Create Purchase Order
                </button>
                <button className="w-full flex items-center justify-center gap-3 py-4 border border-neutral-300 rounded-2xl hover:bg-neutral-50 transition-colors text-lg font-medium">
                  <MessageCircle className="w-5 h-5" /> Send Message
                </button>
                <button className="w-full flex items-center justify-center gap-3 py-4 border border-neutral-300 rounded-2xl hover:bg-neutral-50 transition-colors text-lg font-medium">
                  <Edit2 className="w-5 h-5" /> Edit Supplier Details
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-sm">
              <div className="text-neutral-500 mb-4 font-medium">SYSTEM METADATA</div>
              <div className="space-y-4 text-neutral-600">
                <div className="flex justify-between">
                  <span>Supplier ID</span>
                  <span className="font-mono text-xs">{supplier.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="font-medium capitalize">{supplier.supplier_status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated</span>
                  <span>{supplier.updated_at ? new Date(supplier.updated_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main export wrapped in Suspense
export default function SupplierProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00b4d8]"></div>
      </div>
    }>
      <SupplierProfileContent />
    </Suspense>
  );
}