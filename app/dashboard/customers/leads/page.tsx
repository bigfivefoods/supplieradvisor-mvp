'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Download, Target } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    profile_id: '',
    contact_name: '',
    contact_number: '',
    location: '',
    opportunity_location: '',
    opportunity_size: '',
    estimated_date: '',
    description: '',
    status: 'Prospect',
  });

  const fetchAll = async () => {
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from('opportunities').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, contact_name, trading_name, full_address')
    ]);
    setLeads(leadsRes.data || []);
    setProfiles(profilesRes.data || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const save = async () => {
    if (editing) {
      await supabase.from('opportunities').update(form).eq('id', editing.id);
    } else {
      await supabase.from('opportunities').insert([form]);
    }
    setModalOpen(false);
    setEditing(null);
    fetchAll();
    alert('✅ Opportunity saved successfully');
  };

  const moveStage = async (id: number, newStatus: string) => {
    await supabase.from('opportunities').update({ status: newStatus }).eq('id', id);
    fetchAll();
  };

  const exportCSV = () => {
    const csv = "Contact,Phone,Value,Stage,Est Close\n" +
      leads.map(l => `${l.contact_name},${l.contact_number || ''},${l.opportunity_size || 0},${l.status},${l.estimated_date}`).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.download = "pipeline-export.csv";
    link.click();
  };

  const stages = ['Prospect', 'Qualified', 'Proposal', 'Negotiation', 'Closing', 'Won', 'Lost'];

  return (
    <div className="p-8 max-w-screen-2xl mx-auto bg-white min-h-screen text-zinc-900">
      <div className="flex justify-between items-end mb-8">
        <div className="flex items-center gap-4">
          <Target className="w-12 h-12 text-emerald-600" />
          <h1 className="text-5xl font-bold tracking-tight">Leads & Opportunity Pipeline</h1>
        </div>

        <div className="flex gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 px-6 py-3 bg-zinc-100 hover:bg-zinc-200 rounded-2xl font-medium">📥 Export CSV</button>
          <button onClick={() => {setEditing(null); setForm({profile_id:'', contact_name:'', contact_number:'', location:'', opportunity_location:'', opportunity_size:'', estimated_date:'', description:'', status:'Prospect'}); setModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-2">
            <Plus size={20} /> New Opportunity
          </button>
        </div>
      </div>

      <input 
        placeholder="Search opportunities..." 
        value={search} 
        onChange={e => setSearch(e.target.value)} 
        className="w-full bg-white border border-zinc-200 px-5 py-4 rounded-2xl mb-8 focus:outline-none focus:border-emerald-500" 
      />

      {/* Clean Kanban */}
      <div className="grid grid-cols-7 gap-6">
        {stages.map(stage => (
          <div key={stage} className="bg-white border border-zinc-200 rounded-3xl p-6">
            <h3 className="font-semibold text-xl mb-5 text-center text-zinc-800">{stage}</h3>
            <div className="space-y-4">
              {leads.filter(l => l.status === stage).map(l => (
                <div key={l.id} className="bg-zinc-50 border border-zinc-100 p-5 rounded-2xl hover:border-emerald-200 transition">
                  <div className="font-semibold text-lg">{l.contact_name}</div>
                  <div className="text-emerald-600 font-medium">R {Number(l.opportunity_size || 0).toLocaleString()}</div>
                  
                  <div className="flex flex-wrap gap-1 mt-4">
                    {stages.map(s => (
                      <button 
                        key={s} 
                        onClick={() => moveStage(l.id, s)} 
                        className={`text-xs px-4 py-1.5 rounded-full transition ${s === stage ? 'bg-emerald-600 text-white' : 'bg-white border border-zinc-200 hover:bg-zinc-50'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => {setEditing(l); setForm(l); setModalOpen(true); }} 
                    className="mt-4 text-sm text-emerald-600 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Button */}
      <button 
        onClick={() => {setEditing(null); setForm({...form}); setModalOpen(true); }} 
        className="fixed bottom-8 right-8 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-full shadow-xl font-semibold flex items-center gap-2"
      >
        + Add Opportunity
      </button>

      {/* Clean Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg border border-zinc-100 shadow-2xl">
            <h2 className="text-3xl font-semibold mb-6">{editing ? 'Edit' : 'New'} Opportunity</h2>
            
            <select className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-2xl mb-4 focus:outline-none" onChange={e => setForm({...form, profile_id: e.target.value})}>
              <option value="">Select Existing Profile</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.contact_name || p.trading_name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Contact Name *" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className="bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-2xl focus:outline-none" />
              <input placeholder="Phone" value={form.contact_number} onChange={e => setForm({...form, contact_number: e.target.value})} className="bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-2xl focus:outline-none" />
              <input placeholder="Value (ZAR)" type="number" value={form.opportunity_size} onChange={e => setForm({...form, opportunity_size: e.target.value})} className="bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-2xl focus:outline-none" />
              <input type="date" value={form.estimated_date} onChange={e => setForm({...form, estimated_date: e.target.value})} className="bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-2xl focus:outline-none" />
            </div>

            <input placeholder="Opportunity Location" value={form.opportunity_location} onChange={e => setForm({...form, opportunity_location: e.target.value})} className="mt-4 w-full bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-2xl focus:outline-none" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4} className="mt-4 w-full bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-2xl focus:outline-none" />

            <div className="flex gap-3 mt-8">
              <button onClick={save} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-semibold">SAVE OPPORTUNITY</button>
              <button onClick={() => setModalOpen(false)} className="flex-1 border border-zinc-200 py-4 rounded-2xl font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}