'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ArrowRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InventoryTransferPage() {
  const [form, setForm] = useState({
    fromLocationId: 1,
    toLocationId: 2,
    items: [] as any[]
  });

  // Example locations with stock (this is the part that was causing the TS error)
  const allLocations = [
    { id: 1, name: 'Durban Warehouse', stock: { 101: 450, 102: 120, 103: 0 } as Record<number, number> },
    { id: 2, name: 'Cape Town Warehouse', stock: { 101: 80, 102: 300, 103: 50 } as Record<number, number> },
    { id: 3, name: 'Johannesburg Warehouse', stock: { 101: 220, 102: 90, 103: 180 } as Record<number, number> },
  ];

  const selectedItemsList = [
    { id: 101, name: 'Tomato Paste 400g', uom: 'case' },
    { id: 102, name: 'Olive Oil 5L', uom: 'tin' },
    { id: 103, name: 'Spice Mix 1kg', uom: 'bag' },
  ];

  const fromLocation = allLocations.find(l => l.id === form.fromLocationId);

  const availableItems = selectedItemsList.filter(item => {
    const stockQty = (fromLocation?.stock as Record<number, number>)[item.id] ?? 0;
    return stockQty > 0;
  });

  const handleTransfer = () => {
    toast.success('Transfer request submitted successfully!');
  };

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Inventory Transfer</h1>

        <div className="card p-12">
          <h2 className="text-4xl font-bold mb-8">Create Transfer</h2>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium mb-2">From Location</label>
              <select 
                className="input w-full"
                value={form.fromLocationId}
                onChange={e => setForm(prev => ({ ...prev, fromLocationId: Number(e.target.value) }))}
              >
                {allLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">To Location</label>
              <select 
                className="input w-full"
                value={form.toLocationId}
                onChange={e => setForm(prev => ({ ...prev, toLocationId: Number(e.target.value) }))}
              >
                {allLocations.filter(l => l.id !== form.fromLocationId).map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-6">Available Items</h3>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-4 text-left">Item</th>
                  <th className="p-4 text-center">Available</th>
                  <th className="p-4 text-center">UOM</th>
                  <th className="p-4 text-center">Transfer Qty</th>
                </tr>
              </thead>
              <tbody>
                {availableItems.map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="p-4">{item.name}</td>
                    <td className="p-4 text-center">
                      {(fromLocation?.stock as Record<number, number>)[item.id] ?? 0}
                    </td>
                    <td className="p-4 text-center">{item.uom}</td>
                    <td className="p-4 text-center">
                      <input type="number" className="input w-20 text-center" defaultValue={0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-12">
            <button onClick={handleTransfer} className="btn-primary flex items-center gap-3 px-12 py-4">
              Submit Transfer <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
