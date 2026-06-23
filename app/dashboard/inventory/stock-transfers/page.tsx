'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Plus, ArrowRight, CheckCircle, Clock, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface Transfer {
  id: number;
  from: string;
  to: string;
  item: string;
  quantity: number;
  uom: string;
  status: 'Pending' | 'In Transit' | 'Completed' | 'Cancelled';
  date: string;
  requestedBy: string;
}

export default function InventoryTransfers() {
  const [showModal, setShowModal] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([
    {
      id: 1,
      from: 'Durban Main Warehouse',
      to: 'Pietermaritzburg DC',
      item: 'Wheat Flour',
      quantity: 500,
      uom: 'kg',
      status: 'Completed',
      date: '2026-06-15',
      requestedBy: 'Sipho Nkosi',
    },
    {
      id: 2,
      from: 'C-DUR-001 (Container)',
      to: 'Durban Main Warehouse',
      item: 'Sugar',
      quantity: 300,
      uom: 'kg',
      status: 'In Transit',
      date: '2026-06-18',
      requestedBy: 'Thandiwe Mthembu',
    },
    {
      id: 3,
      from: 'Pietermaritzburg DC',
      to: 'C-PMB-002',
      item: 'Baked Beans 400g',
      quantity: 120,
      uom: 'cases',
      status: 'Pending',
      date: '2026-06-20',
      requestedBy: 'Sipho Nkosi',
    },
  ]);

  const [form, setForm] = useState({
    from: '',
    to: '',
    item: '',
    quantity: '',
    uom: 'kg',
    requestedBy: '',
  });

  const openModal = () => {
    setForm({ from: '', to: '', item: '', quantity: '', uom: 'kg', requestedBy: '' });
    setShowModal(true);
  };

  const createTransfer = () => {
    if (!form.from || !form.to || !form.item || !form.quantity) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newTransfer: Transfer = {
      id: Date.now(),
      from: form.from,
      to: form.to,
      item: form.item,
      quantity: parseInt(form.quantity),
      uom: form.uom,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
      requestedBy: form.requestedBy || 'System',
    };

    setTransfers(prev => [newTransfer, ...prev]);
    setShowModal(false);
    toast.success('Transfer request created');
  };

  const updateStatus = (id: number, newStatus: Transfer['status']) => {
    setTransfers(prev =>
      prev.map(t => (t.id === id ? { ...t, status: newStatus } : t))
    );
    toast.success(`Transfer marked as ${newStatus}`);
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Completed') return <CheckCircle className="text-emerald-600" size={16} />;
    if (status === 'In Transit') return <Truck className="text-amber-600" size={16} />;
    return <Clock className="text-blue-600" size={16} />;
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Inventory Transfers</h1>
          <p className="text-xl text-neutral-600">Move stock between warehouses, containers, and sites</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-3 px-8 py-4">
          <Plus size={20} /> New Transfer
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="px-8 py-5 text-left font-medium">From</th>
              <th className="px-8 py-5 text-center font-medium"></th>
              <th className="px-8 py-5 text-left font-medium">To</th>
              <th className="px-8 py-5 text-left font-medium">Item</th>
              <th className="px-8 py-5 text-center font-medium">Qty</th>
              <th className="px-8 py-5 text-center font-medium">Status</th>
              <th className="px-8 py-5 text-left font-medium">Requested By</th>
              <th className="px-8 py-5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b last:border-none hover:bg-neutral-50">
                <td className="px-8 py-6 font-medium">{transfer.from}</td>
                <td className="px-8 py-6 text-center text-neutral-400"><ArrowRight size={18} /></td>
                <td className="px-8 py-6 font-medium">{transfer.to}</td>
                <td className="px-8 py-6">{transfer.item}</td>
                <td className="px-8 py-6 text-center font-medium">{transfer.quantity} {transfer.uom}</td>
                <td className="px-8 py-6 text-center">
                  <span className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-sm font-medium ${
                    transfer.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                    transfer.status === 'In Transit' ? 'bg-amber-100 text-amber-700' :
                    transfer.status === 'Pending' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {getStatusIcon(transfer.status)} {transfer.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-neutral-600">{transfer.requestedBy}</td>
                <td className="px-8 py-6 text-right space-x-2">
                  {transfer.status === 'Pending' && (
                    <button onClick={() => updateStatus(transfer.id, 'In Transit')} className="btn-primary text-sm px-5 py-2">
                      Start Transfer
                    </button>
                  )}
                  {transfer.status === 'In Transit' && (
                    <button onClick={() => updateStatus(transfer.id, 'Completed')} className="btn-primary text-sm px-5 py-2">
                      Mark Completed
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8">
            <h2 className="text-3xl font-bold mb-8">Create New Transfer</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">From Location</label>
                <select className="input w-full" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })}>
                  <option value="">Select source...</option>
                  <option>Durban Main Warehouse</option>
                  <option>Pietermaritzburg DC</option>
                  <option>C-DUR-001 (Container)</option>
                  <option>C-DUR-002 Cold Room</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">To Location</label>
                <select className="input w-full" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}>
                  <option value="">Select destination...</option>
                  <option>Durban Main Warehouse</option>
                  <option>Pietermaritzburg DC</option>
                  <option>C-DUR-001 (Container)</option>
                  <option>C-DUR-002 Cold Room</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Item</label>
                <input type="text" className="input w-full" placeholder="Item name" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <input type="number" className="input w-full" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Unit</label>
                  <select className="input w-full" value={form.uom} onChange={e => setForm({ ...form, uom: e.target.value })}>
                    <option>kg</option>
                    <option>cases</option>
                    <option>units</option>
                    <option>litres</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Requested By</label>
                <input type="text" className="input w-full" placeholder="Staff name" value={form.requestedBy} onChange={e => setForm({ ...form, requestedBy: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowModal(false)} className="flex-1 border py-4 rounded-3xl">Cancel</button>
              <button onClick={createTransfer} className="flex-1 btn-primary py-4">Create Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}