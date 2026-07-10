'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Users, MapPin, Package } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { KpiCard, Panel } from '@/components/relationship/RelationshipChrome';

type Metrics = {
  total: number;
  active: number;
  mapped: number;
  contractors: number;
  verified: number;
  certified: number;
};

export default function ContainersMetrics() {
  return (
    <CompanyRequired>
      <MetricsInner />
    </CompanyRequired>
  );
}

function MetricsInner() {
  const companyId = getSelectedCompanyId()!;
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(`/api/containers?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/containers/contractors?companyId=${companyId}`).then((r) => r.json()),
      ]);
      const containers = cRes.containers || [];
      const contractors = tRes.contractors || [];
      setM({
        total: containers.length,
        active: containers.filter((c: { status?: string }) =>
          !c.status ||
          ['active', 'deployed', 'operational', 'open'].includes(
            String(c.status).toLowerCase()
          )
        ).length,
        mapped: containers.filter(
          (c: { latitude?: number | null; longitude?: number | null }) =>
            c.latitude != null && c.longitude != null
        ).length,
        contractors: contractors.length,
        verified: contractors.filter(
          (c: { verification_status?: string }) =>
            String(c.verification_status || '').toLowerCase() === 'verified'
        ).length,
        certified: contractors.filter(
          (c: { training_status?: string }) => c.training_status === 'certified'
        ).length,
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ContainersPage>
      <ContainersHeader
        title="Network"
        titleAccent="metrics"
        description="Live pulse across outlets, map coverage, and contractor readiness — from Supabase."
        action={
          <Link href="/dashboard/containers/manage" className="btn-secondary !py-2.5 !px-5 text-sm">
            Manage outlets
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={Package}
          label="Total containers"
          value={m?.total ?? 0}
          sub={`${m?.active ?? 0} active`}
          href="/dashboard/containers/manage"
          loading={loading}
          tone="cyan"
        />
        <KpiCard
          icon={MapPin}
          label="Mapped outlets"
          value={m?.mapped ?? 0}
          sub="With GPS coordinates"
          href="/dashboard/containers/map"
          loading={loading}
          tone="emerald"
        />
        <KpiCard
          icon={Users}
          label="Contractors"
          value={m?.contractors ?? 0}
          sub={`${m?.verified ?? 0} verified`}
          href="/dashboard/containers/contractors"
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label="Certified operators"
          value={m?.certified ?? 0}
          sub="Training complete"
          href="/dashboard/containers/training"
          loading={loading}
          tone="violet"
        />
      </div>

      <Panel title="Coming next">
        <div className="p-8 sm:p-10 text-center">
          <p className="text-sm font-semibold text-slate-800 mb-2">
            Advanced analytics on the roadmap
          </p>
          <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
            Top performing containers, regional breakdowns, trend charts, contractor rankings, and
            impact metrics (jobs created, households served) will layer on this live pulse.
          </p>
        </div>
      </Panel>
    </ContainersPage>
  );
}
