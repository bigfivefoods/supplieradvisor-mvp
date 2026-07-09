'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, MapPin, Package, User, Boxes, ShoppingCart, Loader2,
} from 'lucide-react';
import type { ContainerRecord } from '@/lib/containers/types';

const LocationMap = dynamic(() => import('@/components/LocationMap'), { ssr: false });

export default function ContainerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [container, setContainer] = useState<ContainerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/containers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setContainer(d.container);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error || !container) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">{error || 'Container not found'}</p>
        <Link href="/dashboard/containers/manage" className="btn-primary px-6 py-3">
          Back to manage
        </Link>
      </div>
    );
  }

  const hasGps = container.latitude != null && container.longitude != null;

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto">
      <Link href="/dashboard/containers/manage" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Manage containers
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
              {container.name}
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
              container.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100'
            }`}>
              {container.status}
            </span>
          </div>
          <p className="font-mono text-sm text-neutral-500">{container.container_code}</p>
          <p className="text-neutral-600 mt-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {[container.address, container.city, container.province, container.country]
              .filter(Boolean)
              .join(', ') || 'No address'}
          </p>
          <p className="text-neutral-600 mt-1 flex items-center gap-2">
            <User className="w-4 h-4" />
            Contractor: {container.assigned_contractor || 'Unassigned'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/containers/${id}/inventory`} className="btn-primary !py-3 !px-5 text-sm">
            <Boxes className="w-4 h-4" /> Inventory
          </Link>
          <Link href="/dashboard/containers/map" className="btn-secondary !py-3 !px-5 text-sm">
            Map
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="h-72 rounded-3xl overflow-hidden border bg-white">
          {hasGps ? (
            <LocationMap
              selectedPosition={[Number(container.latitude), Number(container.longitude)]}
              pins={[{
                id: container.id,
                position: [Number(container.latitude), Number(container.longitude)],
                label: container.name,
              }]}
              height="100%"
              zoom={14}
              interactive={false}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 text-sm p-6 text-center">
              No GPS coordinates. Edit the container and pin it on the map.
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { href: `/dashboard/containers/${id}/inventory`, icon: Boxes, title: 'Inventory', desc: 'Stock levels, receive goods, reorder' },
            { href: `/dashboard/containers/${id}/inventory?tab=orders`, icon: ShoppingCart, title: 'Orders', desc: 'Order stock for this outlet' },
            { href: '/dashboard/containers/contractors', icon: User, title: 'Contractors', desc: 'Appoint, train, pay operators' },
            { href: '/dashboard/containers/manage', icon: Package, title: 'All outlets', desc: 'CRUD manage list' },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white border border-neutral-200 rounded-3xl p-5 hover:border-[#00b4d8] transition-colors"
            >
              <card.icon className="w-6 h-6 text-[#00b4d8] mb-3" />
              <div className="font-semibold text-slate-900">{card.title}</div>
              <div className="text-sm text-neutral-500 mt-1">{card.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {container.notes && (
        <div className="bg-white border rounded-3xl p-6">
          <h3 className="font-bold mb-2">Notes</h3>
          <p className="text-neutral-600 whitespace-pre-wrap">{container.notes}</p>
        </div>
      )}
    </div>
  );
}
