'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, Plus, ArrowLeft, Target, CheckCircle, Users, Upload, X } from 'lucide-react';

const supabase = createClient();

type RIADType = 'risk' | 'issue' | 'action' | 'decision';
type StakeholderType = 'supplier' | 'customer' | 'internal';

interface Profile {
  id: number;
  trading_name: string;
}

interface RIADLog {
  id: number;
  stakeholder_type: string;
  title: string;
  description: string | null;
  status: string;
  rpn: number | null;
  image_url: string | null;
  created_at: string;
  stakeholder: { trading_name: string } | null;
  owner: { trading_name: string } | null;
}

export default function ContainerRIADLog() {
  const [activeTab, setActiveTab] = useState<RIADType>('risk');
  const [riadLogs, setRiadLogs] = useState<RIADLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [stakeholders, setStakeholders] = useState<Profile[]>([]);
  const [owners, setOwners] = useState<Profile[]>([]);
  const [loadingStakeholders, setLoadingStakeholders] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [form, setForm] = useState({
    stakeholder_type: 'internal' as StakeholderType,
    stakeholder_id: '',
    owner_id: '',
    title: '',
    description: '',
    status: 'active',
    logged_date: new Date().toISOString().split('T')[0],
    closed_date: '',
    severity: 3,
    likelihood: 3,
    time_horizon: 3,
    image_url: '',
  });

  const rpn = form.severity * form.likelihood * form.time_horizon;

  const fetchStakeholders = async (type: StakeholderType) => {
    setLoadingStakeholders(true);
    let query = supabase.from('profiles').select('id, trading_name').order('trading_name');
    if (type === 'internal') query = query.eq('relationship_type', 'internal');
    const { data } = await query;
    setStakeholders(data || []);
    setLoadingStakeholders(false);
  };

  const fetchOwners = async () => {
    const { data } = await supabase.from('profiles').select('id, trading_name').order('trading_name');
    setOwners(data || []);
  };

  const fetchLogs = async (type: RIADType) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('riad_logs')
      .select(`
        *,
        stakeholder:profiles!stakeholder_id? (trading_name),
        owner:profiles!owner_id? (trading_name)
      `)
      .eq('riad_type', type)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching RIAD logs:', error);
      alert('Error loading data: ' + error.message);
    } else {
      setRiadLogs((data as unknown as RIADLog[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLogs(activeTab);
    fetchOwners();
  }, [activeTab]);

  useEffect(() => {
    fetchStakeholders(form.stakeholder_type);
    setForm(prev => ({ ...prev, stakeholder_id: '' }));
  }, [form.stakeholder_type]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setForm(prev => ({ ...prev, image_url: '' }));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile) return null;
    setUploadingImage(true);
    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `riad-images/${fileName}`;

    const { error } = await supabase.storage.from('riad_images').upload(filePath, selectedFile);
    if (error) { alert('Image upload failed'); setUploadingImage(false); return null; }
    const { data } = supabase.storage.from('riad_images').getPublicUrl(filePath);
    setUploadingImage(false);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!form.title) { alert('Please enter a Title'); return; }

    let imageUrl = form.image_url;
    if (selectedFile) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) imageUrl = uploadedUrl;
    }

    const payload: any = {
      stakeholder_type: form.stakeholder_type,
      stakeholder_id: form.stakeholder_id ? parseInt(form.stakeholder_id) : null,
      owner_id: form.owner_id ? parseInt(form.owner_id) : null,
      riad_type: activeTab,
      title: form.title,
      description: form.description || null,
      status: form.status,
      logged_date: form.logged_date || null,
      closed_at: form.closed_date ? new Date(form.closed_date).toISOString() : null,
      image_url: imageUrl || null,
    };

    if (activeTab === 'risk') {
      payload.severity = form.severity;
      payload.likelihood = form.likelihood;
      payload.time_horizon = form.time_horizon;
      payload.rpn = rpn;
    }

    const { error } = await supabase.from('riad_logs').insert(payload);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setShowModal(false);
      resetForm();
      fetchLogs(activeTab);
    }
  };

  const resetForm = () => {
    setForm({
      stakeholder_type: 'internal',
      stakeholder_id: '',
      owner_id: '',
      title: '',
      description: '',
      status: 'active',
      logged_date: new Date().toISOString().split('T')[0],
      closed_date: '',
      severity: 3,
      likelihood: 3,
      time_horizon: 3,
      image_url: '',
    });
    setSelectedFile(null);
    setImagePreview(null);
  };

  const getRPNColor = (value: number) => {
    if (value >= 75) return 'bg-red-600 text-white';
    if (value >= 50) return 'bg-orange-500 text-white';
    if (value >= 25) return 'bg-amber-500 text-white';
    return 'bg-emerald-500 text-white';
  };

  const getRPNLabel = (value: number) => {
    if (value >= 75) return 'Critical';
    if (value >= 50) return 'High';
    if (value >= 25) return 'Medium';
    return 'Low';
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard/containers" className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Containers
          </Link>
          <h1 className="font-black text-5xl tracking-[-2px]">Container RIAD Register</h1>
          <p className="text-xl text-neutral-600">Container Risks • Issues • Actions • Decisions</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary px-6 py-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Log New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </button>
      </div>

      <div className="flex border-b mb-8">
        {[
          { key: 'risk', label: 'Risks', icon: Target },
          { key: 'issue', label: 'Issues', icon: AlertTriangle },
          { key: 'action', label: 'Actions', icon: CheckCircle },
          { key: 'decision', label: 'Decisions', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as RIADType)}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-all ${activeTab === tab.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500'}`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Loading...</div>
        ) : riadLogs.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="px-8 py-4 text-left font-semibold">Stakeholder</th>
                <th className="px-8 py-4 text-left font-semibold">Title</th>
                <th className="px-6 py-4 text-left font-semibold">Owner</th>
                {activeTab === 'risk' && <th className="px-6 py-4 text-center font-semibold">RPN</th>}
                <th className="px-6 py-4 text-center font-semibold">Status</th>
                <th className="px-8 py-4 text-right font-semibold">Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {riadLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-8 py-5">
                    <div className="font-medium text-sm">{log.stakeholder?.trading_name || 'Unassigned'}</div>
                    <div className="text-xs text-neutral-500 capitalize">{log.stakeholder_type}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-semibold flex items-center gap-2">
                      {log.title}
                      {log.image_url && <span className="text-emerald-600 text-xs">📷</span>}
                    </div>
                    {log.description && <div className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{log.description}</div>}
                  </td>
                  <td className="px-6 py-5 text-sm font-medium">{log.owner?.trading_name || '-'}</td>
                  {activeTab === 'risk' && (
                    <td className="px-6 py-5 text-center">
                      {log.rpn && <span className={`px-4 py-1 rounded-2xl text-sm font-bold ${getRPNColor(log.rpn)}`}>{log.rpn}</span>}
                    </td>
                  )}
                  <td className="px-6 py-5 text-center">
                    <span className="px-4 py-1 rounded-full text-xs font-medium border bg-neutral-100 text-neutral-600 capitalize">
                      {log.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right text-xs text-neutral-500">
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-16 text-center text-neutral-500">
            No {activeTab}s logged yet.
            <div className="mt-4">
              <button onClick={() => setShowModal(true)} className="btn-primary px-6 py-2 text-sm">
                Log your first {activeTab}
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-2xl tracking-tight mb-6">Log New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium block mb-1.5">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm" placeholder="Short title" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1.5">Stakeholder Type</label>
                  <select value={form.stakeholder_type} onChange={(e) => setForm({ ...form, stakeholder_type: e.target.value as StakeholderType })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm">
                    <option value="internal">Internal</option>
                    <option value="supplier">Supplier</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5">Stakeholder <span className="text-neutral-400">(Optional)</span></label>
                  {loadingStakeholders ? <div className="text-sm py-2 text-neutral-500">Loading...</div> : (
                    <select value={form.stakeholder_id} onChange={(e) => setForm({ ...form, stakeholder_id: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm">
                      <option value="">None / Not linked yet</option>
                      {stakeholders.map((s) => <option key={s.id} value={s.id}>{s.trading_name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5">Owner (Team Member)</label>
                <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm">
                  <option value="">Unassigned</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.trading_name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm h-20" />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5">Attach Image (Optional)</label>
                {!imagePreview ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-2xl p-6 cursor-pointer hover:border-neutral-400 transition-colors">
                    <Upload className="w-6 h-6 text-neutral-400 mb-2" />
                    <span className="text-sm text-neutral-600">Click to upload image</span>
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  </label>
                ) : (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-2xl border" />
                    <button onClick={removeSelectedImage} className="absolute top-3 right-3 bg-white rounded-full p-1 shadow"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              {activeTab === 'risk' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium block mb-1.5">Severity</label>
                    <select value={form.severity} onChange={(e) => setForm({ ...form, severity: parseInt(e.target.value) })} className="w-full border border-neutral-200 rounded-2xl px-3 py-2.5 text-sm">
                      <option value={1}>1 - Very Low</option><option value={2}>2 - Low</option><option value={3}>3 - Medium</option><option value={4}>4 - High</option><option value={5}>5 - Very High</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5">Likelihood</label>
                    <select value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: parseInt(e.target.value) })} className="w-full border border-neutral-200 rounded-2xl px-3 py-2.5 text-sm">
                      <option value={1}>1 - Very Unlikely</option><option value={2}>2 - Unlikely</option><option value={3}>3 - Possible</option><option value={4}>4 - Likely</option><option value={5}>5 - Almost Certain</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5">Time Horizon</label>
                    <select value={form.time_horizon} onChange={(e) => setForm({ ...form, time_horizon: parseInt(e.target.value) })} className="w-full border border-neutral-200 rounded-2xl px-3 py-2.5 text-sm">
                      <option value={1}>1 - Immediate</option><option value={2}>2 - Very Soon</option><option value={3}>3 - Within Months</option><option value={4}>4 - Within a Year</option><option value={5}>5 - Long Term</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1.5">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-2 text-sm">
                    <option value="active">Active</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5">Logged Date</label>
                  <input type="date" value={form.logged_date} onChange={(e) => setForm({ ...form, logged_date: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5">Closed Date</label>
                  <input type="date" value={form.closed_date} onChange={(e) => setForm({ ...form, closed_date: e.target.value })} className="w-full border border-neutral-200 rounded-2xl px-4 py-2 text-sm" />
                </div>
              </div>

              {activeTab === 'risk' && (
                <div className="bg-neutral-900 text-white rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-neutral-400">RPN</div>
                    <div className="text-5xl font-black tracking-tighter">{rpn}</div>
                  </div>
                  <div className={`px-7 py-2.5 rounded-2xl text-base font-bold ${getRPNColor(rpn)}`}>
                    {getRPNLabel(rpn)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-3 rounded-2xl border border-neutral-200">Cancel</button>
              <button onClick={handleSubmit} disabled={uploadingImage} className="flex-1 py-3 rounded-2xl bg-neutral-900 text-white font-medium disabled:opacity-50">
                {uploadingImage ? 'Uploading image...' : `Log ${activeTab}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}