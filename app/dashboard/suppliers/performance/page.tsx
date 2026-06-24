'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Truck, Plus, Users, FileText, AlertTriangle, 
  ArrowRight, Package, Award, TrendingUp, BarChart3 
} from 'lucide-react';

interface Supplier {
  id: string;
  trading_name: string;
  supplier_status: string;
  created_at: string;
  invited_at: string | null;
  claimed_at: string | null;
}

interface OTIFEFData {
  overall: number;
  onTime: number;
  inFull: number;
  errorFree: number;
  totalPOs: number;
  supplierCount: number;
}

export default function SuppliersHub() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [otifefLoading, setOtifefLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, invited: 0 });
  const [otifefData, setOtifefData] = useState<OTIFEFData>({
    overall: 0, onTime: 0, inFull: 0, errorFree: 0, totalPOs: 0, supplierCount: 0
  });

  const supabase = createClient();

  // Load suppliers
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

        setStats({ total: data.length, active: activeCount, invited: invitedCount });
      }
      setLoading(false);
    };

    loadSuppliers();
  }, [supabase]);

  // Load live OTIFEF data
  useEffect(() => {
    const loadOTIFEF = async () => {
      setOtifefLoading(true);

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

      const { data: pos, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, supplier_id, promised_date, actual_delivery_date,
          order_quantity, delivered_quantity, damaged_quantity,
          profiles!inner (trading_name)
        `)
        .gte('actual_delivery_date', twelveMonthsAgo.toISOString().split('T')[0])
        .not('actual_delivery_date', 'is', null);

      if (error || !pos || pos.length === 0) {
        setOtifefLoading(false);
        return;
      }

      const supplierMap = new Map();

      pos.forEach((po: any) => {
        const sid = po.supplier_id;
        const sname = po.profiles?.trading_name || 'Unknown Supplier';

        if (!supplierMap.has(sid)) {
          supplierMap.set(sid, {
            total_pos: 0, on_time_count: 0, ot_days_sum: 0,
            total_ordered: 0, total_delivered: 0, total_damaged: 0,
          });
        }

        const s = supplierMap.get(sid);
        s.total_pos += 1;
        if (po.actual_delivery_date <= po.promised_date) s.on_time_count += 1;

        const daysDiff = (new Date(po.promised_date).getTime() - new Date(po.actual_delivery_date).getTime()) / (1000 * 3600 * 24);
        s.ot_days_sum += daysDiff;
        s.total_ordered += po.order_quantity || 0;
        s.total_delivered += po.delivered_quantity || 0;
        s.total_damaged += po.damaged_quantity || 0;
      });

      const metrics = Array.from(supplierMap.values()).map((s) => {
        const ot_percent = s.total_pos > 0 ? (s.on_time_count / s.total_pos) * 100 : 0;
        const if_percent = s.total_ordered > 0 ? (s.total_delivered / s.total_ordered) * 100 : 0;
        const ef_percent = s.total_delivered > 0 ? ((s.total_delivered - s.total_damaged) / s.total_delivered) * 100 : 0;
        const overall = (ot_percent * if_percent * ef_percent) / 10000;

        return { overall: Math.max(0, Math.min(100, overall)), ot_percent, if_percent, ef_percent, total_pos: s.total_pos };
      });

      const totalPOs = metrics.reduce((sum, m) => sum + m.total_pos, 0);
      const avgOverall = metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.overall, 0) / metrics.length : 0;

      setOtifefData({
        overall: avgOverall,
        onTime: metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.ot_percent, 0) / metrics.length : 0,
        inFull: metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.if_percent, 0) / metrics.length : 0,
        errorFree: metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.ef_percent, 0) / metrics.length : 0,
        totalPOs,
        supplierCount: metrics.length,
      });

      setOtifefLoading(false);
    };

    loadOTIFEF();
  }, [supabase]);

  const quickLinks = [
    { title: "Supplier Profiles", desc: "Browse and manage all supplier profiles with rich filters", href: "/dashboard/suppliers/profiles", icon: Users },
    { title: "Add New Supplier", desc: "Onboard a new supplier into the system", href: "/dashboard/suppliers/add", icon: Plus },
    { title: "Sent Supplier Invitations", desc: "Track pending and sent supplier invitations", href: "/dashboard/suppliers/invites", icon: Package },
    { title: "Purchase Orders", desc: "Create and manage supplier purchase orders", href: "/dashboard/suppliers/po", icon: FileText },
    { title: "Supplier Contracts", desc: "View and manage supplier contracts and agreements", href: "/dashboard/suppliers/contracts", icon: Award },
    { title: "Supplier RIAD Log", desc: "Returns, Issues, Adjustments & Disputes", href: "/dashboard/suppliers/riad-log", icon: AlertTriangle },
  ];

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <p className="text-sm text-neutral-500 mb-1">SUPPLIERS</p>
          <h1 className="font-black text-5xl md:text-6xl tracking-[-2.5px]">Suppliers</h1>
          <p className="text-xl text-neutral-600 mt-2">Manage your supplier ecosystem</p>
        </div>
        
        <Link href="/dashboard/suppliers/add" className="btn-primary px-8 py-3 flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" /> Add New Supplier
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {/* ... existing 4 stat cards unchanged ... */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl"><Truck className="w-6 h-6 text-blue-600" /></div>
            <div><div className="text-4xl font-black tracking-tighter">{stats.total}</div><div className="text-sm text-neutral-600">Total Suppliers</div></div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 rounded-2xl"><Users className="w-6 h-6 text-emerald-600" /></div>
            <div><div className="text-4xl font-black tracking-tighter">{stats.active}</div><div className="text-sm text-neutral-600">Active Suppliers</div></div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 rounded-2xl"><Package className="w-6 h-6 text-amber-600" /></div>
            <div><div className="text-4xl font-black tracking-tighter">{stats.invited}</div><div className="text-sm text-neutral-600">Pending Acceptance</div></div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-2xl"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
            <div><div className="text-4xl font-black tracking-tighter">14</div><div className="text-sm text-neutral-600">Open RIADs</div></div>
          </div>
        </div>
      </div>

      {/* Live OTIFEF Summary */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-xl tracking-tight flex items-center gap-2">
              Supplier Performance <span className="text-emerald-600">(OTIFEF)</span>
            </h3>
            <p className="text-sm text-neutral-500">Last 12 months • Live from Supabase</p>
          </div>
          <Link href="/dashboard/suppliers/performance" className="text-sm text-[#00b4d8] flex items-center gap-1 hover:underline">
            View full metrics <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {otifefLoading ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center text-neutral-500">
            Loading live OTIFEF performance data...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 4 summary cards - same as before */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">OVERALL OTIFEF</div>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">{otifefData.overall.toFixed(1)}<span className="text-4xl">%</span></div>
              <div className="text-sm text-emerald-600 font-medium">Based on {otifefData.totalPOs} POs</div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">ON TIME</div>
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">{otifefData.onTime.toFixed(1)}<span className="text-4xl">%</span></div>
              <div className="text-sm text-neutral-600">Average across suppliers</div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">IN FULL</div>
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">{otifefData.inFull.toFixed(1)}<span className="text-4xl">%</span></div>
              <div className="text-sm text-neutral-600">Quantity accuracy</div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">ERROR FREE</div>
                <Award className="w-5 h-5 text-orange-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">{otifefData.errorFree.toFixed(1)}<span className="text-4xl">%</span></div>
              <div className="text-sm text-neutral-600">Damage-free rate</div>
            </div>
          </div>
        )}
      </div>

      {/* NEW: Nice Featured Card for Supplier Performance */}
      <div className="mb-10">
        <Link 
          href="/dashboard/suppliers/performance"
          className="group block bg-gradient-to-br from-white to-neutral-50 border border-neutral-200 hover:border-[#00b4d8] rounded-3xl p-8 transition-all hover:shadow-lg"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="p-4 bg-emerald-100 rounded-2xl group-hover:bg-emerald-200 transition-colors">
                <BarChart3 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-2xl tracking-tight">Supplier Performance Dashboard</h3>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">NEW</span>
                </div>
                <p className="text-neutral-600 max-w-md">
                  Deep dive into OTIFEF rankings, supplier comparisons, trends over time, and detailed performance breakdowns.
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[#00b4d8] group-hover:gap-3 transition-all">
                  Open Full Performance View
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="hidden md:block text-right">
              <div className="text-5xl font-black tracking-tighter text-emerald-600">
                {otifefData.overall > 0 ? otifefData.overall.toFixed(1) : '--'}%
              </div>
              <div className="text-sm text-neutral-500">Current Overall OTIFEF</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Navigation Cards */}
      <div className="mb-10">
        <h3 className="font-bold text-xl tracking-tight mb-6">Supplier Management</h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {quickLinks.map((item, index) => {
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

      {/* Recently Added Suppliers */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl tracking-tight">Recently Added Suppliers</h3>
          <Link href="/dashboard/suppliers/profiles" className="text-sm text-[#00b4d8] flex items-center gap-1">
            View all suppliers <ArrowRight className="w-4 h-4" />
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
                  <div className="font-semibold group-hover:text-[#00b4d8] transition-colors">{supplier.trading_name}</div>
                  <div className="text-sm text-neutral-500">
                    {supplier.claimed_at 
                      ? `Claimed ${new Date(supplier.claimed_at).toLocaleDateString()}`
                      : `Invited ${new Date(supplier.invited_at || supplier.created_at).toLocaleDateString()}`
                    }
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-4 py-1.5 rounded-full font-medium ${
                    supplier.supplier_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
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