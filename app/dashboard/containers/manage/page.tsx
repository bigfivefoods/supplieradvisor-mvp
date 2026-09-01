'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Edit2, Trash2, MapPin, ExternalLink, Search, Package, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import AddContainerForm from '@/components/AddContainerForm';
import EditContainerForm, { Container } from '@/components/EditContainerForm';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

function toEditContainer(c: ContainerRecord): Container {
  return {
    id: c.id,
    container_code: c.container_code,
    name: c.name,
    type: c.type ?? null,
    status: c.status ?? null,
    continent: (c as { continent?: string | null }).continent ?? null,
    country: c.country ?? null,
    province: c.province ?? null,
    city: c.city ?? null,
    contractor_id: c.contractor_id ?? null,
    address: c.address ?? null,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    deployed_date: c.deployed_date ?? null,
    purchase_date: c.purchase_date ?? null,
    cost: c.cost ?? null,
    assigned_contractor: c.assigned_contractor ?? null,
    tags: Array.isArray(c.tags) ? c.tags.join(',') : (c.tags as string) || null,
    photo_url: c.photo_url ?? null,
    notes: c.notes ?? null,
  };
}

export default function ManageContainersPage() {
  return (
    <CompanyRequired>
      <ManageInner />
    </CompanyRequired>
  );
}

function ManageInner() {
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Container | null>(null);
  const [search, setSearch] = useState('');
  const companyId = getSelectedCompanyId()!;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/containers?companyId=${companyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setContainers(data.containers || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = containers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.container_code?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.assigned_contractor?.toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this container outlet? This cannot be undone.')) return;
    const res = await fetch(`/api/containers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Delete failed');
      return;
    }
    toast.success('Container deleted');
    void load();
  };

  return (
    <ContainersPage>
      <ContainersHeader
        title="Manage"
        titleAccent="containers"
        description="Retail outlets · contractors · locations · inventory — full CRUD for every container."
        action={
          <>
            <Link href="/dashboard/containers/map" className="btn-secondary !py-2.5 !px-5 text-sm">
              <MapPin className="w-4 h-4" /> Map
            </Link>
            <button type="button" onClick={() => void load()} className="btn-secondary !py-2.5 !px-5 text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> Add container
            </button>
          </>
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          className="input w-full !pl-11 !py-3 !text-base"
          placeholder="Search code, name, city, contractor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Outlet</th>
                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Location</th>
                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</th>
                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Contractor</th>
                <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-neutral-400">
                    Loading containers…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-neutral-500">
                    No containers yet.{' '}
                    <button type="button" className="text-[#00b4d8] font-medium" onClick={() => setShowAdd(true)}>
                      Add your first outlet
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/80">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/containers/${c.id}`} className="group">
                        <div className="font-semibold text-slate-800 group-hover:text-[#0077b6]">
                          {c.name}
                        </div>
                        <div className="text-xs font-mono text-neutral-500">{c.container_code}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        {[c.city, c.province, c.country].filter(Boolean).join(', ') || '—'}
                      </div>
                      {c.latitude != null && c.longitude != null && (
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${
                          c.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : c.status === 'maintenance'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {c.status || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-neutral-700">
                      {c.assigned_contractor || <span className="text-neutral-400">Unassigned</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/dashboard/containers/${c.id}`}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-2xl border border-neutral-200 hover:bg-neutral-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEditing(toEditContainer(c))}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-2xl border border-neutral-200 hover:bg-neutral-50"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(c.id)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-2xl border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <AddContainerForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}

      {editing && (
        <EditContainerForm
          container={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </ContainersPage>
  );
}
