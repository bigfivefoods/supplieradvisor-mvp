'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Award, ArrowLeft, TrendingUp, Clock, Package, ShieldCheck, Calendar } from 'lucide-react';

const supabase = createClient();

interface SupplierMetric {
  id: number;
  name: string;
  overall: number;
  ot_days: number;
  ot_percent: number;
  if_percent: number;
  ef_percent: number;
  total_pos: number;
}

export default function SupplierPerformanceMetrics() {
  const [fromDate, setFromDate] = useState('2025-06-01');
  const [toDate, setToDate] = useState('2026-06-24');
  const [activePreset, setActivePreset] = useState<'30d' | '90d' | '6m' | '12m' | 'all' | 'custom'>('12m');

  const [metrics, setMetrics] = useState<SupplierMetric[]>([]);
  const [summary, setSummary] = useState({
    overall: 0, onTime: 0, inFull: 0, errorFree: 0, totalPOs: 0, supplierCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Quick Date Presets
  const applyPreset = (preset: '30d' | '90d' | '6m' | '12m' | 'all') => {
    const today = new Date();
    let from = new Date();

    if (preset === '30d') from.setDate(today.getDate() - 30);
    if (preset === '90d') from.setDate(today.getDate() - 90);
    if (preset === '6m') from.setMonth(today.getMonth() - 6);
    if (preset === '12m') from.setFullYear(today.getFullYear() - 1);
    if (preset === 'all') from = new Date('2024-01-01');

    setFromDate(from.toISOString().split('T')[0]);
    setToDate(today.toISOString().split('T')[0]);
    setActivePreset(preset);
  };

  // Fetch OTIFEF Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: pos, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          supplier_id,
          promised_date,
          actual_delivery_date,
          order_quantity,
          delivered_quantity,
          damaged_quantity,
          profiles!supplier_id (trading_name)
        `)
        .gte('actual_delivery_date', fromDate)
        .lte('actual_delivery_date', toDate)
        .not('actual_delivery_date', 'is', null);

      if (error || !pos || pos.length === 0) {
        setMetrics([]);
        setSummary({ overall: 0, onTime: 0, inFull: 0, errorFree: 0, totalPOs: 0, supplierCount: 0 });
        setLoading(false);
        return;
      }

      const supplierMap = new Map<number, any>();

      pos.forEach((po: any) => {
        const sid = po.supplier_id;
        const sname = po.profiles?.trading_name || 'Unknown Supplier';

        if (!supplierMap.has(sid)) {
          supplierMap.set(sid, {
            id: sid,
            name: sname,
            total_pos: 0,
            on_time_count: 0,
            ot_days_sum: 0,
            total_ordered: 0,
            total_delivered: 0,
            total_damaged: 0,
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

      const calculatedMetrics: SupplierMetric[] = Array.from(supplierMap.values()).map((s: any) => {
        const ot_percent = s.total_pos > 0 ? (s.on_time_count / s.total_pos) * 100 : 0;
        const ot_days = s.total_pos > 0 ? s.ot_days_sum / s.total_pos : 0;
        const if_percent = s.total_ordered > 0 ? (s.total_delivered / s.total_ordered) * 100 : 0;
        const ef_percent = s.total_delivered > 0 ? ((s.total_delivered - s.total_damaged) / s.total_delivered) * 100 : 0;
        const overall = (ot_percent * if_percent * ef_percent) / 10000;

        return {
          id: s.id,
          name: s.name,
          overall: Math.max(0, Math.min(100, overall)),
          ot_days: parseFloat(ot_days.toFixed(1)),
          ot_percent: parseFloat(ot_percent.toFixed(1)),
          if_percent: parseFloat(if_percent.toFixed(1)),
          ef_percent: parseFloat(ef_percent.toFixed(1)),
          total_pos: s.total_pos,
        };
      });

      const totalPOs = calculatedMetrics.reduce((sum, m) => sum + m.total_pos, 0);
      const avgOverall = calculatedMetrics.length > 0 
        ? calculatedMetrics.reduce((sum, m) => sum + m.overall, 0) / calculatedMetrics.length : 0;

      setMetrics(calculatedMetrics.sort((a, b) => b.overall - a.overall));
      setSummary({
        overall: avgOverall,
        onTime: calculatedMetrics.length > 0 ? calculatedMetrics.reduce((sum, m) => sum + m.ot_percent, 0) / calculatedMetrics.length : 0,
        inFull: calculatedMetrics.length > 0 ? calculatedMetrics.reduce((sum, m) => sum + m.if_percent, 0) / calculatedMetrics.length : 0,
        errorFree: calculatedMetrics.length > 0 ? calculatedMetrics.reduce((sum, m) => sum + m.ef_percent, 0) / calculatedMetrics.length : 0,
        totalPOs,
        supplierCount: calculatedMetrics.length,
      });

      setLoading(false);
    };

    fetchData();
  }, [fromDate, toDate]);

  const getPerformanceColor = (value: number) => {
    if (value >= 95) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (value >= 85) return 'text-teal-600 bg-teal-50 border-teal-200';
    if (value >= 70) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/suppliers" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Suppliers
        </Link>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-emerald-100 rounded-2xl">
            <Award className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="font-black text-5xl tracking-[-2px]">Supplier Performance</h1>
        </div>
        <p className="text-xl text-neutral-600">OTIFEF Analysis • Live from Supabase</p>
      </div>

      {/* === CLEAN COMPACT DATE RANGE === */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-5 mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          
          {/* Quick Presets */}
          <div className="flex-shrink-0">
            <div className="text-[10px] font-semibold tracking-[1px] text-neutral-500 mb-1.5 px-1">QUICK RANGES</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '30d', value: '30d' as const },
                { label: '90d', value: '90d' as const },
                { label: '6m', value: '6m' as const },
                { label: '12m', value: '12m' as const },
                { label: 'All', value: 'all' as const },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => applyPreset(preset.value)}
                  className={`px-4 py-1.5 text-sm rounded-2xl font-medium transition-all border ${
                    activePreset === preset.value 
                      ? 'bg-neutral-900 text-white border-neutral-900' 
                      : 'bg-white hover:bg-neutral-50 border-neutral-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs */}
          <div className="flex-1">
            <div className="text-[10px] font-semibold tracking-[1px] text-neutral-500 mb-1.5 px-1">CUSTOM RANGE</div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="w-full border border-neutral-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400"
                  />
                  <Calendar className="absolute right-4 top-3 w-4 h-4 text-neutral-400 pointer-events-none" />
                </div>
              </div>

              <div className="text-neutral-400 text-sm pt-2">→</div>

              <div className="flex-1">
                <div className="relative">
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="w-full border border-neutral-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400"
                  />
                  <Calendar className="absolute right-4 top-3 w-4 h-4 text-neutral-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-neutral-500 lg:pt-6 whitespace-nowrap">
            {fromDate} → {toDate}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-neutral-500">Loading live OTIFEF data...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">OVERALL OTIFEF</div>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">
                {summary.overall.toFixed(1)}<span className="text-4xl">%</span>
              </div>
              <div className="text-sm text-emerald-600 font-medium">Based on {summary.totalPOs} POs</div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">ON TIME</div>
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">
                {summary.onTime.toFixed(1)}<span className="text-4xl">%</span>
              </div>
              <div className="text-sm text-neutral-600">Average across suppliers</div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">IN FULL</div>
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">
                {summary.inFull.toFixed(1)}<span className="text-4xl">%</span>
              </div>
              <div className="text-sm text-neutral-600">Quantity accuracy</div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-neutral-500">ERROR FREE</div>
                <ShieldCheck className="w-5 h-5 text-orange-600" />
              </div>
              <div className="font-black text-6xl tracking-tighter mb-2">
                {summary.errorFree.toFixed(1)}<span className="text-4xl">%</span>
              </div>
              <div className="text-sm text-neutral-600">Damage-free rate</div>
            </div>
          </div>

          {/* Top Suppliers Table */}
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
            <div className="px-8 pt-8 pb-6 border-b">
              <h2 className="font-bold text-3xl tracking-tight">Top Performing Suppliers</h2>
              <p className="text-neutral-600 mt-1">
                Ranked by Overall OTIFEF Score • {summary.supplierCount} suppliers in period
              </p>
            </div>

            {metrics.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-neutral-50 text-left text-sm">
                      <th className="px-8 py-4 font-semibold text-neutral-500 w-12">#</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Supplier</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500 text-center">Overall OTIFEF</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500 text-center">On Time</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500 text-center">In Full</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500 text-center">Error Free</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500 text-center">POs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {metrics.map((supplier, index) => (
                      <tr key={supplier.id} className="hover:bg-neutral-50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center w-8 h-8 rounded-2xl bg-neutral-100 text-neutral-600 font-bold text-sm group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="font-semibold text-lg tracking-tight">{supplier.name}</div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className={`inline-flex px-4 py-1.5 rounded-2xl text-xl font-black tracking-tighter border ${getPerformanceColor(supplier.overall)}`}>
                            {supplier.overall.toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="font-bold text-lg tracking-tight">{supplier.ot_percent.toFixed(1)}%</div>
                          <div className="text-xs text-neutral-500">{supplier.ot_days > 0 ? '+' : ''}{supplier.ot_days}d avg</div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="font-bold text-lg tracking-tight">{supplier.if_percent.toFixed(1)}%</div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="font-bold text-lg tracking-tight text-emerald-600">{supplier.ef_percent.toFixed(1)}%</div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="font-mono text-lg font-bold text-neutral-700">{supplier.total_pos}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-8 py-16 text-center text-neutral-500">
                No purchase orders found in the selected date range.
              </div>
            )}
          </div>

          <p className="text-center text-xs text-neutral-400 mt-8">
            OTIFEF Score = On Time % × In Full % × Error Free % • Data updates in real-time from Supabase
          </p>
        </>
      )}
    </div>
  );
}