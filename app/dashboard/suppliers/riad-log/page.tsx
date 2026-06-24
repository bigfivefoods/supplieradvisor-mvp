'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { 
  AlertTriangle, Plus, ArrowLeft, Target, CheckCircle, Clock, Users 
} from 'lucide-react';

const supabase = createClient();

type RIADType = 'risk' | 'issue' | 'action' | 'decision';

interface RIADLog {
  id: number;
  stakeholder_type: string;
  stakeholder_id: number;
  riad_type: RIADType;
  title: string;
  description: string | null;
  status: string;
  severity: number | null;
  likelihood: number | null;
  time_horizon: number | null;
  rpn: number | null;
  created_at: string;
  profiles: { trading_name: string } | null;
}

export default function SupplierRIADLog() {
  const [activeTab, setActiveTab] = useState<RIADType>('risk');
  const [riadLogs, setRiadLogs] = useState<RIADLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Risk Form State with Live RPN
  const [riskForm, setRiskForm] = useState({
    stakeholder_id: '',
    title: '',
    description: '',
    severity: 3,
    likelihood: 3,
    time_horizon: 3,
    status: 'active',
  });

  const rpn = riskForm.severity * riskForm.likelihood * riskForm.time_horizon;

  const fetchRIADLogs = async (type: RIADType) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('riad_logs')
      .select(`*, profiles:stakeholder_id (trading_name)`)
      .eq('stakeholder_type', 'supplier')
      .eq('riad_type', type)
      .order('created_at', { ascending: false });

    if (!error) setRiadLogs(data as RIADLog[] || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRIADLogs(activeTab);
  }, [activeTab]);

  const handleCreateRisk = async () => {
    if (!riskForm.title || !riskForm.stakeholder_id) {
      alert('Please enter a title and Supplier ID');
      return;
    }

    const { error } = await supabase.from('riad_logs').insert({
      stakeholder_type: 'supplier',
      stakeholder_id: parseInt(riskForm.stakeholder_id),
      riad_type: 'risk',
      title: riskForm.title,
      description: riskForm.description || null,
      severity: riskForm.severity,
      likelihood: riskForm.likelihood,
      time_horizon: riskForm.time_horizon,
      rpn: rpn,
      status: riskForm.status,
    });

    if (error) {
      alert('Error creating risk: ' + error.message);
    } else {
      setShowModal(false);
      resetRiskForm();
      fetchRIADLogs('risk');
    }
  };

  const resetRiskForm = () => {
    setRiskForm({
      stakeholder_id: '', title: '', description: '', severity: 3, likelihood: 3, time_horizon: 3, status: 'active',
    });
  };

  const getRPNColor = (value: number) => {
    if (value >= 75) return 'bg-red-600 text-white';
    if (value >= 50) return 'bg-orange-500 text-white';
    if (value >= 25) return 'bg-amber-500 text-white';
    return 'bg-emerald-500 text-white';
  };

  const tabs = [
    { key: 'risk', label: 'Risks', icon: Target },
    { key: 'issue', label: 'Issues', icon: AlertTriangle },
    { key: 'action', label: 'Actions', icon: CheckCircle },
    { key: 'decision', label: 'Decisions', icon: Users },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard/suppliers" className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Suppliers
          </Link>
          <h1 className="font-black text-5xl tracking-[-2px]">Supplier RIAD Register</h1>
          <p className="text-xl text-neutral-600">Risks • Issues • Actions • Decisions</p>
        </div>

        <button 
          onClick={() => setShowModal(true)} 
          className="btn-primary px-6 py-3 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Log New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as RIADType)}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-all ${activeTab === tab.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500'}`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Loading...</div>
        ) : riadLogs.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="px-8 py-4 text-left font-semibold">Title</th>
                {activeTab === 'risk' && <th className="px-6 py-4 text-center font-semibold">RPN</th>}
                <th className="px-6 py-4 text-center font-semibold">Status</th>
                <th className="px-8 py-4 text-right font-semibold">Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {riadLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-8 py-5">
                    <div className="font-semibold">{log.title}</div>
                    {log.description && <div className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{log.description}</div>}
                  </td>
                  {activeTab === 'risk' && (
                    <td className="px-6 py-5 text-center">
                      {log.rpn && (
                        <span className={`px-4 py-1 rounded-2xl text-sm font-bold ${getRPNColor(log.rpn)}`}>
                          {log.rpn}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-5 text-center">
                    <span className="px-4 py-1 rounded-full text-xs font-medium border bg-neutral-100 text-neutral-600 capitalize">
                      {log.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right text-xs text-neutral-500">
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-16 text-center text-neutral-500">No {activeTab}s logged yet for suppliers.</div>
        )}
      </div>

      {/* Risk Logging Modal with Live RPN */}
      {showModal && activeTab === 'risk' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8">
            <h2 className="font-bold text-2xl tracking-tight mb-6">Log New Risk</h2>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium block mb-1.5">Supplier ID</label>
                <input
                  type="number"
                  value={riskForm.stakeholder_id}
                  onChange={(e) => setRiskForm({ ...riskForm, stakeholder_id: e.target.value })}
                  className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm"
                  placeholder="Enter supplier profile ID"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5">Risk Title</label>
                <input
                  type="text"
                  value={riskForm.title}
                  onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })}
                  className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm"
                  placeholder="Short risk description"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5">Description (Optional)</label>
                <textarea
                  value={riskForm.description}
                  onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
                  className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm h-20"
                />
              </div>

              {/* Risk Scoring with Live RPN */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1">Severity (1-5)</label>
                  <select value={riskForm.severity} onChange={(e) => setRiskForm({ ...riskForm, severity: parseInt(e.target.value) })} className="w-full border rounded-2xl px-3 py-2.5 text-sm">
                    {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Likelihood (1-5)</label>
                  <select value={riskForm.likelihood} onChange={(e) => setRiskForm({ ...riskForm, likelihood: parseInt(e.target.value) })} className="w-full border rounded-2xl px-3 py-2.5 text-sm">
                    {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Time Horizon (1-5)</label>
                  <select value={riskForm.time_horizon} onChange={(e) => setRiskForm({ ...riskForm, time_horizon: parseInt(e.target.value) })} className="w-full border rounded-2xl px-3 py-2.5 text-sm">
                    {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Live RPN Display */}
              <div className="bg-neutral-900 text-white rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs tracking-widest text-neutral-400">RISK PRIORITY NUMBER (RPN)</div>
                  <div className="text-5xl font-black tracking-tighter">{rpn}</div>
                </div>
                <div className={`px-6 py-2 rounded-2xl text-sm font-bold ${getRPNColor(rpn)}`}>
                  {rpn >= 75 ? 'Critical' : rpn >= 50 ? 'High' : rpn >= 25 ? 'Medium' : 'Low'}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { setShowModal(false); resetRiskForm(); }} className="flex-1 py-3 rounded-2xl border border-neutral-200 font-medium">
                Cancel
              </button>
              <button onClick={handleCreateRisk} className="flex-1 py-3 rounded-2xl bg-neutral-900 text-white font-medium">
                Log Risk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}