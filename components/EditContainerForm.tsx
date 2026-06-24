'use client';

import React, { useState, useEffect } from 'react';
import { X, MapPin, Package, Image as ImageIcon, User, Tag, DollarSign, FileText, CheckCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';

const LocationMap = dynamic(() => import('@/components/LocationMap'), { ssr: false });
const supabase = createClient();

export interface Container {
  id: number;
  container_code: string;
  name: string;
  type: string | null;
  status: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  deployed_date: string | null;
  purchase_date: string | null;
  cost: number | null;
  assigned_contractor: string | null;
  tags: string | null;
  photo_url: string | null;
  notes: string | null;
}

interface EditContainerFormProps {
  container: Container;
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

const statusOptions = ['active', 'inactive', 'maintenance', 'pending'];
const typeOptions = ['Retail', 'Distribution', 'Pilot', 'Storage', 'Other'];

export default function EditContainerForm({ container, onClose, onSuccess }: EditContainerFormProps) {
  const [form, setForm] = useState({
    container_code: container.container_code || '',
    name: container.name || '',
    type: container.type || 'Retail',
    status: container.status || 'active',
    continent: 'Africa',
    country: container.country || 'South Africa',
    province: container.province || '',
    city: container.city || '',
    address: container.address || '',
    latitude: container.latitude,
    longitude: container.longitude,
    deployed_date: container.deployed_date || '',
    purchase_date: container.purchase_date || '',
    cost: container.cost ? container.cost.toString() : '',
    assigned_contractor: container.assigned_contractor || '',
    notes: container.notes || '',
  });

  const [tags, setTags] = useState<string[]>(
    container.tags ? container.tags.split(',').filter(Boolean) : []
  );
  const [tagInput, setTagInput] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(container.photo_url);
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(
    container.latitude && container.longitude ? [container.latitude, container.longitude] : null
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const availableCountries = countriesByContinent[form.continent] || [];
  const availableProvinces = ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape'];

  // Auto-detect continent from existing country
  useEffect(() => {
    if (container.country) {
      const foundContinent = Object.keys(countriesByContinent).find((c) =>
        countriesByContinent[c].includes(container.country!)
      );
      if (foundContinent) {
        setForm((prev) => ({ ...prev, continent: foundContinent }));
      }
    }
  }, [container.country]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.container_code.trim()) newErrors.container_code = 'Container code is required';
    if (!form.name.trim()) newErrors.name = 'Container name is required';
    if (form.cost && isNaN(parseFloat(form.cost))) newErrors.cost = 'Cost must be a number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors({ photo: 'Please upload a valid image file' });
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setPhotoPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    let photoUrl = container.photo_url;

    // Upload new photo if selected
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${form.container_code}-${Date.now()}.${fileExt}`;
      const filePath = `containers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('container-photos')
        .upload(filePath, photoFile);

      if (uploadError) {
        setErrors({ submit: 'Failed to upload new photo.' });
        setLoading(false);
        return;
      }

      const { data } = supabase.storage.from('container-photos').getPublicUrl(filePath);
      photoUrl = data.publicUrl;
    }

    // Update in Supabase
    const { error } = await supabase
      .from('containers')
      .update({
        container_code: form.container_code.trim(),
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        country: form.country,
        province: form.province || null,
        city: form.city || null,
        address: form.address || null,
        latitude: form.latitude,
        longitude: form.longitude,
        deployed_date: form.deployed_date || null,
        purchase_date: form.purchase_date || null,
        cost: form.cost ? parseFloat(form.cost) : null,
        assigned_contractor: form.assigned_contractor || null,
        tags: tags.length > 0 ? tags.join(',') : null,
        photo_url: photoUrl,
        notes: form.notes || null,
      })
      .eq('id', container.id);

    setLoading(false);

    if (error) {
      console.error('Update error:', error);
      setErrors({ submit: 'Failed to update container.' });
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
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col relative">
        
        {/* Success Toast */}
        {showSuccess && (
          <div className="absolute top-6 right-6 bg-green-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-xl z-50">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Container updated successfully!</span>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-3xl font-black tracking-[-1.5px]">Edit Container</h2>
            <p className="text-slate-500 mt-1">Update container details and location</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            
            {/* Left Column - Form */}
            <div className="lg:col-span-3 space-y-8">
              
              {/* Basic Information */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-lg">Basic Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">CONTAINER CODE</label>
                    <input type="text" value={form.container_code} onChange={(e) => setForm({ ...form, container_code: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">NAME</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">TYPE</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                      {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">STATUS</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                      {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-lg">Location</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">CONTINENT</label>
                    <select value={form.continent} onChange={(e) => setForm({ ...form, continent: e.target.value })} className="input">
                      {continents.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">COUNTRY</label>
                    <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input">
                      {availableCountries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">PROVINCE</label>
                    <select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="input">
                      <option value="">Select Province</option>
                      {availableProvinces.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">CITY</label>
                    <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">ADDRESS</label>
                    <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" />
                  </div>
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-lg">Container Photo</h3>
                </div>
                {photoPreview ? (
                  <div className="relative w-full h-48 rounded-3xl overflow-hidden border border-slate-200">
                    <img src={photoPreview} alt="Container" className="w-full h-full object-cover" />
                    <button onClick={removePhoto} className="absolute top-3 right-3 bg-black/70 text-white px-3 py-1 rounded-2xl text-sm flex items-center gap-1 hover:bg-black">
                      <X className="w-4 h-4" /> Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-3xl cursor-pointer hover:border-slate-400 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="w-10 h-10 text-slate-400 mb-3" />
                      <p className="text-sm text-slate-500">Click to upload new photo</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                  </label>
                )}
              </div>

              {/* Contractor Assignment */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-lg">Contractor Assignment</h3>
                </div>
                <input
                  type="text"
                  placeholder="Contractor name or ID"
                  value={form.assigned_contractor}
                  onChange={(e) => setForm({ ...form, assigned_contractor: e.target.value })}
                  className="input"
                />
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-lg">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                  {tags.map((tag, index) => (
                    <div key={index} className="flex items-center bg-slate-100 text-slate-700 px-3 py-1 rounded-2xl text-sm">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-2 text-slate-400 hover:text-red-500">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add tag and press Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    className="input flex-1"
                  />
                  <button onClick={addTag} className="px-6 py-3 rounded-3xl bg-slate-900 text-white text-sm font-medium">Add</button>
                </div>
              </div>

              {/* Financial & Dates */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-lg">Financial & Dates</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">PURCHASE DATE</label>
                    <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">DEPLOYED DATE</label>
                    <input type="date" value={form.deployed_date} onChange={(e) => setForm({ ...form, deployed_date: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-widest text-slate-500 block mb-1.5">COST (ZAR)</label>
                    <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-lg">Notes</h3>
                </div>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input min-h-[120px] resize-y"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Right Column - Map */}
            <div className="lg:col-span-2">
              <div className="sticky top-0">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Update Location on Map
                  </span>
                  <div className="flex bg-slate-100 rounded-2xl p-1">
                    <button onClick={() => setMapLayer('street')} className={`px-4 py-1.5 rounded-xl text-sm transition-all ${mapLayer === 'street' ? 'bg-white shadow' : ''}`}>
                      Street
                    </button>
                    <button onClick={() => setMapLayer('satellite')} className={`px-4 py-1.5 rounded-xl text-sm transition-all ${mapLayer === 'satellite' ? 'bg-white shadow' : ''}`}>
                      Satellite
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl overflow-hidden border border-slate-200 h-[420px]">
                  <LocationMap
                    onMapClick={handleMapClick}
                    selectedPosition={selectedPosition}
                    layer={mapLayer}
                  />
                </div>

                {form.latitude && form.longitude && (
                  <div className="mt-3 text-xs text-slate-500 font-mono">
                    Lat: {form.latitude.toFixed(6)} &nbsp;|&nbsp; Lng: {form.longitude.toFixed(6)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-8 py-6 border-t bg-slate-50 flex-shrink-0">
          <button onClick={onClose} className="px-8 py-3 rounded-3xl border border-slate-300 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary px-10 disabled:opacity-70"
          >
            {loading ? 'Updating Container...' : 'Update Container'}
          </button>
        </div>

        {errors.submit && (
          <div className="px-8 py-3 bg-red-50 text-red-600 text-sm border-t">
            {errors.submit}
          </div>
        )}
      </div>
    </div>
  );
}