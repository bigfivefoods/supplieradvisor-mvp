'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContractorRecord } from '@/lib/containers/types';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { KpiCard, Panel } from '@/components/relationship/RelationshipChrome';

export default function ContainerTrainingPage() {
  return (
    <CompanyRequired>
      <TrainingInner />
    </CompanyRequired>
  );
}

function TrainingInner() {
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const companyId = getSelectedCompanyId()!;

  useEffect(() => {
    fetch(`/api/containers/contractors?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setContractors(d.contractors || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  const counts = {
    pending: contractors.filter((c) => (c.training_status || 'pending') === 'pending').length,
    in_progress: contractors.filter((c) => c.training_status === 'in_progress').length,
    certified: contractors.filter((c) => c.training_status === 'certified').length,
  };

  return (
    <ContainersPage>
      <ContainersHeader
        title="Training"
        titleAccent="hub"
        description="Track independent contractor onboarding and certification for every outlet operator."
        action={
          <Link href="/dashboard/containers/contractors" className="btn-primary !py-2.5 !px-5 text-sm">
            Manage contractors
          </Link>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={GraduationCap}
          label="Pending"
          value={counts.pending}
          tone="amber"
          loading={loading}
        />
        <KpiCard
          icon={GraduationCap}
          label="In progress"
          value={counts.in_progress}
          tone="cyan"
          loading={loading}
        />
        <KpiCard
          icon={GraduationCap}
          label="Certified"
          value={counts.certified}
          tone="emerald"
          loading={loading}
        />
      </div>

      <Panel title="Operators">
        {contractors.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">
            No contractors yet.{' '}
            <Link href="/dashboard/containers/contractors" className="text-[#00b4d8] font-semibold">
              Appoint contractors
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {contractors.map((c) => (
              <li key={c.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-[#00b4d8]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{c.full_name}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {c.email || c.phone || '—'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#00b4d8]/10 text-[#0077b6] border border-[#00b4d8]/20 capitalize shrink-0">
                  {(c.training_status || 'pending').replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ContainersPage>
  );
}
