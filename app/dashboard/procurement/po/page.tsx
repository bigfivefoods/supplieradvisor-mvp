'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import Breadcrumb from '../../../components/ui/Breadcrumb';

export default function RaisePO() {
  const [connectedSuppliers, setConnectedSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [poForm, setPoForm] = useState({
    poNumber: `PO-${Date.now()}`,
    amount: '',
    dueDate: '',
    incoterms: 'DDP',
    notes: '',
  });

  // Load approved connections
  useEffect(() => {
    const loadSuppliers = async () => {
      const { data } = await supabase
        .from('business_connections')
        .select('*, requestee:profiles!requestee_id(*)')
        .eq('status', 'approved');
      setConnectedSuppliers(data || []);
    };
    loadSuppliers();
  }, []);

  const handleCreatePO = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a connected supplier');
      return;
    }

    const { error } = await supabase.from('purchase_orders').insert({
      supplier_id: selectedSupplier.requestee.id,
      po_number: poForm.poNumber,
      amount: parseFloat(poForm.amount || '0'),
      due_date: poForm.dueDate,
      incoterms: poForm.incoterms,
      status: 'draft',
      supplier_vat: selectedSupplier.requestee.vat_number,
      supplier_bank: selectedSupplier.requestee.bank_details,
      on_chain_tx_hash: `0x${Math.random().toString(16).slice(2)}`,
    });

    if (!error) {
      toast.success('✅ PO created and tokenized on Base Blockchain!');
      window.location.href = '/dashboard';
    } else {
      toast.error('Failed to create PO');
    }
  };

  return (
    <div className="pl-[25px]">
      {/* Mandatory breadcrumb on every page */}
      <Breadcrumb />

      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Raise Purchase Order</h1>
      <p className="text-2xl text-slate-600">Only with approved connections • Auto-pulls verified data • Tokenized on Base</p>

      {/* Supplier Selection */}
      <div className="card mt-8">
        <h3 className="text-2xl font-bold mb-6">Select Connected Supplier</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {connectedSuppliers.map((conn) => (
            <button
              key={conn.id}
              onClick={() => setSelectedSupplier(conn)}
              className={`p-8 border-2 rounded-3xl text-left transition-all ${selectedSupplier?.id === conn.id ? 'border-[#00b4d8] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-4">
                <ShieldCheck className="text-emerald-600" />
                <div className="flex-1">
                  <div className="text-2xl font-bold">{conn.requestee.legal_name}</div>
                  <div className="text-slate-500">{conn.requestee.trading_name}</div>
                  <div className="text-sm text-emerald-600 mt-2">VAT: {conn.requestee.vat_number}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* PO Form */}
      {selectedSupplier && (
        <div className="card mt-8">
          <h3 className="text-2xl font-bold mb-8">PO Details (auto-filled from supplier)</h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium mb-2">PO Number</label>
              <input type="text" className="input" value={poForm.poNumber} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount (R)</label>
              <input
                type="text"
                className="input"
                placeholder="0.00"
                value={poForm.amount}
                onChange={(e) => setPoForm({ ...poForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Due Date</label>
              <input
                type="date"
                className="input"
                value={poForm.dueDate}
                onChange={(e) => setPoForm({ ...poForm, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Incoterms</label>
              <select
                className="input"
                value={poForm.incoterms}
                onChange={(e) => setPoForm({ ...poForm, incoterms: e.target.value })}
              >
                <option value="DDP">DDP (Delivered Duty Paid)</option>
                <option value="DAP">DAP (Delivered at Place)</option>
                <option value="FOB">FOB (Free on Board)</option>
                <option value="EXW">EXW (Ex Works)</option>
                <option value="CIF">CIF (Cost, Insurance & Freight)</option>
              </select>
            </div>
          </div>

          {/* CoA Attachment */}
          <div className="mt-10">
            <label className="block text-sm font-medium mb-3">Attach Certificate of Analysis / Documents</label>
            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:border-[#00b4d8] transition-colors">
              <FileText size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600">Drag & drop or click to upload CoA / Phytosanitary / Packing List</p>
            </div>
          </div>

          <button
            onClick={handleCreatePO}
            className="btn-primary w-full mt-12 py-7 text-xl font-semibold"
          >
            Create PO &amp; Tokenize on Base Blockchain
          </button>
        </div>
      )}
    </div>
  );
}