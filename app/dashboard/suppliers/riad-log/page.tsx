'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Plus, Search, Filter, X, Calendar, AlertTriangle, 
  CheckCircle, Clock, ArrowUpDown 
} from 'lucide-react';
import Link from 'next/link';

interface RIADLog {
  id: number;
  public_id: string;
  supplier_name: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  amount: number | null;
  created_at: string;
  updated_at: string;
}

export default function SupplierRIADLog() {
  const supabase = createClient();

  const [logs, setLogs] = useState<RIADLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');

  // New RIAD Form State
  const [newRIAD, setNewRIAD] = useState({
    supplier_name: '',
    type: 'Quality Issue',
    title: '',
    description: '',
    severity: 'Medium',
    amount: '',
  });

  const fetchRIADLogs = async () => {
    const { data, error } = await supabase
      .from('supplier_riad_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLogs(data as RIADLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRIADLogs();
  }, [supabase]);

  // Filtered + Searched Logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'All' || log.status === filterStatus;
    const matchesType = filterType === 'All' || log.type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Create new RIAD entry
  const handleCreateRIAD = async () => {
    if (!newRIAD.title || !newRIAD.supplier_name) {
      alert('Please fill in Supplier Name and Title');
      return;
    }

    const { error } = await supabase.from('supplier_riad_logs').insert([{
      supplier_name: newRIAD.supplier_name,
      type: newRIAD.type,
      title: newRIAD.title,
      description: newRIAD.description || null,
      severity: newRIAD.severity,
      amount: newRIAD.amount ? parseFloat(newRIAD.amount) : null,
      status: 'Open',
    }]);

    if (error) {
      alert('Error creating RIAD entry');
      console.error(error);
    } else {
      setShowModal(false);
      setNewRIAD({
        supplier_name: '',
        type: 'Quality Issue',
        title: '',
        description: '',
        severity: 'Medium',
        amount: '',
      });
      fetchRIADLogs();
    }
  };

  // Update status
  const updateStatus = async (id: number, newStatus: string) => {
    const { error } = await supabase
      .from('supplier_riad_logs')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === 'Resolved' && { resolved_at: new Date().toISOString() })
      })
      .eq('id', id);

    if (!error) {
      fetchRIADLogs();
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Open') return 'bg-red-100 text-red-700';
    if (status === 'Investigating') return 'bg-amber-100 text-amber-700';
    if (status === 'Resolved') return 'bg-emerald-100 text-emerald-700';
    return 'bg-neutral-100 text-neutral-700';
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'Critical') return 'text-red-600';
    if (severity === 'High') return 'text-orange-600';
    if (severity === 'Medium') return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className="px-8 py-12 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <p className="text-sm text-neutral-500 mb-1">SUPPLIERS</p>
          <h1 className="font-black text-6xl tracking-[-3px]">Supplier RIAD Log</h1>
          <p className="text-xl text-neutral-600 mt-2">Returns • Issues • Adjustments • Disputes</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary px-8 py-3 flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" /> Raise New RIAD
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-4 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by title, supplier, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white border border-neutral-200 rounded-3xl text-lg focus:outline-none focus:border-[#00b4d8]"
          />
        </div>

        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-6 py-4 bg-white border border-neutral-200 rounded-3xl text-sm font-medium"
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Investigating">Investigating</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>

        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className="px-6 py-4 bg-white border border-neutral-200 rounded-3xl text-sm font-medium"
        >
          <option value="All">All Types</option>
          <option value="Quality Issue">Quality Issue</option>
          <option value="Return">Return</option>
          <option value="Claim">Claim</option>
          <option value="Adjustment">Adjustment</option>
          <option value="Dispute">Dispute</option>
        </select>
      </div>

      {/* RIAD Table */}
      <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-8 py-4 text-sm font-semibold">Supplier</th>
                <th className="text-left px-6 py-4 text-sm font-semibold">Type</th>
                <th className="text-left px-6 py-4 text-sm font-semibold">Title</th>
                <th className="text-left px-6 py-4 text-sm font-semibold">Severity</th>
                <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold">Amount</th>
                <th className="text-left px-6 py-4 text-sm font-semibold">Date</th>
                <th className="text-right px-8 py-4 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="px-8 py-12 text-center text-neutral-500">Loading RIAD logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={8} className="px-8 py-12 text-center text-neutral-500">No RIAD entries found.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-8 py-5 font-semibold">{log.supplier_name}</td>
                    <td className="px-6 py-5 text-sm">{log.type}</td>
                    <td className="px-6 py-5">
                      <div className="font-medium">{log.title}</div>
                      {log.description && <div className="text-xs text-neutral-500 line-clamp-1">{log.description}</div>}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`font-semibold text-sm ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <select 
                        value={log.status}
                        onChange={(e) => updateStatus(log.id, e.target.value)}
                        className={`text-xs px-4 py-1.5 rounded-full font-medium border-0 ${getStatusColor(log.status)}`}
                      >
                        <option value="Open">Open</option>
                        <option value="Investigating">Investigating</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                    <td className="px-6 py-5 font-mono text-sm">
                      {log.amount ? `R ${log.amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-6 py-5 text-sm text-neutral-500">
                      {new Date(log.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-sm text-[#00b4d8] hover:underline">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raise New RIAD Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black tracking-tight">Raise New RIAD</h2>
              <button onClick={() => setShowModal(false)}><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Supplier Name</label>
                <input 
                  type="text" 
                  value={newRIAD.supplier_name}
                  onChange={(e) => setNewRIAD({...newRIAD, supplier_name: e.target.value})}
                  className="w-full border border-neutral-200 rounded-2xl px-6 py-4 text-lg"
                  placeholder="e.g. Tiger Brands"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select 
                    value={newRIAD.type}
                    onChange={(e) => setNewRIAD({...newRIAD, type: e.target.value})}
                    className="w-full border border-neutral-200 rounded-2xl px-6 py-4"
                  >
                    <option>Quality Issue</option>
                    <option>Return</option>
                    <option>Claim</option>
                    <option>Adjustment</option>
                    <option>Dispute</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Severity</label>
                  <select 
                    value={newRIAD.severity}
                    onChange={(e) => setNewRIAD({...newRIAD, severity: e.target.value})}
                    className="w-full border border-neutral-200 rounded-2xl px-6 py-4"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input 
                  type="text" 
                  value={newRIAD.title}
                  onChange={(e) => setNewRIAD({...newRIAD, title: e.target.value})}
                  className="w-full border border-neutral-200 rounded-2xl px-6 py-4 text-lg"
                  placeholder="Short description of the issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea 
                  value={newRIAD.description}
                  onChange={(e) => setNewRIAD({...newRIAD, description: e.target.value})}
                  rows={4}
                  className="w-full border border-neutral-200 rounded-3xl px-6 py-4"
                  placeholder="Detailed description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Financial Impact (Optional)</label>
                <input 
                  type="number" 
                  value={newRIAD.amount}
                  onChange={(e) => setNewRIAD({...newRIAD, amount: e.target.value})}
                  className="w-full border border-neutral-200 rounded-2xl px-6 py-4 text-lg"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 border border-neutral-300 rounded-2xl font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateRIAD}
                className="flex-1 py-4 bg-[#00b4d8] text-white rounded-2xl font-medium hover:bg-[#0099b8]"
              >
                Raise RIAD Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}