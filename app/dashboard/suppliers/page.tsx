'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Truck, Plus, Users, FileText, AlertTriangle, 
  ArrowRight, Package 
} from 'lucide-react';

interface Supplier {
  id: string;
  trading_name: string;
  supplier_status: string;
  created_at: string;
  invited_at: string | null;
  claimed_at: string | null;
}

export default function SuppliersHub() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    invited: 0,
  });

  useEffect(() => {
    const loadSuppliers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, trading_name, supplier_status, created_at, invited_at, claimed_at')
        .eq('relationship_type', 'supplier')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) {
        console.error('Error loading suppliers:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setSuppliers(data as Supplier[]);

        const activeCount = data.filter(s => s.supplier_status === 'active').length;
        const invitedCount = data.filter(s => s.supplier_status === 'invited').length;

        setStats({
          total: data.length,
          active: activeCount,
          invited: invitedCount,
        });
      }
      setLoading(false);
    };

    loadSuppliers();
  }, []);

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <p className="text-sm text-neutral-500 mb-1">Supply Chain</p>
          <h1 className="font-black text-5xl md:text-6xl tracking-[-2.5px]">Suppliers</h1>
          <p className="text-xl text-neutral-600 mt-2">Manage your supplier ecosystem</p>
        </div>
        
        <Link 
          href="/dashboard/suppliers/add" 
          className="btn-primary px-8 py-3 flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" /> Add New Supplier
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-4xl font-black tracking-tighter">{stats.total}</div>
              <div className="text-sm text-neutral-600">Total Suppliers</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-4xl font-black tracking-tighter">{stats.active}</div>
              <div className="text-sm text-neutral-600">Active Suppliers</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <Package className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-4xl font-black tracking-tighter">{stats.invited}</div>
              <div className="text-sm text-neutral-600">Pending Acceptance</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-4xl font-black tracking-tighter">0</div>
              <div className="text-sm text-neutral-600">High Risk</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="mb-10">
        <h3 className="font-bold text-xl tracking-tight mb-6">Supplier Management</h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            { title: "Supplier Directory", desc: "Browse and search all suppliers", href: "/dashboard/suppliers/directory", icon: Users },
            { title: "Sent Invitations", desc: "Track invites you've sent", href: "/dashboard/suppliers/invites", icon: Package },
            { title: "Add New Supplier", desc: "Onboard a new supplier", href: "/dashboard/suppliers/add", icon: Plus },
            { title: "Purchase Orders", desc: "Manage POs and deliveries", href: "/dashboard/suppliers/po", icon: Package },
            { title: "Contracts", desc: "View and manage agreements", href: "/dashboard/suppliers/contracts", icon: FileText },
            { title: "Risk Alerts", desc: "Monitor supplier risks", href: "/dashboard/suppliers/risk-alerts", icon: AlertTriangle },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <Link 
                key={index}
                href={item.href}
                className="group bg-white border border-neutral-200 rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-neutral-100 rounded-2xl group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-neutral-300 group-hover:text-[#00b4d8] transition-colors" />
                </div>
                <h4 className="font-bold text-lg tracking-tight mb-1">{item.title}</h4>
                <p className="text-sm text-neutral-600">{item.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recently Added / Invited Suppliers */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl tracking-tight">Recently Added Suppliers</h3>
          <Link href="/dashboard/suppliers/invites" className="text-sm text-[#00b4d8] flex items-center gap-1">
            View all invites <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-neutral-500">Loading suppliers...</div>
        ) : suppliers.length > 0 ? (
          <div className="divide-y">
            {suppliers.map((supplier) => (
              <Link 
                key={supplier.id}
                href={`/dashboard/suppliers/profiles?id=${supplier.id}`}
                className="flex items-center justify-between py-5 px-2 hover:bg-neutral-50 rounded-2xl transition-colors group"
              >
                <div>
                  <div className="font-semibold group-hover:text-[#00b4d8] transition-colors">
                    {supplier.trading_name}
                  </div>
                  <div className="text-sm text-neutral-500">
                    {supplier.claimed_at 
                      ? `Claimed ${new Date(supplier.claimed_at).toLocaleDateString()}`
                      : `Invited ${new Date(supplier.invited_at || supplier.created_at).toLocaleDateString()}`
                    }
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-4 py-1.5 rounded-full font-medium ${
                    supplier.supplier_status === 'active' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {supplier.supplier_status === 'active' ? 'Active' : 'Invited'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8]" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Truck className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-600">No suppliers found yet.</p>
            <Link href="/dashboard/suppliers/add" className="btn-primary mt-4 inline-block px-6 py-2">
              Add your first supplier
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}