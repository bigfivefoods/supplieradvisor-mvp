'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContractorRecord } from '@/lib/containers/types';

export default function ContainerTrainingPage() {
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const companyId = getSelectedCompanyId();

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/containers/contractors?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setContractors(d.contractors || []));
  }, [companyId]);

  const counts = {
    pending: contractors.filter((c) => (c.training_status || 'pending') === 'pending').length,
    in_progress: contractors.filter((c) => c.training_status === 'in_progress').length,
    certified: contractors.filter((c) => c.training_status === 'certified').length,
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto">
      <Link href="/dashboard/containers" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Containers
      </Link>
      <h1 className="text-3xl font-black tracking-[-2px] text-[#00b4d8] mb-2">Training hub</h1>
      <p className="text-neutral-600 mb-8">
        Track independent contractor onboarding and certification for every outlet operator.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Pending', value: counts.pending, color: 'bg-amber-50 text-amber-800' },
          { label: 'In progress', value: counts.in_progress, color: 'bg-blue-50 text-blue-800' },
          { label: 'Certified', value: counts.certified, color: 'bg-emerald-50 text-emerald-800' },
        ].map((k) => (
          <div key={k.label} className={`rounded-3xl border p-6 ${k.color}`}>
            <div className="text-sm font-medium opacity-80">{k.label}</div>
            <div className="text-4xl font-black mt-2">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {contractors.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            No contractors yet.{' '}
            <Link href="/dashboard/containers/contractors" className="text-[#00b4d8] font-medium">
              Appoint contractors
            </Link>
          </div>
        ) : (
          <ul className="divide-y">
            {contractors.map((c) => (
              <li key={c.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-[#00b4d8]" />
                  <div>
                    <div className="font-semibold">{c.full_name}</div>
                    <div className="text-sm text-neutral-500">{c.email || c.phone || '—'}</div>
                  </div>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-neutral-100 capitalize">
                  {(c.training_status || 'pending').replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
