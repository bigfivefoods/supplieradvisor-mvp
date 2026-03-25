'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { AlertTriangle, CheckCircle, Target, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RaidPage() {
  const [expanded, setExpanded] = useState({
    risks: true,
    issues: false,
    actions: false,
    decisions: false,
  });

  const toggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="pl-[25px] min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Enterprise RIAD</h1>
        <p className="text-xl text-slate-600 max-w-3xl mb-12">Risks • Issues • Actions • Decisions — with full on-chain audit trail and PESTLE integration</p>

        <div className="space-y-6 max-w-5xl">

          {/* Risks */}
          <div className="card">
            <button onClick={() => toggle('risks')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <div className="flex items-center gap-4">
                <AlertTriangle size={36} className="text-red-500" />
                <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Risks</h2>
              </div>
              <ChevronDown className={`transition ${expanded.risks ? 'rotate-180' : ''}`} />
            </button>
            {expanded.risks && (
              <div className="p-8">
                <div className="text-xl">Risk Register • Heatmap • PESTLE Integration • On-chain Risk Tokens</div>
              </div>
            )}
          </div>

          {/* Issues */}
          <div className="card">
            <button onClick={() => toggle('issues')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <div className="flex items-center gap-4">
                <AlertTriangle size={36} className="text-amber-500" />
                <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Issues</h2>
              </div>
              <ChevronDown className={`transition ${expanded.issues ? 'rotate-180' : ''}`} />
            </button>
            {expanded.issues && (
              <div className="p-8">
                <div className="text-xl">Issue Register • Root Cause Analysis • Real-time Escalation • On-chain Issue Tokens</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card">
            <button onClick={() => toggle('actions')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <div className="flex items-center gap-4">
                <Target size={36} className="text-emerald-500" />
                <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Actions</h2>
              </div>
              <ChevronDown className={`transition ${expanded.actions ? 'rotate-180' : ''}`} />
            </button>
            {expanded.actions && (
              <div className="p-8">
                <div className="text-xl">Action Tracker • Ownership • Deadlines • On-chain Action Tokens & Approvals</div>
              </div>
            )}
          </div>

          {/* Decisions */}
          <div className="card">
            <button onClick={() => toggle('decisions')} className="w-full flex justify-between items-center p-8 text-left border-b">
              <div className="flex items-center gap-4">
                <BookOpen size={36} className="text-[#00b4d8]" />
                <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">Decisions</h2>
              </div>
              <ChevronDown className={`transition ${expanded.decisions ? 'rotate-180' : ''}`} />
            </button>
            {expanded.decisions && (
              <div className="p-8">
                <div className="text-xl">Decision Log • Immutable On-chain Records • PESTLE Context • Leadership Scorecards</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
