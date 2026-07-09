'use client';

import React, { useEffect, useState } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContractorRecord } from '@/lib/containers/types';

const LocationMap = dynamic(() => import('@/components/LocationMap'), { ssr: false });

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
  contractor_id?: number | null;
}

interface EditContainerFormProps {
  container: Container;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditContainerForm({ container, onClose, onSuccess }: EditContainerFormProps) {
  const companyId = getSelectedCompanyId();
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    container_code: container.container_code || '',
    name: container.name || '',
    type: container.type || 'Retail',
    status: container.status || 'active',
    country: container.country || 'South Africa',
    province: container.province || '',
    city: container.city || '',
    address: container.address || '',
    latitude: container.latitude?.toString() || '',
    longitude: container.longitude?.toString() || '',
    deployed_date: container.deployed_date || '',
    purchase_date: container.purchase_date || '',
    cost: container.cost != null ? String(container.cost) : '',
    contractor_id: container.contractor_id ? String(container.contractor_id) : '',
    assigned_contractor: container.assigned_contractor || '',
    notes: container.notes || '',
    photo_url: container.photo_url || '',
    tags: container.tags || '',
  });

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/containers/contractors?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setContractors(d.contractors || []))
      .catch(() => {});
  }, [companyId]);

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const contractor = contractors.find((c) => String(c.id) === form.contractor_id);
    try {
      const res = await fetch(`/api/containers/${container.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contractor_id: form.contractor_id || null,
          assigned_contractor: contractor?.full_name || form.assigned_contractor || null,
          tags: form.tags,
          cost: form.cost || null,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          profile_id: companyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success('Container updated');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#00b4d8]">Edit container</h2>
            <p className="text-sm text-neutral-500">{container.container_code}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Code *</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.container_code} onChange={(e) => set('container_code', e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="input mt-1 w-full !p-3 !text-base" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input className="input mt-1 w-full !p-3 !text-base" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Contractor</label>
              <select className="input mt-1 w-full !p-3 !text-base" value={form.contractor_id} onChange={(e) => set('contractor_id', e.target.value)}>
                <option value="">Unassigned</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">City</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.city} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Province</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.province} onChange={(e) => set('province', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <input className="input mt-1 w-full !p-3 !text-base" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Tags (comma separated)</label>
              <input className="input mt-1 w-full !p-3 !text-base" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="spaza, rural, pilot" />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea className="input mt-1 w-full !p-3 !text-base min-h-[80px]" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="w-4 h-4 text-[#00b4d8]" /> Location
            </div>
            <div className="h-72 rounded-3xl overflow-hidden border">
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
                height="100%"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Latitude</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Longitude</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 !py-3">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 !py-3">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
