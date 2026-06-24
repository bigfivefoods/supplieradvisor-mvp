'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import AddContainerForm from '@/components/AddContainerForm';
import EditContainerForm, { Container } from '@/components/EditContainerForm';

const supabase = createClient();

export default function ManageContainersPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchContainers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching containers:', error);
    } else {
      setContainers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const filteredContainers = containers.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.container_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.assigned_contractor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this container?')) return;

    const { error } = await supabase.from('containers').delete().eq('id', id);
    if (!error) {
      fetchContainers();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-[-2px]">Manage Containers</h1>
          <p className="text-slate-500 mt-1">View and manage all containers</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-3xl hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add New Container
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search containers..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full max-w-md px-5 py-3 rounded-3xl border border-slate-200 mb-6 focus:outline-none focus:ring-2 focus:ring-black"
      />

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Container</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Location</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Contractor</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Loading containers...</td>
              </tr>
            ) : filteredContainers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No containers found</td>
              </tr>
            ) : (
              filteredContainers.map((container) => (
                <tr key={container.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-semibold">{container.name}</div>
                    <div className="text-sm text-slate-500 font-mono">{container.container_code}</div>
                  </td>
                  <td className="px-6 py-5 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {container.city || container.province || container.country || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      container.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {container.status || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">
                    {container.assigned_contractor || '—'}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingContainer(container)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(container.id)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Container Modal */}
      {showAddModal && (
        <AddContainerForm
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchContainers();
          }}
        />
      )}

      {/* Edit Container Modal */}
      {editingContainer && (
        <EditContainerForm
          container={editingContainer!}
          onClose={() => setEditingContainer(null)}
          onSuccess={() => {
            setEditingContainer(null);
            fetchContainers();
          }}
        />
      )}
    </div>
  );
}