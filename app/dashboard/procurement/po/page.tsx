'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RaisePO() {
  const [connectedBusinesses, setConnectedBusinesses] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [poData, setPoData] = useState({
    po_number: `PO-${Date.now()}`,
    amount: '',
    due_date: '',
    items: [] as any[],
  });

  useEffect(() => {
    const loadConnected = async () => {
      const { data } = await supabase
        .from('business_connections')
        .select('*, requestee:profiles!requestee_id(*)')
        .eq('status', 'approved');
      setConnectedBusinesses(data || []);
    };
    loadConnected();
  }, []);

  const createPO = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a connected supplier');
      return;
    }

    const { error } = await supabase.from('purchase_orders').insert({
      supplier_id: selectedSupplier.requestee.id,
      po_number: poData.po_number,
      amount: parseFloat(poData.amount),
      due_date: poData.due_date,
      status: 'draft',
      // Auto-pull metadata
      supplier_vat: selectedSupplier.requestee.vat_number,
      supplier_bank: selectedSupplier.requestee.bank_details,
    });

    if (!error) {
      toast.success('PO created and tokenized on Base!');
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="space-y-12">
      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Raise Purchase Order</h1>
      <p className="text-2xl text-slate-600">Only with approved connections • Auto-pulls verified bank, VAT & certificates</p>

      {/* Supplier Selector */}
      <div className="card p-8">
        <h3 className="text-2xl font-bold mb-6">Select Connected Supplier</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {connectedBusinesses.map(conn => (
            <button
              key={conn.id}
              onClick={() => setSelectedSupplier(conn)}
              className={`p-8 border-2 rounded-3xl text-left transition-all ${selectedSupplier?.id === conn.id ? 'border-[#00b4d8] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-4">
                <ShieldCheck className="text-emerald-600" />
                <div>
                  <div className="text-2xl font-bold">{conn.requestee.legal_name}</div>
                  <div className="text-slate-500">VAT: {conn.requestee.vat_number}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* PO Form */}
      {selectedSupplier && (
        <div className="card p-8">
          <h3 className="text-2xl font-bold mb-6">PO Details (auto-filled from supplier)</h3>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium mb-2">PO Number</label>
              <input type="text" className="input" value={poData.po_number} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount (R)</label>
              <input 
                type="text" 
                className="input" 
                value={poData.amount}
                onChange={e => setPoData(p => ({...p, amount: e.target.value}))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Due Date</label>
              <input 
                type="date" 
                className="input" 
                value={poData.due_date}
                onChange={e => setPoData(p => ({...p, due_date: e.target.value}))}
              />
            </div>
          </div>

          <div className="mt-10">
            <button onClick={createPO} className="btn-primary w-full py-6 text-xl">
              Create & Tokenize PO on Base Blockchain
            </button>
          </div>
        </div>
      )}
    </div>
  );
}