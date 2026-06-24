'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { 
  Plus, Search, Filter, MapPin, Edit2, Trash2, Eye, 
  ArrowLeft, Truck 
} from 'lucide-react';
import AddContainerForm from '@/components/AddContainerForm';

const supabase = createClient();

interface Container {
  id: number;
  name: string;
  code: string;
  status: string;
  continent: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export default function ManageContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchContainers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .order('created_at', { ascending: false });

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

  const filteredContainers = containers.filter(container => {
    const matchesSearch = 
      container.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      container.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      container.city?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || container.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'inactive': return 'bg-slate-100 text-slate-600';
      case 'maintenance': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this container?')) return;

    const { error } = await supabase.from('containers').delete().eq('id', id);
    if (error) {
      alert('Error deleting container');
    } else {
      fetchContainers();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link 
            href="/dashboard/containers" 
            className="flex items-center gap-2 text-sm text-slate-500 mb-3 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Containers Hub
          </Link>
          <h1 className="font-black text-5xl tracking-[-2px]">Manage Containers</h1>
          <p className="text-xl text-slate-600 mt-2">Add, edit and monitor all your retail containers</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-3 px-8"
        >
          <Plus className="w-5 h-5" />
          Add New Container
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-5 top-4 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-5 py-4 rounded-3xl border border-slate-200 focus:border-[#00b4d8] focus:outline-none text-lg"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 text-sm text-slate-500">
            <Filter className="w-4 h-4" /> Status
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-3xl px-5 py-4 text-sm focus:outline-none focus:border-[#00b4d8]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading containers...</div>
        ) : filteredContainers.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-8 py-5 text-left font-semibold">Container</th>
                <th className="px-6 py-5 text-left font-semibold">Location</th>
                <th className="px-6 py-5 text-center font-semibold">Status</th>
                <th className="px-6 py-5 text-center font-semibold">Coordinates</th>
                <th className="px-8 py-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredContainers.map((container) => (
                <tr key={container.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="font-semibold text-lg">{container.name}</div>
                    <div className="text-sm text-slate-500 font-mono">{container.code}</div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-[#00b4d8]" />
                      <span>
                        {container.city}, {container.province}<br />
                        <span className="text-xs text-slate-500">{container.country}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`inline-block px-4 py-1 rounded-full text-xs font-semibold ${getStatusColor(container.status)}`}>
                      {container.status}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-center font-mono text-xs text-slate-500">
                    {container.latitude && container.longitude ? (
                      `${container.latitude.toFixed(4)}, ${container.longitude.toFixed(4)}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-end gap-2">
                      <button className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(container.id)}
                        className="p-3 hover:bg-red-50 text-red-500 rounded-2xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-16 text-center">
            <Truck className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-xl font-semibold text-slate-600">No containers found</p>
            <p className="text-slate-500 mt-1">Try adjusting your search or filters</p>
          </div>
        )}
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
    </div>
  );
}