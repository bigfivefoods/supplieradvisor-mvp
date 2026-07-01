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
    alert('✅ Opportunity saved to Supabase successfully');
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
    <div className="p-8 max-w-screen-2xl mx-auto bg-zinc-950 min-h-screen">
      <div className="flex justify-between items-end mb-8">
        <div className="flex items-center gap-4">
          <Target className="w-12 h-12 text-emerald-400" />
          <h1 className="text-5xl font-black tracking-[-1px] text-white">Leads • Opportunity Pipeline</h1>
        </div>

        <div className="flex gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 px-6 py-3 bg-zinc-800 rounded-2xl hover:bg-zinc-700">📥 Export CSV</button>
          <button onClick={() => {setEditing(null); setForm({profile_id:'', contact_name:'', contact_number:'', location:'', opportunity_location:'', opportunity_size:'', estimated_date:'', description:'', status:'Prospect'}); setModalOpen(true); }} className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
            <Plus /> New Opportunity
          </button>
        </div>
      </div>

      {/* Search */}
      <input placeholder="Search pipeline..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-zinc-800 border border-zinc-600 px-5 py-4 rounded-2xl mb-6" />

      {/* Kanban Pipeline */}
      <div className="grid grid-cols-7 gap-3">
        {stages.map(stage => (
          <div key={stage} className="bg-zinc-900 border border-zinc-700 rounded-3xl p-4">
            <h3 className="font-bold text-center text-lg mb-4 text-white">{stage}</h3>
            <div className="space-y-3">
              {leads.filter(l => l.status === stage).map(l => (
                <div key={l.id} className="bg-zinc-800 p-4 rounded-2xl">
                  <div className="font-semibold">{l.contact_name}</div>
                  <div className="text-emerald-400 text-sm">R {Number(l.opportunity_size || 0).toLocaleString()}</div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {stages.map(s => (
                      <button key={s} onClick={() => moveStage(l.id, s)} className={`text-[10px] px-3 py-1 rounded-full ${s === stage ? 'bg-emerald-500 text-black' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => {setEditing(l); setForm(l); setModalOpen(true); }} className="mt-3 text-xs text-sky-400">Edit</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Button */}
      <button onClick={() => {setEditing(null); setForm({...form}); setModalOpen(true); }} className="fixed bottom-8 right-8 bg-white text-black px-8 py-4 rounded-full shadow-2xl font-bold flex items-center gap-2">
        + Add to Pipeline
      </button>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-3xl w-full max-w-lg">
            <h2 className="text-3xl font-bold mb-6">{editing ? 'Edit' : 'New'} Opportunity</h2>
            
            <select className="w-full bg-zinc-800 p-3 rounded-2xl mb-4" onChange={e => setForm({...form, profile_id: e.target.value})}>
              <option value="">Select Existing Profile / Customer</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.contact_name || p.trading_name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Contact Name *" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className="bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input placeholder="Contact Number" value={form.contact_number} onChange={e => setForm({...form, contact_number: e.target.value})} className="bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input placeholder="Value (ZAR)" type="number" value={form.opportunity_size} onChange={e => setForm({...form, opportunity_size: e.target.value})} className="bg-zinc-800 px-4 py-3 rounded-2xl" />
              <input type="date" value={form.estimated_date} onChange={e => setForm({...form, estimated_date: e.target.value})} className="bg-zinc-800 px-4 py-3 rounded-2xl" />
            </div>

            <input placeholder="Opportunity Location" value={form.opportunity_location} onChange={e => setForm({...form, opportunity_location: e.target.value})} className="mt-4 w-full bg-zinc-800 px-4 py-3 rounded-2xl" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="mt-4 w-full bg-zinc-800 px-4 py-3 rounded-2xl" />

            <button onClick={save} className="w-full mt-6 bg-emerald-500 text-black py-4 font-bold rounded-2xl">SAVE TO SUPABASE</button>
            <button onClick={() => setModalOpen(false)} className="w-full mt-3 border border-zinc-700 py-4 rounded-2xl">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}