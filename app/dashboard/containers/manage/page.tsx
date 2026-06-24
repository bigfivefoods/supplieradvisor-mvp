'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Plus, Edit2, Trash2, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';

const supabase = createClient();

interface Container {
  id: number;
  container_code: string;
  name: string | null;
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
  notes: string | null;
  photo_url: string | null;
  is_active: boolean | null;
  created_at: string;
  contractor?: {
    id: number;
    full_name: string;
  } | null;
}

interface Contractor {
  id: number;
  full_name: string;
  container_id: number | null;
}

type SortKey = 'container_code' | 'status' | 'deployed_date' | 'city';

export default function ContainerManagePage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>(['active', 'deployed', 'in_transit', 'maintenance', 'retired']);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [contractorFilter, setContractorFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'created_at' as any,
    direction: 'desc',
  });

  const [showModal, setShowModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    container_code: '',
    name: '',
    type: '40ft',
    status: 'active',
    country: '',
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

  const [selectedContractorId, setSelectedContractorId] = useState<string>('');

  const fetchContainers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('containers')
      .select(`
        *,
        contractor:contractors!container_id (id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setContainers(data as any || []);
    setLoading(false);
  };

  const fetchContractors = async () => {
    const { data } = await supabase.from('contractors').select('id, full_name, container_id').order('full_name');
    setContractors(data || []);
  };

  useEffect(() => {
    fetchContainers();
    fetchContractors();
  }, []);

  // Filtered + Sorted Data
  const filteredContainers = useMemo(() => {
    let result = [...containers];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.container_code.toLowerCase().includes(term) ||
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.city && c.city.toLowerCase().includes(term))
      );
    }

    // Status
    result = result.filter(c => statusFilters.includes(c.status || ''));

    // Active / Inactive
    if (activeFilter === 'active') result = result.filter(c => c.is_active === true);
    if (activeFilter === 'inactive') result = result.filter(c => c.is_active === false);

    // Contractor
    if (contractorFilter === 'assigned') result = result.filter(c => c.contractor);
    if (contractorFilter === 'unassigned') result = result.filter(c => !c.contractor);

    // Sorting
    result.sort((a, b) => {
      let valA: any = a[sortConfig.key as keyof Container];
      let valB: any = b[sortConfig.key as keyof Container];

      if (sortConfig.key === 'deployed_date') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [containers, searchTerm, statusFilters, activeFilter, contractorFilter, sortConfig]);

  const toggleStatusFilter = (status: string) => {
    if (statusFilters.includes(status)) {
      setStatusFilters(statusFilters.filter(s => s !== status));
    } else {
      setStatusFilters([...statusFilters, status]);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  // Modal Functions
  const openCreateModal = () => {
    setEditingContainer(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (container: Container) => {
    setEditingContainer(container);
    setForm({
      container_code: container.container_code || '',
      name: container.name || '',
      type: container.type || '40ft',
      status: container.status || 'active',
      country: container.country || '',
      province: container.province || '',
      city: container.city || '',
      address: container.address || '',
      latitude: container.latitude?.toString() || '',
      longitude: container.longitude?.toString() || '',
      deployed_date: container.deployed_date || '',
      purchase_date: container.purchase_date || '',
      cost: container.cost?.toString() || '',
      notes: container.notes || '',
      photo_url: container.photo_url || '',
      is_active: container.is_active ?? true,
    });
    setImagePreview(container.photo_url);

    const current = contractors.find(c => c.container_id === container.id);
    setSelectedContractorId(current ? current.id.toString() : '');
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({
      container_code: '',
      name: '',
      type: '40ft',
      status: 'active',
      country: '',
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
    setSelectedFile(null);
    setImagePreview(null);
    setSelectedContractorId('');
    setEditingContainer(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!selectedFile) return null;
    setUploading(true);
    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `container-${Date.now()}.${fileExt}`;
    const filePath = `container-photos/${fileName}`;

    const { error } = await supabase.storage.from('container-photos').upload(filePath, selectedFile);
    if (error) {
      alert('Photo upload failed');
      setUploading(false);
      return null;
    }
    const { data } = supabase.storage.from('container-photos').getPublicUrl(filePath);
    setUploading(false);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!form.container_code) {
      alert('Container Code is required');
      return;
    }

    let photoUrl = form.photo_url;
    if (selectedFile) {
      const uploaded = await uploadPhoto();
      if (uploaded) photoUrl = uploaded;
    }

    const payload: any = {
      container_code: form.container_code,
      name: form.name || null,
      type: form.type,
      status: form.status,
      country: form.country || null,
      province: form.province || null,
      city: form.city || null,
      address: form.address || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      deployed_date: form.deployed_date || null,
      purchase_date: form.purchase_date || null,
      cost: form.cost ? parseFloat(form.cost) : null,
      notes: form.notes || null,
      photo_url: photoUrl || null,
      is_active: form.is_active,
    };

    let containerId = editingContainer?.id;

    if (editingContainer) {
      const { error } = await supabase.from('containers').update(payload).eq('id', editingContainer.id);
      if (error) { alert('Update failed: ' + error.message); return; }
      containerId = editingContainer.id;
    } else {
      const { data, error } = await supabase.from('containers').insert(payload).select('id').single();
      if (error) { alert('Create failed: ' + error.message); return; }
      containerId = data.id;
    }

    // Contractor Assignment
    if (containerId) {
      await supabase.from('contractors').update({ container_id: null }).eq('container_id', containerId);
      if (selectedContractorId) {
        await supabase.from('contractors').update({ container_id: containerId }).eq('id', parseInt(selectedContractorId));
      }
    }

    setShowModal(false);
    resetForm();
    fetchContainers();
    fetchContractors();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this container? This cannot be undone.')) return;
    await supabase.from('contractors').update({ container_id: null }).eq('container_id', id);
    const { error } = await supabase.from('containers').delete().eq('id', id);
    if (error) alert('Delete failed: ' + error.message);
    else fetchContainers();
  };

  const getStatusColor = (status: string | null) => {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'deployed') return 'bg-blue-100 text-blue-700';
    if (status === 'in_transit') return 'bg-amber-100 text-amber-700';
    if (status === 'maintenance') return 'bg-orange-100 text-orange-700';
    return 'bg-neutral-200 text-neutral-600';
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/containers" className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to Container Hub
          </Link>
          <h1 className="font-black text-5xl tracking-[-2px]">Manage Containers</h1>
          <p className="text-xl text-neutral-600">Full CRUD • Filters • Contractor Assignment</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary px-6 py-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Container
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-medium block mb-1.5">Search</label>
            <input
              type="text"
              placeholder="Search code, name or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-neutral-200 rounded-2xl px-4 py-2.5 text-sm"
            />
          </div>

          {/* Status Checkboxes */}
          <div>
            <label className="text-xs font-medium block mb-1.5">Status</label>
            <div className="flex flex-wrap gap-2 text-sm">
              {['active', 'deployed', 'in_transit', 'maintenance', 'retired'].map((status) => (
                <label key={status} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(status)}
                    onChange={() => toggleStatusFilter(status)}
                    className="accent-neutral-900"
                  />
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Active Filter */}
          <div>
            <label className="text-xs font-medium block mb-1.5">Active Status</label>
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)} className="border border-neutral-200 rounded-2xl px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Contractor Filter */}
          <div>
            <label className="text-xs font-medium block mb-1.5">Contractor</label>
            <select value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value as any)} className="border border-neutral-200 rounded-2xl px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Loading containers...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th onClick={() => handleSort('container_code')} className="px-8 py-4 text-left font-semibold cursor-pointer hover:bg-neutral-100">
                  Container {getSortIcon('container_code')}
                </th>
                <th className="px-6 py-4 text-left font-semibold">Type</th>
                <th onClick={() => handleSort('status')} className="px-6 py-4 text-left font-semibold cursor-pointer hover:bg-neutral-100">
                  Status {getSortIcon('status')}
                </th>
                <th className="px-6 py-4 text-left font-semibold">Contractor</th>
                <th onClick={() => handleSort('city')} className="px-6 py-4 text-left font-semibold cursor-pointer hover:bg-neutral-100">
                  Location {getSortIcon('city')}
                </th>
                <th onClick={() => handleSort('deployed_date')} className="px-6 py-4 text-left font-semibold cursor-pointer hover:bg-neutral-100">
                  Deployed {getSortIcon('deployed_date')}
                </th>
                <th className="px-8 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredContainers.length > 0 ? (
                filteredContainers.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-8 py-5">
                      <div className="font-semibold">{c.container_code}</div>
                      {c.name && <div className="text-sm text-neutral-500">{c.name}</div>}
                    </td>
                    <td className="px-6 py-5 capitalize">{c.type}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                          {c.status}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm">
                      {c.contractor ? (
                        <span className="font-medium">{c.contractor.full_name}</span>
                      ) : (
                        <span className="text-neutral-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm text-neutral-600">
                      {[c.city, c.province].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-6 py-5 text-sm text-neutral-600">
                      {c.deployed_date ? new Date(c.deployed_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-8 py-5 text-right space-x-4">
                      <button onClick={() => openEditModal(c)} className="text-neutral-600 hover:text-black">
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-neutral-500">No containers match your current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detailed Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-8 my-8">
            <h2 className="font-bold text-3xl tracking-tight mb-8">
              {editingContainer ? 'Edit Container' : 'Create New Container'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {/* Container Code */}
              <div>
                <label className="text-xs font-medium block mb-1.5">Container Code *</label>
                <input type="text" value={form.container_code} onChange={(e) => setForm({ ...form, container_code: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" placeholder="CONT-2026-0042" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Display Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>

              {/* Type & Status */}
              <div>
                <label className="text-xs font-medium block mb-1.5">Container Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm">
                  <option value="20ft">20ft Standard</option>
                  <option value="40ft">40ft Standard</option>
                  <option value="40ft_hc">40ft High Cube</option>
                  <option value="reefer">Reefer (Refrigerated)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm">
                  <option value="active">Active</option>
                  <option value="deployed">Deployed</option>
                  <option value="in_transit">In Transit</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              {/* Location */}
              <div className="md:col-span-2">
                <label className="text-xs font-medium block mb-1.5">Full Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">City / Town</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Province / State</label>
                <input type="text" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Country</label>
                <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>

              {/* GPS */}
              <div>
                <label className="text-xs font-medium block mb-1.5">Latitude</label>
                <input type="text" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" placeholder="-29.1234" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Longitude</label>
                <input type="text" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" placeholder="30.5678" />
              </div>

              {/* Dates & Cost */}
              <div>
                <label className="text-xs font-medium block mb-1.5">Purchase Date</label>
                <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Deployed Date</label>
                <input type="date" value={form.deployed_date} onChange={(e) => setForm({ ...form, deployed_date: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Purchase Cost (ZAR)</label>
                <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                  Active Container
                </label>
              </div>

              {/* Contractor Assignment */}
              <div className="md:col-span-2">
                <label className="text-xs font-medium block mb-1.5">Assign Independent Contractor</label>
                <select
                  value={selectedContractorId}
                  onChange={(e) => setSelectedContractorId(e.target.value)}
                  className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm"
                >
                  <option value="">— Unassigned —</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.container_id && c.container_id !== editingContainer?.id ? ' (Already assigned)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="text-xs font-medium block mb-1.5">Notes / Comments</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm h-24" />
              </div>

              {/* Photo Upload */}
              <div className="md:col-span-2">
                <label className="text-xs font-medium block mb-1.5">Container Photo</label>
                {!imagePreview ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-2xl p-8 cursor-pointer hover:border-neutral-400">
                    <span className="text-sm text-neutral-600">Click to upload photo</span>
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  </label>
                ) : (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-56 object-cover rounded-2xl border" />
                    <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute top-3 right-3 bg-white rounded-full px-3 py-1 text-sm shadow">Remove Photo</button>
                  </div>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-8">
              <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-3.5 rounded-2xl border border-neutral-200 font-medium">Cancel</button>
              <button onClick={handleSubmit} disabled={uploading} className="flex-1 py-3.5 rounded-2xl bg-neutral-900 text-white font-medium disabled:opacity-60">
                {uploading ? 'Uploading photo...' : editingContainer ? 'Save Changes' : 'Create Container'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}