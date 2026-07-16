'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  MapPin,
  Package,
  User,
  Boxes,
  ShoppingCart,
  Loader2,
  Map,
} from 'lucide-react';
import type { ContainerRecord } from '@/lib/containers/types';
import InviteContractorButton from '@/components/containers/InviteContractorButton';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

export default function ContainerDetailPage() {
  return (
    <CompanyRequired>
      <DetailInner />
    </CompanyRequired>
  );
}

function DetailInner() {
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
      <ContainersPage>
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </ContainersPage>
    );
  }

  if (error || !container) {
    return (
      <ContainersPage>
        <ContainersHeader
          title="Outlet"
          titleAccent="not found"
          description={error || 'Container not found'}
        />
        <div className="text-center py-10">
          <Link
            href="/dashboard/containers/manage"
            className="btn-primary px-6 py-3"
          >
            Back to manage
          </Link>
        </div>
      </ContainersPage>
    );
  }

  const hasGps = container.latitude != null && container.longitude != null;

  return (
    <ContainersPage>
      <ContainersHeader
        title={container.name}
        titleAccent={container.container_code || 'outlet'}
        description={
          [container.address, container.city, container.province, container.country]
            .filter(Boolean)
            .join(', ') || 'No address set'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/containers/${id}/inventory`}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Boxes className="w-4 h-4" /> Inventory
            </Link>
            <Link
              href="/dashboard/containers/map"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Map className="w-4 h-4" /> Map
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
            container.status === 'active'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {container.status || 'status'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {container.assigned_contractor || 'Unassigned'}
        </span>
        <div className="ml-auto">
          <InviteContractorButton
            containerId={container.id}
            containerName={container.name}
            defaultName={container.assigned_contractor || ''}
            contractorId={container.contractor_id}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="h-72 rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          {hasGps ? (
            <LocationMap
              selectedPosition={[
                Number(container.latitude),
                Number(container.longitude),
              ]}
              pins={[
                {
                  id: container.id,
                  position: [
                    Number(container.latitude),
                    Number(container.longitude),
                  ],
                  label: container.name,
                },
              ]}
              height="100%"
              zoom={14}
              interactive={false}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-sm p-6 text-center gap-2">
              <MapPin className="w-8 h-8 text-slate-300" />
              No GPS coordinates. Edit the container and pin it on the map.
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              href: `/dashboard/containers/${id}/inventory`,
              icon: Boxes,
              title: 'Inventory',
              desc: 'Stock levels, receive goods, reorder',
            },
            {
              href: `/dashboard/containers/${id}/inventory?tab=orders`,
              icon: ShoppingCart,
              title: 'Orders',
              desc: 'Order stock for this outlet',
            },
            {
              href: '/dashboard/containers/contractors',
              icon: User,
              title: 'Contractors',
              desc: 'Appoint, train, pay operators',
            },
            {
              href: '/dashboard/containers/manage',
              icon: Package,
              title: 'All outlets',
              desc: 'CRUD manage list',
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white border border-slate-200 rounded-3xl p-5 hover:border-[#00b4d8] hover:shadow-md transition-all"
            >
              <card.icon className="w-6 h-6 text-[#00b4d8] mb-3" />
              <div className="font-semibold text-slate-900">{card.title}</div>
              <div className="text-sm text-neutral-500 mt-1">{card.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {container.notes && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold mb-2 text-slate-900">Notes</h3>
          <p className="text-neutral-600 whitespace-pre-wrap">
            {container.notes}
          </p>
        </div>
      )}
    </ContainersPage>
  );
}
