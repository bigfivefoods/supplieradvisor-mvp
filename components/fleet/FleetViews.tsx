'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, ClipboardList, Gauge, Truck, Users } from 'lucide-react';
import { cpkForBook } from '@/lib/fleet/book-cpk';
import { complianceLabel, complianceStatus } from '@/lib/fleet/compliance';
import { requiredRate, type VehicleCpk } from '@/lib/fleet/cpk';
import { signedPerKm } from '@/lib/fleet/cpk-fixtures';
import { centsFromRand, formatKm, formatLitresPer100, formatPerKm, formatSastDate } from '@/lib/fleet/format';
import {
  complianceKindLabel,
  distanceSourceLabel,
  driverStatusLabel,
  employmentLabel,
  fleetRoleLabel,
  jobStatusLabel,
  runningCategoryLabel,
  ownershipLabel,
  vehicleKindLabel,
  vehicleStatusLabel,
} from '@/lib/fleet/labels';
import { nextMonth, periodFor, type PeriodId } from '@/lib/fleet/periods';
import type { FleetCapabilities } from '@/lib/fleet/roles';
import type { FleetBook, FleetOp, FleetRole } from '@/lib/fleet/types';
import { CpkWaterfallArt, DispatchArt, ExpiryStripArt, FleetRegisterArt, MapSketchArt, PodArt } from './Illustrations';
import {
  FleetBanner,
  FleetCompletenessChip,
  FleetDate,
  FleetDrawer,
  FleetEmpty,
  FleetError,
  FleetLoading,
  FleetMoney,
  FleetPageHead,
  FleetSection,
  FleetSegmented,
  FleetSoonChip,
  FleetStat,
  FleetStatusPill,
  FleetTable,
  FleetVariancePill,
  fleetBtn,
  fleetField,
  fleetFocus,
  fleetGhost,
  fleetLabel,
  fleetLink,
} from './FleetUi';

export type FleetScreen = 'command' | 'map' | 'vehicles' | 'drivers' | 'jobs' | 'cpk' | 'settings';

export type FleetDeskProps = {
  screen: FleetScreen;
  phase: 'loading' | 'error' | 'ready';
  book: FleetBook;
  role: FleetRole;
  caps: FleetCapabilities;
  periodId: PeriodId;
  hrefBase: string;
  today: string;
  notice?: string | null;
  migrationPending?: boolean;
  illustrate?: boolean;
  onPeriod?: (id: PeriodId) => void;
  onOp?: (op: FleetOp, expected?: string | null) => void | boolean | Promise<boolean | void>;
};

function useCpk(props: FleetDeskProps): VehicleCpk[] {
  const period = periodFor(props.periodId, props.today, props.book.workspace.cpk_window_days);
  if (!props.caps.seesCosts) return [];
  return cpkForBook(props.book, period);
}

async function commitOp(props: FleetDeskProps, op: FleetOp, expected?: string | null): Promise<boolean> {
  const result = await props.onOp?.(op, expected);
  return result !== false;
}

export function FleetDesk(props: FleetDeskProps) {
  if (props.phase === 'loading') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4">
        <FleetLoading />
      </main>
    );
  }
  if (props.phase === 'error') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4">
        <FleetError
          action={
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => props.onOp?.({ op: 'settings.update', payload: {} })}>
              Try again
            </button>
          }
        />
      </main>
    );
  }
  if (props.screen === 'command') return <CommandView {...props} />;
  if (props.screen === 'map') return <MapView {...props} />;
  if (props.screen === 'vehicles') return <VehiclesView {...props} />;
  if (props.screen === 'drivers') return <DriversView {...props} />;
  if (props.screen === 'jobs') return <JobsView {...props} />;
  if (props.screen === 'cpk') return <CpkView {...props} />;
  return <SettingsView {...props} />;
}

function Banners(props: FleetDeskProps) {
  return (
    <>
      {props.migrationPending ? (
        <FleetBanner tone="info" testId="fleet-migration-banner">
          Database setup is still pending. Figures will appear after the fleet tables are applied.
        </FleetBanner>
      ) : null}
      {!props.book.workspace.real_data_enabled ? (
        <FleetBanner tone="info" testId="fleet-demo-banner">
          Demo-data mode is on. Personal details stay off until an owner confirms real data in Settings.
        </FleetBanner>
      ) : null}
      {props.notice ? <FleetBanner tone="pending">{props.notice}</FleetBanner> : null}
    </>
  );
}

function CommandView(props: FleetDeskProps) {
  const cpk = useCpk({ ...props, periodId: 'last' });
  const vehicles = props.book.vehicles.filter((row) => !row.archived_at);
  const drivers = props.book.drivers.filter((row) => !row.archived_at);
  const openJobs = props.book.jobs.filter((row) => row.status !== 'cancelled' && !row.archived_at);
  const expiring = props.book.compliance.filter((row) => {
    const state = complianceStatus(row.expires_on, props.today, props.book.workspace.expiring_window_days);
    return state === 'expired' || state === 'expiring';
  });
  const fleet = fleetRollup(cpk, 'last', props.book.workspace.cpk_window_days);
  const empty = vehicles.length === 0 && drivers.length === 0 && openJobs.length === 0;
  const attention = attentionRows(props);
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-command">
      <FleetPageHead
        title="Command"
        detail="Vehicles, drivers, open jobs, expiries and fleet cost per kilometre."
        illustration={props.illustrate}
      />
      <Banners {...props} />
      {empty ? (
        <FleetEmpty
          testId="fleet-command-empty"
          icon={<Truck />}
          title="Your fleet desk is empty"
          hint="Add a vehicle to start the register. Cost per kilometre shows Not enough data until odometer readings and costs exist."
          illustration={
            <div className="space-y-3">
              <FleetRegisterArt />
              <ExpiryStripArt />
              <CpkWaterfallArt />
            </div>
          }
          action={
            <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
              Add your first vehicle
            </Link>
          }
        />
      ) : (
        <>
          <section className="overflow-hidden rounded-3xl bg-[#0f172a] shadow-sm">
            <div className="bg-[#00b4d8] px-5 py-5 text-[#0f172a]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em]">
                    {props.caps.seesCosts ? 'Fleet cost per kilometre' : 'Today on the board'}
                  </p>
                  <p className="mt-1 text-4xl font-black tabular-nums" data-testid="fleet-command-hero">
                    {props.caps.seesCosts ? fleet.value : `${openJobs.length} open jobs`}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {props.caps.seesCosts
                      ? `${fleet.hint}${fleet.target ? ` · fleet target ${formatPerKm(fleet.target)}/km` : ''}`
                      : `${vehicles.length} vehicles · ${expiring.length} dates due`}
                  </p>
                </div>
                <span className="rounded-full bg-[#0f172a] px-3 py-1 text-xs font-black text-white" data-testid="fleet-role-chip">
                  {fleetRoleLabel(props.role)}
                </span>
              </div>
              {props.role === 'office' ? (
                <p className="mt-3 text-sm font-bold">Office sees costs and prices. Driver pay is left out of this view.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 px-5 py-3">
              <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/jobs`}>Open jobs</Link>
              <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>Vehicles</Link>
              {props.caps.seesCosts ? (
                <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/cpk`}>Cost per kilometre</Link>
              ) : (
                <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/drivers`}>Drivers</Link>
              )}
            </div>
            {props.role === 'office' ? (
              <p className="px-5 pb-4 text-sm font-bold text-white">Driver pay stays with the owner. The fleet figure above excludes it.</p>
            ) : null}
          </section>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <FleetStat label="Vehicles" value={String(vehicles.length)} icon={<Truck className="h-4 w-4" aria-hidden />} />
            <FleetStat label="Drivers" value={String(drivers.length)} icon={<Users className="h-4 w-4" aria-hidden />} />
            <FleetStat label="Open jobs" value={String(openJobs.length)} icon={<ClipboardList className="h-4 w-4" aria-hidden />} />
            <FleetStat label="Expiring or expired" value={String(expiring.length)} icon={<AlertTriangle className="h-4 w-4" aria-hidden />} />
            {props.caps.seesCosts ? (
              <div className="col-span-2 lg:col-span-1" data-testid="fleet-cpk-tile">
                <FleetStat label="Fleet CPK" value={fleet.value} hint={fleet.hint} icon={<Gauge className="h-4 w-4" aria-hidden />} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <FleetSection title="Today">
              <TodayList {...props} />
            </FleetSection>
            <FleetSection title="Compliance expiry">
              <ExpiryList {...props} />
            </FleetSection>
          </div>
          <FleetSection title="Needs attention">
            {attention.length === 0 ? (
              <p className="text-sm text-slate-600">Nothing is waiting. Expiries and workshop vehicles will list here.</p>
            ) : (
              <ul className="space-y-2">
                {attention.map((item) => (
                  <li key={item} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </FleetSection>
          <FleetSection title="Setup">
            <SetupList {...props} />
          </FleetSection>
        </>
      )}
    </main>
  );
}

function fleetRollup(rows: VehicleCpk[], periodId: PeriodId, windowDays: number): { value: string; hint: string; target: number | null; perKm: number | null } {
  const ready = rows.filter((row) => row.status === 'ok' && row.fully_loaded_per_km != null && (row.total_km || 0) > 0);
  const name = periodId === 'mtd' ? 'month to date' : periodId === 'trail' ? `trailing ${windowDays} days` : 'last full month';
  if (!ready.length) {
    return { value: 'Not enough data', hint: rows.find((row) => row.next_step)?.next_step || 'Add two odometer readings at least 7 days apart', target: null, perKm: null };
  }
  const km = ready.reduce((sum, row) => sum + (row.total_km || 0), 0);
  const total = ready.reduce((sum, row) => sum + (row.total_cents || 0), 0);
  const perKm = km > 0 ? total / km / 100 : null;
  const targeted = ready.filter((row) => row.target_per_km != null);
  const targetKm = targeted.reduce((sum, row) => sum + (row.total_km || 0), 0);
  const target = targetKm > 0 ? targeted.reduce((sum, row) => sum + (row.target_per_km || 0) * (row.total_km || 0), 0) / targetKm : null;
  const partial = ready.some((row) => row.completeness !== 'complete');
  return { value: `${formatPerKm(perKm)}/km`, hint: partial ? `Fleet · partial · ${name}` : `Fleet · ${name}`, target, perKm };
}

function TodayList(props: FleetDeskProps) {
  const jobs = props.book.jobs.filter((job) => !job.archived_at && job.status !== 'cancelled').slice(0, 4);
  if (!jobs.length) return <p className="text-sm text-slate-600">No open jobs on the board.</p>;
  return (
    <ul className="space-y-2">
      {jobs.map((job) => {
        const vehicle = props.book.vehicles.find((row) => row.id === job.vehicle_id);
        const driver = props.book.drivers.find((row) => row.id === job.driver_id);
        return (
          <li key={job.id} className="text-sm">
            <p className="font-black text-slate-900">{job.reference}</p>
            <p className="text-slate-600">{jobStatusLabel(job.status)} · {vehicle?.reg_no || 'No vehicle'} · {driver?.full_name || 'No driver'}</p>
          </li>
        );
      })}
    </ul>
  );
}

function ExpiryList(props: FleetDeskProps) {
  const rows = props.book.compliance.filter((row) => row.expires_on).slice(0, 4);
  if (!rows.length) return <p className="text-sm text-slate-600">No expiry dates yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="font-bold text-slate-800">{complianceKindLabel(row.kind)}</span>
          <span className="inline-flex items-center gap-1 text-slate-600"><CalendarClock className="h-3.5 w-3.5" aria-hidden />{complianceLabel(row.expires_on, props.today, props.book.workspace.expiring_window_days)}</span>
        </li>
      ))}
    </ul>
  );
}

function attentionRows(props: FleetDeskProps): string[] {
  const items: Array<{ rank: number; label: string }> = [];
  for (const row of props.book.compliance) {
    const state = complianceStatus(row.expires_on, props.today, props.book.workspace.expiring_window_days);
    if (state === 'expired') items.push({ rank: 0, label: `${complianceKindLabel(row.kind)} · ${complianceLabel(row.expires_on, props.today, props.book.workspace.expiring_window_days)}` });
    if (state === 'expiring') items.push({ rank: 1, label: `${complianceKindLabel(row.kind)} · ${complianceLabel(row.expires_on, props.today, props.book.workspace.expiring_window_days)}` });
  }
  for (const vehicle of props.book.vehicles) {
    if (vehicle.status === 'workshop' || vehicle.status === 'off_road') {
      items.push({ rank: 2, label: `${vehicle.reg_no} is ${vehicle.status === 'workshop' ? 'in the workshop' : 'off road'}` });
    }
  }
  for (const job of props.book.jobs) {
    if (job.archived_at || job.status === 'cancelled') continue;
    if (!props.book.stops.some((stop) => stop.job_id === job.id)) items.push({ rank: 3, label: `${job.reference} has no stops` });
  }
  return items.sort((a, b) => a.rank - b.rank).map((item) => item.label);
}

function SetupList(props: FleetDeskProps) {
  const steps = [
    ['Workspace name', Boolean(props.book.workspace.display_name)],
    ['First vehicle', props.book.vehicles.length > 0],
    ['First driver', props.book.drivers.length > 0],
    ['First expiry date', props.book.compliance.some((row) => row.expires_on)],
    ['First odometer reading', props.book.odometer_readings.length > 0],
    ['First cost profile', props.book.cost_profiles.length > 0],
    ['First job', props.book.jobs.length > 0],
  ] as const;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {steps.map(([label, done]) => (
        <li key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 text-sm">
          <span>{label}</span>
          <FleetStatusPill tone={done ? 'ok' : 'muted'}>{done ? 'Done' : 'Still to add'}</FleetStatusPill>
        </li>
      ))}
    </ul>
  );
}

function MapView(props: FleetDeskProps) {
  const vehicles = props.book.vehicles.filter((row) => !row.archived_at);
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-map">
      <FleetPageHead
        title="Fleet map"
        detail="Nothing is tracked yet. This page explains where a position can come from later."
        illustration={props.illustrate}
      />
      <Banners {...props} />
      <MapSketchArt />
      <FleetSection title="Position sources">
        <ul className="space-y-3">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">Manual odometer</p>
              <p className="text-sm text-slate-600">Available now. A reading gives last-known distance, not a live dot.</p>
            </div>
            <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
              Add an odometer reading
            </Link>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">Driver phone</p>
              <p className="text-sm text-slate-600">A consented phone fix during a trip. Not switched on.</p>
            </div>
            <FleetSoonChip />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">GPS file import</p>
              <p className="text-sm text-slate-600">A file of fixes you already hold. Not switched on.</p>
            </div>
            <FleetSoonChip />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">Telematics integrations</p>
              <p className="text-sm text-slate-600">A tracker feed. Not assumed, and not switched on.</p>
            </div>
            <FleetSoonChip />
          </li>
        </ul>
      </FleetSection>
      <FleetSection title="Last known odometer">
        {vehicles.length === 0 ? (
          <FleetEmpty
            title="No vehicles yet"
            hint="Add a vehicle, then record an odometer reading."
            action={
              <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
                Add your first vehicle
              </Link>
            }
          />
        ) : (
          <FleetTable
            testId="fleet-odometer-list"
            columns={['Registration', 'Odometer', 'Read', 'Status']}
            rows={vehicles.map((vehicle) => ({
              id: vehicle.id,
              cells: [
                vehicle.reg_no,
                formatKm(vehicle.odometer_km),
                <FleetDate key="d" value={vehicle.odometer_at} />,
                <FleetStatusPill key="s" tone={vehicle.status === 'active' ? 'ok' : 'warn'}>
                  {vehicleStatusLabel(vehicle.status)}
                </FleetStatusPill>,
              ],
              card: (
                <div>
                  <p className="font-black">{vehicle.reg_no}</p>
                  <p className="text-sm tabular-nums text-slate-600">{formatKm(vehicle.odometer_km)}</p>
                </div>
              ),
            }))}
          />
        )}
      </FleetSection>
    </main>
  );
}

function VehiclesView(props: FleetDeskProps) {
  const cpk = useCpk(props);
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [reg, setReg] = useState('');
  const [odo, setOdo] = useState('');
  const [amount, setAmount] = useState('');
  const [costDate, setCostDate] = useState(props.today);
  const [category, setCategory] = useState('maintenance');
  const [litres, setLitres] = useState('');
  const [fuelOdo, setFuelOdo] = useState('');
  const [vatClaim, setVatClaim] = useState(true);
  const [vatRand, setVatRand] = useState('');
  const [fullTank, setFullTank] = useState(false);
  const [status, setStatus] = useState('active');
  const [showProfile, setShowProfile] = useState(false);
  const current = props.book.vehicles.find((vehicle) => vehicle.id === open);
  useEffect(() => {
    if (open == null) return;
    setReg(open === 'new' ? '' : current?.reg_no || '');
    setStatus(current?.status || 'active');
  }, [open, current?.id, current?.reg_no, current?.status]);
  const rows = props.book.vehicles.filter((vehicle) => {
    if (vehicle.archived_at) return false;
    if (filter !== 'all' && vehicle.status !== filter) return false;
    if (query && !vehicle.reg_no.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const amountCents = centsFromRand(amount);
  const vatCents = vatRand.trim() === '' ? null : centsFromRand(vatRand);
  const costReady = amountCents != null && amountCents > 0 && (vatRand.trim() === '' || (vatCents != null && vatCents >= 0));
  const odoReady = odo.trim() !== '' && Number.isFinite(Number(odo)) && Number(odo) > 0;
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-vehicles">
      <FleetPageHead
        title="Vehicles"
        detail="Registration, status, odometer and, where your role allows it, cost per kilometre."
        illustration={props.illustrate}
        actions={
          props.caps.canEditRegister ? (
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-add-vehicle" onClick={() => { setOpen('new'); setReg(''); }}>
              Add a vehicle
            </button>
          ) : null
        }
      />
      <Banners {...props} />
      <FleetSegmented
        label="Vehicle status"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'workshop', label: 'Workshop' },
          { id: 'off_road', label: 'Off road' },
          { id: 'sold', label: 'Sold' },
        ]}
      />
      <label className={fleetLabel}>
        Search
        <input className={`${fleetField} ${fleetFocus}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Registration" />
      </label>
      {rows.length === 0 ? (
        <FleetEmpty
          title="No vehicles in this view"
          hint="Add a vehicle to start the register."
          illustration={<FleetRegisterArt />}
          action={
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>
              Add your first vehicle
            </button>
          }
        />
      ) : (
        <FleetTable
          testId="fleet-vehicle-table"
          columns={['Registration', 'Kind', 'Status', 'Ownership', 'Odometer', ...(props.caps.seesCosts ? ['CPK'] : [])]}
          rows={rows.map((vehicle) => {
            const metric = cpk.find((row) => row.vehicle_id === vehicle.id);
            return {
              id: vehicle.id,
              cells: [
                <button key="o" type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} data-testid={`fleet-open-${vehicle.reg_no.replace(/\s+/g, '-')}`} onClick={() => setOpen(vehicle.id)}>
                  {vehicle.reg_no}
                </button>,
                vehicleKindLabel(vehicle.kind),
                <FleetStatusPill key="s" tone={vehicle.status === 'active' ? 'ok' : vehicle.status === 'sold' ? 'muted' : 'warn'}>
                  {vehicleStatusLabel(vehicle.status)}
                </FleetStatusPill>,
                ownershipLabel(vehicle.ownership),
                formatKm(vehicle.odometer_km),
                ...(props.caps.seesCosts
                  ? [
                      <span key="c" className="inline-flex flex-col gap-1">
                        <span className="tabular-nums">{metric?.status === 'ok' ? `${formatPerKm(metric.fully_loaded_per_km)}/km` : 'Not enough data'}</span>
                        <FleetCompletenessChip completeness={metric?.completeness || 'none'} missing={metric?.missing} />
                      </span>,
                    ]
                  : []),
              ],
              card: (
                <button type="button" className="min-h-11 w-full text-left" onClick={() => setOpen(vehicle.id)}>
                  <p className="font-black">{vehicle.reg_no}</p>
                  <p className="text-sm text-slate-600">{vehicleKindLabel(vehicle.kind)} · {vehicleStatusLabel(vehicle.status)} · {formatKm(vehicle.odometer_km)}</p>
                </button>
              ),
            };
          })}
        />
      )}
      <FleetDrawer open={open != null} title={current ? current.reg_no : 'New vehicle'} onClose={() => setOpen(null)} testId="fleet-vehicle-drawer">
        <div className="space-y-4">
          <section>
            <h3 className="mb-3 text-sm font-black tracking-tight text-[#0f172a]">Details</h3>
            <label className={fleetLabel}>
              Registration
              <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-reg" value={reg} onChange={(event) => setReg(event.target.value)} />
            </label>
            {props.caps.canEditRegister ? (
              <button
                type="button"
                className={`${fleetBtn} ${fleetFocus} mt-3`}
                data-testid="fleet-save-vehicle"
                disabled={!reg.trim()}
                onClick={() => {
                  void commitOp(
                    props,
                    {
                      op: 'vehicle.upsert',
                      payload: {
                        id: current?.id,
                        reg_no: reg,
                        kind: current?.kind || 'rigid',
                        ownership: current?.ownership || 'owned',
                        status,
                      },
                    },
                    current?.updated_at
                  ).then((saved) => {
                    if (saved) setOpen(null);
                  });
                }}
              >
                Save vehicle
              </button>
            ) : null}
          </section>
          {current ? (
            <>
              <section>
                <h3 className="text-sm font-black">Compliance</h3>
                <ComplianceList book={props.book} subjectId={current.id} today={props.today} />
              </section>
              <section>
                <h3 className="text-sm font-black">Odometer</h3>
                <ul className="mb-2 space-y-1 text-sm">
                  {props.book.odometer_readings.filter((row) => row.vehicle_id === current.id).map((row) => (
                    <li key={row.id} className="tabular-nums">{formatKm(row.reading_km)} · <FleetDate value={row.read_at} /></li>
                  ))}
                </ul>
                {props.caps.canEditRegister ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-odometer-km" inputMode="decimal" value={odo} onChange={(event) => setOdo(event.target.value)} placeholder="Reading" />
                    <button
                      type="button"
                      className={`${fleetBtn} ${fleetFocus} shrink-0 whitespace-nowrap`}
                      data-testid="fleet-save-odometer"
                      disabled={!odoReady}
                      onClick={() => {
                        void commitOp(props, { op: 'odometer.add', payload: { vehicle_id: current.id, reading_km: Number(odo), read_at: props.today } }).then((saved) => {
                          if (saved) setOdo('');
                        });
                      }}
                    >
                      Add reading
                    </button>
                  </div>
                ) : null}
              </section>
              {props.caps.canEditRegister ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-black">Status</h3>
                  <label className={fleetLabel}>
                    Vehicle status
                    <select className={`${fleetField} ${fleetFocus}`} value={status} onChange={(event) => setStatus(event.target.value)}>
                      <option value="active">Active</option>
                      <option value="workshop">Workshop</option>
                      <option value="off_road">Off road</option>
                      <option value="sold">Sold</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className={`${fleetGhost} ${fleetFocus}`}
                    onClick={() => props.onOp?.({ op: 'vehicle.set_status', payload: { id: current.id, status } }, current.updated_at)}
                  >
                    Save status
                  </button>
                </section>
              ) : null}
              {props.caps.seesCosts ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-black">Costs and profile</h3>
                  <p className="text-sm text-slate-600">Purchase, standing costs and tyre mode live on the cost profile. The ledger is for fuel, tolls and maintenance.</p>
                  <label className={fleetLabel}>
                    Category
                    <select className={`${fleetField} ${fleetFocus}`} value={category} onChange={(event) => setCategory(event.target.value)}>
                      <option value="fuel">Fuel</option>
                      <option value="toll">Toll</option>
                      <option value="border">Border</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="tyres">Tyres</option>
                      <option value="other_running">Other running</option>
                      <option value="fine">Fine</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className={fleetLabel}>
                    Amount (rand)
                    <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-cost-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
                  </label>
                  <label className={fleetLabel}>
                    Date
                    <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-cost-date" type="date" value={costDate} onChange={(event) => setCostDate(event.target.value)} />
                  </label>
                  <label className={fleetLabel}>
                    VAT amount (rand)
                    <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={vatRand} onChange={(event) => setVatRand(event.target.value)} placeholder="Leave blank to use the workspace rate" />
                  </label>
                  <label className="mt-2 flex min-h-11 items-center gap-2 text-sm font-bold text-slate-800">
                    <input type="checkbox" checked={vatClaim} onChange={(event) => setVatClaim(event.target.checked)} />
                    VAT is claimable
                  </label>
                  {category === 'fuel' ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={fleetLabel}>
                        Litres
                        <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={litres} onChange={(event) => setLitres(event.target.value)} />
                      </label>
                      <label className={fleetLabel}>
                        Odometer at fill
                        <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={fuelOdo} onChange={(event) => setFuelOdo(event.target.value)} />
                      </label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-slate-800 sm:col-span-2">
                        <input type="checkbox" checked={fullTank} onChange={(event) => setFullTank(event.target.checked)} />
                        Full tank
                      </label>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={`${fleetBtn} ${fleetFocus}`}
                    data-testid="fleet-save-cost"
                    disabled={!costReady}
                    onClick={() => {
                      void commitOp(props, {
                        op: 'cost_entry.add',
                        payload: {
                          vehicle_id: current.id,
                          category,
                          amount_cents: amountCents,
                          vat_cents: vatRand.trim() === '' ? '' : vatCents,
                          occurred_on: costDate || props.today,
                          vat_claimable: vatClaim,
                          litres: category === 'fuel' && litres ? Number(litres) : null,
                          odometer_km: category === 'fuel' && fuelOdo ? Number(fuelOdo) : null,
                          full_tank: category === 'fuel' ? fullTank : false,
                        },
                      }).then((saved) => {
                        if (saved) {
                          setAmount('');
                          setVatRand('');
                        }
                      });
                    }}
                  >
                    Add cost entry
                  </button>
                  <ul className="space-y-1 text-sm">
                    {props.book.cost_entries.filter((row) => row.vehicle_id === current.id && !row.reverses_id).map((row) => {
                      const reversed = props.book.cost_entries.some((item) => item.reverses_id === row.id);
                      return (
                        <li key={row.id} className="flex items-center justify-between gap-2">
                          <span>{runningCategoryLabel(row.category)} · <FleetMoney cents={row.amount_cents} /></span>
                          {props.caps.canEditRegister && !reversed ? (
                            <button type="button" className={`${fleetGhost} ${fleetFocus}`} onClick={() => props.onOp?.({ op: 'cost_entry.reverse', payload: { vehicle_id: current.id, reverses_id: row.id } })}>
                              Reverse
                            </button>
                          ) : <span className="text-xs text-slate-500">{reversed ? 'Reversed' : ''}</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} onClick={() => setShowProfile((value) => !value)}>
                    Add a cost profile
                  </button>
                  {showProfile ? <ProfileForm {...props} vehicleId={current.id} /> : null}
                </section>
              ) : null}
              {props.caps.seesCosts ? <CpkCard metric={cpk.find((row) => row.vehicle_id === current.id) || null} caps={props.caps} /> : null}
            </>
          ) : null}
        </div>
      </FleetDrawer>
    </main>
  );
}

function CpkCard({ metric, caps }: { metric: VehicleCpk | null; caps: FleetCapabilities }) {
  if (!metric || metric.status !== 'ok') {
    return (
      <section data-testid="fleet-cpk-card">
        <h3 className="text-sm font-black">CPK card</h3>
        <p className="text-sm text-slate-600">{metric?.message || 'Not enough data'}</p>
        <p className="text-sm text-slate-600">{metric?.next_step}</p>
      </section>
    );
  }
  return (
    <section className="space-y-2" data-testid="fleet-cpk-card">
      <h3 className="text-sm font-black">CPK card</h3>
      <p className="text-lg font-black tabular-nums text-slate-900">{formatPerKm(metric.fully_loaded_per_km)}/km fully loaded</p>
      <p className="text-sm tabular-nums text-slate-600">Operating {formatPerKm(metric.operating_per_km)}/km · {distanceSourceLabel(metric.distance_source)}{metric.interpolated ? ' · estimated' : ''}</p>
      <FleetCompletenessChip completeness={metric.completeness} missing={metric.missing} />
      <FleetVariancePill status={metric.variance_status} />
      <ul className="text-sm text-slate-700">
        <li>Running <FleetMoney cents={metric.running_cents} /></li>
        <li>Standing <FleetMoney cents={metric.standing_cents} /></li>
        {caps.seesDriverPay ? null : <li className="text-slate-500">Driver pay is hidden for this role.</li>}
        <li>Capital <FleetMoney cents={metric.capital_cents} /></li>
        <li>Overhead <FleetMoney cents={metric.overhead_cents} /></li>
      </ul>
      <p className="text-sm tabular-nums">{metric.litres_per_100km == null ? 'Fuel efficiency not recorded' : formatLitresPer100(metric.litres_per_100km)}</p>
      {metric.distance_warnings.map((warning) => (
        <p key={warning} className="text-sm text-slate-600">{warning}</p>
      ))}
      {metric.next_step ? <p className="text-sm font-bold text-slate-800">Next: {metric.next_step}</p> : null}
    </section>
  );
}

function ComplianceList({ book, subjectId, today }: { book: FleetBook; subjectId: string; today: string }) {
  const rows = book.compliance.filter((row) => row.subject_id === subjectId);
  if (!rows.length) return <p className="text-sm text-slate-600">No dates yet.</p>;
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const state = complianceStatus(row.expires_on, today, book.workspace.expiring_window_days);
        const tone = state === 'expired' ? 'bad' : state === 'expiring' ? 'warn' : state === 'valid' ? 'ok' : 'muted';
        return (
          <li key={row.id}>
            <FleetStatusPill tone={tone}>{complianceKindLabel(row.kind)} · {complianceLabel(row.expires_on, today, book.workspace.expiring_window_days)}</FleetStatusPill>
          </li>
        );
      })}
    </ul>
  );
}

function DriversView(props: FleetDeskProps) {
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [employment, setEmployment] = useState('employee');
  const [licenceCode, setLicenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [expiry, setExpiry] = useState('');
  const [complianceKind, setComplianceKind] = useState('driver_licence');
  const [prdpCategory, setPrdpCategory] = useState('G');
  const current = props.book.drivers.find((row) => row.id === open);
  useEffect(() => {
    if (open == null) return;
    if (open === 'new' || !current) {
      setName('');
      setPhone('');
      setEmployment('employee');
      setLicenceCode('');
      setNotes('');
      setEmail('');
      return;
    }
    setName(current.full_name);
    setPhone(current.phone);
    setEmployment(current.employment);
    setLicenceCode(current.licence_code);
    setNotes(current.notes);
    setEmail(current.email);
  }, [open, current]);
  const rows = props.book.drivers.filter((row) => !row.archived_at);
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-drivers">
      <FleetPageHead
        title="Drivers"
        detail="Name, contact, employment and licence code. Identity numbers are not stored."
        illustration={props.illustrate}
        actions={
          props.caps.canEditRegister ? (
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-add-driver" onClick={() => { setOpen('new'); setName(''); }}>
              Add a driver
            </button>
          ) : null
        }
      />
      <Banners {...props} />
      {rows.length === 0 ? (
        <FleetEmpty
          title="No drivers yet"
          hint="Add a driver when you are ready. The form has no identity-number field."
          action={<button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>Add a driver</button>}
        />
      ) : (
        <FleetTable
          columns={['Name', 'Employment', 'Licence code', 'Status']}
          rows={rows.map((driver) => ({
            id: driver.id,
            cells: [
              <button key="n" type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} onClick={() => setOpen(driver.id)}>{driver.full_name}</button>,
              employmentLabel(driver.employment),
              driver.licence_code || '—',
              <FleetStatusPill key="s" tone={driver.status === 'active' ? 'ok' : 'muted'}>{driverStatusLabel(driver.status)}</FleetStatusPill>,
            ],
            card: (
              <button type="button" className="min-h-11 text-left" onClick={() => setOpen(driver.id)}>
                <p className="font-black">{driver.full_name}</p>
                <p className="text-sm text-slate-600">{driverStatusLabel(driver.status)} · {employmentLabel(driver.employment)}</p>
                <p className="text-sm text-slate-600">Next due {nextDue(props.book, driver.id, props.today)}</p>
              </button>
            ),
          }))}
        />
      )}
      <FleetDrawer open={open != null} title={current ? current.full_name : 'New driver'} onClose={() => setOpen(null)}>
        <label className={fleetLabel}>
          Name
          <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-driver-name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className={fleetLabel}>
          Phone
          <input className={`${fleetField} ${fleetFocus}`} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className={fleetLabel}>
          Employment
          <select className={`${fleetField} ${fleetFocus}`} value={employment} onChange={(event) => setEmployment(event.target.value)}>
            <option value="employee">Employee</option>
            <option value="contractor">Contractor</option>
            <option value="owner_operator">Owner-operator</option>
          </select>
        </label>
        <label className={fleetLabel}>
          Licence code
          <input className={`${fleetField} ${fleetFocus}`} value={licenceCode} onChange={(event) => setLicenceCode(event.target.value)} placeholder="EC" />
        </label>
        <label className={fleetLabel}>
          Notes
          <input className={`${fleetField} ${fleetFocus}`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {props.caps.canEditRegister ? (
          <button
            type="button"
            className={`${fleetBtn} ${fleetFocus} mt-3`}
            data-testid="fleet-save-driver"
            onClick={() => {
              props.onOp?.(
                {
                  op: 'driver.upsert',
                  payload: {
                    id: current?.id,
                    full_name: name,
                    phone,
                    notes,
                    email,
                    employment,
                    licence_code: licenceCode,
                    status: current?.status || 'active',
                  },
                },
                current?.updated_at
              );
              setOpen(null);
            }}
          >
            Save driver
          </button>
        ) : null}
        {current ? (
          <section className="mt-4 space-y-2">
            <h3 className="text-sm font-black">Dates</h3>
            <ComplianceList book={props.book} subjectId={current.id} today={props.today} />
            {props.caps.canEditRegister ? (
              <>
                <label className={fleetLabel}>
                  Date kind
                  <select className={`${fleetField} ${fleetFocus}`} value={complianceKind} onChange={(event) => setComplianceKind(event.target.value)}>
                    <option value="driver_licence">Driving licence</option>
                    <option value="prdp">PrDP</option>
                    <option value="medical">Medical</option>
                    <option value="induction">Induction</option>
                  </select>
                </label>
                {complianceKind === 'prdp' ? (
                  <label className={fleetLabel}>
                    PrDP category
                    <input className={`${fleetField} ${fleetFocus}`} value={prdpCategory} onChange={(event) => setPrdpCategory(event.target.value)} />
                  </label>
                ) : null}
                <label className={fleetLabel}>
                  {complianceKindLabel(complianceKind)} expiry
                  <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-compliance-expiry" type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
                </label>
                <button
                  type="button"
                  className={`${fleetBtn} ${fleetFocus}`}
                  data-testid="fleet-save-compliance"
                  disabled={!expiry}
                  onClick={() => {
                    const existing = props.book.compliance.find((row) => row.subject_id === current.id && row.kind === complianceKind && !row.archived_at);
                    void commitOp(
                      props,
                      {
                        op: 'compliance.upsert',
                        payload: {
                          id: existing?.id,
                          subject_kind: 'driver',
                          subject_id: current.id,
                          kind: complianceKind,
                          expires_on: expiry,
                          detail: complianceKind === 'prdp' ? { category: prdpCategory } : {},
                        },
                      },
                      existing?.updated_at
                    ).then((saved) => {
                      if (saved) setExpiry('');
                    });
                  }}
                >
                  Save date
                </button>
              </>
            ) : null}
          </section>
        ) : null}
      </FleetDrawer>
    </main>
  );
}

function JobsView(props: FleetDeskProps) {
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [filter, setFilter] = useState('all');
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [jobStatus, setJobStatus] = useState('draft');
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [cargo, setCargo] = useState('');
  const [cargoKg, setCargoKg] = useState('');
  const [dangerous, setDangerous] = useState(false);
  const [abnormal, setAbnormal] = useState(false);
  const [crossBorder, setCrossBorder] = useState(false);
  const [price, setPrice] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [stops, setStops] = useState<Array<{ id?: string; kind: string; place_name: string }>>([
    { kind: 'pickup', place_name: '' },
    { kind: 'delivery', place_name: '' },
  ]);
  const current = props.book.jobs.find((row) => row.id === open);
  useEffect(() => {
    if (open == null) return;
    if (open === 'new' || !current) {
      setCustomerId('');
      setNewCustomer('');
      setJobStatus('draft');
      setAddingCustomer(false);
      setCargo('');
      setCargoKg('');
      setDangerous(false);
      setAbnormal(false);
      setCrossBorder(false);
      setPrice('');
      setVehicleId('');
      setDriverId('');
      setStops([
        { kind: 'pickup', place_name: '' },
        { kind: 'delivery', place_name: '' },
      ]);
      setDraftFor(String(open));
      return;
    }
    setCustomerId(current.customer_id == null ? '' : String(current.customer_id));
    setNewCustomer('');
    setJobStatus(current.status);
    setAddingCustomer(false);
    setCargo(current.cargo_description);
    setCargoKg(current.cargo_kg == null ? '' : String(current.cargo_kg));
    setDangerous(current.dangerous_goods);
    setAbnormal(current.abnormal);
    setCrossBorder(current.cross_border);
    setPrice(current.price_cents == null ? '' : String(current.price_cents / 100));
    setVehicleId(current.vehicle_id || '');
    setDriverId(current.driver_id || '');
    const existing = props.book.stops.filter((stop) => stop.job_id === current.id);
    setStops(existing.length ? existing.map((stop) => ({ id: stop.id, kind: stop.kind, place_name: stop.place_name })) : [{ kind: 'pickup', place_name: '' }]);
    setDraftFor(String(open));
  }, [open, current, props.book.stops]);
  const rows = props.book.jobs.filter((job) => !job.archived_at && (filter === 'all' || job.status === filter));
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-jobs">
      <FleetPageHead
        title="Jobs"
        detail="A job holds the customer, the stops and the cargo. Dispatch and proof of delivery are not switched on."
        illustration={props.illustrate}
        actions={
          props.caps.canEditRegister ? (
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>Create a job</button>
          ) : null
        }
      />
      <Banners {...props} />
      <FleetSegmented
        label="Job status"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All' },
          { id: 'draft', label: 'Draft' },
          { id: 'booked', label: 'Booked' },
          { id: 'cancelled', label: 'Cancelled' },
        ]}
      />
      {rows.length === 0 ? (
        <FleetEmpty
          title="No jobs yet"
          hint="Create a job with a pickup and a delivery. Assignment comes later."
          action={<button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>Create a job</button>}
        />
      ) : (
        <FleetTable
          columns={['Reference', 'Customer', 'Status', ...(props.caps.seesRates ? ['Price'] : [])]}
          rows={rows.map((job) => ({
            id: job.id,
            cells: [
              <button key="r" type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} onClick={() => setOpen(job.id)}>{job.reference}</button>,
              job.customer_name || '—',
              <FleetStatusPill key="s" tone={job.status === 'cancelled' ? 'muted' : 'ok'}>{jobStatusLabel(job.status)}</FleetStatusPill>,
              ...(props.caps.seesRates ? [<FleetMoney key="p" cents={job.price_cents} />] : []),
            ],
            card: (
              <button type="button" className="min-h-11 text-left" onClick={() => setOpen(job.id)}>
                <p className="font-black">{job.reference}</p>
                <p className="text-sm text-slate-600">{jobStatusLabel(job.status)} · {props.book.vehicles.find((row) => row.id === job.vehicle_id)?.reg_no || 'No vehicle'}</p>
                <p className="text-sm text-slate-600">{job.customer_name || 'No customer yet'}</p>
              </button>
            ),
          }))}
        />
      )}
      <FleetSection title="Still to come">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FleetSoonChip />
            <DispatchArt />
          </div>
          <div>
            <FleetSoonChip />
            <PodArt />
          </div>
        </div>
      </FleetSection>
      <FleetDrawer open={open != null} title={current ? current.reference : 'New job'} onClose={() => setOpen(null)} testId="fleet-job-drawer">
        {draftFor !== String(open) ? null : (
        <div key={String(open)}>
        <label className={fleetLabel}>
          Customer
          <select
            className={`${fleetField} ${fleetFocus}`}
            value={addingCustomer ? '__new' : customerId}
            onChange={(event) => {
              if (event.target.value === '__new') {
                setAddingCustomer(true);
                setCustomerId('');
                return;
              }
              setAddingCustomer(false);
              setCustomerId(event.target.value);
            }}
          >
            <option value="">Choose a customer from this company</option>
            {props.book.customers.map((row) => (
              <option key={row.id} value={String(row.id)}>{row.trading_name}</option>
            ))}
            <option value="__new">Add a customer</option>
          </select>
        </label>
        {addingCustomer ? (
          <label className={fleetLabel}>
            New customer name
            <input className={`${fleetField} ${fleetFocus}`} value={newCustomer} onChange={(event) => setNewCustomer(event.target.value)} />
          </label>
        ) : null}
        <label className={fleetLabel}>
          Status
          <select className={`${fleetField} ${fleetFocus}`} value={jobStatus} onChange={(event) => setJobStatus(event.target.value)}>
            <option value="draft">Draft</option>
            <option value="booked">Booked</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className={fleetLabel}>
          Cargo
          <input className={`${fleetField} ${fleetFocus}`} value={cargo} onChange={(event) => setCargo(event.target.value)} />
        </label>
        <label className={fleetLabel}>
          Cargo kg
          <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={cargoKg} onChange={(event) => setCargoKg(event.target.value)} />
        </label>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={dangerous} onChange={(event) => setDangerous(event.target.checked)} /> Dangerous goods</label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={abnormal} onChange={(event) => setAbnormal(event.target.checked)} /> Abnormal load</label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={crossBorder} onChange={(event) => setCrossBorder(event.target.checked)} /> Cross-border</label>
        <label className={fleetLabel}>
          Vehicle
          <select className={`${fleetField} ${fleetFocus}`} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">Unassigned</option>
            {props.book.vehicles.filter((row) => !row.archived_at).map((row) => (
              <option key={row.id} value={row.id}>{row.reg_no}</option>
            ))}
          </select>
        </label>
        <label className={fleetLabel}>
          Driver
          <select className={`${fleetField} ${fleetFocus}`} value={driverId} onChange={(event) => setDriverId(event.target.value)}>
            <option value="">Unassigned</option>
            {props.book.drivers.filter((row) => !row.archived_at).map((row) => (
              <option key={row.id} value={row.id}>{row.full_name}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 space-y-2">
          <h3 className="text-sm font-black">Stops</h3>
          {stops.map((stop, index) => (
            <div key={`${stop.kind}-${index}`} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
              <select
                className={`${fleetField} ${fleetFocus}`}
                value={stop.kind}
                onChange={(event) => setStops((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.target.value } : item))}
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
                <option value="via">Via</option>
              </select>
              <input
                className={`${fleetField} ${fleetFocus}`}
                value={stop.place_name}
                placeholder="Place"
                onChange={(event) => setStops((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, place_name: event.target.value } : item))}
              />
            </div>
          ))}
          <button type="button" className={`${fleetGhost} ${fleetFocus}`} onClick={() => setStops((rows) => [...rows, { kind: 'via', place_name: '' }])}>Add a stop</button>
        </div>
        {props.caps.seesRates ? (
          <label className={fleetLabel}>
            Price (rand)
            <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
        ) : <p className="mt-2 text-sm text-slate-600">Prices are hidden for this role.</p>}
        {props.caps.canEditRegister ? (
          <button
            type="button"
            className={`${fleetBtn} ${fleetFocus} mt-3`}
            disabled={(price.trim() !== '' && (centsFromRand(price) == null || (centsFromRand(price) || 0) <= 0)) || (addingCustomer && !newCustomer.trim())}
            onClick={() => {
              const payload: Record<string, unknown> = {
                id: current?.id,
                cargo_description: cargo,
                cargo_kg: cargoKg ? Number(cargoKg) : null,
                dangerous_goods: dangerous,
                abnormal,
                cross_border: crossBorder,
                vehicle_id: vehicleId || null,
                driver_id: driverId || null,
                stops: stops.filter((stop) => stop.place_name.trim()),
              };
              const chosen = props.book.customers.find((row) => String(row.id) === customerId);
              payload.customer_id = addingCustomer || !customerId ? null : Number(customerId);
              payload.customer_name = addingCustomer ? '' : chosen?.trading_name || '';
              payload.new_customer_name = addingCustomer ? newCustomer : '';
              payload.status = jobStatus;
              if (props.caps.seesRates) payload.price_cents = price.trim() === '' ? null : centsFromRand(price);
              void commitOp(props, { op: 'job.upsert', payload }, current?.updated_at).then((saved) => {
                if (saved) setOpen(null);
              });
            }}
          >
            Save job
          </button>
        ) : null}
        </div>
        )}
      </FleetDrawer>
    </main>
  );
}

function CpkView(props: FleetDeskProps) {
  const cpk = useCpk(props);
  const vehicles = props.book.vehicles.filter((row) => !row.archived_at);
  const withReadings = vehicles.filter((vehicle) => props.book.odometer_readings.filter((row) => row.vehicle_id === vehicle.id).length >= 2).length;
  const missingProfiles = vehicles.filter((vehicle) => !props.book.cost_profiles.some((row) => row.vehicle_id === vehicle.id)).length;
  const period = periodFor(props.periodId, props.today, props.book.workspace.cpk_window_days);
  const poolMonth = `${period.from.slice(0, 7)}-01`;
  const hasPool = props.book.overhead_pools.some((row) => {
    const start = `${row.period_month.slice(0, 7)}-01`;
    const end = nextMonth(start);
    return start < period.to && end > period.from;
  });
  const fleet = fleetRollup(cpk, props.periodId, props.book.workspace.cpk_window_days);
  const ready = cpk.filter((row) => row.status === 'ok');
  const loadedKm = ready.reduce((sum, row) => sum + (row.loaded_km || 0), 0);
  const fleetCents = ready.reduce((sum, row) => sum + (row.total_cents || 0), 0);
  const fleetBreakeven = loadedKm > 0 ? fleetCents / loadedKm / 100 : null;
  const tripDays = ready.reduce((sum, row) => sum + (row.utilisation?.trip_days || 0), 0);
  const availableDays = ready.reduce((sum, row) => sum + (row.utilisation?.available_days || 0), 0);
  const margin = props.book.workspace.required_margin_bps / 10000;
  const fleetVariance = fleet.perKm != null && fleet.target != null ? fleet.perKm - fleet.target : null;
  const fleetVarianceStatus = fleetVariance == null ? 'no_target' : Math.abs(fleetVariance) < 0.005 ? 'on_target' : fleetVariance > 0 ? 'over' : 'under';
  const unallocated = cpk.find((row) => (row.overhead_unallocated_cents || 0) > 0)?.overhead_unallocated_cents ?? null;
  if (!props.caps.seesCosts) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4" data-testid="fleet-cpk">
        <FleetPageHead title="CPK" detail="Cost per kilometre is hidden for this role." illustration={props.illustrate} />
        <FleetEmpty
          title="Nothing to show here"
          hint="An owner or office role can open cost per kilometre. You can still work with vehicles, drivers and jobs."
          action={<Link className={`${fleetBtn} ${fleetFocus}`} href={props.hrefBase}>Back to command</Link>}
        />
      </main>
    );
  }
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-cpk">
      <FleetPageHead
        title="CPK"
        detail="Fully loaded cost per kilometre from your own ledger, profiles and targets. No outside benchmark."
        illustration={props.illustrate}
      />
      <Banners {...props} />
      <FleetSegmented
        label="Period"
        value={props.periodId}
        onChange={(id) => props.onPeriod?.(id as PeriodId)}
        options={[
          { id: 'mtd', label: 'Month to date' },
          { id: 'last', label: 'Last full month' },
          { id: 'trail', label: `Trailing ${props.book.workspace.cpk_window_days} days` },
        ]}
      />
      {vehicles.length === 0 ? (
        <FleetEmpty
          title="No cost per kilometre yet"
          hint="Add a vehicle and a cost profile. Until then the sample waterfall below is only an illustration."
          illustration={<CpkWaterfallArt />}
          action={<Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>Add a vehicle</Link>}
        />
      ) : (
        <>
          <div className="rounded-3xl border border-[#00b4d8]/40 bg-[#00b4d8]/10 p-4 shadow-sm" data-testid="fleet-cpk-headline">
            <p className="text-xs font-black uppercase tracking-wide text-[#0077b6]">Fleet fully loaded</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-[#0f172a]" data-testid="fleet-cpk-value">{fleet.value}</p>
            <p className="text-sm text-slate-600">{fleet.hint}. Per-vehicle figures are in the table.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
              <span>Fleet target {formatPerKm(fleet.target)}/km</span>
              <FleetVariancePill status={fleetVarianceStatus} delta={signedPerKm(fleetVariance)} />
              <span>Fleet breakeven {formatPerKm(fleetBreakeven)}/loaded km</span>
              <span>Required {formatPerKm(requiredRate(fleetBreakeven, margin))}/km</span>
              <span>Fleet utilisation {availableDays ? `${tripDays}/${availableDays}` : '—'}</span>
            </div>
            {unallocated != null ? <p className="mt-2 text-sm font-bold text-slate-800">Unallocated overhead <FleetMoney cents={unallocated} /></p> : null}
          </div>
          <FleetTable
            columns={['Vehicle', 'CPK', 'Variance', 'Source', 'L/100 km']}
            rows={vehicles.map((vehicle) => {
              const metric = cpk.find((row) => row.vehicle_id === vehicle.id);
              return {
                id: vehicle.id,
                cells: [
                  vehicle.reg_no,
                  metric?.status === 'ok' ? `${formatPerKm(metric.fully_loaded_per_km)}/km` : metric?.message || 'Not enough data',
                  <FleetVariancePill key="v" status={metric?.variance_status || 'no_target'} delta={signedPerKm(metric?.variance_per_km ?? null)} />,
                  distanceSourceLabel(metric?.distance_source || 'none'),
                  formatLitresPer100(metric?.litres_per_100km),
                ],
                card: (
                  <div>
                    <p className="font-black">{vehicle.reg_no}</p>
                    <p className="tabular-nums text-sm">{metric?.status === 'ok' ? `${formatPerKm(metric.fully_loaded_per_km)}/km` : 'Not enough data'}</p>
                    <FleetCompletenessChip completeness={metric?.completeness || 'none'} missing={metric?.missing} />
                  </div>
                ),
              };
            })}
          />
          <FleetSection title="Data completeness">
            <ul className="space-y-2 text-sm font-bold text-slate-800">
              <li>{withReadings} of {vehicles.length} vehicles have two odometer readings. <Link className={fleetLink} href={`${props.hrefBase}/vehicles`}>Add a reading</Link></li>
              <li>{missingProfiles === 0 ? 'Every vehicle has a cost profile.' : `No cost profile for ${missingProfiles} ${missingProfiles === 1 ? 'vehicle' : 'vehicles'}.`} <button type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} onClick={() => document.getElementById('fleet-profile-form')?.scrollIntoView({ behavior: 'smooth' })}>Add a cost profile</button></li>
              <li>{hasPool ? 'An overhead pool covers this period.' : 'No overhead pool covers this period.'}</li>
            </ul>
          </FleetSection>
          {props.caps.canEditSettings ? (
            <FleetSection title="Target and overhead">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <TargetOverheadForm {...props} poolMonth={poolMonth} periodFrom={period.from} />
              </div>
              <div id="fleet-profile-form" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <ProfileForm {...props} />
              </div>
            </FleetSection>
          ) : null}
        </>
      )}
      <details className="rounded-3xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-black">How this is calculated</summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
          <p>Running costs come from the ledger on the day they happened: fuel, tolls, maintenance and tyres. Standing costs and capital accrue from the vehicle profile for each day the vehicle is in the fleet, including workshop days. Overhead is a monthly pool shared by vehicle-days, kilometres or revenue.</p>
          <p>Distance uses completed trip readings when they exist, otherwise odometer pairs, otherwise GPS-derived distance. Planned kilometres are never used. A partial result names what is still missing. Targets are yours. There is no external benchmark.</p>
        </div>
      </details>
    </main>
  );
}

function SettingsView(props: FleetDeskProps) {
  const [phrase, setPhrase] = useState('');
  const [name, setName] = useState(props.book.workspace.display_name);
  const [retention, setRetention] = useState(String(props.book.workspace.retention_days ?? 1825));
  const [marginPct, setMarginPct] = useState(String(props.book.workspace.required_margin_bps / 100));
  if (!props.caps.canEditSettings && props.role !== 'owner' && props.role !== 'manager') {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4" data-testid="fleet-settings">
        <FleetPageHead title="Settings" detail="Settings are read-only for this role." illustration={props.illustrate} />
        <FleetEmpty
          title="You can look, not change"
          hint="An owner or manager edits the workspace. Your role still sees the explainer below."
          action={<Link className={`${fleetBtn} ${fleetFocus}`} href={props.hrefBase}>Back to command</Link>}
        />
        <RoleExplainer />
      </main>
    );
  }
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-settings">
      <FleetPageHead title="Settings" detail="Workspace, expiry window, cost settings and who can see prices." illustration={props.illustrate} />
      <Banners {...props} />
      <FleetSection title="Workspace">
        <label className={fleetLabel}>
          Display name
          <input className={`${fleetField} ${fleetFocus}`} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className={`${fleetLabel} mt-3`}>
          Required rate margin (%)
          <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={marginPct} onChange={(event) => setMarginPct(event.target.value)} />
        </label>
        <p className="mt-1 text-sm text-slate-600">Added on top of fleet breakeven when the desk shows the required rate. 10 means 10%.</p>
        <button
          type="button"
          className={`${fleetBtn} ${fleetFocus} mt-3`}
          onClick={() =>
            props.onOp?.(
              { op: 'settings.update', payload: { display_name: name, expiring_window_days: props.book.workspace.expiring_window_days, cpk_window_days: props.book.workspace.cpk_window_days, cpk_min_km: props.book.workspace.cpk_min_km, required_margin_bps: Math.round(Number(marginPct) * 100) } },
              props.book.workspace.updated_at
            )
          }
        >
          Save settings
        </button>
      </FleetSection>
      <FleetSection title="What each role can do">
        <RoleExplainer />
      </FleetSection>
      {props.caps.canOwnerSwitches ? (
        <FleetSection title="Owner switches">
          <p className="text-sm text-slate-600">Dispatchers see job prices only when you turn that on. It is off to start.</p>
          <button
            type="button"
            className={`${fleetGhost} ${fleetFocus} mt-2`}
            onClick={() =>
              props.onOp?.(
                { op: 'settings.update', payload: { dispatcher_sees_rates: !props.book.workspace.dispatcher_sees_rates } },
                props.book.workspace.updated_at
              )
            }
          >
            {props.book.workspace.dispatcher_sees_rates ? 'Hide prices from dispatchers' : 'Let dispatchers see prices'}
          </button>
          <label className={`${fleetLabel} mt-3`}>
            Suggested holding period (days)
            <input className={`${fleetField} ${fleetFocus}`} inputMode="numeric" value={retention} onChange={(event) => setRetention(event.target.value)} />
          </label>
          <button
            type="button"
            className={`${fleetGhost} ${fleetFocus} mt-2`}
            onClick={() => props.onOp?.({ op: 'settings.update', payload: { retention_days: Number(retention) } }, props.book.workspace.updated_at)}
          >
            Save holding period
          </button>
          <label className={`${fleetLabel} mt-4`}>
            Type ENABLE REAL DATA to leave demo-data mode
            <input className={`${fleetField} ${fleetFocus}`} value={phrase} onChange={(event) => setPhrase(event.target.value)} />
          </label>
          <button type="button" className={`${fleetBtn} ${fleetFocus} mt-3`} onClick={() => props.onOp?.({ op: 'real_data.confirm', payload: { phrase } })}>
            Confirm real data
          </button>
        </FleetSection>
      ) : (
        <p className="text-sm text-slate-600">Retention, price visibility and the real-data switch are owner-only.</p>
      )}
    </main>
  );
}

function nextDue(book: FleetBook, subjectId: string, today: string): string {
  const rows = book.compliance.filter((row) => row.subject_id === subjectId && row.expires_on);
  if (!rows.length) return '—';
  const next = [...rows].sort((a, b) => String(a.expires_on).localeCompare(String(b.expires_on)))[0];
  return complianceLabel(next.expires_on, today, book.workspace.expiring_window_days);
}

function LayerBar({ metric }: { metric: VehicleCpk }) {
  const parts = [
    { label: 'Running', cents: metric.running_cents || 0, color: '#00b4d8' },
    { label: 'Standing', cents: metric.standing_cents || 0, color: '#0077b6' },
    { label: 'Capital', cents: metric.capital_cents || 0, color: '#0f172a' },
    { label: 'Overhead', cents: metric.overhead_cents || 0, color: '#64748b' },
  ];
  const total = parts.reduce((sum, part) => sum + part.cents, 0) || 1;
  return (
    <div className="mt-4" data-testid="fleet-cpk-layers">
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
        {parts.map((part) => (
          <div key={part.label} style={{ width: `${(part.cents / total) * 100}%`, background: part.color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-700">
        {parts.map((part) => (
          <li key={part.label} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: part.color }} />
            {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TargetOverheadForm(props: FleetDeskProps & { poolMonth: string; periodFrom: string }) {
  const [targetRand, setTargetRand] = useState('');
  const [targetFrom, setTargetFrom] = useState(props.periodFrom);
  const [scope, setScope] = useState('fleet');
  const [classRef, setClassRef] = useState('rigid');
  const [overheadRand, setOverheadRand] = useState('');
  const targetCents = centsFromRand(targetRand);
  const poolCents = centsFromRand(overheadRand);
  const pool = props.book.overhead_pools.find((row) => row.period_month.slice(0, 7) === props.poolMonth.slice(0, 7));
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Targets are this company&apos;s own figures, in rand per kilometre.</p>
      <label className={fleetLabel}>
        Target scope
        <select className={`${fleetField} ${fleetFocus}`} value={scope} onChange={(event) => setScope(event.target.value)}>
          <option value="fleet">Whole fleet</option>
          <option value="vehicle_class">Vehicle class</option>
        </select>
      </label>
      {scope === 'vehicle_class' ? (
        <label className={fleetLabel}>
          Vehicle class
          <select className={`${fleetField} ${fleetFocus}`} value={classRef} onChange={(event) => setClassRef(event.target.value)}>
            {['rigid', 'tractor', 'trailer', 'tipper', 'van', 'other'].map((kind) => (
              <option key={kind} value={kind}>{vehicleKindLabel(kind)}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={fleetLabel}>
        Target (rand per km)
        <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={targetRand} onChange={(event) => setTargetRand(event.target.value)} placeholder="15.50" />
      </label>
      <label className={fleetLabel}>
        Effective from · {formatSastDate(targetFrom)}
        <input className={`${fleetField} ${fleetFocus}`} type="date" value={targetFrom} onChange={(event) => setTargetFrom(event.target.value)} />
      </label>
      <button
        type="button"
        className={`${fleetBtn} ${fleetFocus}`}
        disabled={targetCents == null || targetCents <= 0}
        onClick={() =>
          props.onOp?.({
            op: 'cpk_target.set',
            payload: {
              scope_kind: scope,
              scope_ref: scope === 'vehicle_class' ? classRef : '',
              layer: 'fully_loaded',
              target_cents_per_km: targetCents,
              effective_from: targetFrom || props.periodFrom,
            },
          })
        }
      >
        Save target
      </button>
      <label className={fleetLabel}>
        Monthly overhead pool (rand)
        <input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={overheadRand} onChange={(event) => setOverheadRand(event.target.value)} placeholder="0.00" />
      </label>
      <button
        type="button"
        className={`${fleetGhost} ${fleetFocus}`}
        disabled={poolCents == null || poolCents <= 0}
        onClick={() =>
          props.onOp?.(
            {
              op: 'overhead_pool.set',
              payload: {
                period_month: props.poolMonth,
                amount_cents: poolCents,
                basis: props.book.workspace.overhead_basis,
              },
            },
            pool?.updated_at
          )
        }
      >
        Save overhead pool
      </button>
    </div>
  );
}

function ProfileForm(props: FleetDeskProps & { vehicleId?: string }) {
  const [vehicleId, setVehicleId] = useState(props.vehicleId || props.book.vehicles[0]?.id || '');
  const [finance, setFinance] = useState('');
  const [insurance, setInsurance] = useState('');
  const [licences, setLicences] = useState('');
  const [tracker, setTracker] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [purchase, setPurchase] = useState('');
  const [life, setLife] = useState('60');
  const [from, setFrom] = useState(props.today);
  useEffect(() => {
    if (props.vehicleId) setVehicleId(props.vehicleId);
  }, [props.vehicleId]);
  if (!props.book.vehicles.length) return <p className="text-sm text-slate-600">Add a vehicle before a cost profile.</p>;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black">Cost profile</h3>
      {props.vehicleId ? null : (
        <label className={fleetLabel}>
          Vehicle
          <select className={`${fleetField} ${fleetFocus}`} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            {props.book.vehicles.map((row) => (
              <option key={row.id} value={row.id}>{row.reg_no}</option>
            ))}
          </select>
        </label>
      )}
      <label className={fleetLabel}>Effective from · {formatSastDate(from)}<input className={`${fleetField} ${fleetFocus}`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className={fleetLabel}>Purchase price (rand)<input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={purchase} onChange={(event) => setPurchase(event.target.value)} /></label>
      <label className={fleetLabel}>Life (months)<input className={`${fleetField} ${fleetFocus}`} inputMode="numeric" value={life} onChange={(event) => setLife(event.target.value)} /></label>
      <label className={fleetLabel}>Finance each month (rand)<input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={finance} onChange={(event) => setFinance(event.target.value)} /></label>
      <label className={fleetLabel}>Insurance each year (rand)<input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={insurance} onChange={(event) => setInsurance(event.target.value)} /></label>
      <label className={fleetLabel}>Licences each year (rand)<input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={licences} onChange={(event) => setLicences(event.target.value)} /></label>
      <label className={fleetLabel}>Tracker each month (rand)<input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={tracker} onChange={(event) => setTracker(event.target.value)} /></label>
      {props.caps.seesDriverPay ? (
        <label className={fleetLabel}>Driver cost each month (rand)<input className={`${fleetField} ${fleetFocus}`} inputMode="decimal" value={driverPay} onChange={(event) => setDriverPay(event.target.value)} /></label>
      ) : (
        <p className="text-sm text-slate-600">Driver pay is hidden for this role.</p>
      )}
      <button
        type="button"
        className={`${fleetBtn} ${fleetFocus}`}
        disabled={[purchase, finance, insurance, licences, tracker, driverPay].some((value) => value.trim() !== '' && centsFromRand(value) == null)}
        onClick={() =>
          props.onOp?.({
            op: 'cost_profile.set',
            payload: {
              vehicle_id: vehicleId,
              effective_from: from,
              depreciation_method: 'time',
              life_months: Number(life) || 60,
              purchase_price_cents: purchase.trim() === '' ? null : centsFromRand(purchase),
              finance_monthly_cents: finance.trim() === '' ? 0 : centsFromRand(finance),
              insurance_annual_cents: insurance.trim() === '' ? 0 : centsFromRand(insurance),
              licences_annual_cents: licences.trim() === '' ? 0 : centsFromRand(licences),
              tracker_monthly_cents: tracker.trim() === '' ? 0 : centsFromRand(tracker),
              driver_cost_monthly_cents: props.caps.seesDriverPay ? (driverPay.trim() === '' ? 0 : centsFromRand(driverPay)) : 0,
              tyre_mode: 'accrual',
            },
          })
        }
      >
        Save cost profile
      </button>
    </div>
  );
}

function RoleExplainer() {
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      <li><span className="font-black">Owner</span> — fleet, costs, prices, settings, real-data confirmation.</li>
      <li><span className="font-black">Manager</span> — fleet and costs. No invoicing and no real-data switch.</li>
      <li><span className="font-black">Dispatcher</span> — vehicles, drivers and jobs. No costs. Prices only if the owner allows them.</li>
      <li><span className="font-black">Office</span> — reads costs and prices. Driver pay stays hidden.</li>
      <li><span className="font-black">Viewer</span> — reads the register and prices. No costs.</li>
    </ul>
  );
}
