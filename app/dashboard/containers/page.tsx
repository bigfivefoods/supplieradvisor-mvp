'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface Container {
  id: number;
  container_id: string;
  name: string;
  country: string | null;
  province: string | null;
  suburb: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  wifi_portal_url: string | null;
  status: string;
  business_id: number;
}

interface Business {
  id: number;
  legal_name: string;
  trading_name: string | null;
}

export default function ContainersPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);

  const [form, setForm] = useState({
    container_id: '',
    name: '',
    business_id: '',
    country: '',
    province: '',
    suburb: '',
    address: '',
    latitude: '',
    longitude: '',
    wifi_portal_url: '',
    status: 'active',
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: containersData } = await supabase
        .from('containers')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: businessesData } = await supabase
        .from('profiles')
        .select('id, legal_name, trading_name');

      if (containersData) setContainers(containersData);
      if (businessesData) setBusinesses(businessesData);

      setLoading(false);
    };

    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingContainer(null);
    setForm({
      container_id: '',
      name: '',
      business_id: '',
      country: '',
      province: '',
      suburb: '',
      address: '',
      latitude: '',
      longitude: '',
      wifi_portal_url: '',
      status: 'active',
    });
    setShowModal(true);
  };

  const openEditModal = (container: Container) => {
    setEditingContainer(container);
    setForm({
      container_id: container.container_id,
      name: container.name,
      business_id: container.business_id.toString(),
      country: container.country || '',
      province: container.province || '',
      suburb: container.suburb || '',
      address: container.address || '',
      latitude: container.latitude?.toString() || '',
      longitude: container.longitude?.toString() || '',
      wifi_portal_url: container.wifi_portal_url || '',
      status: container.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const containerData = {
      container_id: form.container_id,
      name: form.name,
      business_id: Number(form.business_id),
      country: form.country || null,
      province: form.province || null,
      suburb: form.suburb || null,
      address: form.address || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      wifi_portal_url: form.wifi_portal_url || null,
      status: form.status,
    };

    if (editingContainer) {
      const { error } = await supabase
        .from('containers')
        .update(containerData)
        .eq('id', editingContainer.id);

      if (error) {
        toast.error('Failed to update container');
      } else {
        toast.success('Container updated successfully');
        setShowModal(false);
        window.location.reload();
      }
    } else {
      const { error } = await supabase.from('containers').insert([containerData]);

      if (error) {
        toast.error('Failed to create container');
      } else {
        toast.success('Container created successfully');
        setShowModal(false);
        window.location.reload();
      }
    }
  };

  if (loading) {
    return <div className="p-12">Loading containers...</div>;
  }

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Containers</h1>
          <p className="text-neutral-600 mt-1">Manage your physical container spaza locations</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus size={20} /> Add New Container
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-6 py-4 font-semibold">Container ID</th>
              <th className="text-left px-6 py-4 font-semibold">Name</th>
              <th className="text-left px-6 py-4 font-semibold">Location</th>
              <th className="text-left px-6 py-4 font-semibold">Status</th>
              <th className="text-right px-6 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.length > 0 ? (
              containers.map((container) => (
                <tr key={container.id} className="border-t hover:bg-neutral-50">
                  <td className="px-6 py-4 font-medium">{container.container_id}</td>
                  <td className="px-6 py-4">{container.name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {[container.suburb, container.province].filter(Boolean).join(', ')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      container.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {container.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => openEditModal(container)} 
                      className="p-2 hover:bg-neutral-100 rounded-xl"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                  No containers found. Click "Add New Container" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8">
            <h2 className="text-2xl font-bold mb-6">
              {editingContainer ? 'Edit Container' : 'Add New Container'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium">Container ID *</label>
                  <input 
                    type="text" 
                    className="input w-full mt-1" 
                    value={form.container_id} 
                    onChange={e => setForm({...form, container_id: e.target.value})} 
                    required 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Container Name *</label>
                  <input 
                    type="text" 
                    className="input w-full mt-1" 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Linked Business *</label>
                <select 
                  className="input w-full mt-1" 
                  value={form.business_id} 
                  onChange={e => setForm({...form, business_id: e.target.value})} 
                  required
                >
                  <option value="">Select Business</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.legal_name} {b.trading_name && `(${b.trading_name})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium">Country</label>
                  <input type="text" className="input w-full mt-1" value={form.country} onChange={e => setForm({...form, country: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Province</label>
                  <input type="text" className="input w-full mt-1" value={form.province} onChange={e => setForm({...form, province: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Suburb</label>
                  <input type="text" className="input w-full mt-1" value={form.suburb} onChange={e => setForm({...form, suburb: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Full Address</label>
                <input type="text" className="input w-full mt-1" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium">Latitude</label>
                  <input type="text" className="input w-full mt-1" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Longitude</label>
                  <input type="text" className="input w-full mt-1" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">WiFi Portal URL (Optional)</label>
                <input type="text" className="input w-full mt-1" value={form.wifi_portal_url} onChange={e => setForm({...form, wifi_portal_url: e.target.value})} />
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 border rounded-2xl hover:bg-neutral-50">
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-8 py-3">
                  {editingContainer ? 'Update Container' : 'Create Container'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}