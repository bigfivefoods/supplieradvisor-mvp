'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { MapPin, Package } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import type { MapPin as Pin } from '@/components/LocationMap';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

const LocationMap = dynamic(() => import('@/components/LocationMap'), { ssr: false });

export default function ContainersMapPage() {
  return (
    <CompanyRequired>
      <MapInner />
    </CompanyRequired>
  );
}

function MapInner() {
  const companyId = getSelectedCompanyId()!;
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');

  useEffect(() => {
    fetch(`/api/containers?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setContainers(d.containers || []))
      .finally(() => setLoading(false));
  }, [companyId]);

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
    <ContainersPage>
      <ContainersHeader
        title="Container"
        titleAccent="map"
        description={
          loading
            ? 'Loading outlet locations…'
            : `${pins.length} mapped · ${unmapped.length} without coordinates`
        }
        action={
          <>
            <button
              type="button"
              onClick={() => setLayer('street')}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                layer === 'street'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-neutral-200 text-neutral-600'
              }`}
            >
              Street
            </button>
            <button
              type="button"
              onClick={() => setLayer('satellite')}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                layer === 'satellite'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-neutral-200 text-neutral-600'
              }`}
            >
              Satellite
            </button>
            <Link href="/dashboard/containers/manage" className="btn-secondary !py-2.5 !px-5 text-sm">
              Manage
            </Link>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 h-[480px] sm:h-[560px] rounded-3xl overflow-hidden border border-neutral-200 bg-white">
          {!loading && (
            <LocationMap pins={pins} layer={layer} height="100%" interactive scrollWheelZoom zoom={6} />
          )}
        </div>
        <div className="bg-white border border-neutral-200 rounded-3xl p-5 max-h-[560px] overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Outlets</h3>
          {containers.length === 0 ? (
            <p className="text-sm text-neutral-500">No containers yet.</p>
          ) : (
            <ul className="space-y-2">
              {containers.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/containers/${c.id}`}
                    className="block p-3 rounded-2xl border border-neutral-100 hover:border-[#00b4d8]/40 hover:bg-[#00b4d8]/5 transition-all"
                  >
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#00b4d8]" />
                      {c.name}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 font-mono">{c.container_code}</div>
                    <div className="text-xs text-neutral-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00b4d8]" />
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
    </ContainersPage>
  );
}
