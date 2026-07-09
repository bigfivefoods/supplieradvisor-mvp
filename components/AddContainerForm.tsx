'use client';

import React, { useEffect, useState } from 'react';
import { X, MapPin, Loader2, Upload, UserPlus, Info } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContractorRecord } from '@/lib/containers/types';
import GeoSelectFields, { type GeoValue } from '@/components/geo/GeoSelectFields';
import { uploadContainerPhoto } from '@/lib/containers/uploadPhoto';

const LocationMap = dynamic(() => import('./LocationMap'), { ssr: false });

interface AddContainerFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddContainerForm({ onClose, onSuccess }: AddContainerFormProps) {
  const companyId = getSelectedCompanyId();
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showQuickContractor, setShowQuickContractor] = useState(false);
  const [quickContractor, setQuickContractor] = useState({ full_name: '', email: '', phone: '' });

  const [geo, setGeo] = useState<GeoValue>({
    continent: 'Africa',
    country: 'South Africa',
    province: '',
    city: '',
  });

  const [form, setForm] = useState({
    container_code: '',
    name: '',
    type: 'Retail',
    status: 'active',
    container_type: '40ft',
    address: '',
    latitude: '' as string | number,
    longitude: '' as string | number,
    deployed_date: '',
    purchase_date: '',
    cost: '',
    contractor_id: '',
    notes: '',
    monthly_target: '',
  });

  const loadContractors = async () => {
    if (!companyId) return;
    const res = await fetch(`/api/containers/contractors?companyId=${companyId}`);
    const d = await res.json();
    setContractors(d.contractors || []);
  };

  useEffect(() => {
    void loadContractors();
  }, [companyId]);

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8MB');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const appointQuickContractor = async () => {
    if (!companyId || !quickContractor.full_name.trim()) {
      toast.error('Contractor name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/containers/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          full_name: quickContractor.full_name,
          email: quickContractor.email || null,
          phone: quickContractor.phone || null,
          training_status: 'pending',
          status: 'active',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to appoint contractor');
      toast.success('Contractor appointed');
      await loadContractors();
      setForm((p) => ({ ...p, contractor_id: String(data.contractor.id) }));
      setShowQuickContractor(false);
      setQuickContractor({ full_name: '', email: '', phone: '' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('Select a company first');
      return;
    }
    if (!form.container_code || !form.name) {
      toast.error('Code and name are required');
      return;
    }
    if (!geo.country) {
      toast.error('Please select a country');
      return;
    }

    setLoading(true);
    try {
      let photo_url: string | null = null;
      if (photoFile) {
        setUploading(true);
        const uploaded = await uploadContainerPhoto(photoFile, companyId, form.container_code);
        setUploading(false);
        if (!uploaded.url) {
          toast.error(uploaded.error || 'Photo upload failed');
          setLoading(false);
          return;
        }
        photo_url = uploaded.url;
      }

      const contractor = contractors.find((c) => String(c.id) === form.contractor_id);
      const res = await fetch('/api/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          container_code: form.container_code,
          name: form.name,
          type: form.type,
          status: form.status,
          container_type: form.container_type,
          continent: geo.continent || null,
          country: geo.country,
          province: geo.province || null,
          city: geo.city || null,
          address: form.address || null,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          deployed_date: form.deployed_date || null,
          purchase_date: form.purchase_date || null,
          cost: form.cost || null,
          contractor_id: form.contractor_id || null,
          assigned_contractor: contractor?.full_name || null,
          notes: form.notes || null,
          monthly_target: form.monthly_target || null,
          photo_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      toast.success(
        form.contractor_id
          ? 'Container created and contractor assigned'
          : 'Container created — you can assign a contractor anytime'
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#00b4d8]">Add retail container</h2>
            <p className="text-sm text-neutral-500">
              Create the outlet first — contractor is optional (assign now or later)
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-sm text-blue-900 flex gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                You do <strong>not</strong> need a contractor first. Create the container with location &amp; photo,
                then appoint an independent contractor here or under Contractors.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Code *</label>
                <input
                  className="input mt-1 w-full !p-3 !text-base"
                  value={form.container_code}
                  onChange={(e) => set('container_code', e.target.value)}
                  placeholder="C-JHB-001"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="input mt-1 w-full !p-3 !text-base"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="pending">Pending deploy</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Display name *</label>
              <input
                className="input mt-1 w-full !p-3 !text-base"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Nongoma Spaza 03"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Outlet type</label>
                <select className="input mt-1 w-full !p-3 !text-base" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  <option>Retail</option>
                  <option>Hub</option>
                  <option>Distribution</option>
                  <option>Storage</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Container size</label>
                <select
                  className="input mt-1 w-full !p-3 !text-base"
                  value={form.container_type}
                  onChange={(e) => set('container_type', e.target.value)}
                >
                  <option value="20ft">20ft</option>
                  <option value="40ft">40ft</option>
                  <option value="custom">Custom build</option>
                </select>
              </div>
            </div>

            {/* Contractor */}
            <div className="rounded-2xl border border-neutral-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-slate-900">Independent contractor</label>
                <button
                  type="button"
                  onClick={() => setShowQuickContractor((v) => !v)}
                  className="text-xs font-medium text-[#00b4d8] inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {showQuickContractor ? 'Cancel' : 'Appoint new'}
                </button>
              </div>
              <select
                className="input w-full !p-3 !text-base"
                value={form.contractor_id}
                onChange={(e) => set('contractor_id', e.target.value)}
              >
                <option value="">Leave unassigned (assign later)</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.training_status ? ` · ${c.training_status}` : ''}
                  </option>
                ))}
              </select>

              {showQuickContractor && (
                <div className="bg-neutral-50 rounded-2xl p-3 space-y-2 border border-neutral-100">
                  <input
                    className="input w-full !p-2.5 !text-sm"
                    placeholder="Full name *"
                    value={quickContractor.full_name}
                    onChange={(e) => setQuickContractor({ ...quickContractor, full_name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input !p-2.5 !text-sm"
                      placeholder="Email"
                      value={quickContractor.email}
                      onChange={(e) => setQuickContractor({ ...quickContractor, email: e.target.value })}
                    />
                    <input
                      className="input !p-2.5 !text-sm"
                      placeholder="Phone"
                      value={quickContractor.phone}
                      onChange={(e) => setQuickContractor({ ...quickContractor, phone: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void appointQuickContractor()}
                    disabled={loading}
                    className="btn-secondary w-full !py-2 text-sm"
                  >
                    Save contractor &amp; select
                  </button>
                </div>
              )}
            </div>

            {/* Geo from Supabase */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Location (from Supabase)</h3>
              <GeoSelectFields value={geo} onChange={setGeo} />
            </div>

            <div>
              <label className="text-sm font-medium">Street address</label>
              <input
                className="input mt-1 w-full !p-3 !text-base"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Street / landmark"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea
                className="input mt-1 w-full !p-3 !text-base min-h-[72px]"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-5">
            {/* Photo */}
            <div>
              <label className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-[#00b4d8]" /> Container photo
              </label>
              <div className="border-2 border-dashed border-neutral-200 rounded-3xl p-4 text-center hover:border-[#00b4d8]/50 transition-colors">
                {photoPreview ? (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Container preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block py-8">
                    <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                    <span className="text-sm text-neutral-600">Click to upload image (JPG/PNG, max 8MB)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
                  </label>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">Stored in Supabase Storage → saved as photo_url on the container</p>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin className="w-4 h-4 text-[#00b4d8]" />
              Pin GPS on map
            </div>
            <p className="text-xs text-neutral-500 -mt-3">
              Click the map to drop a pin — latitude and longitude fill in automatically.
            </p>
            <div className="relative z-0 h-72 min-h-[288px] w-full rounded-3xl overflow-hidden border border-neutral-200 bg-slate-100 isolate">
              <LocationMap
                onMapClick={(lat, lng) => {
                  setForm((p) => ({
                    ...p,
                    latitude: lat.toFixed(6),
                    longitude: lng.toFixed(6),
                  }));
                }}
                selectedPosition={
                  form.latitude && form.longitude
                    ? [Number(form.latitude), Number(form.longitude)]
                    : null
                }
                center={[-29.0, 24.5]}
                zoom={5}
                height="288px"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Latitude</label>
                <input
                  className="input mt-1 w-full !p-3 !text-base"
                  value={form.latitude}
                  onChange={(e) => set('latitude', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Longitude</label>
                <input
                  className="input mt-1 w-full !p-3 !text-base"
                  value={form.longitude}
                  onChange={(e) => set('longitude', e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 !py-3">
                Cancel
              </button>
              <button type="submit" disabled={loading || uploading} className="btn-primary flex-1 !py-3 disabled:opacity-60">
                {loading || uploading ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploading ? 'Uploading photo…' : 'Saving…'}
                  </span>
                ) : (
                  'Create container'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
