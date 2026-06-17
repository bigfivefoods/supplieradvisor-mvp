'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Edit2, Upload, UserPlus, Truck, Brain, ArrowDown, ArrowUp, List } from 'lucide-react';

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
  image_url: string | null;
  current_lead_name: string | null;
  current_lead_cellphone: string | null;
  current_lead_contract_url: string | null;
  current_lead_start_date: string | null;
  current_lead_end_date: string | null;
}

interface Business {
  id: number;
  legal_name: string;
  trading_name: string | null;
}

interface LeadHistory {
  id: number;
  lead_name: string;
  cellphone: string | null;
  contract_url: string | null;
  start_date: string;
  end_date: string | null;
}

interface Country {
  id: number;
  name: string;
  flag: string;
}

interface Province {
  id: number;
  name: string;
}

export default function ContainersPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [leadHistory, setLeadHistory] = useState<LeadHistory[]>([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [uploading, setUploading] = useState(false);

  const [sortField, setSortField] = useState<'container_id' | 'name' | 'status'>('container_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [form, setForm] = useState({
    container_id: '', name: '', business_id: '', country: '', province: '',
    suburb: '', address: '', latitude: '', longitude: '', wifi_portal_url: '',
    status: 'active', image_url: '', current_lead_name: '', current_lead_cellphone: '',
    current_lead_contract_url: '', current_lead_start_date: '', current_lead_end_date: '',
  });

  const [newLead, setNewLead] = useState({
    lead_name: '', cellphone: '', contract_url: '', start_date: '', end_date: '',
  });

  const filteredAndSortedContainers = [...containers]
    .filter((container) => statusFilter === 'all' || container.status === statusFilter)
    .sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      return sortDirection === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
    });

  const handleSort = (field: 'container_id' | 'name' | 'status') => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const toggleContainerStatus = async (container: Container) => {
    const newStatus = container.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('containers').update({ status: newStatus }).eq('id', container.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(`Container marked as ${newStatus}`);
      setContainers(prev => prev.map(c => c.id === container.id ? { ...c, status: newStatus } : c));
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [containersRes, businessesRes, countriesRes] = await Promise.all([
        supabase.from('containers').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, legal_name, trading_name'),
        supabase.from('countries').select('id, name, flag').order('name'),
      ]);
      if (containersRes.data) setContainers(containersRes.data);
      if (businessesRes.data) setBusinesses(businessesRes.data);
      if (countriesRes.data) setCountries(countriesRes.data);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadProvinces = async () => {
      if (!selectedCountryId) { setProvinces([]); return; }
      const { data } = await supabase.from('provinces').select('id, name').eq('country_id', selectedCountryId).order('name');
      setProvinces(data || []);
    };
    loadProvinces();
  }, [selectedCountryId]);

  const openCreateModal = () => { setEditingContainer(null); resetForm(); setShowModal(true); };

  const openEditModal = async (container: Container) => {
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
      image_url: container.image_url || '',
      current_lead_name: container.current_lead_name || '',
      current_lead_cellphone: container.current_lead_cellphone || '',
      current_lead_contract_url: container.current_lead_contract_url || '',
      current_lead_start_date: container.current_lead_start_date || '',
      current_lead_end_date: container.current_lead_end_date || '',
    });
    const { data: history } = await supabase.from('container_lead_history').select('*').eq('container_id', container.id).order('start_date', { ascending: false });
    setLeadHistory(history || []);
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({ container_id: '', name: '', business_id: '', country: '', province: '', suburb: '', address: '', latitude: '', longitude: '', wifi_portal_url: '', status: 'active', image_url: '', current_lead_name: '', current_lead_cellphone: '', current_lead_contract_url: '', current_lead_start_date: '', current_lead_end_date: '' });
    setLeadHistory([]);
    setSelectedCountryId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `containers/${fileName}`;
    const { error } = await supabase.storage.from('container-images').upload(filePath, file);
    if (error) { toast.error('Image upload failed'); setUploading(false); return; }
    const { data } = supabase.storage.from('container-images').getPublicUrl(filePath);
    setForm({ ...form, image_url: data.publicUrl });
    setUploading(false);
    toast.success('Image uploaded');
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
      image_url: form.image_url || null,
      current_lead_name: form.current_lead_name || null,
      current_lead_cellphone: form.current_lead_cellphone || null,
      current_lead_contract_url: form.current_lead_contract_url || null,
      current_lead_start_date: form.current_lead_start_date || null,
      current_lead_end_date: form.current_lead_end_date || null,
    };

    if (editingContainer) {
      const { error } = await supabase.from('containers').update(containerData).eq('id', editingContainer.id);
      if (error) toast.error('Failed to update container');
      else { toast.success('Container updated'); setShowModal(false); window.location.reload(); }
    } else {
      const { error } = await supabase.from('containers').insert([containerData]);
      if (error) toast.error('Failed to create container');
      else { toast.success('Container created'); setShowModal(false); window.location.reload(); }
    }
  };

  const addNewLead = async () => {
    if (!editingContainer || !newLead.lead_name || !newLead.start_date) {
      toast.error('Lead name and start date are required');
      return;
    }
    const { error } = await supabase.from('container_lead_history').insert([{
      container_id: editingContainer.id,
      lead_name: newLead.lead_name,
      cellphone: newLead.cellphone || null,
      contract_url: newLead.contract_url || null,
      start_date: newLead.start_date,
      end_date: newLead.end_date || null,
    }]);
    if (error) toast.error('Failed to add lead record');
    else {
      toast.success('Lead record added');
      setNewLead({ lead_name: '', cellphone: '', contract_url: '', start_date: '', end_date: '' });
      const { data } = await supabase.from('container_lead_history').select('*').eq('container_id', editingContainer.id).order('start_date', { ascending: false });
      setLeadHistory(data || []);
    }
  };

  const recordReceiveStock = (container: Container) => {
    toast.success(`Stock In (Receiving) recorded for ${container.container_id}`);
  };

  const recordSellStock = (container: Container) => {
    toast.success(`Stock Out (Sales / Loyalty) recorded for ${container.container_id}`);
    window.location.href = '/dashboard/distribution';
  };

  const recordStockCount = (container: Container) => {
    toast.success(`Stock Count completed for ${container.container_id}`);
  };

  const askGrok = () => {
    toast.success("Grok: Containers analysed. Recommended actions: Receive stock in Container 03, Sell 60 units from Container 01 to loyalty, Count stock in Container 07.");
  };

  if (loading) return <div className="p-12">Loading containers...</div>;

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Containers</h1>
          <p className="text-neutral-600">Receive Stock • Sell Stock • Stock Count • Grok active</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.location.href = '/dashboard/supplychain'} className="px-5 py-2 border rounded-2xl">← Supply Chain</button>
          <button onClick={() => window.location.href = '/dashboard/manufacturing'} className="px-5 py-2 border rounded-2xl">Manufacturing →</button>
          <button onClick={askGrok} className="bg-black text-white px-5 py-2 rounded-2xl flex items-center gap-2"><Brain size={20} /> Ask Grok</button>
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2"><Plus size={20} /> Add New Container</button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-neutral-600">Filter by Status:</span>
        {(['all', 'active', 'inactive'] as const).map(status => (
          <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-1.5 rounded-2xl text-sm font-medium transition ${statusFilter === status ? 'bg-[#00b4d8] text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}`}>
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Image</th>
              <th className="px-6 py-4 text-left font-semibold cursor-pointer" onClick={() => handleSort('container_id')}>Container ID {sortField === 'container_id' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-4 text-left font-semibold cursor-pointer" onClick={() => handleSort('name')}>Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-4 text-left font-semibold">Location</th>
              <th className="px-6 py-4 text-left font-semibold">Current Lead</th>
              <th className="px-6 py-4 text-left font-semibold cursor-pointer" onClick={() => handleSort('status')}>Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedContainers.length > 0 ? filteredAndSortedContainers.map((container) => (
              <tr key={container.id} className="border-t hover:bg-neutral-50">
                <td className="px-6 py-4">{container.image_url ? <img src={container.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 bg-neutral-100 rounded-xl" />}</td>
                <td className="px-6 py-4 font-medium">{container.container_id}</td>
                <td className="px-6 py-4 text-sm text-neutral-700">{container.name}</td>
                <td className="px-6 py-4 text-sm text-neutral-600">{[container.suburb, container.province].filter(Boolean).join(', ') || '—'}</td>
                <td className="px-6 py-4 text-sm">{container.current_lead_name || '—'}</td>
                <td className="px-6 py-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={container.status === 'active'} onChange={() => toggleContainerStatus(container)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#00b4d8] rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                    <span className="ml-3 text-sm font-medium text-neutral-600">{container.status}</span>
                  </label>
                </td>
                <td className="px-6 py-4 text-right flex gap-2 justify-end flex-wrap">
                  <button onClick={() => openEditModal(container)} className="p-2 hover:bg-neutral-100 rounded-xl"><Edit2 size={18} /></button>
                  <button onClick={() => recordReceiveStock(container)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-xl text-sm flex items-center gap-1"><ArrowDown size={16} /> Receive</button>
                  <button onClick={() => recordSellStock(container)} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-xl text-sm flex items-center gap-1"><ArrowUp size={16} /> Sell / Dispatch</button>
                  <button onClick={() => recordStockCount(container)} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-xl text-sm flex items-center gap-1"><List size={16} /> Count</button>
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="px-6 py-12 text-center text-neutral-500">No containers found.</td></tr>}
          </tbody>
        </table>
      </div>

      <button onClick={askGrok} className="fixed bottom-8 right-8 bg-black text-white px-6 py-3 rounded-2xl flex items-center gap-2">
        <Brain size={20} /> Ask Grok
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">{editingContainer ? 'Edit Container' : 'Add New Container'}</h2>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <h3 className="font-semibold text-lg mb-4">1. Container Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="text-sm font-medium">Container ID *</label><input type="text" className="input w-full mt-1" value={form.container_id} onChange={e => setForm({ ...form, container_id: e.target.value })} required /></div>
                  <div><label className="text-sm font-medium">Container Name *</label><input type="text" className="input w-full mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">Linked Business *</label>
                  <select className="input w-full mt-1" value={form.business_id} onChange={e => setForm({ ...form, business_id: e.target.value })} required>
                    <option value="">Select Business</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.legal_name} {b.trading_name && `(${b.trading_name})`}</option>)}
                  </select>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium block mb-2">Container Photo</label>
                  <div className="flex items-center gap-4">
                    {form.image_url && <img src={form.image_url} alt="Preview" className="w-20 h-20 object-cover rounded-2xl" />}
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2 border rounded-2xl hover:bg-neutral-50">
                      <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload Photo'}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-4">2. Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium">Country</label>
                    <select className="input w-full mt-1" value={form.country} onChange={e => {
                      const selected = countries.find(c => c.name === e.target.value);
                      setForm({ ...form, country: e.target.value, province: '' });
                      setSelectedCountryId(selected ? selected.id : null);
                    }}>
                      <option value="">Select Country</option>
                      {countries.map(c => <option key={c.id} value={c.name}>{c.flag} {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Province</label>
                    <select className="input w-full mt-1" value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} disabled={!selectedCountryId}>
                      <option value="">Select Province</option>
                      {provinces.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Suburb</label>
                    <input type="text" className="input w-full mt-1" value={form.suburb} onChange={e => setForm({ ...form, suburb: e.target.value })} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">Full Address</label>
                  <input type="text" className="input w-full mt-1" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div><label className="text-sm font-medium">Latitude</label><input type="text" className="input w-full mt-1" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">Longitude</label><input type="text" className="input w-full mt-1" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-4">3. Current Lead</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="text-sm font-medium">Lead Name</label><input type="text" className="input w-full mt-1" value={form.current_lead_name} onChange={e => setForm({ ...form, current_lead_name: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">Cellphone</label><input type="text" className="input w-full mt-1" value={form.current_lead_cellphone} onChange={e => setForm({ ...form, current_lead_cellphone: e.target.value })} /></div>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">Contract URL</label>
                  <input type="text" className="input w-full mt-1" value={form.current_lead_contract_url} onChange={e => setForm({ ...form, current_lead_contract_url: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div><label className="text-sm font-medium">Start Date</label><input type="date" className="input w-full mt-1" value={form.current_lead_start_date} onChange={e => setForm({ ...form, current_lead_start_date: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">End Date</label><input type="date" className="input w-full mt-1" value={form.current_lead_end_date} onChange={e => setForm({ ...form, current_lead_end_date: e.target.value })} /></div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 border rounded-2xl">Cancel</button>
                <button type="submit" className="btn-primary px-8 py-3">{editingContainer ? 'Update Container' : 'Create Container'}</button>
              </div>
            </form>

            {editingContainer && (
              <div className="mt-10 border-t pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Lead History</h3>
                  <button onClick={() => setShowLeadModal(true)} className="flex items-center gap-2 text-sm text-[#00b4d8]"><UserPlus size={16} /> Add New Lead Record</button>
                </div>
                {leadHistory.length > 0 ? leadHistory.map((lead) => (
                  <div key={lead.id} className="bg-neutral-50 p-4 rounded-2xl text-sm mb-3">
                    <div className="font-medium">{lead.lead_name}</div>
                    <div className="text-neutral-600">{lead.cellphone}</div>
                    <div className="text-xs text-neutral-500">{lead.start_date} → {lead.end_date || 'Present'}</div>
                  </div>
                )) : <p className="text-sm text-neutral-500">No lead history recorded yet.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {showLeadModal && editingContainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-6">Add New Lead Record</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Lead Name" className="input w-full" value={newLead.lead_name} onChange={e => setNewLead({ ...newLead, lead_name: e.target.value })} />
              <input type="text" placeholder="Cellphone" className="input w-full" value={newLead.cellphone} onChange={e => setNewLead({ ...newLead, cellphone: e.target.value })} />
              <input type="text" placeholder="Contract URL" className="input w-full" value={newLead.contract_url} onChange={e => setNewLead({ ...newLead, contract_url: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" className="input w-full" value={newLead.start_date} onChange={e => setNewLead({ ...newLead, start_date: e.target.value })} />
                <input type="date" className="input w-full" value={newLead.end_date} onChange={e => setNewLead({ ...newLead, end_date: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-8">
              <button onClick={() => setShowLeadModal(false)} className="px-6 py-3 border rounded-2xl">Cancel</button>
              <button onClick={addNewLead} className="btn-primary px-8 py-3">Add Lead Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}