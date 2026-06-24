'use client';

import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

interface AddContainerFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddContainerForm({ onClose, onSuccess }: AddContainerFormProps) {
  const [form, setForm] = useState({
    container_code: '',
    name: '',
    type: 'Retail',
    status: 'active',
    country: 'South Africa',
    province: '',
    city: '',
    address: '',
    assigned_contractor: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!form.container_code || !form.name) {
      alert('Container code and name are required');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('containers').insert([form]);

    setLoading(false);

    if (error) {
      alert('Error adding container: ' + error.message);
    } else {
      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        setShowSuccess(false);
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
        
        {showSuccess && (
          <div className="absolute top-6 right-6 bg-green-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            Container added successfully!
          </div>
        )}

        <div className="flex justify-between items-center px-8 py-6 border-b">
          <div>
            <h2 className="text-3xl font-black tracking-[-1.5px]">Add New Container</h2>
            <p className="text-slate-500 mt-1">Create a new container record</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">CONTAINER CODE</label>
              <input
                type="text"
                value={form.container_code}
                onChange={(e) => setForm({ ...form, container_code: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200"
                placeholder="CONT-001"
              />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">NAME</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200"
                placeholder="Main Distribution Hub"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">TYPE</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200"
              >
                <option value="Retail">Retail</option>
                <option value="Distribution">Distribution</option>
                <option value="Pilot">Pilot</option>
                <option value="Storage">Storage</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">STATUS</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">COUNTRY</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">CONTRACTOR</label>
            <input
              type="text"
              value={form.assigned_contractor}
              onChange={(e) => setForm({ ...form, assigned_contractor: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200"
              placeholder="Contractor name"
            />
          </div>

          <div>
            <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">NOTES</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 min-h-[100px]"
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-8 py-6 border-t bg-slate-50">
          <button onClick={onClose} className="px-8 py-3 rounded-3xl border border-slate-300 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-10 py-3 rounded-3xl bg-black text-white disabled:opacity-70"
          >
            {loading ? 'Adding...' : 'Add Container'}
          </button>
        </div>
      </div>
    </div>
  );
}