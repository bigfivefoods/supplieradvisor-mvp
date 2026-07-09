'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import ContainerRiadRegister from '@/components/riad/ContainerRiadRegister';

/**
 * World-class Container RIAD register for company operators.
 * Risks · Issues · Actions · Decisions — scoped to containers, filterable,
 * and shared with independent contractors who can log from their portal.
 */
export default function ContainerRiadLogPage() {
  const companyId = getSelectedCompanyId();
  const [containers, setContainers] = useState<ContainerRecord[]>([]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/containers?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setContainers(d.containers || []))
      .catch(() => setContainers([]));
  }, [companyId]);

  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">Select a company to manage the container RIAD log.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-10">
      <Link
        href="/dashboard/containers"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-neutral-800"
      >
        <ArrowLeft className="w-4 h-4" /> Containers
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
          Container RIAD register
        </h1>
        <p className="text-neutral-600 mt-2 max-w-2xl">
          Best-in-class operational log for container Risks, Issues, Actions, and Decisions.
          Independent contractors can also log RIADs for their allocated outlet — you see everything
          here in one place.
        </p>
      </div>
      <ContainerRiadRegister mode="business" companyId={companyId} containers={containers} />
    </div>
  );
}
