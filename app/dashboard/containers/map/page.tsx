'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, MapPin, Package } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import type { MapPin as Pin } from '@/components/LocationMap';

const LocationMap = dynamic(() => import('@/components/LocationMap'), { ssr: false });

export default function ContainersMapPage() {
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');

  useEffect(() => {
    const companyId = getSelectedCompanyId();
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetch(`/api/containers?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setContainers(d.containers || []))
      .finally(() => setLoading(false));
  }, []);

  const pins: Pin[] = useMemo(
    () =>
      containers
        .filter((c) => c.latitude != null && c.longitude != null)
        .map((c) => ({
          id: c.id,
          position: [Number(c.latitude), Number(c.longitude)] as [number, number],
          label: c.name,
          subtitle: `${c.container_code} · ${c.status || 'unknown'} · ${c.assigned_contractor || 'No contractor'}`,
        })),
    [containers]
  );

  const unmapped = containers.filter((c) => c.latitude == null || c.longitude == null);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto">
      <Link href="/dashboard/containers" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-neutral-800">
        <ArrowLeft className="w-4 h-4" /> Containers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">Container map</h1>
          <p className="text-neutral-600 mt-1">
            {loading ? 'Loading…' : `${pins.length} mapped · ${unmapped.length} without coordinates`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLayer('street')}
            className={`px-4 py-2 rounded-2xl text-sm font-medium border ${layer === 'street' ? 'bg-[#00b4d8] text-white border-[#00b4d8]' : 'bg-white'}`}
          >
            Street
          </button>
          <button
            type="button"
            onClick={() => setLayer('satellite')}
            className={`px-4 py-2 rounded-2xl text-sm font-medium border ${layer === 'satellite' ? 'bg-[#00b4d8] text-white border-[#00b4d8]' : 'bg-white'}`}
          >
            Satellite
          </button>
          <Link href="/dashboard/containers/manage" className="btn-secondary !py-2 !px-4 text-sm">
            Manage
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[480px] sm:h-[560px] rounded-3xl overflow-hidden border border-neutral-200 bg-white">
          {!loading && (
            <LocationMap pins={pins} layer={layer} height="100%" interactive scrollWheelZoom zoom={6} />
          )}
        </div>
        <div className="bg-white border border-neutral-200 rounded-3xl p-5 max-h-[560px] overflow-y-auto">
          <h3 className="font-bold text-lg mb-4 text-slate-900">Outlets</h3>
          {containers.length === 0 ? (
            <p className="text-sm text-neutral-500">No containers yet.</p>
          ) : (
            <ul className="space-y-3">
              {containers.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/containers/${c.id}`}
                    className="block p-3 rounded-2xl border border-neutral-100 hover:border-[#00b4d8]/40 hover:bg-[#00b4d8]/5"
                  >
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#00b4d8]" />
                      {c.name}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 font-mono">{c.container_code}</div>
                    <div className="text-xs text-neutral-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {c.latitude != null
                        ? `${Number(c.latitude).toFixed(3)}, ${Number(c.longitude).toFixed(3)}`
                        : 'No GPS — edit to pin on map'}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
