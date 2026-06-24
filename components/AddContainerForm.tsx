'use client';

import React, { useState } from 'react';
import { X, MapPin, Satellite, Map as MapIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';

const LocationMap = dynamic(() => import('@/components/LocationMap'), { ssr: false });

const supabase = createClient();

interface AddContainerFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const continents = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

const countriesByContinent: Record<string, string[]> = {
  Africa: ['South Africa', 'Nigeria', 'Kenya', 'Ghana', 'Egypt', 'Morocco', 'Namibia', 'Botswana', 'Zimbabwe', 'Zambia'],
  Asia: ['India', 'China', 'Japan', 'Singapore', 'UAE'],
  Europe: ['United Kingdom', 'Germany', 'France', 'Netherlands'],
  'North America': ['United States', 'Canada'],
  'South America': ['Brazil', 'Argentina'],
  Oceania: ['Australia', 'New Zealand'],
};

const provincesByCountry: Record<string, string[]> = {
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape'],
};

export default function AddContainerForm({ onClose, onSuccess }: AddContainerFormProps) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    status: 'active',
    continent: 'Africa',
    country: 'South Africa',
    province: '',
    city: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);

  const availableCountries = countriesByContinent[form.continent] || [];
  const availableProvinces = provincesByCountry[form.country] || [];

  const handleContinentChange = (continent: string) => {
    const newCountry = continent === 'Africa' ? 'South Africa' : (availableCountries[0] || '');
    setForm(prev => ({ ...prev, continent, country: newCountry, province: '' }));
    setSelectedPosition(null);
  };

  const handleCountryChange = (country: string) => {
    setForm(prev => ({ ...prev, country, province: '' }));
    setSelectedPosition(null);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.code) {
      alert('Please enter at least a name and code');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('containers').insert({
      name: form.name,
      code: form.code,
      status: form.status,
      continent: form.continent,
      country: form.country,
      province: form.province || null,
      city: form.city || null,
      address: form.address || null,
      latitude: form.latitude,
      longitude: form.longitude,
    });

    setLoading(false);

    if (error) {
      console.error('Error creating container:', error);
      alert('Failed to create container. Please try again.');
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b">
          <div>
            <h2 className="text-3xl font-black tracking-[-1.5px]">Add New Container</h2>
            <p className="text-slate-500 mt-1">Create a new retail location</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
          
          {/* Left: Form */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-2">CONTAINER DETAILS</label>
              <input
                type="text"
                placeholder="Container Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input mb-4"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Code (e.g. NGA-001)"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  className="input"
                />
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>

            {/* Location Section */}
            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> LOCATION
              </label>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <select value={form.continent} onChange={e => handleContinentChange(e.target.value)} className="input">
                  {continents.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.country} onChange={e => handleCountryChange(e.target.value)} className="input">
                  {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <select value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} className="input">
                  <option value="">Select Province</option>
                  {availableProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="City / Town"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Right: Map */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium">Pin Exact Location</span>
              <div className="flex bg-slate-100 rounded-2xl p-1">
                <button
                  onClick={() => setMapLayer('street')}
                  className={`px-4 py-1.5 rounded-xl text-sm flex items-center gap-2 transition-all ${mapLayer === 'street' ? 'bg-white shadow' : ''}`}
                >
                  <MapIcon className="w-4 h-4" /> Street
                </button>
                <button
                  onClick={() => setMapLayer('satellite')}
                  className={`px-4 py-1.5 rounded-xl text-sm flex items-center gap-2 transition-all ${mapLayer === 'satellite' ? 'bg-white shadow' : ''}`}
                >
                  <Satellite className="w-4 h-4" /> Satellite
                </button>
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden border border-slate-200 h-[380px]">
              <LocationMap
                onMapClick={handleMapClick}
                selectedPosition={selectedPosition}
                layer={mapLayer}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-8 py-6 border-t bg-slate-50">
          <button onClick={onClose} className="px-8 py-3 rounded-3xl border border-slate-300 hover:bg-slate-100">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="btn-primary px-10 disabled:opacity-70"
          >
            {loading ? 'Creating...' : 'Create Container'}
          </button>
        </div>
      </div>
    </div>
  );
}