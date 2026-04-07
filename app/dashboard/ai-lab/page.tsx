'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Brain, TrendingUp, Zap, Target, BarChart3 } from 'lucide-react';

export default function AILabHub() {
  const nodes = [
    { name: 'Pulse Dashboard', href: '/dashboard/ai-lab/pulse-dashboard', icon: BarChart3 },
    { name: 'Neural Insights', href: '/dashboard/ai-lab/neural-insights', icon: Brain },
    { name: 'Predictive Forecasts', href: '/dashboard/ai-lab/predictive-forecasts', icon: TrendingUp },
    { name: 'Simulation Lab', href: '/dashboard/ai-lab/simulation-lab', icon: Zap },
    { name: 'Custom Scorecards', href: '/dashboard/ai-lab/custom-scorecards', icon: Target },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">AI Lab</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map((node, i) => (
            <Link key={i} href={node.href} className="card group hover:border-[#00b4d8] transition-all">
              <div className="flex items-center gap-6 p-8">
                <node.icon size={48} className="text-[#00b4d8]" />
                <div>
                  <h3 className="text-3xl font-bold">{node.name}</h3>
                  <p className="text-slate-600 mt-2">Click to open module →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}