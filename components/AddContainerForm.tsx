'use client';

import React, { useState } from 'react';
import { X, MapPin, Upload, Save } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import dynamic from 'next/dynamic';

const LocationMap = dynamic(() => import('./LocationMap'), { ssr: false });

const supabase = createClient();

interface AddContainerFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddContainerForm({ onClose, onSuccess }: AddContainerFormProps) {
  const [form, setForm] = useState({
    container_code: '',
    name: '',
    type: 'standard',
    status: 'active',
    container_type: '40ft',
    country: 'South Africa',
    province: '',
    city: '',
    address: '',
    latitude: '',
    longitude: '',
    deployed_date: '',
    purchase_date: '',
    cost: '',
    notes: '',
    photo_url: '',
    is_active: true,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleMapClick = (lat: number, lng: number) => {
    setForm(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  };

  const handleSubmit = async () => {
    if (!form.container_code || !form.name) {
      alert('Container Code and Name are required');
      return;
    }

    setLoading(true);

    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
    };

    const { error } = await supabase.from('containers').insert([payload]);

    setLoading(false);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('✅ Container created successfully!');
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[100] p-6">
      <div className="bg-zinc-950 border border-zinc-700 w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-zinc-700">
          <h2 className="text-4xl font-black tracking-tight">Add New Container</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Left Column - Form */}
          <div className="space-y-8">
            {/* Identification */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">📍 Identification</h3>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Container Code *" value={form.container_code} onChange={e => handleChange('container_code', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
                <input placeholder="Display Name *" value={form.name} onChange={e => handleChange('name', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
              </div>
              <input placeholder="Photo URL (optional)" value={form.photo_url} onChange={e => handleChange('photo_url', e.target.value)} className="mt-3 w-full bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
            </div>

            {/* Type & Status */}
            <div className="grid grid-cols-3 gap-4">
              <select value={form.type} onChange={e => handleChange('type', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl">
                <option value="standard">Standard</option>
                <option value="hub">Hub</option>
                <option value="pilot">Pilot</option>
              </select>
              <select value={form.status} onChange={e => handleChange('status', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <select value={form.container_type} onChange={e => handleChange('container_type', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl">
                <option value="40ft">40ft</option>
                <option value="20ft">20ft</option>
                <option value="refrigerated">Refrigerated</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📍 Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Country" value={form.country} onChange={e => handleChange('country', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
                <input placeholder="Province" value={form.province} onChange={e => handleChange('province', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
                <input placeholder="City" value={form.city} onChange={e => handleChange('city', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
                <input placeholder="Street Address" value={form.address} onChange={e => handleChange('address', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
              </div>
            </div>

            {/* Financial & Dates */}
            <div className="grid grid-cols-2 gap-4">
              <input type="date" placeholder="Purchase Date" value={form.purchase_date} onChange={e => handleChange('purchase_date', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
              <input type="date" placeholder="Deployed Date" value={form.deployed_date} onChange={e => handleChange('deployed_date', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
              <input type="number" placeholder="Purchase Cost (R)" value={form.cost} onChange={e => handleChange('cost', e.target.value)} className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
              <label className="flex items-center gap-2 text-zinc-400">
                <input type="checkbox" checked={form.is_active} onChange={e => handleChange('is_active', e.target.checked)} /> Active Container
              </label>
            </div>

            <textarea placeholder="Notes / Special instructions" value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={3} className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl" />
          </div>

          {/* Right Column - Map + Preview */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              📍 Click map to set GPS • {form.latitude && form.longitude && `${form.latitude}, ${form.longitude}`}
            </h3>
            <div className="h-96 bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-700">
              <LocationMap onMapClick={handleMapClick} />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="mt-6 w-full bg-white text-black font-semibold py-4 rounded-2xl hover:bg-zinc-200 flex items-center justify-center gap-2 text-lg"
            >
              {loading ? 'Creating Container...' : '🚀 Create Container & Save'}
            </button>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-zinc-700 flex justify-end">
          <button onClick={onClose} className="px-8 py-3 text-zinc-400 hover:text-white">Cancel</button>
        </div>
      </div>
    </div>
  );
}