'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Warehouse, Package } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

type Wh = {
  id: number;
  name: string;
  code?: string | null;
  status?: string | null;
  city?: string | null;
  address?: string | null;
  warehouse_type?: string | null;
  stock_lines?: number;
  units_on_hand?: number;
};

type Ctr = {
  id: number;
  name: string;
  container_code?: string;
  city?: string | null;
  status?: string | null;
};

export default function WarehousesPage() {
  return (
    <CompanyRequired>
      <WarehousesInner />
    </CompanyRequired>
  );
}

function WarehousesInner() {
  const companyId = getSelectedCompanyId()!;
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [containers, setContainers] = useState<Ctr[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventory/warehouses?companyId=${companyId}`);
    const data = await res.json();
    setWarehouses(data.warehouses || []);
    setContainers(data.containers || []);
    if (data.warning) toast.message(data.warning, { description: data.hint });
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name,
          code: code || undefined,
          city: city || undefined,
          warehouse_type: 'warehouse',
          status: 'active',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success('Warehouse created');
      setName('');
      setCode('');
      setCity('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this warehouse?')) return;
    const res = await fetch(`/api/inventory/warehouses?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Failed');
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Warehouses"
        description="Central storage locations linked to stock_levels. Retail containers appear as outlet locations."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white border rounded-3xl p-5 space-y-3 h-fit">
          <h2 className="font-bold flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00b4d8]" /> Add warehouse
          </h2>
          <input
            className="input w-full !p-3 !text-sm"
            placeholder="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input !p-3 !text-sm font-mono"
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="input !p-3 !text-sm"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <button type="button" disabled={saving} onClick={() => void create()} className="btn-primary w-full !py-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save warehouse'}
          </button>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-[#00b4d8]" /> Warehouses
            </div>
            {loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : warehouses.length === 0 ? (
              <div className="p-10 text-center text-neutral-500 text-sm">No warehouses yet</div>
            ) : (
              <ul className="divide-y">
                {warehouses.map((w) => (
                  <li key={w.id} className="px-5 py-3 flex justify-between gap-3 text-sm">
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-xs text-neutral-500">
                        {[w.code, w.city, w.status].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {w.stock_lines || 0} lines · {Math.round(w.units_on_hand || 0)} units
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(w.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl h-fit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-[#00b4d8]" /> Retail containers (outlets)
            </div>
            {containers.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                No containers —{' '}
                <Link href="/dashboard/containers/manage" className="text-[#00b4d8] font-medium">
                  manage containers
                </Link>
              </div>
            ) : (
              <ul className="divide-y">
                {containers.map((c) => (
                  <li key={c.id} className="px-5 py-3 text-sm flex justify-between">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-neutral-500 font-mono">
                        {c.container_code} · {c.city || '—'}
                      </div>
                    </div>
                    <span className="text-xs capitalize text-neutral-500">{c.status || 'active'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
