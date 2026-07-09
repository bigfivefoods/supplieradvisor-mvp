'use client';

import React, { useEffect, useState } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContractorRecord } from '@/lib/containers/types';

const LocationMap = dynamic(() => import('./LocationMap'), { ssr: false });

interface AddContainerFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddContainerForm({ onClose, onSuccess }: AddContainerFormProps) {
  const companyId = getSelectedCompanyId();
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    container_code: '',
    name: '',
    type: 'Retail',
    status: 'active',
    container_type: '40ft',
    country: 'South Africa',
    province: '',
    city: '',
    address: '',
    latitude: '' as string | number,
    longitude: '' as string | number,
    deployed_date: '',
    purchase_date: '',
    cost: '',
    contractor_id: '',
    assigned_contractor: '',
    notes: '',
    photo_url: '',
    monthly_target: '',
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
    if (!companyId) {
      toast.error('Select a company first');
      return;
    }
    if (!form.container_code || !form.name) {
      toast.error('Code and name are required');
      return;
    }

    setLoading(true);
    const contractor = contractors.find((c) => String(c.id) === form.contractor_id);
    try {
      const res = await fetch('/api/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...form,
          contractor_id: form.contractor_id || null,
          assigned_contractor: contractor?.full_name || form.assigned_contractor || null,
          cost: form.cost || null,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          monthly_target: form.monthly_target || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      toast.success('Container created');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#00b4d8]">Add retail container</h2>
            <p className="text-sm text-neutral-500">Outlet location, contractor, and operating details</p>
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
                <input className="input mt-1 w-full !p-3 !text-base" value={form.container_code} onChange={(e) => set('container_code', e.target.value)} placeholder="C-JHB-001" required />
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
              <label className="text-sm font-medium">Display name *</label>
              <input className="input mt-1 w-full !p-3 !text-base" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nongoma Spaza 03" required />
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
                <select className="input mt-1 w-full !p-3 !text-base" value={form.container_type} onChange={(e) => set('container_type', e.target.value)}>
                  <option value="20ft">20ft</option>
                  <option value="40ft">40ft</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Appoint contractor</label>
              <select
                className="input mt-1 w-full !p-3 !text-base"
                value={form.contractor_id}
                onChange={(e) => set('contractor_id', e.target.value)}
              >
                <option value="">Unassigned — appoint later</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.training_status ? `(${c.training_status})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Manage contractors under Containers → Contractors
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Country</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.country} onChange={(e) => set('country', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Province</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.province} onChange={(e) => set('province', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <input className="input mt-1 w-full !p-3 !text-base" value={form.city} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Monthly target (R)</label>
                <input className="input mt-1 w-full !p-3 !text-base" type="number" value={form.monthly_target} onChange={(e) => set('monthly_target', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Street address</label>
              <input className="input mt-1 w-full !p-3 !text-base" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea className="input mt-1 w-full !p-3 !text-base min-h-[80px]" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin className="w-4 h-4 text-[#00b4d8]" />
              Pin location on map
            </div>
            <div className="h-72 rounded-3xl overflow-hidden border border-neutral-200">
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
              <button type="button" onClick={onClose} className="btn-secondary flex-1 !py-3">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 !py-3 disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create container'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
