'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const [form, setForm] = useState({
    lead_name: '',
    cellphone: '',
    location: '',
    opportunity_location: '',
    opportunity_size: '',
    estimated_date: '',
    description: '',
    status: 'Prospect',
  });

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('container_lead_history')
      .select('*')
      .order(sortField, { ascending: sortAsc });
    setLeads(data || []);
  };

  useEffect(() => { fetchLeads(); }, [sortField, sortAsc]);

  const openAdd = () => { setEditingLead(null); setForm({ ...form, status: 'Prospect' }); setModalOpen(true); };
  const openEdit = (lead: any) => { setEditingLead(lead); setForm(lead); setModalOpen(true); };

  const saveLead = async () => {
    if (editingLead) {
      await supabase.from('container_lead_history').update(form).eq('id', editingLead.id);
    } else {
      await supabase.from('container_lead_history').insert([form]);
    }
    setModalOpen(false);
    fetchLeads();
    alert('✅ Saved successfully!');
  };

  const deleteLead = async (id: number) => {
    if (confirm('Delete this lead?')) {
      await supabase.from('container_lead_history').delete().eq('id', id);
      fetchLeads();
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Won') return 'bg-emerald-500 text-white';
    if (status === 'Lost') return 'bg-red-500 text-white';
    if (status === 'Negotiation') return 'bg-amber-500 text-black';
    return 'bg-blue-500 text-white';
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-5xl font-black">Leads & Opportunities</h1>
        <button onClick={openAdd} className="flex items-center gap-3 bg-white hover:bg-zinc-100 text-black px-6 py-3 rounded-2xl font-semibold">
          <Plus className="w-5 h-5" /> New Opportunity
        </button>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-700">
              {['Lead Name', 'Cell', 'Location', 'Opp. Size (ZAR)', 'Est. Date', 'Status'].map((h, i) => (
                <th key={i} className="py-5 px-6 text-left cursor-pointer hover:text-white" onClick={() => { setSortField(h.toLowerCase().replace(/ /g,'_')); setSortAsc(!sortAsc); }}>
                  {h} {sortField.includes(h.toLowerCase()) && (sortAsc ? '↑' : '↓')}
                </th>
              ))}
              <th className="py-5 px-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="border-b border-zinc-700 hover:bg-zinc-800">
                <td className="px-6 py-5 font-medium">{l.lead_name}</td>
                <td className="px-6 py-5">{l.cellphone}</td>
                <td className="px-6 py-5">{l.location}</td>
                <td className="px-6 py-5 font-mono">R {parseFloat(l.opportunity_size || 0).toLocaleString()}</td>
                <td className="px-6 py-5">{l.estimated_date}</td>
                <td className="px-6 py-5">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(l.status)}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-6 py-5 flex gap-3">
                  <button onClick={() => openEdit(l)} className="text-emerald-400"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => deleteLead(l.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-lg p-8">
            <h2 className="text-3xl font-bold mb-6">{editingLead ? 'Edit Opportunity' : 'New Opportunity'}</h2>
            
            <div className="space-y-4">
              <input placeholder="Contact Name" value={form.lead_name} onChange={e => setForm({...form, lead_name: e.target.value})} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input placeholder="Contact Number" value={form.cellphone} onChange={e => setForm({...form, cellphone: e.target.value})} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input placeholder="Location (City/Province)" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input placeholder="Opportunity Location" value={form.opportunity_location} onChange={e => setForm({...form, opportunity_location: e.target.value})} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input type="number" placeholder="Opportunity Size (ZAR)" value={form.opportunity_size} onChange={e => setForm({...form, opportunity_size: e.target.value})} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input type="date" value={form.estimated_date} onChange={e => setForm({...form, estimated_date: e.target.value})} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
              <textarea placeholder="Opportunity Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
              
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-zinc-800 px-4 py-3 rounded-2xl">
                <option value="Prospect">Prospect</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={saveLead} className="flex-1 bg-white text-black py-4 rounded-2xl font-semibold">Save Opportunity</button>
              <button onClick={() => setModalOpen(false)} className="flex-1 border border-zinc-700 py-4 rounded-2xl">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={openAdd} className="fixed bottom-8 right-8 bg-emerald-500 text-black px-6 py-4 rounded-full shadow-lg flex items-center gap-2 hover:bg-emerald-400">
        <Plus className="w-6 h-6" /> New Opportunity
      </button>
    </div>
  );
}