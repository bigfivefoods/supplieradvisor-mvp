'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import { emptyFleetBook } from '@/lib/fleet/empty-book';
import { applyFleetOp } from '@/lib/fleet/ops';
import type { PeriodId } from '@/lib/fleet/periods';
import { capabilitiesFor } from '@/lib/fleet/roles';
import { sampleFleetBook } from '@/lib/fleet/sample-book';
import type { FleetBook, FleetOp, FleetRole } from '@/lib/fleet/types';
import { fleetBtn, fleetFocus } from './FleetUi';
import { FleetDesk, type FleetScreen } from './FleetViews';

const KEY = 'fleet-preview-book-v1';

const SCREENS: Record<string, FleetScreen> = {
  command: 'command',
  map: 'map',
  vehicles: 'vehicles',
  drivers: 'drivers',
  jobs: 'jobs',
  cpk: 'cpk',
  settings: 'settings',
};

export function PreviewShell({ screen }: { screen: FleetScreen }) {
  const [book, setBook] = useState<FleetBook | null>(null);
  const [role, setRole] = useState<FleetRole>('owner');
  const [periodId, setPeriodId] = useState<PeriodId>('last');
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const steps = MODULE_NAV.find((mod) => mod.id === 'fleetgraph')?.steps || [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') window.sessionStorage.removeItem(KEY);
    const asked = params.get('role');
    if (asked === 'owner' || asked === 'manager' || asked === 'dispatcher' || asked === 'office') setRole(asked);
    if (params.get('empty') === '1') {
      setBook(emptyFleetBook(1, '2024-07-02T08:00:00.000Z'));
      return;
    }
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) {
      try {
        setBook(JSON.parse(stored) as FleetBook);
        return;
      } catch {
        window.sessionStorage.removeItem(KEY);
      }
    }
    setBook(sampleFleetBook());
  }, []);

  useEffect(() => {
    if (book) window.sessionStorage.setItem(KEY, JSON.stringify(book));
  }, [book]);

  function onOp(op: FleetOp, expected?: string | null) {
    if (!book) return;
    const outcome = applyFleetOp(
      book,
      op,
      { role, actorId: 'preview', now: '2024-07-02T08:00:00.000Z', companyId: 1, enforceRealData: false },
      expected
    );
    if (!outcome.ok) {
      setNotice(outcome.error);
      return false;
    }
    setNotice(null);
    setBook(outcome.book);
    return true;
  }

  const caps = capabilitiesFor(role, { dispatcherSeesRates: book?.workspace.dispatcher_sees_rates });
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]" data-book-ready={book ? '1' : '0'}>
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-white px-3 py-2 md:hidden">
        <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-menu" aria-expanded={menu} onClick={() => setMenu((value) => !value)}>
          {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Menu
        </button>
      </div>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={`${menu ? 'block' : 'hidden'} min-h-screen border-[#e2e8f0] bg-white md:sticky md:top-0 md:block md:min-h-screen md:border-r`} data-testid="fleet-sidebar">
          <p className="px-4 pt-4 text-xs font-black uppercase tracking-wide text-[#0077b6]">FleetAdvisor®</p>
          <ul className="space-y-1 p-3">
            {steps.map((step) => {
              const name = step.href === '/dashboard/fleetgraph' ? 'command' : step.href.split('/').pop() || 'command';
              const active = SCREENS[name] === screen;
              return (
                <li key={step.href}>
                  <Link
                    href={step.href === '/dashboard/fleetgraph' ? '/preview/fleetgraph' : step.href.replace('/dashboard/fleetgraph', '/preview/fleetgraph')}
                    className={`${fleetFocus} flex min-h-11 items-center rounded-2xl px-3 text-sm font-bold ${active ? 'bg-[#00b4d8] text-[#0f172a]' : 'text-slate-800'}`}
                    onClick={() => setMenu(false)}
                  >
                    {step.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
        <div className="min-w-0">
          {book ? (
            <FleetDesk
              screen={screen}
              phase="ready"
              book={book}
              role={role}
              caps={caps}
              periodId={periodId}
              hrefBase="/preview/fleetgraph"
              today="2024-07-02"
              notice={notice}
              illustrate
              onPeriod={setPeriodId}
              onOp={onOp}
            />
          ) : (
            <FleetDesk
              screen={screen}
              phase="loading"
              book={emptyFleetBook()}
              role={role}
              caps={caps}
              periodId={periodId}
              hrefBase="/preview/fleetgraph"
              today="2024-07-02"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function screenFromParam(value: string | undefined): FleetScreen {
  if (value && value in SCREENS) return SCREENS[value];
  return 'command';
}
