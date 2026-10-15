'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClientApp, PublicProgramme, WorkersApp } from '@/components/construction/RoleApps';
import { ConstructionError, ConstructionLoading } from '@/components/construction/ConstructionUi';
import {
  emptyConstructiongraphStore,
  type ClientPortalView,
  type ConstructionPortalView,
  type ConstructiongraphStore,
  type ContractorPortalView,
} from '@/lib/construction/constructiongraph';

function workersStore(view: ContractorPortalView): ConstructiongraphStore {
  const siteId = view.projects[0]?.siteId || 'site';
  return {
    ...emptyConstructiongraphStore(),
    sites: view.projects.map((row) => ({
      id: row.siteId,
      code: row.code,
      name: row.name,
      status: row.status,
      address: view.projectName,
    })),
    programme: view.activities.map((row) => ({
      id: row.id,
      site_id: siteId,
      activity: row.activity,
      status: row.status,
      planned_pct: row.plannedPct,
      actual_pct: row.actualPct,
      planned_start: row.plannedStart,
      planned_end: row.plannedEnd,
    })),
    snags: view.openSnags.map((row, index) => ({
      id: `snag_${index}`,
      site_id: siteId,
      item: row.item,
      location: row.location,
      status: row.status,
    })),
    diary: (view.diary || []).map((row) => ({
      id: row.id,
      site_id: siteId,
      date: row.date,
      weather: row.weather,
      progress_note: row.progress,
      signed_off_at: row.signedOff ? row.date : null,
    })),
    materials: (view.materials || []).map((row) => ({
      id: row.id,
      site_id: siteId,
      item: row.item,
      uom: row.uom,
      ordered_qty: row.ordered,
      delivered_qty: row.delivered,
    })),
    photos: (view.photos || []).map((row) => ({
      id: row.id,
      site_id: siteId,
      caption: row.caption,
      taken_on: row.takenOn,
    })),
    time_entries: (view.timeEntries || []).map((row) => ({
      id: row.id,
      site_id: siteId,
      minutes: row.minutes,
      note: row.note,
      at: row.at || undefined,
    })),
    payments: view.seeMoney
      ? view.payments.map((row) => ({
          id: row.id,
          site_id: siteId,
          number: row.number,
          title: row.title,
          planned_amount: row.plannedAmount,
          claimed_amount: row.claimedAmount,
          certified_amount: row.certifiedAmount,
          paid_amount: row.paidAmount,
          status: row.status,
        }))
      : [],
    settings: { workers_see_money: view.seeMoney },
  };
}

export function ConstructionTokenApp({ token, expect }: { token: string; expect?: 'client' | 'contractor' | 'public' }) {
  const [view, setView] = useState<ConstructionPortalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/constructiongraph?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.view) throw new Error(data.error || 'Portal not found');
      setView(data.view as ConstructionPortalView);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Portal not found');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ConstructionLoading testId="portal-loading" />;
  if (error || !view) return <ConstructionError testId="portal-error" onRetry={() => void load()} />;
  if (expect && view.kind !== expect) {
    return <ConstructionError testId="portal-error" onRetry={() => void load()} />;
  }
  if (view.kind === 'client') return <ClientApp view={view as ClientPortalView} />;
  if (view.kind === 'contractor') {
    const contractor = view as ContractorPortalView;
    return <WorkersApp store={workersStore(contractor)} siteId={contractor.projects[0]?.siteId} seeMoney={contractor.seeMoney} />;
  }
  return <PublicProgramme view={view} />;
}

export default function ConstructionPortalPage() {
  const params = useParams<{ token: string }>();
  return <ConstructionTokenApp token={String(params?.token || '')} />;
}
