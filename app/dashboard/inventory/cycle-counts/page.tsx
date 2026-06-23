'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Plus, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface CycleCount {
  id: number;
  location: string;
  scheduledDate: string;
  status: 'Scheduled' | 'In Progress' | 'Completed';
  itemsCounted: number;
  accuracy: number | null;
  performedBy: string;
  notes?: string;
}

export default function CycleCounts() {
  const [showModal, setShowModal] = useState(false);
  const [cycleCounts, setCycleCounts] = useState<CycleCount[]>([
    {
      id: 1,
      location: 'Durban Main Warehouse',
      scheduledDate: '2026-06-25',
      status: 'Scheduled',
      itemsCounted: 0,
      accuracy: null,
      performedBy: '',
    },
    {
      id: 2,
      location: 'Pietermaritzburg DC',
      scheduledDate: '2026-06-18',
      status: 'Completed',
      itemsCounted: 87,
      accuracy: 98.4,
      performedBy: 'Sipho Nkosi',
    },
    {
      id: 3,
      location: 'C-DUR-001 (Container)',
      scheduledDate: '2026-06-10',
      status: 'Completed',
      itemsCounted: 42,
      accuracy: 97.1,
      performedBy: 'Thandiwe Mthembu',
    },
  ]);

  const [form, setForm] = useState({
    location: '',
    scheduledDate: '',
    performedBy: '',
  });

  const openModal = () => {
    setForm({ location: '', scheduledDate: '', performedBy: '' });
    setShowModal(true);
  };

  const saveCycleCount = () => {
    if (!form.location || !form.scheduledDate) {
      toast.error('Please select a location and date');
      return;
    }

    const newCount: CycleCount = {
      id: Date.now(),
      location: form.location,
      scheduledDate: form.scheduledDate,
      status: 'Scheduled',
      itemsCounted: 0,
      accuracy: null,
      performedBy: form.performedBy,
    };

    setCycleCounts(prev => [newCount, ...prev]);
    setShowModal(false);
    toast.success('Cycle count scheduled');
  };

  const updateStatus = (id: number, newStatus: CycleCount['status']) => {
    setCycleCounts(prev =>
      prev.map(item => {
        if (item.id === id) {
          if (newStatus === 'Completed') {
            return {
              ...item,
              status: newStatus,
              itemsCounted: Math.floor(Math.random() * 90) + 30,
              accuracy: parseFloat((96.5 + Math.random() * 3).toFixed(1)),
            };
          }
          return { ...item, status: newStatus };
        }
        return item;
      })
    );
    toast.success(`Marked as ${newStatus}`);
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Cycle Counts</h1>
          <p className="text-xl text-neutral-600">Regular inventory accuracy checks across all locations</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-3 px-8 py-4">
          <Plus size={20} /> Schedule Cycle Count
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="px-8 py-5 text-left font-medium">Location</th>
              <th className="px-8 py-5 text-left font-medium">Scheduled Date</th>
              <th className="px-8 py-5 text-center font-medium">Status</th>
              <th className="px-8 py-5 text-center font-medium">Items Counted</th>
              <th className="px-8 py-5 text-center font-medium">Accuracy</th>
              <th className="px-8 py-5 text-left font-medium">Performed By</th>
              <th className="px-8 py-5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cycleCounts.map((count) => (
              <tr key={count.id} className="border-b last:border-none hover:bg-neutral-50">
                <td className="px-8 py-6 font-medium">{count.location}</td>
                <td className="px-8 py-6 text-neutral-600">{count.scheduledDate}</td>
                <td className="px-8 py-6 text-center">
                  <span className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-sm font-medium ${
                    count.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                    count.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {count.status === 'Completed' && <CheckCircle size={15} />}
                    {count.status === 'Scheduled' && <Clock size={15} />}
                    {count.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-center font-medium">{count.itemsCounted || '-'}</td>
                <td className="px-8 py-6 text-center font-semibold text-emerald-600">
                  {count.accuracy ? `${count.accuracy}%` : '-'}
                </td>
                <td className="px-8 py-6 text-neutral-600">{count.performedBy || '-'}</td>
                <td className="px-8 py-6 text-right">
                  {count.status === 'Scheduled' && (
                    <button
                      onClick={() => updateStatus(count.id, 'Completed')}
                      className="btn-primary text-sm px-6 py-2"
                    >
                      Mark Completed
                    </button>
                  )}
                  {count.status === 'Completed' && (
                    <span className="text-emerald-600 text-sm flex items-center justify-end gap-1">
                      <TrendingUp size={16} /> Verified
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8">
            <h2 className="text-3xl font-bold mb-8">Schedule Cycle Count</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <select 
                  className="input w-full"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                >
                  <option value="">Select location...</option>
                  <option>Durban Main Warehouse</option>
                  <option>Pietermaritzburg DC</option>
                  <option>C-DUR-001 (Container)</option>
                  <option>C-DUR-002 Cold Room</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Scheduled Date</label>
                <input 
                  type="date" 
                  className="input w-full"
                  value={form.scheduledDate}
                  onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                >
              </input>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Performed By (optional)</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="Staff name"
                  value={form.performedBy}
                  onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                >
              </input>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowModal(false)} className="flex-1 border py-4 rounded-3xl">Cancel</button>
              <button onClick={saveCycleCount} className="flex-1 btn-primary py-4">Schedule Cycle Count</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}