'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { emptyFleetBook } from '@/lib/fleet/empty-book';
import { sastDate } from '@/lib/fleet/format';
import type { PeriodId } from '@/lib/fleet/periods';
import { capabilitiesFor } from '@/lib/fleet/roles';
import type { FleetBook, FleetOp, FleetRole } from '@/lib/fleet/types';
import { fleetBtn, fleetFocus } from './FleetUi';
import { FleetDesk, type FleetScreen } from './FleetViews';

type Payload = {
  ready?: boolean;
  reason?: string;
  role?: FleetRole;
  book?: FleetBook & { cpk?: unknown };
  error?: string;
};

export function FleetLive({ screen }: { screen: FleetScreen }) {
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [book, setBook] = useState<FleetBook>(emptyFleetBook());
  const [role, setRole] = useState<FleetRole>('viewer');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<PeriodId>('last');
  const today = sastDate(new Date()) || '2024-07-02';

  async function load() {
    const companyId = window.localStorage.getItem('selectedCompanyId') || '';
    const response = await fetch('/api/fleet/fleetgraph', {
      headers: { 'x-fleet-company': companyId },
      cache: 'no-store',
    });
    const body = (await response.json()) as Payload;
    if (!response.ok) {
      setNotice(body.error || 'The desk could not open.');
      setPhase('error');
      return;
    }
    if (body.ready === false) {
      setPending(true);
      setBook(emptyFleetBook(Number(companyId) || 0));
      setPhase('ready');
      return;
    }
    if (body.book) {
      const next = { ...emptyFleetBook(), ...body.book } as FleetBook;
      delete (next as FleetBook & { cpk?: unknown }).cpk;
      setBook(next);
      setRole(body.role || 'viewer');
      setPending(false);
      setPhase('ready');
    }
  }

  useEffect(() => {
    load().catch(() => setPhase('error'));
  }, []);

  async function onOp(op: FleetOp, expected?: string | null) {
    const companyId = window.localStorage.getItem('selectedCompanyId') || '';
    const response = await fetch('/api/fleet/fleetgraph', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-fleet-company': companyId },
      body: JSON.stringify({ op: op.op, payload: op.payload, expected_updated_at: expected || null }),
    });
    const body = (await response.json()) as Payload;
    if (body.ready === false) {
      setPending(true);
      setNotice('Database setup is still pending.');
      return;
    }
    if (!response.ok || body.error) {
      setNotice(body.error || 'The desk could not save that.');
      return;
    }
    if (body.book) {
      const next = { ...emptyFleetBook(), ...body.book } as FleetBook;
      delete (next as FleetBook & { cpk?: unknown }).cpk;
      setBook(next);
      setRole(body.role || role);
      setNotice(null);
    }
  }

  const caps = capabilitiesFor(role, { dispatcherSeesRates: book.workspace.dispatcher_sees_rates });
  return (
    <div className="min-w-0">
      {phase === 'error' && !notice ? null : null}
      {phase === 'error' ? (
        <div className="px-4 pt-4">
          <Link className={`${fleetBtn} ${fleetFocus}`} href="/dashboard">
            Back to the dashboard
          </Link>
        </div>
      ) : null}
      <FleetDesk
        screen={screen}
        phase={phase}
        book={book}
        role={role}
        caps={caps}
        periodId={periodId}
        hrefBase="/dashboard/fleetgraph"
        today={today}
        notice={notice}
        migrationPending={pending}
        onPeriod={setPeriodId}
        onOp={(op, expected) => {
          onOp(op, expected).catch(() => setNotice('The desk could not save that.'));
        }}
      />
    </div>
  );
}
