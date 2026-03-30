'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { ArrowRight, Target, Calendar, AlertTriangle } from 'lucide-react';

export default function ActiveProjectsPage() {
  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <Breadcrumb />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Active Projects</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Project 1 */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Target className="text-[#00b4d8]" size={28} />
                <h3 className="text-2xl font-bold">New Production Line</h3>
              </div>
              <span className="px-4 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-3xl">On Track</span>
            </div>
            <p className="text-slate-600 mb-8">Implementation of automated packaging line for finished goods with full on-chain tracking.</p>
            <div className="flex justify-between text-sm">
              <div>
                <span className="text-slate-500">Due</span><br />
                <span className="font-medium">15 Apr 2026</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Progress</span><br />
                <span className="font-medium">68%</span>
              </div>
            </div>
          </div>

          {/* Project 2 */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="text-amber-500" size={28} />
                <h3 className="text-2xl font-bold">Warehouse Expansion</h3>
              </div>
              <span className="px-4 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-3xl">At Risk</span>
            </div>
            <p className="text-slate-600 mb-8">Phase 2 cold storage facility upgrade with RIAD integration and live IoT monitoring.</p>
            <div className="flex justify-between text-sm">
              <div>
                <span className="text-slate-500">Due</span><br />
                <span className="font-medium">28 Mar 2026</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Progress</span><br />
                <span className="font-medium">42%</span>
              </div>
            </div>
          </div>

          {/* Project 3 */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={28} />
                <h3 className="text-2xl font-bold">Sustainability Audit</h3>
              </div>
              <span className="px-4 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-3xl">Delayed</span>
            </div>
            <p className="text-slate-600 mb-8">Carbon footprint and ethical sourcing review with full blockchain traceability.</p>
            <div className="flex justify-between text-sm">
              <div>
                <span className="text-slate-500">Due</span><br />
                <span className="font-medium">10 Apr 2026</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Progress</span><br />
                <span className="font-medium">19%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
